'use client';

import { useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { createField } from '@/lib/actions/fields';
import type { FieldFormState } from '@/lib/actions/fields';
import { useTranslations } from '@/i18n/LocaleProvider';
import styles from './NewFieldDialog.module.css';

const initialState: FieldFormState = {};
const SOIL_OPTIONS = ['clay', 'sandy', 'loam', 'peat', 'silt'];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function NewFieldDialog({ onClose, onSuccess }: Props) {
  const [state, formAction, isPending] = useActionState(createField, initialState);
  const t = useTranslations('fields');
  const te = useTranslations('enums');

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <dialog
        className={styles.dialog}
        open
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span className={styles.title}>{t('dialog.title')}</span>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            ×
          </button>
        </div>

        <form action={formAction}>
          <div className={styles.body}>
            {state.error && (
              <div className={styles.globalError}>{state.error}</div>
            )}

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="name">
                {t('dialog.nameLabel')}
              </label>
              <input
                id="name"
                name="name"
                className={`${styles.input}${state.fieldErrors?.name ? ` ${styles.hasError}` : ''}`}
                placeholder={t('dialog.namePlaceholder')}
                autoFocus
              />
              {state.fieldErrors?.name && (
                <span className={styles.errorMsg}>{state.fieldErrors.name[0]}</span>
              )}
            </div>

            <div className={styles.row}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="hectares">
                  {t('dialog.area')}
                </label>
                <input
                  id="hectares"
                  name="hectares"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="9999"
                  className={`${styles.input}${state.fieldErrors?.hectares ? ` ${styles.hasError}` : ''}`}
                  placeholder="12.50"
                />
                {state.fieldErrors?.hectares && (
                  <span className={styles.errorMsg}>{state.fieldErrors.hectares[0]}</span>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="soilType">
                  {t('dialog.soilType')}
                </label>
                <select
                  id="soilType"
                  name="soilType"
                  className={`${styles.select}${state.fieldErrors?.soilType ? ` ${styles.hasError}` : ''}`}
                  defaultValue="loam"
                >
                  {SOIL_OPTIONS.map((s) => <option key={s} value={s}>{te(`soilType.${s}`)}</option>)}
                </select>
                {state.fieldErrors?.soilType && (
                  <span className={styles.errorMsg}>{state.fieldErrors.soilType[0]}</span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.footer}>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('dialog.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={isPending}>
              {t('dialog.create')}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
