import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tx, mockDb } = vi.hoisted(() => {
const tx = {
  seasonPlanItem: { findFirst: vi.fn(), update: vi.fn() },
  workOrder: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  inventoryItem: { findFirst: vi.fn() },
  inventoryReservation: { aggregate: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  activity: { findFirst: vi.fn() },
};
const mockDb = {
  fieldSeason: { findFirst: vi.fn() }, inventoryItem: { findFirst: vi.fn() },
  machine: { findFirst: vi.fn() }, employee: { findFirst: vi.fn() },
  seasonPlanItem: { create: vi.fn() }, workOrder: { findFirst: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
};
return { tx, mockDb };
});
vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/farm', () => ({
  getActiveFarmOrThrow: vi.fn().mockResolvedValue({ id: 'farm-1', clerkUserId: 'owner-1' }),
  getClerkUserId: vi.fn().mockResolvedValue('owner-1'),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { completeWorkOrderWithActivity, convertPlanItemToWorkOrder, createSeasonPlanItem, createWorkOrder, setWorkOrderStatus } from '../field-operations';

const ids = {
  fieldSeason: 'b0000002-0000-4000-8000-000000000002',
  product: 'c0000003-0000-4000-8000-000000000003',
  order: 'd0000004-0000-4000-8000-000000000004',
  activity: 'e0000005-0000-4000-8000-000000000005',
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('field operation action invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    mockDb.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('rejects an inverted planning window before any write', async () => {
    const result = await createSeasonPlanItem({}, form({ fieldSeasonId: ids.fieldSeason, operationType: 'spray', title: 'T1', windowStart: '2026-08-10', windowEnd: '2026-08-01' }));
    expect(result.error?.code).toBe('WORK_WINDOW_INVALID');
    expect(mockDb.seasonPlanItem.create).not.toHaveBeenCalled();
  });

  it('uses farm-scoped not-found without exposing which relation failed', async () => {
    mockDb.fieldSeason.findFirst.mockResolvedValue(null);
    const result = await createWorkOrder({}, form({ fieldSeasonId: ids.fieldSeason, operationType: 'spray', title: 'Scoped' }));
    expect(result.error).toMatchObject({ code: 'NOT_FOUND', category: 'not_found' });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it('requires an inventory selection before reserving quantity', async () => {
    mockDb.fieldSeason.findFirst.mockResolvedValue({ id: ids.fieldSeason });
    const result = await createWorkOrder({}, form({ fieldSeasonId: ids.fieldSeason, operationType: 'spray', title: 'Reserve', reservationQuantity: '2' }));
    expect(result.error?.code).toBe('INVENTORY_SELECTION_REQUIRED');
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it('returns the existing converted order and creates no duplicate reservation or audit', async () => {
    tx.seasonPlanItem.findFirst.mockResolvedValue({ workOrders: [{ id: ids.order }] });
    const firstRetry = await convertPlanItemToWorkOrder('plan-1');
    expect(firstRetry).toMatchObject({ success: true, id: ids.order });
    expect(tx.workOrder.create).not.toHaveBeenCalled();
    expect(tx.inventoryReservation.create).not.toHaveBeenCalled();
    expect(mockDb.auditEvent.create).not.toHaveBeenCalled();
  });

  it('insufficient unreserved stock returns a safe conflict and creates no reservation', async () => {
    tx.seasonPlanItem.findFirst.mockResolvedValue({ id: 'plan-1', fieldSeasonId: ids.fieldSeason, operationType: 'spray', title: 'T1', windowStart: new Date(), windowEnd: new Date(), reason: null, expectedProductId: ids.product, expectedQuantity: 20, workOrders: [] });
    tx.workOrder.create.mockResolvedValue({ id: ids.order });
    tx.inventoryItem.findFirst.mockResolvedValue({ currentStock: 10 });
    tx.inventoryReservation.aggregate.mockResolvedValue({ _sum: { quantity: 2 } });
    const result = await convertPlanItemToWorkOrder('plan-1');
    expect(result.error).toMatchObject({ code: 'INSUFFICIENT_STOCK', category: 'conflict' });
    expect(tx.inventoryReservation.create).not.toHaveBeenCalled();
    expect(tx.seasonPlanItem.update).not.toHaveBeenCalled();
  });

  it('completed work orders are immutable and cause no status write', async () => {
    mockDb.workOrder.findFirst.mockResolvedValue({ id: ids.order, status: 'completed' });
    const result = await setWorkOrderStatus(ids.order, 'cancelled');
    expect(result.error?.code).toBe('WORK_ORDER_COMPLETED');
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it('cancellation releases active reservations exactly once in its transaction', async () => {
    mockDb.workOrder.findFirst.mockResolvedValue({ id: ids.order, status: 'ready' });
    const result = await setWorkOrderStatus(ids.order, 'cancelled');
    expect(result.success).toBe(true);
    expect(tx.inventoryReservation.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.inventoryReservation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { workOrderId: ids.order, status: 'active' }, data: expect.objectContaining({ status: 'released' }) }));
  });

  it('a completion retry creates no duplicate activity link, stock consumption, plan update, or audit', async () => {
    tx.workOrder.findFirst.mockResolvedValue({ id: ids.order, completedActivityId: ids.activity, sourcePlanItemId: 'plan-1' });
    const result = await completeWorkOrderWithActivity(ids.order, ids.activity);
    expect(result.success).toBe(true);
    expect(tx.activity.findFirst).not.toHaveBeenCalled();
    expect(tx.workOrder.update).not.toHaveBeenCalled();
    expect(tx.inventoryReservation.updateMany).not.toHaveBeenCalled();
    expect(tx.seasonPlanItem.update).not.toHaveBeenCalled();
    expect(mockDb.auditEvent.create).not.toHaveBeenCalled();
  });
});
