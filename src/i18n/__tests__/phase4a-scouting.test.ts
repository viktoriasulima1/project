import { describe, it, expect } from 'vitest';
import { getNamespace, NAMESPACES } from '../catalog';
import { SUPPORTED_LOCALES } from '../locales';
import { createTranslator } from '../translator';
import { diffNamespace, type Tree } from '../validate-core';

const sc = (locale: (typeof SUPPORTED_LOCALES)[number]) =>
  createTranslator(locale, { messages: getNamespace(locale, 'scouting'), fallback: getNamespace('en-GB', 'scouting') });

// 1 — scouting namespace exists in every locale
it('scouting is a registered namespace present in all locales', () => {
  expect(NAMESPACES).toContain('scouting');
  for (const locale of SUPPORTED_LOCALES) expect(Object.keys(getNamespace(locale, 'scouting')).length).toBeGreaterThan(0);
});

// 2/3 — structure matches en-GB, no empties/placeholder drift
it('scouting structure matches en-GB across locales', () => {
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === 'en-GB') continue;
    const diff = diffNamespace(getNamespace('en-GB', 'scouting') as Tree, getNamespace(locale, 'scouting') as Tree);
    expect({ locale, ...diff }).toEqual({ locale, missing: [], extra: [], empty: [], placeholderMismatch: [] });
  }
});

// 4 — real (non-English) translations
describe('scouting labels are really translated', () => {
  it('Dutch', () => { expect(sc('nl-NL')('page.title')).toBe('Gewasinspectie'); expect(sc('nl-NL')('form.reviewSave')).toBe('Bezoek controleren en opslaan'); });
  it('Polish', () => { expect(sc('pl-PL')('form.fieldAndCrop')).toBe('Pole i uprawa'); });
  it('German', () => { expect(sc('de-DE')('form.overallCondition')).toBe('Allgemeiner Zustand'); });
});

// 22 — the i18n:audit heuristic flags hardcoded JSX text but not {expressions}
it('audit heuristic: JSX text is flagged, {t(...)} is not', () => {
  const stripExpr = (line: string) => { let p: string, o = line; do { p = o; o = o.replace(/\{[^{}]*\}/g, ''); } while (o !== p); return o; };
  const jsxTextWords = (line: string) => [...stripExpr(line).matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter((t) => /[A-Za-z]{2,}/.test(t));
  expect(jsxTextWords('<label>Overall condition<select/></label>')).toContain('Overall condition');
  expect(jsxTextWords("<label>{t('form.overallCondition')}<select/></label>")).toEqual([]);
});
