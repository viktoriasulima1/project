import { SUPPORTED_LOCALES, DEFAULT_LOCALE, isSupportedLocale, type Locale } from './locales';

/** Maps an arbitrary BCP-47 tag to the closest supported locale, or null. */
export function matchLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === lower);
  if (exact) return exact;
  const primary = lower.split('-')[0];
  return SUPPORTED_LOCALES.find((l) => l.toLowerCase().split('-')[0] === primary) ?? null;
}

/** Picks the highest-priority supported locale from an Accept-Language header. */
export function parseAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.trim(), q: q === undefined ? 1 : Number(q) || 0 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const matched = matchLocale(tag);
    if (matched) return matched;
  }
  return null;
}

export interface ResolveInput {
  /** Authenticated user's stored preference (highest priority). */
  userPreference?: string | null;
  /** FarmOS locale cookie. */
  cookieLocale?: string | null;
  /** Browser Accept-Language on first visit. */
  acceptLanguage?: string | null;
}

/**
 * Resolution order (Part 2):
 *   1. stored user preference
 *   2. FarmOS locale cookie
 *   3. browser Accept-Language
 *   4. nl-NL default
 * (en-GB remains the per-key fallback for missing messages — see translator.)
 */
export function resolveLocale(input: ResolveInput): Locale {
  if (isSupportedLocale(input.userPreference)) return input.userPreference;
  if (isSupportedLocale(input.cookieLocale)) return input.cookieLocale;
  const fromHeader = parseAcceptLanguage(input.acceptLanguage);
  if (fromHeader) return fromHeader;
  return DEFAULT_LOCALE;
}
