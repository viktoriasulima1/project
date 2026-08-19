'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ActivityDialog } from './ActivityDialog';
import { UnassignedFieldsBanner } from './UnassignedFieldsBanner';
import { deleteActivity, completeActivity } from '@/lib/actions/activities';
import { logProductEvent } from '@/lib/product-events';
import type {
  FieldSeasonOption,
  ProductOption,
  MachineOption,
  WeatherSnapshot,
  RecentActivityContext,
} from '@/lib/activity-form-context';
import styles from './ActivitiesPage.module.css';
import { useLocale, useTranslations } from '@/i18n/LocaleProvider';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import type { UserFacingError } from '@/lib/user-error';

interface ActivityRow {
  id: string;
  type: string;
  status: string;
  date: Date;
  operatorName: string;
  areaHa: number;
  fieldName: string;
  fieldSeasonId: string;
  crop: string;
  productId?: string;
  productName?: string;
  machineId?: string;
  dosePerHa?: number;
  doseUnit?: string;
  weatherTempC?: number;
  weatherWindKmh?: number;
  weatherWindDir?: string;
}

interface Props {
  activities: ActivityRow[];
  fieldSeasons: FieldSeasonOption[];
  products: ProductOption[];
  machines: MachineOption[];
  farmId: string;
  recentOperatorName: string | null;
  recentMachineId: string | null;
  weather: WeatherSnapshot | null;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  currentFilter: string;
  unassignedFields: { id: string; name: string; hectares: number }[];
  activeSeasonId: string;
  activeSeasonYear: number;
  initialWorkOrderId?: string;
  initialFieldSeasonId?: string;
  initialType?: 'spray' | 'fertilise' | 'sow' | 'tillage' | 'scout' | 'harvest' | 'other';
}

const TYPE_CLASS: Record<string, string> = {
  spray: styles.typeSpray,
  fertilise: styles.typeFertilise,
  harvest: styles.typeHarvest,
};

function typeClass(type: string): string {
  return TYPE_CLASS[type] ?? styles.typeOther;
}

export function ActivitiesClient({
  activities,
  fieldSeasons,
  products,
  machines,
  farmId,
  recentOperatorName,
  recentMachineId,
  weather,
  currentPage,
  totalPages,
  totalCount,
  currentFilter,
  unassignedFields,
  activeSeasonId,
  activeSeasonYear,
  initialWorkOrderId,
  initialFieldSeasonId,
  initialType,
}: Props) {
  const [showDialog, setShowDialog] = useState(Boolean(initialWorkOrderId));
  const [repeatFrom, setRepeatFrom] = useState<RecentActivityContext | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const locale = useLocale();
  const errorT = useTranslations('errors');
  const [deleteError, setDeleteError] = useState<UserFacingError | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<UserFacingError | null>(null);
  const displayError = (error: UserFacingError) => buildUserErrorDisplayModel({ translator: errorT, locale, error }).message;
  const router = useRouter();

  const handleSuccess = useCallback(() => {
    setShowDialog(false);
    setRepeatFrom(null);
    router.refresh();
  }, [router]);

  function openNewActivity() {
    setRepeatFrom(null);
    logProductEvent({ event: 'quick_log_opened', farmId, module: 'activities' });
    setShowDialog(true);
  }

  function openRepeat(row: ActivityRow) {
    setRepeatFrom({
      type: row.type,
      fieldSeasonId: row.fieldSeasonId,
      operatorName: row.operatorName || null,
      machineId: row.machineId ?? null,
      productId: row.productId ?? null,
    });
    logProductEvent({ event: 'repeat_activity_used', farmId, activityType: row.type, module: 'activities' });
    setShowDialog(true);
  }

  async function handleComplete(id: string) {
    setCompletingId(id);
    setCompleteError(null);
    const result = await completeActivity(id);
    setCompletingId(null);
    if (result.error) {
      setCompleteError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this activity?\n\nThe diary record is retained for compliance. Stock will be restored.')) return;
    setDeletingId(id);
    setDeleteError(null);
    const result = await deleteActivity(id);
    setDeletingId(null);
    if (result.error) {
      setDeleteError(result.error);
    } else {
      router.refresh();
    }
  }

  function navigateTo(params: Record<string, string>) {
    const url = new URLSearchParams(params).toString();
    router.push(`/activities?${url}`);
  }

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'spray', label: 'Spray' },
    { key: 'fertilise', label: 'Fertilise' },
    { key: 'harvest', label: 'Harvest' },
    { key: 'tillage', label: 'Tillage' },
    { key: 'sow', label: 'Sow' },
  ];

  return (
    <>
      {showDialog && (
        <ActivityDialog
          fieldSeasons={fieldSeasons}
          products={products}
          machines={machines}
          recentOperatorName={recentOperatorName}
          recentMachineId={recentMachineId}
          weather={weather}
          workOrderId={initialWorkOrderId}
          defaultFieldSeasonId={initialFieldSeasonId}
          initialType={initialType}
          repeatFrom={repeatFrom}
          onClose={() => { setShowDialog(false); setRepeatFrom(null); }}
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
            {displayError(deleteError)}
          </div>
        )}

        {completeError && (
          <div style={{
            marginBottom: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--color-red-subtle)',
            border: '1px solid var(--color-red-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-red)',
            fontSize: 'var(--font-sm)',
          }}>
            {displayError(completeError)}
          </div>
        )}

        <UnassignedFieldsBanner
          fields={unassignedFields}
          seasonId={activeSeasonId}
          seasonYear={activeSeasonYear}
        />

        <div className={styles.toolbar}>
          <div className={styles.filters}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`${styles.filterBtn}${currentFilter === f.key ? ` ${styles.active}` : ''}`}
                onClick={() => navigateTo({ filter: f.key, page: '1' })}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button variant="primary" size="sm" onClick={openNewActivity}>
            + Record activity
          </Button>
        </div>

        {activities.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📋</span>
            <p className={styles.emptyTitle}>No activities logged</p>
            <p className={styles.emptyDesc}>
              {currentFilter !== 'all'
                ? `No ${currentFilter} activities found. Try a different filter.`
                : 'Record field work to build history, update stock and create compliance records.'}
            </p>
            {currentFilter === 'all' && (
              <Button variant="primary" onClick={openNewActivity}>
                + Record your first activity
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Field</th>
                    <th>Operator</th>
                    <th>Product</th>
                    <th>Area</th>
                    <th>Weather</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.id}>
                      <td className={styles.number}>
                        {new Date(a.date).toLocaleDateString('nl-NL', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td>
                        <span className={`${styles.typePill} ${typeClass(a.type)}`}>
                          {a.type}
                        </span>
                        {a.status === 'planned' && (
                          <span
                            style={{
                              marginLeft: '6px',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--color-blue-subtle)',
                              color: 'var(--color-blue)',
                              fontSize: 'var(--font-xs)',
                              fontWeight: 500,
                            }}
                          >
                            Planned
                          </span>
                        )}
                      </td>
                      <td>
                        {a.fieldName}
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', marginLeft: '4px' }}>
                          ({a.crop.replace(/_/g, ' ')})
                        </span>
                      </td>
                      <td>{a.operatorName}</td>
                      <td>
                        {a.productName ? (
                          <>
                            {a.productName}
                            {a.dosePerHa && (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-xs)', marginLeft: '4px' }}>
                                {a.dosePerHa} {a.doseUnit}/ha
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className={styles.number}>
                        {Number(a.areaHa).toFixed(2)} ha
                      </td>
                      <td className={styles.weatherCell}>
                        {a.weatherTempC !== undefined && a.weatherTempC !== null
                          ? `${a.weatherTempC}°C`
                          : ''}
                        {a.weatherWindKmh !== undefined && a.weatherWindKmh !== null
                          ? ` ${a.weatherWindKmh}km/h ${a.weatherWindDir ?? ''}`.trimEnd()
                          : ''}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          {a.status === 'planned' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={completingId === a.id}
                              onClick={() => handleComplete(a.id)}
                            >
                              Mark as completed
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openRepeat(a)}>
                            Repeat
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={deletingId === a.id}
                            onClick={() => handleDelete(a.id)}
                            style={{ color: 'var(--color-red)' }}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3) 0',
                fontSize: 'var(--font-sm)',
                color: 'var(--color-text-muted)',
              }}>
                <span>
                  Showing {((currentPage - 1) * 50) + 1}–{Math.min(currentPage * 50, totalCount)} of {totalCount}
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => navigateTo({ filter: currentFilter, page: String(currentPage - 1) })}
                  >
                    ← Previous
                  </Button>
                  <span style={{ padding: '0 var(--space-2)', lineHeight: '32px' }}>
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => navigateTo({ filter: currentFilter, page: String(currentPage + 1) })}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
