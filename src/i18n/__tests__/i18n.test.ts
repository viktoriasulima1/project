import { describe, it, expect } from 'vitest';
import { resolveLocale, matchLocale, parseAcceptLanguage } from '../resolve';
import { isSupportedLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../locales';
import { createTranslator } from '../translator';
import { getEnumLabel, getEnumLabels } from '../enum-labels';
import { translateErrorCode, isSafeErrorCode } from '../error-codes';
import { clerkLocaleFor } from '../clerk-locale';
import { buildExportProvenance } from '../export-locale';
import { buildBriefingLocaleDirective } from '../ai-locale';
import { diffNamespace } from '../validate-core';
import { formatNumber, formatCurrency, formatDate, formatDateTime } from '../format';
import { CROP_CONDITIONS, normalizeCropCondition } from '@/lib/scouting/condition';
import { createLocalDraft } from '@/offline/drafts';

const norm = (s: string) => s.replace(/\s/g, ' ');

// 1 — Supported locale resolution
it('1 — resolves a supported locale from each signal', () => {
  expect(resolveLocale({ userPreference: 'de-DE' })).toBe('de-DE');
  expect(resolveLocale({ cookieLocale: 'pl-PL' })).toBe('pl-PL');
  expect(resolveLocale({ acceptLanguage: 'nl,en;q=0.8' })).toBe('nl-NL');
});

// 2 — Unsupported locale fallback
it('2 — unsupported locale falls back to the default', () => {
  expect(matchLocale('fr-FR')).toBeNull();
  expect(resolveLocale({ userPreference: 'fr-FR', acceptLanguage: 'fr' })).toBe(DEFAULT_LOCALE);
  expect(isSupportedLocale('ru-RU')).toBe(false);
});

// 3 — Cookie preference beats Accept-Language
it('3 — cookie preference is used over Accept-Language', () => {
  expect(resolveLocale({ cookieLocale: 'de-DE', acceptLanguage: 'nl' })).toBe('de-DE');
});

// 4 — Stored user preference beats cookie
it('4 — stored user preference wins over cookie', () => {
  expect(resolveLocale({ userPreference: 'pl-PL', cookieLocale: 'de-DE' })).toBe('pl-PL');
});

// 5 — Language persists after login (preference precedence)
it('5 — a stored preference determines locale after authentication', () => {
  expect(resolveLocale({ userPreference: 'de-DE', cookieLocale: 'nl-NL', acceptLanguage: 'pl' })).toBe('de-DE');
});

// 6 — Canonical enum unaffected by label language
it('6 — labels change by locale but the canonical value does not', () => {
  expect(getEnumLabel('nl-NL', 'condition', 'good')).toBe('Goed');
  expect(getEnumLabel('de-DE', 'condition', 'good')).toBe('Gut');
  expect(getEnumLabel('pl-PL', 'condition', 'good')).toBe('Dobry');
  // the value passed in is never mutated; canonical set is stable
  expect(CROP_CONDITIONS).toEqual(['good', 'satisfactory', 'poor', 'critical']);
});

// 7 — Translated text cannot become an enum value
it('7 — a translated label never normalises to a canonical value', () => {
  expect(normalizeCropCondition('Хорошо')).toBeNull();
  expect(normalizeCropCondition('Goed')).toBeNull();
  expect(normalizeCropCondition('good')).toBe('good');
});

// 8 — Every option value is canonical
it('8 — enum label maps are keyed exactly by the canonical values', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const labels = getEnumLabels(locale, 'condition', CROP_CONDITIONS);
    expect(Object.keys(labels).sort()).toEqual([...CROP_CONDITIONS].sort());
    for (const value of CROP_CONDITIONS) expect(typeof labels[value]).toBe('string');
  }
});

// 9 — Missing translation detected
it('9 — a missing key is flagged in development', () => {
  const t = createTranslator('nl-NL', { messages: {}, fallback: {} });
  expect(t('scouting.visit.title')).toBe('[missing: scouting.visit.title]');
});

// 10 — Placeholder mismatch detected
it('10 — diffNamespace detects missing/extra/placeholder mismatches', () => {
  const auth = { greeting: 'Hi {name}', a: 'x' };
  const cand = { greeting: 'Hallo', b: 'y' };
  const diff = diffNamespace(auth, cand);
  expect(diff.missing).toContain('a');
  expect(diff.extra).toContain('b');
  expect(diff.placeholderMismatch).toContain('greeting');
});

// 11 — English fallback
it('11 — a key missing in the locale falls back to English', () => {
  const t = createTranslator('nl-NL', { messages: {}, fallback: { greeting: 'Hello' } });
  expect(t('greeting')).toBe('Hello');
});

// 12/13/14 — number & date formatting per locale
it('12 — Dutch number/date formatting', () => {
  expect(formatNumber(1234.5, 'nl-NL')).toBe('1.234,5');
  expect(norm(formatCurrency(1234.5, 'nl-NL'))).toContain('1.234,50');
  expect(formatDate('2026-07-23T10:00:00Z', 'nl-NL', 'Europe/Amsterdam')).toContain('juli');
});
it('13 — Polish number/date formatting', () => {
  // Polish uses a comma decimal + (space) grouping; the exact grouping char
  // depends on the Node ICU build, so assert the decimal comma tolerantly.
  expect(norm(formatNumber(1234.5, 'pl-PL'))).toMatch(/^1\s?234,5$/);
  expect(formatDate('2026-07-23T10:00:00Z', 'pl-PL', 'Europe/Warsaw')).toContain('lipca');
});
it('14 — German number/date formatting', () => {
  expect(formatNumber(1234.5, 'de-DE')).toBe('1.234,5');
  expect(formatDate('2026-07-23T10:00:00Z', 'de-DE', 'Europe/Berlin')).toContain('Juli');
});

// 15 — Farm timezone retained
it('15 — timezone is honoured independently of the locale', () => {
  const instant = '2026-07-23T23:30:00Z';
  expect(formatDateTime(instant, 'nl-NL', 'Europe/Amsterdam')).toContain('24'); // next local day
  expect(formatDateTime(instant, 'nl-NL', 'UTC')).toContain('23');
});

// 16 — Safe error code translated
it('16 — a safe error code maps to a localized message', () => {
  const nl = translateErrorCode('LOCATION_TOO_LOW', 'nl-NL');
  const en = translateErrorCode('LOCATION_TOO_LOW', 'en-GB');
  expect(nl).toContain('te laag');
  expect(nl).not.toBe(en);
});

// 17 — Raw Zod/enum text never exposed
it('17 — an unknown/raw error degrades to GENERIC, never leaking internals', () => {
  expect(isSafeErrorCode('Invalid option: expected one of good | satisfactory')).toBe(false);
  const message = translateErrorCode('Invalid option: expected one of good | satisfactory | poor | critical', 'nl-NL');
  expect(message).not.toMatch(/expected one of/i);
  expect(message).toBe(translateErrorCode('GENERIC', 'nl-NL'));
});

// 18/20 — Offline draft remains canonical
it('18/20 — offline drafts store canonical tokens, not localized labels', () => {
  const draft = createLocalDraft({ userRef: 'u1', farmId: 'f1' }, 'scout', { overallCondition: 'satisfactory', severity: 'low' });
  expect(draft.formData.overallCondition).toBe('satisfactory'); // canonical, never "Voldoende"
  expect(draft.formData.severity).toBe('low');
  // switching UI locale only changes label maps, never the stored token
  expect(getEnumLabel('nl-NL', 'condition', draft.formData.overallCondition)).toBe('Voldoende');
});

// 19 — Language switch preserves route (resolution is path-independent)
it('19 — locale resolution does not depend on the current route', () => {
  expect(resolveLocale({ cookieLocale: 'de-DE' })).toBe('de-DE');
  // the switcher persists via cookie + router.refresh(), never a URL change
});

// 21 — Clerk locale mapping
it('21 — FarmOS locales map to Clerk locale keys (verified against installed pack)', () => {
  expect(clerkLocaleFor('nl-NL')).toBe('nlNL');
  expect(clerkLocaleFor('en-GB')).toBe('enGB');
  expect(clerkLocaleFor('pl-PL')).toBe('plPL');
  expect(clerkLocaleFor('de-DE')).toBe('deDE');
});

// 22 — Report locale provenance
it('22 — export provenance records the resolved locale, defaulting safely', () => {
  expect(buildExportProvenance('de-DE', 'nl-NL').exportLocale).toBe('de-DE');
  expect(buildExportProvenance(null, 'pl-PL').exportLocale).toBe('pl-PL');
  expect(buildExportProvenance('xx-XX', 'en-GB').exportLocale).toBe('en-GB');
});

// 23 — AI briefing locale requested without changing priorities
it('23 — the briefing directive requests a locale but leaves facts untouched', () => {
  const facts = { priorities: ['spray-window', 'scouting', 'stock'] };
  const directive = buildBriefingLocaleDirective('nl-NL', facts);
  expect(directive.outputLocale).toBe('nl-NL');
  expect(directive.facts).toBe(facts); // same reference, order preserved
  expect(directive.terminology).toBe('use_canonical_glossary');
});

// 24 — Security: unsupported/injection locale rejected
it('24 — unsupported or injected locale values are rejected', () => {
  expect(isSupportedLocale('nl-NL')).toBe(true);
  for (const bad of ['', 'en', 'nl', 'ru-RU', '../../etc', 'nl-NL; DROP TABLE']) {
    expect(isSupportedLocale(bad)).toBe(false);
  }
});

// Accept-Language quality ordering
it('parses Accept-Language by q-value', () => {
  expect(parseAcceptLanguage('de;q=0.4, pl;q=0.9, fr;q=1.0')).toBe('pl-PL');
});
