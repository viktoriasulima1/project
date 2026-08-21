import { Topbar } from '@/components/layout/Topbar';
import { WorkOrderStatusActions } from '@/components/operations/OperationActions';
import { WorkOrderForm } from '@/components/operations/OperationForms';
import styles from '@/components/operations/Operations.module.css';
import { resolveResourceReadiness, resolveWorkOrderPriority } from '@/lib/field-operations';
import { db } from '@/lib/db';
import { requireFarm } from '@/lib/require-farm';
import { getServerLocale, getServerI18n } from '@/i18n/server';
import { getEnumLabel } from '@/i18n/enum-labels';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Work orders — FarmOS' };

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<{ field?: string; plan?: string; view?: string }> }) {
  const farm = await requireFarm(); const filters = await searchParams;
  const [fieldSeasons, inventory, machines, employees, orders] = await Promise.all([
    db.fieldSeason.findMany({ where: { field: { farmId: farm.id, deletedAt: null }, season: { isActive: true } }, include: { field: true, season: true }, orderBy: { field: { name: 'asc' } } }),
    db.inventoryItem.findMany({ where: { farmId: farm.id }, orderBy: { name: 'asc' } }), db.machine.findMany({ where: { farmId: farm.id }, orderBy: { name: 'asc' } }), db.employee.findMany({ where: { farmId: farm.id, isActive: true }, orderBy: { name: 'asc' } }),
    db.workOrder.findMany({ where: { farmId: farm.id, ...(filters.field ? { fieldSeason: { fieldId: filters.field } } : {}), ...(filters.plan ? { sourcePlanItemId: filters.plan } : {}), ...(filters.view === 'today' ? { dueDate: { lte: new Date(new Date().setHours(23,59,59,999)) }, status: { notIn: ['completed','cancelled'] } } : {}) }, include: { fieldSeason: { include: { field: true, season: true } }, machine: true, employees: { include: { employee: true } }, reservations: { include: { inventoryItem: { include: { reservations: { where: { status: 'active' } } } } } }, completedActivity: true }, orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }], take: 300 }),
  ]);
  const locale = await getServerLocale();
  const { t } = await getServerI18n(['workOrders']);
  const opLabel = (v: string) => getEnumLabel(locale, 'operationType', v);
  return <><Topbar title={t('title')} subtitle={t('subtitle')} farmName={farm.name}/><main className={styles.page}>
    <div className={styles.actions}><a className={`${styles.tab} ${filters.view === 'today' ? styles.tabActive : ''}`} href="/work-orders?view=today">{t('tabs.today')}</a><a className={`${styles.tab} ${filters.view !== 'today' ? styles.tabActive : ''}`} href="/work-orders">{t('tabs.allWork')}</a><a className={styles.tab} href="/planning">{t('tabs.seasonPlan')}</a></div>
    <section className={styles.grid}><div className={styles.card}><h2>{t('create.title')}</h2>{fieldSeasons.length ? <WorkOrderForm fieldSeasons={fieldSeasons.map(x => ({ id: x.id, label: `${x.field.name} · ${x.crop} · ${x.season.year}` }))} inventory={inventory.map(x => ({ id: x.id, label: `${x.name} (${x.currentStock} ${x.unit})` }))} machines={machines.map(x => ({ id: x.id, label: x.name }))} employees={employees.map(x => ({ id: x.id, label: x.name }))}/> : <p>{t('form.noFieldSeasons')}</p>}</div>
    <div className={styles.card}><h2>{t('readiness.title')}</h2><p className={styles.muted}>{t('readiness.explanation')}</p></div></section>
    <section className={styles.card}><h2>{filters.view === 'today' ? t('queue.today') : t('queue.title')}</h2>{orders.length === 0 ? <p className={styles.muted}>{t('queue.empty')}</p> : <ul className={styles.list}>{orders.map(order => { const reservation = order.reservations[0]; const reservedElsewhere = reservation?.inventoryItem.reservations.filter(x => x.workOrderId !== order.id).reduce((s,x) => s + Number(x.quantity), 0) ?? 0; const readiness = resolveResourceReadiness({ requiredQuantity: reservation ? Number(reservation.quantity) : null, currentStock: reservation ? Number(reservation.inventoryItem.currentStock) : null, reservedElsewhere, needsMachine: Boolean(order.machineId), machineAvailable: order.machine ? order.machine.isCertified : !order.machineId, needsCertifiedOperator: order.operationType === 'spray', certifiedOperatorAssigned: order.employees.some(x => x.employee.hasSpraying && (!x.employee.certExpiry || x.employee.certExpiry >= new Date())) }); const priority = resolveWorkOrderPriority({ explicit: order.priority, status: order.status, dueDate: order.dueDate, blockerReason: order.blockerReason }); return <li className={styles.row} key={order.id}><div><strong>{order.title}</strong><div className={styles.muted}>{order.fieldSeason.field.name} · {opLabel(order.operationType)}{order.dueDate ? ` · ${t('row.due', { date: order.dueDate.toLocaleDateString(locale) })}` : ''}</div><div className={styles.muted}>{readiness.ready ? t('row.resourcesReady') : t('row.blocked', { blockers: readiness.blockers.join(', ').replaceAll('_',' ') })}</div>{order.completedActivity ? <a href={`/activities?activity=${order.completedActivity.id}`}>{t('row.actualRecord')}</a> : ['ready', 'assigned', 'in_progress'].includes(order.status) ? <a href={`/activities?workOrder=${order.id}&fieldSeason=${order.fieldSeasonId}&type=${order.operationType === 'custom' ? 'other' : order.operationType}`}>{t('row.recordActual')}</a> : null}<WorkOrderStatusActions id={order.id} status={order.status}/></div><div><span className={styles.badge}>{getEnumLabel(locale,'workOrderStatus',order.status)}</span> <span className={styles.badge}>{getEnumLabel(locale,'priority',priority)}</span></div></li>; })}</ul>}</section>
  </main></>;
}
