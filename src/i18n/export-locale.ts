import { isSupportedLocale, DEFAULT_LOCALE, type Locale } from './locales';

/**
 * Report/export provenance (Part 13). Every PDF/CSV export records the locale it
 * was rendered in, so a document's language is auditable. Canonical identifiers
 * (UUIDs, enum source values, report IDs) are never localized — only display
 * labels and formatting follow the export locale.
 */
export interface ExportProvenance {
  exportLocale: Locale;
  generatedAt: string;
}

export function buildExportProvenance(requested: string | null | undefined, userLocale: Locale, now: Date = new Date()): ExportProvenance {
  const exportLocale = isSupportedLocale(requested) ? requested : isSupportedLocale(userLocale) ? userLocale : DEFAULT_LOCALE;
  return { exportLocale, generatedAt: now.toISOString() };
}
