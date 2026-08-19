'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { handleActionError, userError, type UserFacingError } from '@/lib/user-error';

export type FieldOperationActionState = { error?: UserFacingError; success?: boolean; id?: string };

class ExpectedFieldOperationError extends Error {
  constructor(readonly safe: UserFacingError) { super(safe.code); }
}

function expected(code: Parameters<typeof userError>[0], details?: Parameters<typeof userError>[1]): never {
  throw new ExpectedFieldOperationError(userError(code, details));
}

function caught(context: string, error: unknown): UserFacingError {
  if (error instanceof ExpectedFieldOperationError) return error.safe;
  const { message: _legacy, ...safe } = handleActionError(context, error, randomUUID());
  return safe;
}

const operationTypes = ['soil_preparation', 'sow', 'fertilise', 'spray', 'irrigate', 'scout', 'tillage', 'harvest', 'custom'] as const;
const priorities = ['critical', 'high', 'medium', 'low'] as const;

const planSchema = z.object({
  fieldSeasonId: z.string().uuid(), operationType: z.enum(operationTypes), title: z.string().trim().min(1).max(160),
  windowStart: z.coerce.date(), windowEnd: z.coerce.date(), expectedAreaHa: z.coerce.number().positive().optional(),
  expectedProductId: z.string().uuid().optional(), expectedQuantity: z.coerce.number().positive().optional(),
  expectedCostEur: z.coerce.number().nonnegative().optional(), reason: z.string().trim().max(1000).optional(),
  expectedInputCostEur: z.coerce.number().nonnegative().optional(), expectedLabourCostEur: z.coerce.number().nonnegative().optional(),
  expectedMachineCostEur: z.coerce.number().nonnegative().optional(), expectedContractorCostEur: z.coerce.number().nonnegative().optional(),
  expectedOverheadEur: z.coerce.number().nonnegative().optional(), expectedYieldQuantity: z.coerce.number().nonnegative().optional(),
  expectedYieldUnit: z.string().max(30).optional(), expectedSalePrice: z.coerce.number().nonnegative().optional(), expectedRevenueEur: z.coerce.number().nonnegative().optional(),
});

const workOrderSchema = z.object({
  fieldSeasonId: z.string().uuid(), operationType: z.enum(operationTypes), title: z.string().trim().min(1).max(160),
  priority: z.enum(priorities).default('medium'), dueDate: z.coerce.date().optional(), plannedStart: z.coerce.date().optional(),
  estimatedHours: z.coerce.number().positive().optional(), machineId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(), instructions: z.string().trim().max(4000).optional(),
  inventoryItemId: z.string().uuid().optional(), reservationQuantity: z.coerce.number().positive().optional(),
});

function clean(raw: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== ''));
}

async function audit(farmId: string, entityType: string, entityId: string, action: 'created' | 'planned' | 'completed' | 'archived', metadata: object) {
  await db.auditEvent.create({ data: { farmId, actorUserId: await getClerkUserId(), entityType, entityId, action, source: 'web', correlationId: randomUUID(), metadataJson: { schemaVersion: 1, ...metadata } } });
}

function revalidateOperations() {
  for (const path of ['/planning', '/work-orders', '/fields', '/dashboard']) revalidatePath(path);
}

export async function createSeasonPlanItem(_previous: unknown, formData: FormData): Promise<FieldOperationActionState> {
  const parsed = planSchema.safeParse(clean(Object.fromEntries(formData)));
  if (!parsed.success) return { error: userError('INVALID_PLAN_ITEM', { field: parsed.error.issues[0]?.path.join('.') || undefined }) };
  if (parsed.data.windowEnd < parsed.data.windowStart) return { error: userError('WORK_WINDOW_INVALID', { field: 'windowEnd' }) };
  const farm = await getActiveFarmOrThrow();
  const fieldSeason = await db.fieldSeason.findFirst({ where: { id: parsed.data.fieldSeasonId, field: { farmId: farm.id, deletedAt: null } } });
  if (!fieldSeason) return { error: userError('NOT_FOUND') };
  if (parsed.data.expectedProductId && !await db.inventoryItem.findFirst({ where: { id: parsed.data.expectedProductId, farmId: farm.id } })) return { error: userError('NOT_FOUND') };
  const item = await db.seasonPlanItem.create({ data: { ...parsed.data, farmId: farm.id, status: 'planned' } });
  await audit(farm.id, 'SeasonPlanItem', item.id, 'planned', { operationType: item.operationType, fieldSeasonId: item.fieldSeasonId });
  revalidateOperations();
  return { success: true, id: item.id };
}

export async function convertPlanItemToWorkOrder(planItemId: string) {
  const farm = await getActiveFarmOrThrow();
  const actor = await getClerkUserId() ?? farm.clerkUserId;
  try {
    const result = await db.$transaction(async (tx) => {
      const plan = await tx.seasonPlanItem.findFirst({ where: { id: planItemId, farmId: farm.id }, include: { workOrders: true } });
      if (!plan) expected('NOT_FOUND');
      if (plan.workOrders.length) return { order: plan.workOrders[0], created: false };
      const created = await tx.workOrder.create({ data: {
        farmId: farm.id, fieldSeasonId: plan.fieldSeasonId, sourcePlanItemId: plan.id, operationType: plan.operationType,
        title: plan.title, status: 'ready', priority: 'medium', plannedStart: plan.windowStart, plannedEnd: plan.windowEnd,
        dueDate: plan.windowEnd, instructions: plan.reason, createdBy: actor,
      } });
      if (plan.expectedProductId && plan.expectedQuantity) {
        const [stock, reserved] = await Promise.all([
          tx.inventoryItem.findFirst({ where: { id: plan.expectedProductId, farmId: farm.id }, select: { currentStock: true } }),
          tx.inventoryReservation.aggregate({ where: { inventoryItemId: plan.expectedProductId, status: 'active' }, _sum: { quantity: true } }),
        ]);
        if (!stock || Number(stock.currentStock) - Number(reserved._sum.quantity ?? 0) < Number(plan.expectedQuantity)) expected('INSUFFICIENT_STOCK', { metadata: { requestedQuantity: Number(plan.expectedQuantity), availableQuantity: stock ? Number(stock.currentStock) - Number(reserved._sum.quantity ?? 0) : 0 } });
        await tx.inventoryReservation.create({ data: { farmId: farm.id, workOrderId: created.id, inventoryItemId: plan.expectedProductId, quantity: plan.expectedQuantity } });
      }
      await tx.seasonPlanItem.update({ where: { id: plan.id }, data: { status: 'converted' } });
      return { order: created, created: true };
    }, { isolationLevel: 'Serializable' });
    if (result.created) await audit(farm.id, 'WorkOrder', result.order.id, 'created', { sourcePlanItemId: planItemId });
    revalidateOperations();
    return { success: true, id: result.order.id };
  } catch (error) { return { error: caught('convertPlanItemToWorkOrder', error) }; }
}

export async function createWorkOrder(_previous: unknown, formData: FormData): Promise<FieldOperationActionState> {
  const parsed = workOrderSchema.safeParse(clean(Object.fromEntries(formData)));
  if (!parsed.success) return { error: userError('INVALID_WORK_ORDER', { field: parsed.error.issues[0]?.path.join('.') || undefined }) };
  const farm = await getActiveFarmOrThrow();
  const actor = await getClerkUserId() ?? farm.clerkUserId;
  const d = parsed.data;
  const [fieldSeason, machine, employee, item] = await Promise.all([
    db.fieldSeason.findFirst({ where: { id: d.fieldSeasonId, field: { farmId: farm.id, deletedAt: null } } }),
    d.machineId ? db.machine.findFirst({ where: { id: d.machineId, farmId: farm.id } }) : null,
    d.employeeId ? db.employee.findFirst({ where: { id: d.employeeId, farmId: farm.id, isActive: true } }) : null,
    d.inventoryItemId ? db.inventoryItem.findFirst({ where: { id: d.inventoryItemId, farmId: farm.id } }) : null,
  ]);
  if (!fieldSeason) return { error: userError('NOT_FOUND') };
  if (d.machineId && !machine) return { error: userError('NOT_FOUND') };
  if (d.employeeId && !employee) return { error: userError('NOT_FOUND') };
  if (d.inventoryItemId && !item) return { error: userError('NOT_FOUND') };
  if (d.reservationQuantity && !d.inventoryItemId) return { error: userError('INVENTORY_SELECTION_REQUIRED', { field: 'inventoryItemId' }) };
  try {
  const order = await db.$transaction(async (tx) => {
    const created = await tx.workOrder.create({ data: {
      farmId: farm.id, fieldSeasonId: d.fieldSeasonId, operationType: d.operationType, title: d.title,
      priority: d.priority, status: 'ready', dueDate: d.dueDate, plannedStart: d.plannedStart,
      estimatedHours: d.estimatedHours, machineId: d.machineId, instructions: d.instructions, createdBy: actor,
      employees: d.employeeId ? { create: { employeeId: d.employeeId } } : undefined,
    } });
    if (d.inventoryItemId && d.reservationQuantity) {
      const reserved = await tx.inventoryReservation.aggregate({ where: { inventoryItemId: d.inventoryItemId, status: 'active' }, _sum: { quantity: true } });
      if (!item || Number(item.currentStock) - Number(reserved._sum.quantity ?? 0) < d.reservationQuantity) expected('INSUFFICIENT_STOCK', { metadata: { requestedQuantity: d.reservationQuantity, availableQuantity: item ? Number(item.currentStock) - Number(reserved._sum.quantity ?? 0) : 0 } });
      await tx.inventoryReservation.create({ data: { farmId: farm.id, workOrderId: created.id, inventoryItemId: d.inventoryItemId, quantity: d.reservationQuantity } });
    }
    return created;
  }, { isolationLevel: 'Serializable' });
  await audit(farm.id, 'WorkOrder', order.id, 'created', { fieldSeasonId: order.fieldSeasonId, priority: order.priority });
  revalidateOperations();
  return { success: true, id: order.id };
  } catch (error) { return { error: caught('createWorkOrder', error) }; }
}

export async function setWorkOrderStatus(id: string, status: 'ready' | 'assigned' | 'in_progress' | 'blocked' | 'cancelled', blockerReason?: string) {
  const farm = await getActiveFarmOrThrow();
  const existing = await db.workOrder.findFirst({ where: { id, farmId: farm.id } });
  if (!existing) return { error: userError('NOT_FOUND') };
  if (existing.status === 'completed') return { error: userError('WORK_ORDER_COMPLETED') };
  await db.$transaction(async (tx) => {
    await tx.workOrder.update({ where: { id }, data: { status, blockerReason: status === 'blocked' ? blockerReason || 'Blocked' : null, version: { increment: 1 } } });
    if (status === 'cancelled') await tx.inventoryReservation.updateMany({ where: { workOrderId: id, status: 'active' }, data: { status: 'released', releasedAt: new Date() } });
  });
  await audit(farm.id, 'WorkOrder', id, status === 'cancelled' ? 'archived' : 'planned', { status });
  revalidateOperations();
  return { success: true };
}

export async function completeWorkOrderWithActivity(workOrderId: string, activityId: string) {
  const farm = await getActiveFarmOrThrow();
  try {
    const completed = await db.$transaction(async (tx) => {
      const order = await tx.workOrder.findFirst({ where: { id: workOrderId, farmId: farm.id }, include: { completedActivity: true } });
      if (!order) expected('NOT_FOUND');
      if (order.completedActivityId) return false;
      const activity = await tx.activity.findFirst({ where: { id: activityId, status: 'completed', deletedAt: null, fieldSeasonId: order.fieldSeasonId, fieldSeason: { field: { farmId: farm.id } } } });
      if (!activity) expected('NOT_FOUND');
      await tx.workOrder.update({ where: { id: order.id }, data: { status: 'completed', completedActivityId: activity.id, blockerReason: null, version: { increment: 1 } } });
      await tx.inventoryReservation.updateMany({ where: { workOrderId: order.id, status: 'active' }, data: { status: 'consumed', releasedAt: new Date() } });
      if (order.sourcePlanItemId) await tx.seasonPlanItem.update({ where: { id: order.sourcePlanItemId }, data: { status: 'completed' } });
      return true;
    });
    if (completed) await audit(farm.id, 'WorkOrder', workOrderId, 'completed', { activityId });
    revalidateOperations();
    return { success: true };
  } catch (error) { return { error: caught('completeWorkOrderWithActivity', error) }; }
}
