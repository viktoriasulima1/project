'use client';

import { useActionState } from 'react';
import { upsertNutrientNormReferenceForm, type NutrientNormFormState } from '@/lib/actions/nutrient-norms';
import { updateInventoryNutrientsForm, type UpdateInventoryNutrientsFormState } from '@/lib/actions/inventory';
import { useTranslations, useLocale } from '@/i18n/LocaleProvider';
import { getEnumLabel } from '@/i18n/enum-labels';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import type { UserFacingError } from '@/lib/user-error';
import styles from './Nutrients.module.css';

export interface BalanceRow {
  fieldId: string;
  fieldName: string;
  crop: string;
  nitrogenKg: number;
  phosphateKg: number;
  incompleteProducts: string[];
  excludedUnitActivities: number;
  nitrogenNormKgPerHa: number | null;
  phosphateNormKgPerHa: number | null;
}

export interface NormRow {
  crop: string;
  nitrogenNormKgPerHa: string | null;
  phosphateNormKgPerHa: string | null;
  source: string | null;
  verifiedAt: string | null; // ISO date
}

export interface IncompleteProduct { id: string; name: string }

const normInitial: NutrientNormFormState = {};
const invInitial: UpdateInventoryNutrientsFormState = {};

function ErrorMessage({ error }: { error: UserFacingError }) {
  const errorT = useTranslations('errors');
  const locale = useLocale();
  const model = buildUserErrorDisplayModel({ translator: errorT, locale, error });
  return <p className={styles.error}>{model.message}</p>;
}

function usageBadge(kg: number, norm: number | null, t: (key: string, vars?: Record<string, string>) => string) {
  if (norm == null || norm === 0) return <span className={`${styles.badge} ${styles.badgeNeutral}`}>{t('balance.noNorm')}</span>;
  const pct = Math.round((kg / norm) * 100);
  const cls = pct > 100 ? styles.badgeOver : pct >= 85 ? styles.badgeNear : styles.badgeOk;
  return <span className={`${styles.badge} ${cls}`}>{t('balance.ofNorm', { pct: String(pct) })}</span>;
}

function BalanceTable({ rows }: { rows: BalanceRow[] }) {
  const t = useTranslations('nutrients');
  const locale = useLocale();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('balance.field')}</th>
            <th>{t('balance.crop')}</th>
            <th>{t('balance.nitrogen')}</th>
            <th>{t('balance.phosphate')}</th>
            <th>{t('balance.norm')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.fieldId}>
              <td>{row.fieldName}</td>
              <td>{getEnumLabel(locale as never, 'crop', row.crop)}</td>
              <td>
                {row.nitrogenKg}
                {row.incompleteProducts.length > 0 && <div className={styles.warning}>{t('balance.incompleteWarning', { count: String(row.incompleteProducts.length) })}</div>}
                {row.excludedUnitActivities > 0 && <div className={styles.warning}>{t('balance.excludedWarning', { count: String(row.excludedUnitActivities) })}</div>}
              </td>
              <td>{row.phosphateKg}</td>
              <td>{usageBadge(row.nitrogenKg, row.nitrogenNormKgPerHa, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NormForm({ norm }: { norm: NormRow }) {
  const t = useTranslations('nutrients');
  const [state, action, pending] = useActionState(upsertNutrientNormReferenceForm, normInitial);
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="crop" value={norm.crop} />
      <label>{t('norms.nitrogenNorm')}<input type="number" name="nitrogenNormKgPerHa" min={0} max={999} step={0.1} defaultValue={norm.nitrogenNormKgPerHa ?? undefined} /></label>
      <label>{t('norms.phosphateNorm')}<input type="number" name="phosphateNormKgPerHa" min={0} max={999} step={0.1} defaultValue={norm.phosphateNormKgPerHa ?? undefined} /></label>
      <label>{t('norms.source')}<input name="source" maxLength={200} placeholder={t('norms.sourcePlaceholder')} defaultValue={norm.source ?? ''} /></label>
      <label>{t('norms.verifiedAt')}<input type="date" name="verifiedAt" defaultValue={norm.verifiedAt ?? ''} /></label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.button} disabled={pending}>{t('norms.save')}</button>
      </div>
      {state.error && <ErrorMessage error={state.error} />}
    </form>
  );
}

function CompositionForm({ product }: { product: IncompleteProduct }) {
  const t = useTranslations('nutrients');
  const [state, action, pending] = useActionState(updateInventoryNutrientsForm, invInitial);
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="itemId" value={product.id} />
      <strong style={{ gridColumn: '1 / -1' }}>{product.name}</strong>
      <label>{t('composition.nitrogenPercent')}<input type="number" name="nitrogenPercent" min={0} max={100} step={0.1} /></label>
      <label>{t('composition.phosphorusPercent')}<input type="number" name="phosphorusPercent" min={0} max={100} step={0.1} /></label>
      <label>{t('composition.potassiumPercent')}<input type="number" name="potassiumPercent" min={0} max={100} step={0.1} /></label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.button} disabled={pending}>{t('composition.save')}</button>
      </div>
      {state.error && <ErrorMessage error={state.error} />}
    </form>
  );
}

export function NutrientsManager({ balance, norms, incompleteProducts }: { balance: BalanceRow[]; norms: NormRow[]; incompleteProducts: IncompleteProduct[] }) {
  const t = useTranslations('nutrients');
  const locale = useLocale();

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h2>{t('balance.title')}</h2>
        {balance.length === 0 ? <p className={styles.muted}>{t('noSeason')}</p> : <BalanceTable rows={balance} />}
      </section>

      {norms.length > 0 && (
        <section className={styles.card}>
          <h2>{t('norms.title')}</h2>
          <p className={styles.explanation}>{t('norms.explanation')}</p>
          {norms.map((norm) => (
            <div className={styles.normRow} key={norm.crop}>
              <h3>{getEnumLabel(locale as never, 'crop', norm.crop)}</h3>
              <NormForm norm={norm} />
            </div>
          ))}
        </section>
      )}

      <section className={styles.card}>
        <h2>{t('composition.title')}</h2>
        <p className={styles.explanation}>{t('composition.explanation')}</p>
        {incompleteProducts.length === 0 ? (
          <p className={styles.muted}>{t('composition.empty')}</p>
        ) : (
          <div className={styles.page} style={{ padding: 0 }}>
            {incompleteProducts.map((product) => <CompositionForm key={product.id} product={product} />)}
          </div>
        )}
      </section>
    </div>
  );
}
