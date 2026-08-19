import { Topbar } from '@/components/layout/Topbar';
import { ConvertPlanButton } from '@/components/operations/OperationActions';
import { PlanItemForm } from '@/components/operations/OperationForms';
import styles from '@/components/operations/Operations.module.css';
import { db } from '@/lib/db';
import { requireFarm } from '@/lib/require-farm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Season planning — FarmOS' };

export default async function PlanningPage() {
  const farm = await requireFarm();
  const [fieldSeasons, inventory, plans] = await Promise.all([
    db.fieldSeason.findMany({ where: { field: { farmId: farm.id, deletedAt: null }, season: { isActive: true } }, include: { field: true, season: true }, orderBy: { field: { name: 'asc' } } }),
    db.inventoryItem.findMany({ where: { farmId: farm.id }, orderBy: { name: 'asc' } }),
    db.seasonPlanItem.findMany({ where: { farmId: farm.id }, include: { fieldSeason: { include: { field: true, season: true } }, expectedProduct: true, workOrders: true }, orderBy: { windowStart: 'asc' }, take: 200 }),
  ]);
  return <><Topbar title="Season planning" subtitle="Strategic work windows before operational assignment" farmName={farm.name}/><main className={styles.page}>
    <section className={styles.grid}><div className={styles.card}><h2>Add plan item</h2>{fieldSeasons.length ? <PlanItemForm fieldSeasons={fieldSeasons.map(x => ({ id: x.id, label: `${x.field.name} · ${x.crop} · ${x.season.year}` }))} inventory={inventory.map(x => ({ id: x.id, label: `${x.name} (${x.currentStock} ${x.unit})` }))}/> : <p>No fields are assigned to the active season yet.</p>}</div>
    <div className={styles.card}><h2>Operation templates</h2><p className={styles.muted}>Use these consistent operation types when building a crop plan.</p><ul><li>Soil preparation → sow → scout</li><li>Fertilise / spray / irrigate</li><li>Harvest and custom field work</li></ul><p className={styles.muted}>Templates provide structure; they never create or submit an activity automatically.</p></div></section>
    <section className={styles.card}><h2>Season plan</h2>{plans.length === 0 ? <p className={styles.muted}>No plan items yet.</p> : <ul className={styles.list}>{plans.map(plan => <li className={styles.row} key={plan.id}><div><strong>{plan.title}</strong><div className={styles.muted}>{plan.fieldSeason.field.name} · {plan.operationType.replaceAll('_', ' ')} · {plan.windowStart.toLocaleDateString()}–{plan.windowEnd.toLocaleDateString()}</div>{plan.expectedProduct && <div className={styles.muted}>{plan.expectedProduct.name}: {Number(plan.expectedQuantity)} {plan.expectedProduct.unit}</div>}<div className={styles.actions}>{plan.workOrders.length === 0 && plan.status !== 'cancelled' ? <ConvertPlanButton id={plan.id}/> : <a className={styles.button} href={`/work-orders?plan=${plan.id}`}>Open work order</a>}</div></div><span className={styles.badge}>{plan.status}</span></li>)}</ul>}</section>
  </main></>;
}
