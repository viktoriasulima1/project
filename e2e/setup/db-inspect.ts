import { PrismaClient } from '@prisma/client';

/**
 * Read-only, farm-scoped E2E database inspection helpers (Sprint 25 closure,
 * Part 14). Specs use these to assert exact-one invariants at the database
 * level, not just in the UI. Like the other E2E setup helpers, this opens its
 * own PrismaClient pointed explicitly at E2E_DATABASE_URL (never the app's
 * `@/lib/db` singleton) and refuses to run against a non-E2E database. It
 * performs NO writes.
 */
function e2ePrisma(): PrismaClient {
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/e2e|test/i.test(url)) {
    throw new Error('db-inspect.ts refuses to run without a valid E2E_DATABASE_URL (must contain "e2e" or "test").');
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export interface FarmCounts {
  workOrders: number;
  completedWorkOrders: number;
  activities: number;
  stockMovements: number;
  complianceRecords: number;
  activeReservations: number;
  consumedReservations: number;
  releasedReservations: number;
  seasonPlanItems: number;
  auditEvents: number;
}

/** Whole-farm counts for exact-one assertions. */
export async function countForFarm(farmId: string): Promise<FarmCounts> {
  const db = e2ePrisma();
  try {
    const [workOrders, completedWorkOrders, activities, stockMovements, complianceRecords, activeReservations, consumedReservations, releasedReservations, seasonPlanItems, auditEvents] = await Promise.all([
      db.workOrder.count({ where: { farmId } }),
      db.workOrder.count({ where: { farmId, status: 'completed' } }),
      db.activity.count({ where: { fieldSeason: { field: { farmId } } } }),
      db.stockMovement.count({ where: { inventoryItem: { farmId } } }),
      db.complianceRecord.count({ where: { activity: { fieldSeason: { field: { farmId } } } } }),
      db.inventoryReservation.count({ where: { farmId, status: 'active' } }),
      db.inventoryReservation.count({ where: { farmId, status: 'consumed' } }),
      db.inventoryReservation.count({ where: { farmId, status: 'released' } }),
      db.seasonPlanItem.count({ where: { farmId } }),
      db.auditEvent.count({ where: { farmId } }),
    ]);
    return { workOrders, completedWorkOrders, activities, stockMovements, complianceRecords, activeReservations, consumedReservations, releasedReservations, seasonPlanItems, auditEvents };
  } finally {
    await db.$disconnect();
  }
}

export interface WorkOrderState {
  id: string;
  status: string;
  completedActivityId: string | null;
  sourcePlanItemId: string | null;
  version: number;
  reservationStatuses: string[];
  auditActions: string[];
}

/** One WorkOrder's exact state, farm-scoped (null if it is not this farm's). */
export async function workOrderState(farmId: string, id: string): Promise<WorkOrderState | null> {
  const db = e2ePrisma();
  try {
    const wo = await db.workOrder.findFirst({ where: { id, farmId }, include: { reservations: true } });
    if (!wo) return null;
    const audits = await db.auditEvent.findMany({ where: { farmId, entityType: 'WorkOrder', entityId: id }, orderBy: { occurredAt: 'asc' } });
    return {
      id: wo.id, status: wo.status, completedActivityId: wo.completedActivityId, sourcePlanItemId: wo.sourcePlanItemId,
      version: wo.version, reservationStatuses: wo.reservations.map((r) => r.status), auditActions: audits.map((a) => a.action),
    };
  } finally {
    await db.$disconnect();
  }
}

/** The farm's most recently created work-order id (specs above create one each). */
export async function firstWorkOrderId(farmId: string): Promise<string | null> {
  const db = e2ePrisma();
  try {
    const wo = await db.workOrder.findFirst({ where: { farmId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    return wo?.id ?? null;
  } finally {
    await db.$disconnect();
  }
}

/** Physical stock + currently-reserved quantity for one inventory item. */
export async function inventoryStock(farmId: string, itemId: string): Promise<{ currentStock: number; activeReserved: number } | null> {
  const db = e2ePrisma();
  try {
    const item = await db.inventoryItem.findFirst({ where: { id: itemId, farmId }, select: { currentStock: true } });
    if (!item) return null;
    const reserved = await db.inventoryReservation.aggregate({ where: { inventoryItemId: itemId, status: 'active' }, _sum: { quantity: true } });
    return { currentStock: Number(item.currentStock), activeReserved: Number(reserved._sum.quantity ?? 0) };
  } finally {
    await db.$disconnect();
  }
}
