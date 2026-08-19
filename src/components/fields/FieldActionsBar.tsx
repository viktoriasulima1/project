'use client';
// Sprint 25 Part 14/15 — contextual + offline-aware Field Detail actions. The
// availability rules live in the pure fieldActionAvailability() resolver
// (unit-tested); this component only renders them, translates the stable reason
// code via the presentation adapter, and shows the honest last-synced banner
// when offline. Mutations that must be atomic across fields or hit external
// systems are online-only and never queued.
import { useOffline } from '@/offline/OfflineProvider';
import { fieldActionAvailability, type FieldAction } from '@/lib/field-actions';
import { translateFieldActionReason } from '@/i18n/adapters/field-action';
import { useTranslations, useLocale } from '@/i18n/LocaleProvider';
import styles from './FieldEconomics.module.css';

// Actions that route to the Finance page (where the vetted forms/dialogs live)
// rather than duplicating each mutation dialog on the field page this slice.
const HREF: Partial<Record<FieldAction, string>> = {
  add_expense: '/finance', add_harvest: '/finance', add_revenue: '/finance', allocate: '/finance',
  correct: '/finance', reverse: '/finance', export_report: '/reports',
};

export function FieldActionsBar({ hasActiveSeason, lastCalculatedAt }: { hasActiveSeason: boolean; lastCalculatedAt: string }) {
  const connectivity = useOffline().connectivity;
  const t = useTranslations('fields');
  const locale = useLocale();
  const online = connectivity === 'online';
  const availability = fieldActionAvailability({ online, hasActiveSeason });
  const order: FieldAction[] = ['add_expense', 'add_harvest', 'add_revenue', 'allocate', 'correct', 'export_report'];
  const label = (action: FieldAction) => t(`actions.labels.${action}`);

  return (
    <section className={styles.card}>
      <h2>{t('detail.actions')}</h2>
      {!online && <p className={styles.offlineBanner}>{t('detail.offlineActions', { lastSynced: t('actions.lastSyncedAt', { date: new Date(lastCalculatedAt).toLocaleString(locale) }) })}</p>}
      <div className={styles.actions}>
        {order.map((action) => {
          const state = availability[action];
          const href = HREF[action];
          const reason = translateFieldActionReason(t, state); // localized, or null when available
          if (state.available && href) return <a key={action} className={styles.secondary} href={href}>{label(action)}</a>;
          return (
            <button key={action} type="button" className={styles.secondary} disabled={!state.available} title={reason ?? undefined} aria-label={reason ? `${label(action)} — ${reason}` : label(action)}>
              {label(action)}
            </button>
          );
        })}
      </div>
      <p className={styles.disclaimer}>{t('detail.actionsDisclaimer')}</p>
    </section>
  );
}
