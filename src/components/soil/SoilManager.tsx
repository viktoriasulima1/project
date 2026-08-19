'use client';

import { useActionState, useState, useTransition } from 'react';
import { createSoilAnalysisForm, deleteSoilAnalysis, type SoilAnalysisFormState } from '@/lib/actions/soil-analyses';
import { useTranslations, useLocale } from '@/i18n/LocaleProvider';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import type { UserFacingError } from '@/lib/user-error';
import styles from './Soil.module.css';

export interface FieldOption { id: string; name: string }
export interface SoilAnalysisRow {
  id: string;
  fieldId: string;
  fieldName: string;
  analysisDate: string; // ISO date
  phLevel: string | null;
  pIndex: number | null;
  kIndex: number | null;
  mgIndex: number | null;
  organicMatterPct: string | null;
  notes: string | null;
}

const initial: SoilAnalysisFormState = {};

function ErrorMessage({ error }: { error: UserFacingError }) {
  const errorT = useTranslations('errors');
  const locale = useLocale();
  const model = buildUserErrorDisplayModel({ translator: errorT, locale, error });
  return <p className={styles.error}>{model.message}</p>;
}

function CreateForm({ fields }: { fields: FieldOption[] }) {
  const t = useTranslations('soil');
  const [state, action, pending] = useActionState(createSoilAnalysisForm, initial);
  return (
    <form action={action} className={styles.form} key={state.success ? 'reset' : 'active'}>
      <label>{t('fields.field')}
        <select name="fieldId" required defaultValue="">
          <option value="" disabled>—</option>
          {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <label>{t('fields.analysisDate')}<input type="date" name="analysisDate" required /></label>
      <label>{t('fields.phLevel')}<input type="number" name="phLevel" min={0} max={14} step={0.1} /></label>
      <label>{t('fields.pIndex')}<input type="number" name="pIndex" min={0} max={999} /></label>
      <label>{t('fields.kIndex')}<input type="number" name="kIndex" min={0} max={999} /></label>
      <label>{t('fields.mgIndex')}<input type="number" name="mgIndex" min={0} max={999} /></label>
      <label>{t('fields.organicMatterPct')}<input type="number" name="organicMatterPct" min={0} max={100} step={0.1} /></label>
      <label>{t('fields.notes')}<input name="notes" maxLength={1000} /></label>
      <div className={styles.formActions}>
        <button type="submit" className={styles.button} disabled={pending || !fields.length}>{t('create.button')}</button>
      </div>
      {state.error && <ErrorMessage error={state.error} />}
      {state.success && <p className={styles.success}>{t('create.button')} ✓</p>}
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const t = useTranslations('soil');
  const [pending, start] = useTransition();
  const [error, setError] = useState<UserFacingError | undefined>();
  return (
    <>
      <button
        type="button"
        className={styles.buttonDanger}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t('confirmDelete'))) return;
          start(async () => {
            const result = await deleteSoilAnalysis(id);
            setError(result.success ? undefined : result.error);
          });
        }}
      >
        {t('actions.delete')}
      </button>
      {error && <ErrorMessage error={error} />}
    </>
  );
}

export function SoilManager({ fields, analyses }: { fields: FieldOption[]; analyses: SoilAnalysisRow[] }) {
  const t = useTranslations('soil');
  const locale = useLocale();
  const noValue = t('noValue');

  const byField = new Map<string, SoilAnalysisRow[]>();
  for (const row of analyses) {
    const list = byField.get(row.fieldId) ?? [];
    list.push(row);
    byField.set(row.fieldId, list);
  }

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h2>{t('create.title')}</h2>
        <CreateForm fields={fields} />
      </section>

      <section className={styles.card}>
        <h2>{t('title')}</h2>
        {analyses.length === 0 ? (
          <p className={styles.muted}>{t('empty')}</p>
        ) : (
          <div className={styles.fieldGroup}>
            {[...byField.entries()].map(([fieldId, rows]) => (
              <div key={fieldId}>
                <h3>{rows[0].fieldName}</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('fields.analysisDate')}</th>
                      <th>{t('fields.phLevel')}</th>
                      <th>{t('fields.pIndex')}</th>
                      <th>{t('fields.kIndex')}</th>
                      <th>{t('fields.mgIndex')}</th>
                      <th>{t('fields.organicMatterPct')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{new Date(row.analysisDate).toLocaleDateString(locale)}</td>
                        <td>{row.phLevel ?? noValue}</td>
                        <td>{row.pIndex ?? noValue}</td>
                        <td>{row.kIndex ?? noValue}</td>
                        <td>{row.mgIndex ?? noValue}</td>
                        <td>{row.organicMatterPct != null ? `${row.organicMatterPct}%` : noValue}</td>
                        <td><DeleteButton id={row.id} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
