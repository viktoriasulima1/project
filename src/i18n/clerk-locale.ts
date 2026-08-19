import type { Locale } from './locales';

/**
 * Maps a FarmOS locale to the Clerk localization key (Part 12). Clerk is
 * localized SEPARATELY from the FarmOS message system, via @clerk/localizations
 * language packs passed to <ClerkProvider localization={...}>.
 *
 * This module intentionally only computes the mapping — it does NOT import the
 * pack (that dependency is installed and wired in a follow-up). Clerk ships no
 * en-GB pack, so English maps to enUS. Where a pack is incomplete, Clerk falls
 * back to English; missing strings are tracked in the translation backlog.
 */
export type ClerkLocaleKey = 'nlNL' | 'enGB' | 'plPL' | 'deDE';

// Verified against @clerk/localizations 4.13.6 exports: nlNL, enGB, plPL, deDE
// all exist (ukUA / ruRU also exist for the planned locales), so English maps to
// the real en-GB pack rather than an en-US fallback.
const CLERK_LOCALE: Record<Locale, ClerkLocaleKey> = {
  'nl-NL': 'nlNL',
  'en-GB': 'enGB',
  'pl-PL': 'plPL',
  'de-DE': 'deDE',
};

export function clerkLocaleFor(locale: Locale): ClerkLocaleKey {
  return CLERK_LOCALE[locale];
}
