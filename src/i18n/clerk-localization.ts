import { nlNL, enGB, plPL, deDE } from '@clerk/localizations';
import type { Locale } from './locales';

/**
 * Maps the active FarmOS locale to a Clerk localization resource (Part 6).
 * Verified against @clerk/localizations 4.13.6, which exports nlNL, enGB, plPL,
 * deDE (and ukUA / ruRU for the planned locales). Passed to
 * <ClerkProvider localization={...}> so SignIn/SignUp/UserButton/UserProfile and
 * Clerk validation errors follow the app language after a refresh. Where a pack
 * is incomplete, Clerk falls back to English internally.
 */
const CLERK_LOCALIZATION = {
  'nl-NL': nlNL,
  'en-GB': enGB,
  'pl-PL': plPL,
  'de-DE': deDE,
} as const;

export function clerkLocalization(locale: Locale) {
  return CLERK_LOCALIZATION[locale];
}
