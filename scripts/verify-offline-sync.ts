import { PrismaClient } from '@prisma/client';

const localDraftId = process.argv.find((arg) => arg.startsWith('--local-draft-id='))?.slice('--local-draft-id='.length);
const authorizedFarmId = process.env.OFFLINE_VERIFY_FARM_ID;
if (!localDraftId || !/^[A-Za-z0-9_-]{1,100}$/.test(localDraftId)) throw new Error('Provide a valid --local-draft-id=<id>.');
if (!authorizedFarmId) throw new Error('Set OFFLINE_VERIFY_FARM_ID to the farm you are authorized to inspect.');
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_OFFLINE_VERIFY !== 'true') throw new Error('Refusing production diagnostics without ALLOW_PRODUCTION_OFFLINE_VERIFY=true.');

async function main() {
 const db = new PrismaClient();
 try {
  const activities = await db.activity.findMany({
    where: { offlineDraftId: localDraftId, fieldSeason: { field: { farmId: authorizedFarmId } } },
    select: { id:true, offlineDraftId:true, idempotencyKey:true, syncCorrelationId:true, fieldSeason:{select:{field:{select:{farmId:true}}}}, stockMovements:{select:{id:true,quantity:true}}, complianceRecords:{select:{id:true}} },
  });
  const correlations = activities.map((activity) => activity.syncCorrelationId).filter((value): value is string => Boolean(value));
  const auditCount = correlations.length ? await db.auditEvent.count({ where: { farmId: authorizedFarmId, correlationId: { in: correlations } } }) : 0;
  const report = {
    localDraftId,
    activityCount: activities.length,
    stockMovementCount: activities.reduce((sum, item) => sum + item.stockMovements.length, 0),
    complianceRecordCount: activities.reduce((sum, item) => sum + item.complianceRecords.length, 0),
    auditEventCount: auditCount,
    idempotencyKeyCount: new Set(activities.map((item) => item.idempotencyKey).filter(Boolean)).size,
    correlationIdCount: new Set(correlations).size,
    inventoryEffect: activities.flatMap((item) => item.stockMovements).reduce((sum, item) => sum + Number(item.quantity), 0),
    exactOneActivity: activities.length === 1,
    exactOneComplianceRecord: activities.length === 1 && activities[0].complianceRecords.length === 1,
  };
  console.log(JSON.stringify(report, null, 2));
  if (activities.length > 1) process.exitCode = 2;
 } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
