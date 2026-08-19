import { Topbar } from '@/components/layout/Topbar';
import { FieldOperationsMap } from '@/components/operations/FieldOperationsMap';
import styles from '@/components/operations/Operations.module.css';
import { resolveFieldOperationalStatus } from '@/lib/field-operations';
import { db } from '@/lib/db';
import { requireFarm } from '@/lib/require-farm';
import { resolveFieldHealthStatus } from '@/lib/scouting/field-health';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Field operations map — FarmOS' };

export default async function FieldMapPage() {
  const farm = await requireFarm();
  const fields = await db.field.findMany({ where: { farmId: farm.id, deletedAt: null }, include: { fieldSeasons: { where: { season: { isActive: true } }, include: { workOrders: { orderBy: { dueDate: 'asc' } }, cropStageRecords: { where: { isEffective: true }, take: 1 }, scoutingVisits: { orderBy: { visitDate: 'desc' }, take: 10, include: { observations: true } } } } }, orderBy: { name: 'asc' } });
  const serialized = fields.map(field => { const active = field.fieldSeasons[0]; const status = resolveFieldOperationalStatus({ hasActiveSeason: Boolean(active), workOrders: active?.workOrders ?? [] }); const observations=active?.scoutingVisits.flatMap((v)=>v.observations)??[]; const health=resolveFieldHealthStatus({hasActiveSeason:Boolean(active),observations,growthStageObservedAt:active?.cropStageRecords[0]?.observedAt,overdueScoutingOrders:active?.workOrders.filter((o)=>o.operationType==='scout'&&o.dueDate&&o.dueDate<new Date()&&!['completed','cancelled'].includes(o.status)).length}); return { id: field.id, name: field.name, hectares: Number(field.hectares), crop: active?.crop ?? null, geometry: field.coordinates, status, nextWork: active?.workOrders.find(x => !['completed','cancelled'].includes(x.status))?.title ?? null, healthStatus:health.status, latestScoutingDate:active?.scoutingVisits[0]?.visitDate.toISOString()??null, unresolvedCount:observations.filter((o)=>['open','monitoring','action_planned'].includes(o.status)).length,currentStage:active?.cropStageRecords[0]?.stageCode??null }; });
  const center: [number, number] = [Number(farm.latitude ?? 52.1), Number(farm.longitude ?? 5.3)];
  return <><Topbar title="Field operations map" subtitle="One shared operational status across map and work queue" farmName={farm.name}/><main className={styles.page}>{serialized.length ? <FieldOperationsMap fields={serialized} center={center}/> : <div className={styles.card}><h2>No fields yet</h2><p>Add a field before opening the operational map.</p></div>}</main></>;
}
