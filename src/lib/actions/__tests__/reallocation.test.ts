import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn(), getClerkUserId: vi.fn() }));

vi.mock('@/lib/db', () => {
  const tx = {
    economicAllocation: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), createMany: vi.fn() },
    economicEntry: { findFirst: vi.fn() },
    fieldSeason: { findMany: vi.fn() },
    harvestResult: { findMany: vi.fn() },
    auditEvent: { create: vi.fn() },
    $queryRaw: vi.fn(),
  };
  const db = { _tx: tx, $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)) };
  return { db };
});

import { reallocateEconomicRecord } from '../reallocation';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { db } from '@/lib/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tx = (db as any)._tx as {
  economicAllocation: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
  economicEntry: { findFirst: ReturnType<typeof vi.fn> };
  fieldSeason: { findMany: ReturnType<typeof vi.fn> };
  harvestResult: { findMany: ReturnType<typeof vi.fn> };
  auditEvent: { create: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
};

const FARM = { id: 'farm-1', currency: 'EUR' };
const FS1 = 'a0000001-0000-4000-8000-000000000001';
const FS2 = 'a0000002-0000-4000-8000-000000000002';
const ENTRY_ID = 'b0000003-0000-4000-8000-000000000003';
const IDEM = 'c0000004-0000-4000-8000-000000000004';

function entry(over: Record<string, unknown> = {}) {
  return { id: ENTRY_ID, farmId: FARM.id, status: 'active', sourceType: 'manual_expense', currency: 'EUR', kind: 'cost', amount: 1000, seasonId: 's1', ...over };
}
function baseInput(over: Record<string, unknown> = {}) {
  return { economicEntryId: ENTRY_ID, expectedVersion: 0, allocationMethod: 'per_hectare' as const, destinations: [{ fieldSeasonId: FS1 }, { fieldSeasonId: FS2 }], partialAllocationAllowed: false, idempotencyKey: IDEM, ...over };
}

describe('reallocateEconomicRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(getClerkUserId).mockResolvedValue('user-1');
    (db.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
    tx.economicAllocation.findFirst.mockResolvedValue(null); // no idempotent duplicate
    tx.economicAllocation.findMany.mockResolvedValue([]);    // no current allocation (version 0)
    tx.economicAllocation.updateMany.mockResolvedValue({ count: 0 });
    tx.economicAllocation.createMany.mockResolvedValue({ count: 2 });
    tx.economicEntry.findFirst.mockResolvedValue(entry());
    // Respect the `where: { id: { in } }` filter so single-destination tests
    // resolve only the fields they actually request.
    tx.fieldSeason.findMany.mockImplementation((args?: { where?: { id?: { in?: string[] } } }) => {
      const all = [
        { id: FS1, crop: 'wheat', field: { name: 'Noord', hectares: 30 } },
        { id: FS2, crop: 'wheat', field: { name: 'Zuid', hectares: 10 } },
      ];
      const ids = args?.where?.id?.in;
      return Promise.resolve(ids ? all.filter(f => ids.includes(f.id)) : all);
    });
    tx.harvestResult.findMany.mockResolvedValue([]);
    tx.auditEvent.create.mockResolvedValue({});
    tx.$queryRaw.mockResolvedValue([]);
  });

  const created = () => tx.economicAllocation.createMany.mock.calls[0][0].data as Array<{ amount: number; method: string; version: number; status: string; originalAmount: number; correlationId: string }>;

  it('1/4/28. per-hectare persists the exact preview output (30/10 → 750/250), version 1', async () => {
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.success).toBe(true);
    expect(created().map(x => x.amount)).toEqual([750, 250]);
    expect(created()[0].version).toBe(1);
    expect(created()[0].method).toBe('per_hectare');
    expect(r.totalAllocatedCents).toBe(100000);
  });

  it('2. percentage allocation persists', async () => {
    await reallocateEconomicRecord(baseInput({ allocationMethod: 'selected_fields', destinations: [{ fieldSeasonId: FS1, percentage: 60 }, { fieldSeasonId: FS2, percentage: 40 }] }));
    expect(created().map(x => x.amount)).toEqual([600, 400]);
    expect(created()[0].method).toBe('selected_fields');
  });

  it('3. amount allocation persists (amountCents)', async () => {
    await reallocateEconomicRecord(baseInput({ allocationMethod: 'selected_fields', destinations: [{ fieldSeasonId: FS1, amountCents: 70000 }, { fieldSeasonId: FS2, amountCents: 30000 }] }));
    expect(created().map(x => x.amount)).toEqual([700, 300]);
  });

  it('5. per-yield persists using authoritative recorded yield', async () => {
    tx.harvestResult.findMany.mockResolvedValue([
      { fieldSeasonId: FS1, grossQuantity: 80, saleableQuantity: 80 },
      { fieldSeasonId: FS2, grossQuantity: 20, saleableQuantity: 20 },
    ]);
    await reallocateEconomicRecord(baseInput({ allocationMethod: 'per_yield' }));
    expect(created().map(x => x.amount)).toEqual([800, 200]);
    expect(created()[0].method).toBe('yield_proportional');
  });

  it('6. crop-level persists a marker row', async () => {
    await reallocateEconomicRecord(baseInput({ allocationMethod: 'crop_level', destinations: [] }));
    expect(created()[0].method).toBe('per_crop_area');
    expect(created()[0].amount).toBe(0);
  });

  it('7. unallocated persists a marker row', async () => {
    const r = await reallocateEconomicRecord(baseInput({ allocationMethod: 'unallocated', destinations: [] }));
    expect(created()[0].method).toBe('unallocated');
    expect(r.unallocatedCents).toBe(100000);
  });

  it('8. partial allocation preserves the remainder', async () => {
    const r = await reallocateEconomicRecord(baseInput({ allocationMethod: 'selected_fields', partialAllocationAllowed: true, destinations: [{ fieldSeasonId: FS1, percentage: 70 }] }));
    expect(r.totalAllocatedCents).toBe(70000);
    expect(r.unallocatedCents).toBe(30000);
  });

  it('9/10. uses the authoritative DB source amount as originalAmount; children reconcile to it', async () => {
    await reallocateEconomicRecord(baseInput({ allocationMethod: 'selected_fields', destinations: [{ fieldSeasonId: FS1, amountCents: 70000 }, { fieldSeasonId: FS2, amountCents: 30000 }] }));
    expect(created().reduce((s, x) => s + x.amount, 0)).toBe(1000); // == the DB record amount, not any client total
    expect(created()[0].originalAmount).toBe(1000);
  });

  it('rejects client amounts that do not reconcile to the authoritative record total', async () => {
    const r = await reallocateEconomicRecord(baseInput({ allocationMethod: 'selected_fields', destinations: [{ fieldSeasonId: FS1, amountCents: 5000000 }, { fieldSeasonId: FS2, amountCents: 1 }] }));
    expect(r.success).toBeUndefined();
    expect(r.category).toBe('invalid_percentage');
  });

  it('11. cross-farm source is rejected (findFirst farm-scoped returns null)', async () => {
    tx.economicEntry.findFirst.mockResolvedValue(null);
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.category).toBe('record_not_found');
  });

  it('12. cross-farm destination is rejected', async () => {
    tx.fieldSeason.findMany.mockResolvedValue([{ id: FS1, crop: 'wheat', field: { name: 'Noord', hectares: 30 } }]); // fs2 missing
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.category).toBe('invalid_destination');
    expect(tx.economicAllocation.createMany).not.toHaveBeenCalled();
  });

  it('13. directly-linked (activity-derived) cost is rejected', async () => {
    tx.economicEntry.findFirst.mockResolvedValue(entry({ sourceType: 'labour' }));
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.category).toBe('directly_linked_cost');
  });

  it('15. reversed record is rejected', async () => {
    tx.economicEntry.findFirst.mockResolvedValue(entry({ status: 'reversed' }));
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.category).toBe('record_reversed');
  });

  it('16. missing yield blocks per-yield', async () => {
    tx.harvestResult.findMany.mockResolvedValue([]); // no yield recorded
    const r = await reallocateEconomicRecord(baseInput({ allocationMethod: 'per_yield' }));
    expect(r.category).toBe('missing_yield');
  });

  it('17. currency mismatch is rejected', async () => {
    tx.economicEntry.findFirst.mockResolvedValue(entry({ currency: 'USD' }));
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.category).toBe('currency_mismatch');
  });

  it('18/19/20. stale version rejected; a valid change supersedes old (corrected) and writes version+1', async () => {
    tx.economicAllocation.findMany.mockResolvedValue([{ id: 'old', version: 2, status: 'active', fieldSeasonId: FS1, amount: 1000 }]);
    const stale = await reallocateEconomicRecord(baseInput({ expectedVersion: 0, reason: 'Reallocating after re-measuring the plots.' }));
    expect(stale.category).toBe('stale_version');
    const ok = await reallocateEconomicRecord(baseInput({ expectedVersion: 2, reason: 'Reallocating after re-measuring the plots.' }));
    expect(ok.success).toBe(true);
    expect(tx.economicAllocation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'corrected' } }));
    expect(created()[0].version).toBe(3);
    expect(created()[0].status).toBe('active');
  });

  it('21. reason required when changing an existing allocation', async () => {
    tx.economicAllocation.findMany.mockResolvedValue([{ id: 'old', version: 1, status: 'active', fieldSeasonId: FS1, amount: 1000 }]);
    const r = await reallocateEconomicRecord(baseInput({ expectedVersion: 1 })); // no reason
    expect(r.error).toMatch(/reason/i);
    expect(tx.economicAllocation.createMany).not.toHaveBeenCalled();
  });

  it('22. first allocation succeeds without a reason', async () => {
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.success).toBe(true);
  });

  it('23/24. writes an allocation_created audit event with a correlation id', async () => {
    await reallocateEconomicRecord(baseInput());
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'allocation_created', entityType: 'EconomicAllocation' }) }));
    expect(created()[0].correlationId).toBeTruthy();
  });

  it('changing an existing allocation writes allocation_changed, not allocation_created', async () => {
    tx.economicAllocation.findMany.mockResolvedValue([{ id: 'old', version: 1, status: 'active', fieldSeasonId: FS1, amount: 1000 }]);
    await reallocateEconomicRecord(baseInput({ expectedVersion: 1, reason: 'Corrected the split after a survey.' }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'allocation_changed' }) }));
  });

  it('25/27. double submission with the same key is idempotent (no second write)', async () => {
    tx.economicAllocation.findFirst.mockResolvedValue({ submissionHash: null, version: 1 });
    // recompute expected hash by running once with a spy? simpler: same payload → same hash; mock returns the hash the action computes.
    // Use the real hash: run once normally to capture it.
    tx.economicAllocation.findFirst.mockResolvedValueOnce(null);
    await reallocateEconomicRecord(baseInput());
    const usedHash = created()[0] && (tx.economicAllocation.createMany.mock.calls[0][0].data[0] as { submissionHash: string }).submissionHash;
    vi.clearAllMocks();
    (db.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(getClerkUserId).mockResolvedValue('user-1');
    tx.economicAllocation.findFirst.mockResolvedValue({ submissionHash: usedHash, version: 1 });
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.success).toBe(true);
    expect(tx.economicAllocation.createMany).not.toHaveBeenCalled();
  });

  it('26. same key with a different payload conflicts', async () => {
    tx.economicAllocation.findFirst.mockResolvedValue({ submissionHash: 'a-different-hash', version: 1 });
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.category).toBe('idempotency_conflict');
    expect(tx.economicAllocation.createMany).not.toHaveBeenCalled();
  });

  it('33. a raw database error is never exposed — returns a generic internal_error', async () => {
    tx.economicEntry.findFirst.mockRejectedValue(new Error('P2002: Unique constraint failed on the fields: (`x`)'));
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.category).toBe('internal_error');
    expect(r.error).not.toMatch(/P2002|constraint/);
  });

  it('rejects an unknown key in the input contract (strict schema)', async () => {
    const r = await reallocateEconomicRecord({ ...baseInput(), somethingUnexpected: true } as never);
    expect(r.success).toBeUndefined();
    expect(r.category).toBe('invalid_destination');
  });

  it('rejects when there is no signed-in user', async () => {
    vi.mocked(getClerkUserId).mockResolvedValue(null as never);
    const r = await reallocateEconomicRecord(baseInput());
    expect(r.category).toBe('unauthenticated');
  });
});
