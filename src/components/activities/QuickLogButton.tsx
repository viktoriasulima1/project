'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { ActivityDialog } from './ActivityDialog';
import { getQuickLogOptions } from '@/lib/actions/quick-log';
import { logProductEvent } from '@/lib/product-events';
import { useLocale, useTranslations } from '@/i18n/LocaleProvider';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import type { UserFacingError } from '@/lib/user-error';
import type { ActivityFormContext } from '@/lib/activity-form-context';
import styles from './QuickLogButton.module.css';

export function QuickLogButton() {
  const t = useTranslations('navigation');
  const errorT = useTranslations('errors');
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [open, setOpen] = useState(false);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [context, setContext] = useState<ActivityFormContext | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Never render on /onboarding or auth pages — nothing to log against yet.
  if (pathname?.startsWith('/onboarding') || pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up')) {
    return null;
  }

  async function handleOpen() {
    setError(null);
    // Once loaded and scoped by the authenticated server action, the form
    // context is safe to reuse for an offline reopen. A network call on every
    // click made local Activity drafts impossible to restore while offline.
    if (context && farmId) {
      setOpen(true);
      logProductEvent({ event: 'quick_log_opened', farmId, module: pathname ?? 'unknown' });
      return;
    }
    setLoading(true);
    const result = await getQuickLogOptions();
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setFarmId(result.farmId);
    setContext(result.context);
    logProductEvent({ event: 'quick_log_opened', farmId: result.farmId, module: pathname ?? 'unknown' });
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleSuccess() {
    setOpen(false);
    // The success panel's "View activity history" button promises to take
    // you to Activities — from a page other than /activities itself (Quick
    // Log can open from anywhere), a bare refresh silently stayed put
    // instead, breaking that promise (found via Sprint 12 E2E testing).
    if (pathname === '/activities') {
      router.refresh();
    } else {
      router.push('/activities');
    }
  }

  return (
    <>
      {/* Desktop trigger */}
      <button type="button" className={styles.desktopTrigger} onClick={handleOpen} disabled={loading}>
        {loading ? '…' : `+ ${t('quickLog')}`}
      </button>

      {/* Mobile floating action button — same handler, different chrome */}
      <button type="button" className={styles.fab} onClick={handleOpen} disabled={loading} aria-label={t('quickLogAria')}>
        {loading ? '…' : '+'}
      </button>

      {error && <div className={styles.errorToast} role="alert">{buildUserErrorDisplayModel({ translator: errorT, locale, error }).message}</div>}

      {open && context && farmId && (
        <ActivityDialog
          fieldSeasons={context.fieldSeasons}
          products={context.products}
          machines={context.machines}
          recentOperatorName={context.recentOperatorName}
          recentMachineId={context.recentMachineId}
          weather={context.weather}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
