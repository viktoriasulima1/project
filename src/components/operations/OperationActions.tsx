'use client';

import { useState, useTransition } from 'react';
import { convertPlanItemToWorkOrder, setWorkOrderStatus } from '@/lib/actions/field-operations';
import { useLocale, useTranslations } from '@/i18n/LocaleProvider';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import type { UserFacingError } from '@/lib/user-error';
import styles from './Operations.module.css';

export function ConvertPlanButton({ id }: { id: string }) {
  const [pending, start] = useTransition(); const [error, setError] = useState<UserFacingError>();
  const t = useTranslations('workOrders');
  return <><button className={styles.button} disabled={pending} onClick={() => start(async () => { const result = await convertPlanItemToWorkOrder(id); setError(result.error); })}>{pending ? t('form.saving') : t('create.title')}</button>{error && <LocalizedInlineError error={error} />}</>;
}

export function WorkOrderStatusActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition(); const [error, setError] = useState<UserFacingError>();
  const t = useTranslations('workOrders');
  const update = (next: 'ready' | 'assigned' | 'in_progress' | 'blocked' | 'cancelled') => start(async () => { const result = await setWorkOrderStatus(id, next, next === 'blocked' ? 'Needs attention' : undefined); setError(result.error); });
  if (status === 'completed' || status === 'cancelled') return null;
  return <div className={styles.actions}>{status !== 'in_progress' && <button className={styles.button} disabled={pending} onClick={() => update('in_progress')}>{t('actions.start')}</button>}<button className={styles.button} disabled={pending} onClick={() => update('blocked')}>{t('actions.block')}</button><button className={styles.button} disabled={pending} onClick={() => update('cancelled')}>{t('actions.cancel')}</button>{error && <LocalizedInlineError error={error} />}</div>;
}

function LocalizedInlineError({ error }: { error: UserFacingError }) {
  const locale = useLocale();
  const translator = useTranslations('errors');
  const display = buildUserErrorDisplayModel({ translator, locale, error });
  return <span className={styles.error} role="alert">{display.message}</span>;
}
