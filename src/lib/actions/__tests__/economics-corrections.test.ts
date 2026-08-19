import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn(), getClerkUserId: vi.fn() }));

vi.mock('@/lib/db', () => {
  const tx = {
    financialExpense: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    revenueEntry: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    harvestResult: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    economicEntry: { updateMany: vi.fn(), create: vi.fn() },
    fieldSeason: { findFirst: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  };
  const db = {
    _tx: tx,
    $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    auditEvent: { create: vi.fn() },
  };
  return { db };
});

import { correctFinancialRecord } from '../economics';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { db } from '@/lib/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tx = (db as any)._tx as {
  financialExpense: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  revenueEntry: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  harvestResult: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  economicEntry: { updateMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  fieldSeason: { findFirst: ReturnType<typeof vi.fn> };
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
};

const FARM = { id: 'a0000001-0000-4000-8000-000000000001', currency: 'EUR' };
const IDS = {
  expense: 'b0000002-0000-4000-8000-000000000002',
  revenue: 'c0000003-0000-4000-8000-000000000003',
  harvest: 'd0000004-0000-4000-8000-000000000004',
  idem: 'e0000005-0000-4000-8000-000000000005',
};

const ACTIVE_EXPENSE = {
  id: IDS.expense, farmId: FARM.id, seasonId: 's', fieldSeasonId: 'fs', sourceType: 'manual_expense',
  description: 'Diesel', expenseDate: new Date('2026-06-01'), amount: 100, quantity: null, unit: null,
  allocationMethod: 'direct_field', confidence: 'recorded', reference: null, notes: null, status: 'active', version: 1,
};

function baseInput(over: Record<string, unknown> = {}) {
  return { type: 'expense' as const, id: IDS.expense, expectedVersion: 1, reason: 'Invoice amount was mistyped on the day.', idempotencyKey: IDS.idem, amount: 80, ...over };
}

describe('correctFinancialRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM as never);
    vi.mocked(getClerkUserId).mockResolvedValue('user-1');
    (db.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
    tx.financialExpense.findFirst.mockImplementation(({ where }: { where: { idempotencyKey?: string } }) => where.idempotencyKey ? Promise.resolve(null) : Promise.resolve(ACTIVE_EXPENSE));
    tx.financialExpense.update.mockResolvedValue({});
    tx.financialExpense.create.mockResolvedValue({ id: 'new-expense', amount: 80 });
    tx.economicEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.economicEntry.create.mockResolvedValue({});
    tx.fieldSeason.findFirst.mockResolvedValue({ fieldId: 'field-1', crop: 'wheat' });
    tx.$queryRawUnsafe.mockResolvedValue([]);
  });

  it('preserves the original (marks corrected) and creates a new effective version referencing it', async () => {
    const result = await correctFinancialRecord(baseInput());
    expect(result.success).toBe(true);
    expect(tx.financialExpense.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: IDS.expense }, data: { status: 'corrected' } }));
    expect(tx.financialExpense.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ version: 2, correctionOfId: IDS.expense, amount: 80, correctionReason: expect.any(String) }) }));
  });

  it('recalculates economics exactly once — supersedes old entries, writes one replacement', async () => {
    await correctFinancialRecord(baseInput());
    expect(tx.economicEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sourceEntityId: IDS.expense, status: 'active' }), data: { status: 'corrected' } }));
    expect(tx.economicEntry.create).toHaveBeenCalledTimes(1);
    expect(tx.economicEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sourceEntityId: 'new-expense', amount: 80 }) }));
  });

  it('writes a corrected audit event referencing the original', async () => {
    await correctFinancialRecord(baseInput());
    expect(db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'corrected', entityType: 'FinancialExpense' }) }));
  });

  it('requires a reason of at least 10 characters', async () => {
    const result = await correctFinancialRecord(baseInput({ reason: 'too short' }));
    expect(result.error).toMatch(/10 characters/);
    expect(tx.financialExpense.create).not.toHaveBeenCalled();
  });

  it('rejects a stale-version correction', async () => {
    const result = await correctFinancialRecord(baseInput({ expectedVersion: 1 }));
    // simulate the record already being at version 2
    tx.financialExpense.findFirst.mockImplementation(({ where }: { where: { idempotencyKey?: string } }) => where.idempotencyKey ? Promise.resolve(null) : Promise.resolve({ ...ACTIVE_EXPENSE, version: 2 }));
    const stale = await correctFinancialRecord(baseInput({ expectedVersion: 1 }));
    expect(result.success).toBe(true); // first one at v1 succeeds
    expect(stale.error).toMatch(/changed by another action/);
  });

  it('is idempotent — a repeated key returns the existing correction without creating a second', async () => {
    tx.financialExpense.findFirst.mockImplementation(({ where }: { where: { idempotencyKey?: string } }) => where.idempotencyKey ? Promise.resolve({ id: 'already-created' }) : Promise.resolve(ACTIVE_EXPENSE));
    const result = await correctFinancialRecord(baseInput());
    expect(result.success).toBe(true);
    expect(result.id).toBe('already-created');
    expect(tx.financialExpense.create).not.toHaveBeenCalled();
  });

  it('rejects a record that does not belong to this farm (findFirst returns null)', async () => {
    tx.financialExpense.findFirst.mockResolvedValue(null);
    const result = await correctFinancialRecord(baseInput());
    expect(result.error).toMatch(/not found/i);
  });

  it('harvest: rejects a corrected saleable quantity above gross, and writes no EconomicEntry', async () => {
    tx.harvestResult.findFirst.mockImplementation(({ where }: { where: { idempotencyKey?: string } }) => where.idempotencyKey ? Promise.resolve(null) : Promise.resolve({ id: IDS.harvest, farmId: FARM.id, seasonId: 's', fieldSeasonId: 'fs', harvestDate: new Date('2026-08-01'), harvestedAreaHa: 10, grossQuantity: 50, saleableQuantity: 40, unit: 'tonnes', moisturePercent: null, qualityGrade: null, storageLocation: null, batchLot: null, wasteLoss: null, status: 'active', version: 1 }));
    const bad = await correctFinancialRecord({ type: 'harvest', id: IDS.harvest, expectedVersion: 1, reason: 'Weighbridge ticket corrected after re-check.', idempotencyKey: IDS.idem, grossQuantity: 30, saleableQuantity: 45 });
    expect(bad.error).toMatch(/cannot exceed gross/);
    expect(tx.economicEntry.create).not.toHaveBeenCalled();
  });

  it('revenue: only writes a recorded EconomicEntry when the corrected status is received', async () => {
    tx.revenueEntry.findFirst.mockImplementation(({ where }: { where: { idempotencyKey?: string } }) => where.idempotencyKey ? Promise.resolve(null) : Promise.resolve({ id: IDS.revenue, farmId: FARM.id, seasonId: 's', fieldSeasonId: 'fs', type: 'crop_sale', name: 'Wheat sale', revenueDate: new Date('2026-09-01'), quantity: null, unit: null, pricePerUnit: null, totalAmount: 1000, buyer: null, qualityGrade: null, batchReference: null, allocationMethod: 'direct_field', revenueStatus: 'received', reference: null, notes: null, status: 'active', version: 1 }));
    tx.revenueEntry.update.mockResolvedValue({});
    tx.revenueEntry.create.mockResolvedValue({ id: 'new-revenue', totalAmount: 1200 });
    await correctFinancialRecord({ type: 'revenue', id: IDS.revenue, expectedVersion: 1, reason: 'Final settlement price differed from estimate.', idempotencyKey: IDS.idem, totalAmount: 1200, revenueStatus: 'expected' });
    // status corrected to 'expected' → no recorded revenue entry
    expect(tx.economicEntry.create).not.toHaveBeenCalled();
  });
});
