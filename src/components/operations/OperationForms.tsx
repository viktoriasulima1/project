'use client';

import { useActionState } from 'react';
import { createSeasonPlanItem, createWorkOrder, type FieldOperationActionState } from '@/lib/actions/field-operations';
import { useLocale, useTranslations } from '@/i18n/LocaleProvider';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import styles from './Operations.module.css';

type Choice = { id: string; label: string };
const operationTypes = ['soil_preparation', 'sow', 'fertilise', 'spray', 'irrigate', 'scout', 'tillage', 'harvest', 'custom'];
const initial: FieldOperationActionState = {};

function LocalizedActionError({ error }: { error: NonNullable<FieldOperationActionState['error']> }) {
  const locale = useLocale();
  const translator = useTranslations('errors');
  const display = buildUserErrorDisplayModel({ translator, locale, error });
  return <p className={styles.error} role="alert">{display.message}</p>;
}

export function PlanItemForm({ fieldSeasons, inventory }: { fieldSeasons: Choice[]; inventory: Choice[] }) {
  const [state, action, pending] = useActionState(createSeasonPlanItem, initial);
  return <form action={action} className={styles.form}>
    <label>Field and season<select name="fieldSeasonId" required>{fieldSeasons.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
    <label>Operation<select name="operationType">{operationTypes.map(x => <option value={x} key={x}>{x.replaceAll('_', ' ')}</option>)}</select></label>
    <label>Title<input name="title" required maxLength={160} /></label>
    <div className={styles.grid}><label>Window start<input type="date" name="windowStart" required /></label><label>Window end<input type="date" name="windowEnd" required /></label></div>
    <label>Expected area (ha)<input type="number" step="0.01" min="0" name="expectedAreaHa" /></label>
    <label>Expected product<select name="expectedProductId"><option value="">None</option>{inventory.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
    <label>Expected quantity<input type="number" step="0.001" min="0" name="expectedQuantity" /></label>
    <label>Expected cost (€)<input type="number" step="0.01" min="0" name="expectedCostEur" /></label>
    <div className={styles.grid}><label>Input budget (€)<input type="number" step="0.01" min="0" name="expectedInputCostEur" /></label><label>Labour budget (€)<input type="number" step="0.01" min="0" name="expectedLabourCostEur" /></label><label>Machine budget (€)<input type="number" step="0.01" min="0" name="expectedMachineCostEur" /></label><label>Contractor budget (€)<input type="number" step="0.01" min="0" name="expectedContractorCostEur" /></label><label>Overhead budget (€)<input type="number" step="0.01" min="0" name="expectedOverheadEur" /></label><label>Expected revenue (€)<input type="number" step="0.01" min="0" name="expectedRevenueEur" /></label><label>Expected yield<input type="number" step="0.001" min="0" name="expectedYieldQuantity" /></label><label>Yield unit<input name="expectedYieldUnit" placeholder="tonnes, kg, boxes…" /></label><label>Expected sale price/unit (€)<input type="number" step="0.0001" min="0" name="expectedSalePrice" /></label></div>
    <label>Reason / agronomic note<textarea name="reason" rows={3} /></label>
    {state.error && <LocalizedActionError error={state.error} />}{state.success && <p className={styles.success}>Plan item saved.</p>}
    <button disabled={pending || !fieldSeasons.length}>{pending ? 'Saving…' : 'Add to season plan'}</button>
  </form>;
}

export function WorkOrderForm({ fieldSeasons, inventory, machines, employees }: { fieldSeasons: Choice[]; inventory: Choice[]; machines: Choice[]; employees: Choice[] }) {
  const [state, action, pending] = useActionState(createWorkOrder, initial);
  const t = useTranslations('workOrders');
  const te = useTranslations('enums');
  // Priority values are explicit canonical tokens; only the labels localize —
  // a translated label can never be submitted as the value.
  const priorities = ['medium', 'high', 'critical', 'low'] as const;
  return <form action={action} className={styles.form}>
    <label>{t('form.fieldAndSeason')}<select name="fieldSeasonId" required>{fieldSeasons.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
    <label>{t('form.operation')}<select name="operationType">{operationTypes.map(x => <option value={x} key={x}>{te(`operationType.${x}`)}</option>)}</select></label>
    <label>{t('form.title')}<input name="title" required /></label>
    <div className={styles.grid}><label>{t('form.priority')}<select name="priority">{priorities.map(p => <option value={p} key={p}>{te(`priority.${p}`)}</option>)}</select></label><label>{t('form.dueDate')}<input type="date" name="dueDate" /></label></div>
    <label>{t('form.machine')}<select name="machineId"><option value="">{t('form.notAssigned')}</option>{machines.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
    <label>{t('form.employee')}<select name="employeeId"><option value="">{t('form.notAssigned')}</option>{employees.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
    <label>{t('form.reserveInventory')}<select name="inventoryItemId"><option value="">{t('form.none')}</option>{inventory.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
    <label>{t('form.reservationQuantity')}<input type="number" step="0.001" min="0" name="reservationQuantity" /></label>
    <label>{t('form.instructions')}<textarea name="instructions" rows={3} /></label>
    {state.error && <LocalizedActionError error={state.error} />}{state.success && <p className={styles.success}>{t('form.created')}</p>}
    <button disabled={pending || !fieldSeasons.length}>{pending ? t('form.saving') : t('form.submit')}</button>
  </form>;
}
