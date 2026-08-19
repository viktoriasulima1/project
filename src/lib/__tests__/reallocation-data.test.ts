import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {
  season: { findFirst: vi.fn() },
  economicEntry: { findMany: vi.fn() },
  financialExpense: { findMany: vi.fn() },
  revenueEntry: { findMany: vi.fn() },
} }));

import { getAllocatableRecords } from '../reallocation-data';
import { db } from '@/lib/db';

const FARM = { id: 'farm-1', currency: 'EUR' } as never;

function entry(over: Record<string, unknown> = {}) {
  return { id: 'e1', kind: 'cost', sourceType: 'manual_expense', currency: 'EUR', amount: 1000, costDate: new Date('2026-06-01'), sourceEntityId: 'exp1', allocations: [], ...over };
}
const alloc = (over: Record<string, unknown> = {}) => ({ fieldSeasonId: 'fs1', amount: 500, version: 1, status: 'active', fieldSeason: { field: { name: 'Noord' } }, ...over });

describe('getAllocatableRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.season.findFirst).mockResolvedValue({ id: 's1', year: 2026 } as never);
    vi.mocked(db.financialExpense.findMany).mockResolvedValue([{ id: 'exp1', description: 'Diesel invoice', reference: 'INV-9' }] as never);
    vi.mocked(db.revenueEntry.findMany).mockResolvedValue([] as never);
  });

  it('returns empty when there is no active season', async () => {
    vi.mocked(db.season.findFirst).mockResolvedValue(null as never);
    expect(await getAllocatableRecords(FARM)).toEqual({ records: [], seasonId: null });
  });

  it('marks a record with no allocations as unallocated', async () => {
    vi.mocked(db.economicEntry.findMany).mockResolvedValue([entry()] as never);
    const { records } = await getAllocatableRecords(FARM);
    expect(records[0].status).toBe('unallocated');
    expect(records[0].unallocatedAmount).toBe(1000);
    expect(records[0].label).toBe('Diesel invoice');
    expect(records[0].reference).toBe('INV-9');
  });

  it('marks a record with a partial allocation as partially_allocated', async () => {
    vi.mocked(db.economicEntry.findMany).mockResolvedValue([entry({ allocations: [alloc({ amount: 400 })] })] as never);
    const { records } = await getAllocatableRecords(FARM);
    expect(records[0].status).toBe('partially_allocated');
    expect(records[0].allocatedAmount).toBe(400);
    expect(records[0].unallocatedAmount).toBe(600);
  });

  it('marks a fully allocated single-version record as fully_allocated', async () => {
    vi.mocked(db.economicEntry.findMany).mockResolvedValue([entry({ allocations: [alloc({ amount: 1000 })] })] as never);
    const { records } = await getAllocatableRecords(FARM);
    expect(records[0].status).toBe('fully_allocated');
  });

  it('marks a record whose allocation version > 1 as reallocated', async () => {
    vi.mocked(db.economicEntry.findMany).mockResolvedValue([entry({ allocations: [alloc({ amount: 1000, version: 3 })] })] as never);
    const { records } = await getAllocatableRecords(FARM);
    expect(records[0].status).toBe('reallocated');
    expect(records[0].version).toBe(3);
    expect(records[0].destinationsSummary).toBe('Noord');
  });

  it('falls back to a humanized source type when no description/name exists', async () => {
    vi.mocked(db.financialExpense.findMany).mockResolvedValue([] as never);
    vi.mocked(db.economicEntry.findMany).mockResolvedValue([entry({ sourceType: 'field_rent' })] as never);
    const { records } = await getAllocatableRecords(FARM);
    expect(records[0].label).toBe('field rent');
  });
});
