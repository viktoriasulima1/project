import type { Locale } from './locales';

/**
 * Daily-briefing / AI locale directive (Part 14).
 *
 * Deterministic facts and priorities are computed by FarmOS and are
 * language-independent. The model is only asked to rewrite the human
 * EXPLANATION in the requested locale — it never reorders or invents
 * priorities, and it never returns IDs. This helper wraps the canonical payload
 * with a locale request while passing facts through untouched.
 */
export interface BriefingLocaleRequest<TFacts> {
  outputLocale: Locale;
  facts: TFacts;
  terminology: 'use_canonical_glossary';
}

export function buildBriefingLocaleDirective<TFacts>(locale: Locale, facts: TFacts): BriefingLocaleRequest<TFacts> {
  return { outputLocale: locale, facts, terminology: 'use_canonical_glossary' };
}
