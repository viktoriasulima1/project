/**
 * FarmOS supported locales. Dutch is the default product language; English is
 * the fallback for any missing message. The architecture is additive: adding
 * `uk-UA` / `ru-UA` later means adding a locale here + a `messages/<locale>/`
 * folder — no component changes.
 */
export const SUPPORTED_LOCALES = ['nl-NL', 'en-GB', 'pl-PL', 'de-DE'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Default product language (first-visit, no other signal). */
export const DEFAULT_LOCALE: Locale = 'nl-NL';
/** Fallback used for any message key missing in the active locale. */
export const FALLBACK_LOCALE: Locale = 'en-GB';

/** Explicit, persisted preference cookie. */
export const LOCALE_COOKIE = 'farmos-locale';

/** Endonyms shown in the switcher — never flag-only, always the language name. */
export const LOCALE_LABELS: Record<Locale, string> = {
  'nl-NL': 'Nederlands',
  'en-GB': 'English',
  'pl-PL': 'Polski',
  'de-DE': 'Deutsch',
};

/** Value for <html lang="…"> — must match the active locale. */
export const HTML_LANG: Record<Locale, string> = {
  'nl-NL': 'nl',
  'en-GB': 'en',
  'pl-PL': 'pl',
  'de-DE': 'de',
};

/** Text direction. All current locales are LTR; the map keeps RTL additions
 *  (ar-*, he-*) a one-line change without touching components. */
export const LOCALE_DIR: Record<Locale, 'ltr' | 'rtl'> = {
  'nl-NL': 'ltr',
  'en-GB': 'ltr',
  'pl-PL': 'ltr',
  'de-DE': 'ltr',
};

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
