'use server';

import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { getChainForRoot } from '@/lib/compliance-data';
import { labelVersion, type ActivityVersionLabel } from '@/lib/activity-versions';

export interface AuditHistoryEntry {
  id: string;
  action: string;
  occurredAt: string;
  actorUserId: string | null;
  actorType: string;
  reason: string | null;
  entityType: string;
  entityId: string;
}

export interface InventoryMovementEntry {
  id: string;
  productName: string;
  quantity: number;
  direction: string;
  notes: string | null;
  createdAt: string;
}

export interface ChainVersionEntry {
  activityId: string;
  version: number;
  labels: ActivityVersionLabel[];
  correctionReason: string | null;
  correctionDiff: Record<string, { old: unknown; new: unknown }> | null;
  createdAt: string;
  date: string;
}

export interface RecordDetail {
  chain: ChainVersionEntry[];
  auditHistory: AuditHistoryEntry[];
  inventoryMovements: InventoryMovementEntry[];
}

/**
 * Read-only — everything Part 9's "Record details" panel needs (correction
 * chain, audit history, inventory movements), scoped strictly to the
 * requesting farm's own data. `rootActivityId` is never trusted blindly:
 * `getChainForRoot` filters by `farmId` internally, and an empty result
 * here (rather than another farm's chain) is exactly what a crafted
 * cross-farm id should produce.
 */
export async function getComplianceRecordDetail(rootActivityId: string): Promise<{ error?: string; detail?: RecordDetail }> {
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Farm not found.' };
  }

  const chain = await getChainForRoot(farm.id, rootActivityId);
  if (chain.length === 0) {
    return { error: 'Record not found or does not belong to this farm.' };
  }

  const activityIds = chain.map((a) => a.id);

  const [auditEvents, movements] = await Promise.all([
    db.auditEvent.findMany({
      where: { farmId: farm.id, entityType: 'Activity', entityId: { in: activityIds } },
      orderBy: { occurredAt: 'asc' },
    }),
    db.stockMovement.findMany({
      where: { activityId: { in: activityIds } },
      include: { inventoryItem: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const chainEntries: ChainVersionEntry[] = chain.map((activity) => ({
    activityId: activity.id,
    version: activity.version,
    labels: labelVersion(activity, chain),
    correctionReason: activity.correctionReason,
    correctionDiff: (activity.correctionDiff as Record<string, { old: unknown; new: unknown }> | null) ?? null,
    createdAt: activity.createdAt.toISOString(),
    date: activity.date.toISOString(),
  }));

  const auditHistory: AuditHistoryEntry[] = auditEvents.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
    actorUserId: e.actorUserId,
    actorType: e.actorType,
    reason: e.reason,
    entityType: e.entityType,
    entityId: e.entityId,
  }));

  const inventoryMovements: InventoryMovementEntry[] = movements.map((m) => ({
    id: m.id,
    productName: m.inventoryItem.name,
    quantity: Number(m.quantity),
    direction: m.direction,
    notes: m.notes,
    createdAt: m.createdAt.toISOString(),
  }));

  return { detail: { chain: chainEntries, auditHistory, inventoryMovements } };
}
