'use client';

import { useActionState, useState } from 'react';
import { createMachineDetailedForm, updateMachineForm, type MachineFormState } from '@/lib/actions/machines';
import { useTranslations, useLocale } from '@/i18n/LocaleProvider';
import { getEnumLabel } from '@/i18n/enum-labels';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import type { ServiceStatus } from '@/lib/machine-service-status';
import type { UserFacingError } from '@/lib/user-error';
import styles from './Machines.module.css';

const MACHINE_TYPES = ['tractor', 'sprayer', 'combine', 'drill', 'cultivator', 'loader', 'trailer', 'other'] as const;

export interface MachineRow {
  id: string;
  name: string;
  type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  hoursSinceService: number | null;
  nextServiceDueHours: number | null;
  isCertified: boolean;
  serviceStatus: ServiceStatus;
}

const initial: MachineFormState = {};
const badgeClass: Record<ServiceStatus, string> = {
  ok: 'badgeOk',
  due_soon: 'badgeDueSoon',
  overdue: 'badgeOverdue',
  not_certified: 'badgeNeutral',
};

function ServiceBadge({ status }: { status: ServiceStatus }) {
  const t = useTranslations('machines');
  const key = status === 'ok' ? 'status.serviceOk' : status === 'due_soon' ? 'status.serviceDueSoon' : status === 'overdue' ? 'status.serviceOverdue' : 'status.notCertified';
  return <span className={`${styles.badge} ${styles[badgeClass[status]]}`}>{t(key)}</span>;
}

function ErrorMessage({ error }: { error: UserFacingError }) {
  const errorT = useTranslations('errors');
  const locale = useLocale();
  const model = buildUserErrorDisplayModel({ translator: errorT, locale, error });
  return <p className={styles.error}>{model.message}</p>;
}

function TypeSelect({ defaultValue }: { defaultValue?: string }) {
  const locale = useLocale();
  return (
    <select name="type" required defaultValue={defaultValue}>
      {MACHINE_TYPES.map((value) => (
        <option key={value} value={value}>{getEnumLabel(locale as never, 'machineType', value)}</option>
      ))}
    </select>
  );
}

function CreateForm() {
  const t = useTranslations('machines');
  const [state, action, pending] = useActionState(createMachineDetailedForm, initial);
  return (
    <form action={action} className={styles.form} key={state.success ? 'reset' : 'active'}>
      <label>{t('fields.name')}<input name="name" required maxLength={100} /></label>
      <label>{t('fields.type')}<TypeSelect /></label>
      <label>{t('fields.make')}<input name="make" maxLength={80} /></label>
      <label>{t('fields.model')}<input name="model" maxLength={80} /></label>
      <label>{t('fields.year')}<input type="number" name="year" min={1950} max={2100} /></label>
      <label>{t('fields.hoursSinceService')}<input type="number" name="hoursSinceService" min={0} /></label>
      <label>{t('fields.nextServiceDueHours')}<input type="number" name="nextServiceDueHours" min={0} /></label>
      <label className={styles.checkboxLabel}><input type="checkbox" name="isCertified" defaultChecked />{t('fields.isCertified')}</label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.button} disabled={pending}>{t('create.button')}</button>
      </div>
      {state.error && <ErrorMessage error={state.error} />}
      {state.success && <p className={styles.success}>{t('create.button')} ✓</p>}
    </form>
  );
}

function EditForm({ machine, onDone }: { machine: MachineRow; onDone: () => void }) {
  const t = useTranslations('machines');
  const [state, action, pending] = useActionState(updateMachineForm, initial);
  if (state.success) onDone();
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="machineId" value={machine.id} />
      <label>{t('fields.name')}<input name="name" defaultValue={machine.name} required maxLength={100} /></label>
      <label>{t('fields.type')}<TypeSelect defaultValue={machine.type} /></label>
      <label>{t('fields.make')}<input name="make" defaultValue={machine.make ?? ''} maxLength={80} /></label>
      <label>{t('fields.model')}<input name="model" defaultValue={machine.model ?? ''} maxLength={80} /></label>
      <label>{t('fields.year')}<input type="number" name="year" defaultValue={machine.year ?? undefined} min={1950} max={2100} /></label>
      <label>{t('fields.hoursSinceService')}<input type="number" name="hoursSinceService" defaultValue={machine.hoursSinceService ?? undefined} min={0} /></label>
      <label>{t('fields.nextServiceDueHours')}<input type="number" name="nextServiceDueHours" defaultValue={machine.nextServiceDueHours ?? undefined} min={0} /></label>
      <label className={styles.checkboxLabel}><input type="checkbox" name="isCertified" defaultChecked={machine.isCertified} />{t('fields.isCertified')}</label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.button} disabled={pending}>{t('edit.button')}</button>
        <button type="button" className={styles.buttonSecondary} onClick={onDone}>{t('cancel')}</button>
      </div>
      {state.error && <ErrorMessage error={state.error} />}
    </form>
  );
}

export function MachineManager({ machines }: { machines: MachineRow[] }) {
  const t = useTranslations('machines');
  const locale = useLocale();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h2>{t('create.title')}</h2>
        <CreateForm />
      </section>

      <section className={styles.card}>
        <h2>{t('title')}</h2>
        {machines.length === 0 ? (
          <p className={styles.muted}>{t('empty')}</p>
        ) : (
          <ul className={styles.list}>
            {machines.map((machine) =>
              editingId === machine.id ? (
                <li key={machine.id} className={styles.row}>
                  <EditForm machine={machine} onDone={() => setEditingId(null)} />
                </li>
              ) : (
                <li key={machine.id} className={styles.row}>
                  <div>
                    <strong>{machine.name}</strong>
                    <span className={styles.muted}> · {getEnumLabel(locale as never, 'machineType', machine.type)}</span>
                    {(machine.make || machine.model || machine.year) && (
                      <div className={styles.muted}>{[machine.make, machine.model, machine.year].filter(Boolean).join(' ')}</div>
                    )}
                  </div>
                  <div className={styles.rowActions}>
                    <ServiceBadge status={machine.serviceStatus} />
                    <button type="button" className={styles.buttonSecondary} onClick={() => setEditingId(machine.id)}>{t('actions.edit')}</button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
