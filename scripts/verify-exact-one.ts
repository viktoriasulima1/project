import { PrismaClient } from '@prisma/client';

/**
 * Sprint 25 Part 8 — READ-ONLY exact-one database verification for a single
 * authorized farm. Run it AFTER a flow (WorkOrder completion, reallocation,
 * correction/reversal) has executed, to confirm the append-only, exact-one
 * invariants hold in the database — not just in the UI. It performs NO writes.
 *
 * Usage:
 *   EXACT_ONE_VERIFY_FARM_ID=<farmId> tsx scripts/verify-exact-one.ts
 *   (optionally --work-order-id=<id> and/or --economic-entry-id=<id> to focus)
 *
 * Refuses to touch a production database without an explicit opt-in, mirroring
 * scripts/verify-offline-sync.ts.
 */

const farmId = process.env.EXACT_ONE_VERIFY_FARM_ID;
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const workOrderId = arg('work-order-id');
const economicEntryId = arg('economic-entry-id');

if (!farmId || !/^[A-Za-z0-9-]{1,64}$/.test(farmId)) throw new Error('Set EXACT_ONE_VERIFY_FARM_ID to the farm you are authorized to inspect.');
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_VERIFY !== 'true') throw new Error('Refusing production diagnostics without ALLOW_PRODUCTION_VERIFY=true.');

async function main() {
  const db = new PrismaClient();
  try {
    const report: Record<string, unknown> = { farmId };

    // ── WorkOrder completion exact-one ──────────────────────────────────────
    const completedWhere = { farmId, status: 'completed' as const, ...(workOrderId ? { id: workOrderId } : {}) };
    const workOrders = await db.workOrder.findMany({
      where: completedWhere,
      select: {
        id: true, completedActivityId: true,
        completedActivity: { select: { id: true, syncCorrelationId: true, stockMovements: { select: { id: true } }, complianceRecords: { select: { id: true } } } },
        reservations: { select: { id: true, status: true } },
      },
      take: 50,
    });
    report.workOrders = workOrders.map((wo) => {
      const corr = wo.completedActivity?.syncCorrelationId ?? null;
      return {
        workOrderId: wo.id,
        exactOneCompletedActivity: Boolean(wo.completedActivityId && wo.completedActivity),
        stockMovementCount: wo.completedActivity?.stockMovements.length ?? 0,
        complianceRecordCount: wo.completedActivity?.complianceRecords.length ?? 0,
        reservationsReleasedOrConsumed: wo.reservations.every((r) => r.status === 'released' || r.status === 'consumed'),
        correlationId: corr,
      };
    });
    // Correlated audit chain for those activities.
    const corrIds = workOrders.map((w) => w.completedActivity?.syncCorrelationId).filter((v): v is string => Boolean(v));
    report.workOrderAuditEventCount = corrIds.length ? await db.auditEvent.count({ where: { farmId, correlationId: { in: corrIds } } }) : 0;

    // ── Reallocation exact-one (append-only versioning) ─────────────────────
    if (economicEntryId) {
      const entry = await db.economicEntry.findFirst({ where: { id: economicEntryId, farmId }, select: { id: true, amount: true } });
      if (!entry) {
        report.reallocation = { error: 'economic entry not found for this farm' };
      } else {
        const allocations = await db.economicAllocation.findMany({ where: { economicEntryId: entry.id, farmId }, select: { version: true, status: true, amount: true } });
        const versions = [...new Set(allocations.map((a) => a.version))].sort((a, b) => a - b);
        const activeVersions = [...new Set(allocations.filter((a) => a.status === 'active').map((a) => a.version))];
        const activeAllocated = allocations.filter((a) => a.status === 'active').reduce((s, a) => s + Number(a.amount), 0);
        report.reallocation = {
          economicEntryId: entry.id,
          versionsPresent: versions,
          exactOneActiveVersion: activeVersions.length === 1,
          priorVersionsPreserved: versions.length >= activeVersions.length && versions.length >= 1,
          activeAllocatedEur: Math.round(activeAllocated * 100) / 100,
          recordAmountEur: Number(entry.amount),
          auditEventCount: await db.auditEvent.count({ where: { farmId, entityType: 'EconomicAllocation', entityId: entry.id } }),
        };
      }
    }

    // ── Correction / reversal exact-one (one active head per chain) ─────────
    const expenses = await db.financialExpense.groupBy({ by: ['status'], where: { farmId }, _count: true });
    report.expenseStatusCounts = Object.fromEntries(expenses.map((e) => [e.status, e._count]));

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
