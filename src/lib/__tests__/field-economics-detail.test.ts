import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/finance-data', () => ({ getFinanceData: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: {
  field: { findFirst: vi.fn() },
  season: { findFirst: vi.fn() },
  fieldSeason: { findFirst: vi.fn() },
  economicEntry: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  economicAllocation: { findMany: vi.fn() },
  activity: { findMany: vi.fn() },
  harvestResult: { findMany: vi.fn(), findFirst: vi.fn() },
  financialExpense: { findMany: vi.fn(), findFirst: vi.fn() },
  revenueEntry: { findMany: vi.fn(), findFirst: vi.fn() },
  contractorCost: { findMany: vi.fn() },
  inventoryPurchase: { findMany: vi.fn(), findFirst: vi.fn() },
  seasonPlanItem: { findMany: vi.fn() },
  auditEvent: { findMany: vi.fn(), count: vi.fn() },
} }));

import {
  getFieldEconomicsDetail, getFieldEconomicSourceRecords,
  getFinancialRecordVersionHistory, getAllocationHistory, getFieldEconomicTimeline,
} from '../field-economics-detail';
import { getFinanceData } from '@/lib/finance-data';
import { db } from '@/lib/db';
import { resolveBudgetVariance } from '../economics';

const FARM = { id: 'farm-1', currency: 'EUR' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  // Neutral defaults so unrelated delegates don't blow up.
  for (const model of Object.values(db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>)) {
    for (const [name, fn] of Object.entries(model)) {
      if (name.startsWith('findMany')) fn.mockResolvedValue([]);
      else if (name === 'count') fn.mockResolvedValue(0);
      else fn.mockResolvedValue(null);
    }
  }
});

// ─── Security (Part 19, tests 31-34) ─────────────────────────────────────────

describe('cross-farm security', () => {
  it('31 — a field from another farm resolves to null (not found)', async () => {
    vi.mocked(db.field.findFirst).mockResolvedValue(null as never);
    expect(await getFieldEconomicsDetail(FARM, 'other-farm-field')).toBeNull();
  });
  it('32 — source records for another farm return empty', async () => {
    vi.mocked(db.fieldSeason.findFirst).mockResolvedValue(null as never);
    expect(await getFieldEconomicSourceRecords(FARM, 'other-fs')).toEqual({ records: [], total: 0 });
  });
  it('33 — version history for another farm returns null', async () => {
    vi.mocked(db.financialExpense.findFirst).mockResolvedValue(null as never);
    expect(await getFinancialRecordVersionHistory(FARM, 'expense', 'other-id')).toBeNull();
  });
  it('34 — allocation history for another farm returns null', async () => {
    vi.mocked(db.economicEntry.findFirst).mockResolvedValue(null as never);
    expect(await getAllocationHistory(FARM, 'other-entry')).toBeNull();
  });
  it('timeline for another farm returns empty', async () => {
    vi.mocked(db.fieldSeason.findFirst).mockResolvedValue(null as never);
    expect(await getFieldEconomicTimeline(FARM, 'other-fs')).toEqual({ events: [], total: 0 });
  });
});

// ─── Field summary shaping (tests 1-10) ──────────────────────────────────────

describe('getFieldEconomicsDetail', () => {
  const summary = {
    fieldSeasonId: 'fs1', fieldId: 'f1', field: 'Noord', crop: 'wheat', hectares: 30,
    recordedCostEur: 4650, recordedRevenueEur: 8000, grossMarginEur: 3350, costPerHaEur: 155,
    yieldQuantity: 60, yieldUnit: 'tonnes', completenessPercent: 82, completenessStatus: 'partial_profitability',
    budgetCostEur: 5000, costVariance: resolveBudgetVariance({ budget: 5000, actual: 4650 }), missing: [] as string[],
  };
  beforeEach(() => {
    vi.mocked(db.field.findFirst).mockResolvedValue({ id: 'f1', name: 'Noord', hectares: 30, soilType: 'clay', status: 'healthy' } as never);
    vi.mocked(db.season.findFirst).mockResolvedValue({ id: 's1', year: 2026 } as never);
    vi.mocked(db.fieldSeason.findFirst).mockResolvedValue({ id: 'fs1', crop: 'wheat' } as never);
    vi.mocked(getFinanceData).mockResolvedValue({ fields: [summary], unallocatedCostEur: 900, lastCalculatedAt: '2026-07-16T09:00:00.000Z' } as never);
    vi.mocked(db.economicEntry.findMany).mockResolvedValue([
      { sourceType: 'inventory_input', sourceEntityId: 'a1', amount: 3000, allocationMethod: 'direct_field', fieldSeasonId: 'fs1', crop: 'wheat' },
      { sourceType: 'labour', sourceEntityId: 'a1', amount: 1200, allocationMethod: 'direct_field', fieldSeasonId: 'fs1', crop: 'wheat' },
      { sourceType: 'miscellaneous', sourceEntityId: 'x1', amount: 450, allocationMethod: 'per_hectare', fieldSeasonId: 'fs1', crop: 'wheat' },
    ] as never);
    vi.mocked(db.activity.findMany).mockResolvedValue([{ id: 'a1', product: { category: 'herbicide' }, costSnapshots: [] }] as never);
    vi.mocked(db.revenueEntry.findMany).mockResolvedValue([{ totalAmount: 8000, quantity: 40, unit: 'tonnes' }] as never);
    vi.mocked(db.harvestResult.findMany).mockResolvedValue([{ unit: 'tonnes' }] as never);
    vi.mocked(db.seasonPlanItem.findMany).mockResolvedValue([] as never);
  });

  it('shapes header, direct/allocated split and cost breakdown', async () => {
    const d = (await getFieldEconomicsDetail(FARM, 'f1'))!;
    expect(d.field.name).toBe('Noord');
    expect(d.crop).toBe('wheat');
    expect(d.header.completenessPercent).toBe(82);
    // 1-2 direct vs allocated: 3000+1200 direct, 450 allocated
    expect(d.split.recordedDirect).toBe(4200);
    expect(d.split.allocatedToField).toBe(450);
    expect(d.split.totalFieldCost).toBe(4650);
    // farm-level unallocated surfaced separately, never folded in
    expect(d.farmUnallocatedCostEur).toBe(900);
    // breakdown: crop protection (herbicide) + labour + allocated overhead
    const cp = d.breakdown.rows.find((r) => r.category === 'crop_protection')!;
    expect(cp.recordedAmount).toBe(3000);
    const ov = d.breakdown.rows.find((r) => r.category === 'allocated_overhead')!;
    expect(ov.allocatedAmount).toBe(450);
  });

  it('7 — passes through gross margin; 6 — cost per hectare from the vetted resolver', async () => {
    const d = (await getFieldEconomicsDetail(FARM, 'f1'))!;
    expect(d.summary!.grossMarginEur).toBe(3350);
    expect(d.summary!.costPerHaEur).toBe(155);
  });

  it('8 — break-even price computed from complete cost + yield', async () => {
    const d = (await getFieldEconomicsDetail(FARM, 'f1'))!;
    expect(d.breakEven.price.value!.result).toBe(77.5); // 4650 / 60
  });
});

// ─── Version history (tests 17-24) ───────────────────────────────────────────

describe('getFinancialRecordVersionHistory', () => {
  const v1 = { id: 'e1', version: 1, status: 'corrected', createdAt: new Date('2026-06-01'), correctionOfId: null, correctionReason: null, description: 'Seed invoice', amount: 500 };
  const v2 = { id: 'e2', version: 2, status: 'active', createdAt: new Date('2026-06-05'), correctionOfId: 'e1', correctionReason: 'Wrong amount keyed', description: 'Seed invoice', amount: 450 };
  beforeEach(() => {
    vi.mocked(db.financialExpense.findFirst).mockImplementation((async (args: { where: { id: string } }) => (args.where.id === 'e1' ? v1 : args.where.id === 'e2' ? v2 : null)) as never);
    vi.mocked(db.financialExpense.findMany).mockImplementation((async (args: { where: { correctionOfId: string } }) => (args.where.correctionOfId === 'e1' ? [v2] : [])) as never);
    vi.mocked(db.auditEvent.findMany).mockResolvedValue([{ entityId: 'e2', actorUserId: 'user-1', reason: 'Wrong amount keyed', occurredAt: new Date('2026-06-05') }] as never);
  });

  it('17,18,21,22 — original + corrected chain, current-effective marking, chronological order', async () => {
    const h = (await getFinancialRecordVersionHistory(FARM, 'expense', 'e2'))!;
    expect(h.entries.map((e) => e.version)).toEqual([1, 2]); // chronological
    expect(h.entries[0].statusCode).toBe('original');
    expect(h.entries[1].statusCode).toBe('effective');
    expect(h.entries[1].isCurrentEffective).toBe(true);
    expect(h.currentEffectiveVersion).toBe(2);
    // before/after diff on the corrected version
    expect(h.entries[1].diff.amount).toEqual({ old: 500, new: 450 });
    expect(h.entries[1].reason).toBe('Wrong amount keyed');
  });

  it('23,24 — purchase reversal/replacement chain is reconstructable; snapshots are untouched here', async () => {
    const p1 = { id: 'p1', version: 1, status: 'reversed', createdAt: new Date('2026-05-01'), correctionOfId: null, correctionReason: 'Wrong supplier', totalAmount: 1000, quantity: 100 };
    vi.mocked(db.inventoryPurchase.findFirst).mockImplementation((async (args: { where: { id: string } }) => (args.where.id === 'p1' ? p1 : null)) as never);
    vi.mocked(db.inventoryPurchase.findMany).mockResolvedValue([] as never);
    vi.mocked(db.auditEvent.findMany).mockResolvedValue([] as never);
    const h = (await getFinancialRecordVersionHistory(FARM, 'purchase', 'p1'))!;
    // A reversed record is labeled "Reversed" even as the only (v1) row.
    expect(h.entries[0].statusCode).toBe('reversed');
    expect(h.entries[0].values.totalAmount).toBe(1000);
    // The history query reads only purchases — it never mutates activity snapshots.
    expect(vi.mocked(db.activity.findMany)).not.toHaveBeenCalled();
  });
});

// ─── Allocation history (test 19) ────────────────────────────────────────────

describe('getAllocationHistory', () => {
  it('19 — groups by version and marks the active version as current-effective', async () => {
    vi.mocked(db.economicEntry.findFirst).mockResolvedValue({ id: 'ee1', amount: 1000, currency: 'EUR', sourceType: 'manual_expense' } as never);
    vi.mocked(db.economicAllocation.findMany).mockResolvedValue([
      { version: 1, status: 'corrected', method: 'direct_field', reason: null, createdAt: new Date('2026-06-01'), fieldSeasonId: 'fs1', percentage: 100, amount: 1000, fieldSeason: { field: { name: 'Noord' } } },
      { version: 2, status: 'active', method: 'selected_fields', reason: 'Split with Zuid', createdAt: new Date('2026-06-10'), fieldSeasonId: 'fs1', percentage: 60, amount: 600, fieldSeason: { field: { name: 'Noord' } } },
      { version: 2, status: 'active', method: 'selected_fields', reason: 'Split with Zuid', createdAt: new Date('2026-06-10'), fieldSeasonId: 'fs2', percentage: 40, amount: 400, fieldSeason: { field: { name: 'Zuid' } } },
    ] as never);
    vi.mocked(db.auditEvent.findMany).mockResolvedValue([] as never);
    const h = (await getAllocationHistory(FARM, 'ee1'))!;
    expect(h.versions).toHaveLength(2);
    expect(h.versions[0].isCurrentEffective).toBe(false);
    const v2 = h.versions[1];
    expect(v2.isCurrentEffective).toBe(true);
    expect(v2.destinations.map((d) => d.field)).toEqual(['Noord', 'Zuid']);
    expect(v2.allocatedAmount).toBe(1000);
    expect(v2.unallocatedAmount).toBe(0);
  });
});

// ─── Timeline (tests 25-30) ──────────────────────────────────────────────────

describe('getFieldEconomicTimeline', () => {
  it('25-30 — surfaces economic events with actor and audit reason', async () => {
    vi.mocked(db.fieldSeason.findFirst).mockResolvedValue({ id: 'fs1' } as never);
    vi.mocked(db.economicEntry.findMany).mockResolvedValue([{ id: 'ee1', sourceEntityId: 'x1' }] as never);
    vi.mocked(db.financialExpense.findMany).mockResolvedValue([{ id: 'x1' }] as never);
    vi.mocked(db.auditEvent.findMany).mockResolvedValue([
      { id: 'au2', occurredAt: new Date('2026-06-10'), action: 'allocation_changed', actorUserId: 'user-1', actorType: 'farmer', entityType: 'EconomicAllocation', source: 'web', reason: 'Split with Zuid', metadataJson: { newAllocatedCents: 60000 } },
      { id: 'au1', occurredAt: new Date('2026-06-01'), action: 'created', actorUserId: 'user-1', actorType: 'farmer', entityType: 'FinancialExpense', source: 'web', reason: null, metadataJson: {} },
    ] as never);
    vi.mocked(db.auditEvent.count).mockResolvedValue(2 as never);
    const t = await getFieldEconomicTimeline(FARM, 'fs1');
    expect(t.total).toBe(2);
    expect(t.events[0].type).toBe('Reallocated');
    expect(t.events[0].reason).toBe('Split with Zuid');
    expect(t.events[0].amount).toBe(600); // 60000 cents
    expect(t.events[1].type).toBe('Recorded');
  });
});
