'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setUserLocale } from '@/i18n/actions';
import { SUPPORTED_LOCALES, LOCALE_LABELS, LOCALE_COOKIE, isSupportedLocale, type Locale } from '@/i18n/locales';
import styles from './LanguageSwitcher.module.css';

function readCookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  const value = match?.split('=')[1];
  return isSupportedLocale(value) ? value : null;
}

/**
 * Accessible, keyboard-usable language selector (never flag-only). Persists the
 * choice via a server action, then refreshes the route so Server Components
 * re-render in the new language WITHOUT changing the URL. The current route is
 * preserved. If an open form advertises unsaved in-memory data
 * (`[data-unsaved="true"]`), the user is warned before switching — IndexedDB
 * drafts are canonical and language-independent, so they are never affected.
 */
export function LanguageSwitcher({ initialLocale, label }: { initialLocale?: Locale; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<Locale>(initialLocale ?? 'en-GB');

  useEffect(() => {
    const fromCookie = readCookieLocale();
    if (fromCookie) setCurrent(fromCookie);
  }, []);

  function change(next: Locale) {
    if (next === current) return;
    const hasUnsaved = typeof document !== 'undefined' && document.querySelector('[data-unsaved="true"]');
    if (hasUnsaved && !window.confirm('Switching language will reload this page. Unsaved changes not stored on this device may be lost. Continue?')) {
      return;
    }
    setCurrent(next);
    startTransition(async () => {
      const result = await setUserLocale(next);
      if ('error' in result) {
        setCurrent(current);
        return;
      }
      router.refresh();
    });
  }

  return (
    <label className={styles.wrap}>
      <span className={styles.label}>{label ?? 'Language'}</span>
      <select
        className={styles.select}
        value={current}
        disabled={pending}
        onChange={(e) => change(e.target.value as Locale)}
        aria-label={label ?? 'Language'}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>{LOCALE_LABELS[locale]}</option>
        ))}
      </select>
    </label>
  );
}
