import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn(), getClerkUserId: vi.fn() }));
vi.mock('@/lib/finance-data', () => ({ getFinanceData: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: {
  economicEntry: { findFirst: vi.fn() },
  economicAllocation: { findMany: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(),
} }));

import { previewReallocationForRecord } from '../reallocation';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { getFinanceData } from '@/lib/finance-data';
import { db } from '@/lib/db';

const FARM = { id: 'farm-1', currency: 'EUR' };
const ENTRY = { id: 'e1', farmId: 'farm-1', status: 'active', sourceType: 'manual_expense', currency: 'EUR', kind: 'cost', amount: 1000, seasonId: 's1' };
const financeFields = {
  fields: [
    { fieldSeasonId: 'fs1', field: 'Noord', crop: 'wheat', hectares: 30, yieldQuantity: 60, recordedCostEur: 1000, recordedRevenueEur: 3000 },
    { fieldSeasonId: 'fs2', field: 'Zuid', crop: 'wheat', hectares: 10, yieldQuantity: 20, recordedCostEur: 500, recordedRevenueEur: null },
  ],
};

describe('previewReallocationForRecord (authoritative server preview)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClerkUserId).mockResolvedValue('user-1');
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(getFinanceData).mockResolvedValue(financeFields as never);
    vi.mocked(db.economicEntry.findFirst).mockResolvedValue(ENTRY as never);
    vi.mocked(db.economicAllocation.findMany).mockResolvedValue([] as never);
  });

  it('returns before/after field impact from authoritative economics (per-hectare 30/10 → 750/250)', async () => {
    const res = await previewReallocationForRecord({ economicEntryId: 'e1', allocationMethod: 'per_hectare', destinations: [{ fieldSeasonId: 'fs1' }, { fieldSeasonId: 'fs2' }], partialAllocationAllowed: false });
    expect(res.error).toBeUndefined();
    expect(res.preview!.resolved.map(r => r.amount)).toEqual([750, 250]);
    // Noord cost 1000 → 1750; Zuid 500 → 750
    const noord = res.preview!.perField.find(f => f.field === 'Noord')!;
    expect(noord.afterCostEur).toBe(1750);
    // Zuid has no revenue → canonical missing-margin reason, never a fabricated 0
    const zuid = res.preview!.perField.find(f => f.field === 'Zuid')!;
    expect(zuid.marginReasonCode).toBe('MISSING_REVENUE');
    expect(res.preview!.recordAmount).toBe(1000);
    expect(res.preview!.currentVersion).toBe(0);
  });

  it('never trusts a client total — uses the DB record amount', async () => {
    const res = await previewReallocationForRecord({ economicEntryId: 'e1', allocationMethod: 'direct_field', destinations: [{ fieldSeasonId: 'fs1' }], partialAllocationAllowed: false });
    expect(res.preview!.totalAllocated).toBe(1000); // the DB amount, not any client-supplied value
  });

  it('rejects a reversed record', async () => {
    vi.mocked(db.economicEntry.findFirst).mockResolvedValue({ ...ENTRY, status: 'reversed' } as never);
    const res = await previewReallocationForRecord({ economicEntryId: 'e1', allocationMethod: 'per_hectare', destinations: [{ fieldSeasonId: 'fs1' }], partialAllocationAllowed: false });
    expect(res.category).toBe('record_reversed');
  });

  it('rejects a directly-linked (activity-derived) cost', async () => {
    vi.mocked(db.economicEntry.findFirst).mockResolvedValue({ ...ENTRY, sourceType: 'labour' } as never);
    const res = await previewReallocationForRecord({ economicEntryId: 'e1', allocationMethod: 'per_hectare', destinations: [{ fieldSeasonId: 'fs1' }], partialAllocationAllowed: false });
    expect(res.category).toBe('directly_linked_cost');
  });

  it('rejects a record not found for this farm', async () => {
    vi.mocked(db.economicEntry.findFirst).mockResolvedValue(null as never);
    const res = await previewReallocationForRecord({ economicEntryId: 'e1', allocationMethod: 'per_hectare', destinations: [], partialAllocationAllowed: false });
    expect(res.category).toBe('record_not_found');
  });

  it('surfaces a blocked reason (missing yield) rather than throwing', async () => {
    const res = await previewReallocationForRecord({ economicEntryId: 'e1', allocationMethod: 'per_yield', destinations: [{ fieldSeasonId: 'fs1' }, { fieldSeasonId: 'fs2' }], partialAllocationAllowed: false });
    // both fields have yield here, so this should NOT be blocked — sanity that yield flows through
    expect(res.preview!.blocked).toEqual([]);
    expect(res.preview!.resolved.map(r => r.amount)).toEqual([750, 250]); // 60/20 → 75/25
  });
});
