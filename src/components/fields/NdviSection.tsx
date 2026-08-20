'use client';

import { useState, useTransition } from 'react';
import { refreshFieldNdvi } from '@/lib/actions/ndvi';
import { useTranslations, useLocale } from '@/i18n/LocaleProvider';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import type { UserFacingError } from '@/lib/user-error';
import styles from './FieldEconomics.module.css';

export interface NdviReadingRow {
  id: string;
  periodFrom: string; // ISO date
  meanNdvi: string | null;
  cloudCoveragePct: string | null;
}

export function NdviSection({ fieldId, hasGeometry, readings }: { fieldId: string; hasGeometry: boolean; readings: NdviReadingRow[] }) {
  const t = useTranslations('fields');
  const errorT = useTranslations('errors');
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [error, setError] = useState<UserFacingError | undefined>();

  const latest = readings[0];

  return (
    <section className={styles.card}>
      <h2>{t('detail.ndviTitle')}</h2>

      {latest ? (
        <p>
          <strong>{t('detail.ndviLatest', { date: new Date(latest.periodFrom).toLocaleDateString(locale) })}</strong>{' '}
          {latest.meanNdvi != null ? t('detail.ndviValue', { value: latest.meanNdvi }) : t('detail.ndviNoValue')}
          {latest.cloudCoveragePct != null && <span className={styles.muted}> · {t('detail.ndviCloudCoverage', { pct: latest.cloudCoveragePct })}</span>}
        </p>
      ) : (
        <p className={styles.muted}>{t('detail.ndviEmpty')}</p>
      )}

      {!hasGeometry ? (
        <p className={styles.muted}>{t('detail.ndviNoGeometry')}</p>
      ) : (
        <button
          type="button"
          className={styles.secondary}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await refreshFieldNdvi(fieldId);
              setError(result.success ? undefined : result.error);
            })
          }
        >
          {pending ? t('detail.ndviRefreshing') : t('detail.ndviRefresh')}
        </button>
      )}

      {error && <p className={styles.muted}>{buildUserErrorDisplayModel({ translator: errorT, locale, error }).message}</p>}

      <p className={styles.disclaimer}>{t('detail.ndviDisclaimer')}</p>
    </section>
  );
}
