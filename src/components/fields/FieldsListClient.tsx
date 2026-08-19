'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Field } from '@prisma/client';
import { Button } from '@/components/ui/Button';
import { NewFieldDialog } from './NewFieldDialog';
import { deleteField } from '@/lib/actions/fields';
import { useTranslations, useLocale } from '@/i18n/LocaleProvider';
import { getEnumLabel } from '@/i18n/enum-labels';
import styles from './FieldsList.module.css';

// hectares is a plain number here — Prisma's Decimal cannot cross the
// Server → Client Component boundary, so the page maps it before passing down.
type SerializableField = Omit<Field, 'hectares'> & { hectares: number };

interface Props {
  fields: SerializableField[];
  totalHa: number;
}

function ndviClass(ndvi: number | null): string {
  if (ndvi === null) return styles.ndviNone;
  if (ndvi >= 70) return styles.ndviHigh;
  if (ndvi >= 40) return styles.ndviMed;
  return styles.ndviLow;
}

export function FieldsListClient({ fields, totalHa }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();
  const t = useTranslations('fields');
  const locale = useLocale();

  const handleSuccess = useCallback(() => {
    setShowNew(false);
    router.refresh();
  }, [router]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(t('archiveConfirm', { name }))) return;

    setDeletingId(id);
    setDeleteError(null);
    const result = await deleteField(id);
    setDeletingId(null);

    if (result.error) {
      setDeleteError(result.error);
    } else {
      router.refresh();
    }
  }

  const healthyCount = fields.filter((f) => f.status === 'healthy').length;
  const attentionCount = fields.filter(
    (f) => f.status === 'attention' || f.status === 'critical'
  ).length;

  return (
    <>
      {showNew && (
        <NewFieldDialog
          onClose={() => setShowNew(false)}
          onSuccess={handleSuccess}
        />
      )}

      <div className={styles.container}>
        {deleteError && (
          <div style={{
            marginBottom: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--color-red-subtle)',
            border: '1px solid var(--color-red-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-red)',
            fontSize: 'var(--font-sm)',
          }}>
            {deleteError}
          </div>
        )}

        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t('summary.totalFields')}</span>
            <span className={styles.summaryValue}>{fields.length}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t('summary.totalArea')}</span>
            <span className={styles.summaryValue}>{`${totalHa.toFixed(1)} ha`}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t('summary.healthy')}</span>
            <span className={styles.summaryValue}>{healthyCount}</span>
          </div>
          {attentionCount > 0 && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{t('summary.needAttention')}</span>
              <span className={styles.summaryValue} style={{ color: 'var(--color-amber)' }}>
                {attentionCount}
              </span>
            </div>
          )}
        </div>

        {fields.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>▦</span>
            <p className={styles.emptyTitle}>{t('empty.title')}</p>
            <p className={styles.emptyDesc}>{t('empty.desc')}</p>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="primary" onClick={() => setShowNew(true)}>
                {t('addField')}
              </Button>
              <Link href="/fields/import/brp">
                <Button variant="secondary">{t('importBrp')}</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Link href="/fields/import/brp">
                <Button variant="secondary" size="sm">{t('importBrp')}</Button>
              </Link>
              <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
                {t('addField')}
              </Button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('table.name')}</th>
                    <th>{t('table.area')}</th>
                    <th>{t('table.soil')}</th>
                    <th>{t('table.status')}</th>
                    <th>{t('table.ndvi')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field.id}>
                      <td className={styles.fieldName}><Link href={`/fields/${field.id}`}>{field.name}</Link></td>
                      <td className={styles.hectares}>
                        {`${field.hectares.toFixed(2)} ha`}
                      </td>
                      <td>
                        <span className={styles.soilBadge}>{getEnumLabel(locale, 'soilType', field.soilType)}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            color:
                              field.status === 'healthy'
                                ? 'var(--color-green)'
                                : field.status === 'critical'
                                ? 'var(--color-red)'
                                : field.status === 'fallow'
                                ? 'var(--color-text-muted)'
                                : 'var(--color-amber)',
                          }}
                        >
                          {getEnumLabel(locale, 'fieldStatus', field.status)}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.ndvi} ${ndviClass(field.ndviScore)}`}>
                          {field.ndviScore !== null ? field.ndviScore : '—'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={deletingId === field.id}
                            onClick={() => handleDelete(field.id, field.name)}
                          >
                            {t('archive')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
