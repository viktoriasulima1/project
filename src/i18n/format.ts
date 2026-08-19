import type { Locale } from './locales';

/**
 * Locale-aware formatting. Values are NEVER converted because the language
 * changes — only their presentation (separators, currency placement, month
 * names). Timezone is honoured explicitly so a farm's local day is stable
 * regardless of the viewer's device timezone.
 */

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(
  value: number,
  locale: Locale,
  currency = 'EUR',
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, ...options }).format(value);
}

export function formatDate(
  value: Date | string | number,
  locale: Locale,
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone, ...options }).format(new Date(value));
}

export function formatDateTime(
  value: Date | string | number,
  locale: Locale,
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone, ...options,
  }).format(new Date(value));
}
