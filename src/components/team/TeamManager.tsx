'use client';

import { useActionState, useState } from 'react';
import { createEmployeeForm, updateEmployeeForm, type EmployeeFormState } from '@/lib/actions/employees';
import { useTranslations, useLocale } from '@/i18n/LocaleProvider';
import { getEnumLabel } from '@/i18n/enum-labels';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import type { CertStatus } from '@/lib/employee-cert-status';
import type { UserFacingError } from '@/lib/user-error';
import styles from './Team.module.css';

export interface TeamMember {
  id: string;
  name: string;
  role: string | null;
  hasSpraying: boolean;
  certNumber: string | null;
  certExpiry: string | null; // ISO date, yyyy-mm-dd, or null
  isActive: boolean;
  certStatus: CertStatus;
}

const initial: EmployeeFormState = {};
const badgeClass: Record<CertStatus, string> = {
  valid: 'badgeValid',
  expiring_soon: 'badgeExpiringSoon',
  expired: 'badgeExpired',
  not_certified: 'badgeNotCertified',
};

function CertBadge({ status, locale }: { status: CertStatus; locale: string }) {
  const label = getEnumLabel(locale as never, 'certStatus', status);
  return <span className={`${styles.badge} ${styles[badgeClass[status]]}`}>{label}</span>;
}

function ErrorMessage({ error }: { error: UserFacingError }) {
  const errorT = useTranslations('errors');
  const locale = useLocale();
  const model = buildUserErrorDisplayModel({ translator: errorT, locale, error });
  return <p className={styles.error}>{model.message}</p>;
}

function CreateForm() {
  const t = useTranslations('team');
  const [state, action, pending] = useActionState(createEmployeeForm, initial);
  return (
    <form action={action} className={styles.form} key={state.success ? 'reset' : 'active'}>
      <label>{t('fields.name')}<input name="name" required maxLength={120} /></label>
      <label>{t('fields.role')}<input name="role" maxLength={60} /></label>
      <label className={styles.checkboxLabel}><input type="checkbox" name="hasSpraying" />{t('fields.hasSpraying')}</label>
      <label>{t('fields.certNumber')}<input name="certNumber" maxLength={50} /></label>
      <label>{t('fields.certExpiry')}<input type="date" name="certExpiry" /></label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.button} disabled={pending}>{t('create.button')}</button>
      </div>
      {state.error && <ErrorMessage error={state.error} />}
      {state.success && <p className={styles.success}>{t('create.button')} ✓</p>}
    </form>
  );
}

function EditForm({ member, onDone }: { member: TeamMember; onDone: () => void }) {
  const t = useTranslations('team');
  const [state, action, pending] = useActionState(updateEmployeeForm, initial);
  if (state.success) onDone();
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="employeeId" value={member.id} />
      <label>{t('fields.name')}<input name="name" defaultValue={member.name} required maxLength={120} /></label>
      <label>{t('fields.role')}<input name="role" defaultValue={member.role ?? ''} maxLength={60} /></label>
      <label className={styles.checkboxLabel}><input type="checkbox" name="hasSpraying" defaultChecked={member.hasSpraying} />{t('fields.hasSpraying')}</label>
      <label>{t('fields.certNumber')}<input name="certNumber" defaultValue={member.certNumber ?? ''} maxLength={50} /></label>
      <label>{t('fields.certExpiry')}<input type="date" name="certExpiry" defaultValue={member.certExpiry ?? ''} /></label>
      <label className={styles.checkboxLabel}><input type="checkbox" name="isActive" defaultChecked={member.isActive} />{t('fields.isActive')}</label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.button} disabled={pending}>{t('edit.button')}</button>
        <button type="button" className={styles.buttonSecondary} onClick={onDone}>{t('cancel')}</button>
      </div>
      {state.error && <ErrorMessage error={state.error} />}
    </form>
  );
}

export function TeamManager({ members }: { members: TeamMember[] }) {
  const t = useTranslations('team');
  const locale = useLocale();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h2>{t('create.title')}</h2>
        <CreateForm />
        <p className={styles.muted}>{t('disclaimer')}</p>
      </section>

      <section className={styles.card}>
        <h2>{t('title')}</h2>
        {members.length === 0 ? (
          <p className={styles.muted}>{t('empty')}</p>
        ) : (
          <ul className={styles.list}>
            {members.map((member) =>
              editingId === member.id ? (
                <li key={member.id} className={styles.row}>
                  <EditForm member={member} onDone={() => setEditingId(null)} />
                </li>
              ) : (
                <li key={member.id} className={`${styles.row} ${!member.isActive ? styles.rowInactive : ''}`}>
                  <div>
                    <strong>{member.name}</strong>
                    {member.role ? <span className={styles.muted}> · {member.role}</span> : null}
                    <div className={styles.muted}>
                      {member.hasSpraying
                        ? member.certExpiry
                          ? t('status.certExpiresOn', { date: new Date(member.certExpiry).toLocaleDateString(locale) })
                          : t('status.noCertOnFile')
                        : null}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    {!member.isActive && <span className={styles.badge + ' ' + styles.badgeInactive}>{t('inactiveBadge')}</span>}
                    <CertBadge status={member.certStatus} locale={locale} />
                    <button type="button" className={styles.buttonSecondary} onClick={() => setEditingId(member.id)}>{t('actions.edit')}</button>
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
