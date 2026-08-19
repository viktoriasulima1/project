import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATALOG, NAMESPACES, getNamespace } from '../catalog';
import { SUPPORTED_LOCALES } from '../locales';
import { createTranslator } from '../translator';
import { diffNamespace, type Tree } from '../validate-core';
import { getEnumLabel } from '../enum-labels';

const wo = (locale: (typeof SUPPORTED_LOCALES)[number]) =>
  createTranslator(locale, { messages: getNamespace(locale, 'workOrders'), fallback: getNamespace('en-GB', 'workOrders') });
const nav = (locale: (typeof SUPPORTED_LOCALES)[number]) =>
  createTranslator(locale, { messages: getNamespace(locale, 'navigation'), fallback: getNamespace('en-GB', 'navigation') });

// 1 — all namespaces exist in all locales
it('1 — every namespace exists and is non-empty in all four locales', () => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const ns of NAMESPACES) {
      expect(CATALOG[locale][ns], `${locale}/${ns}`).toBeTruthy();
      expect(Object.keys(CATALOG[locale][ns]).length).toBeGreaterThan(0);
    }
  }
});

// 2 — locale structures match en-GB for every namespace
it('2 — no missing/extra keys or placeholder mismatches vs en-GB', () => {
  for (const ns of NAMESPACES) {
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'en-GB') continue;
      const diff = diffNamespace(getNamespace('en-GB', ns) as Tree, getNamespace(locale, ns) as Tree);
      expect(diff.missing, `${locale}/${ns} missing`).toEqual([]);
      expect(diff.extra, `${locale}/${ns} extra`).toEqual([]);
      expect(diff.placeholderMismatch, `${locale}/${ns} placeholders`).toEqual([]);
    }
  }
});

// 4/5/6 — real Polish / Dutch / German Work Order labels
describe('Work Order labels are really translated (not English copies)', () => {
  it('4 — Polish', () => {
    const t = wo('pl-PL');
    expect(t('title')).toBe('Zlecenia pracy');
    expect(t('create.title')).toBe('Utwórz zlecenie');
    expect(t('form.fieldAndSeason')).toBe('Pole i sezon');
    expect(t('form.notAssigned')).toBe('Nie przypisano');
    expect(t('readiness.title')).toBe('Zasady gotowości');
  });
  it('5 — Dutch', () => {
    const t = wo('nl-NL');
    expect(t('title')).toBe('Werkorders');
    expect(t('create.title')).toBe('Werkorder aanmaken');
    expect(t('form.priority')).toBe('Prioriteit');
  });
  it('6 — German', () => {
    const t = wo('de-DE');
    expect(t('title')).toBe('Arbeitsaufträge');
    expect(t('create.title')).toBe('Arbeitsauftrag erstellen');
    expect(t('form.dueDate')).toBe('Fälligkeitsdatum');
  });
});

// 7 — navigation label changes by locale
it('7 — the Work orders nav label differs per locale', () => {
  expect(nav('en-GB')('workOrders')).toBe('Work orders');
  expect(nav('nl-NL')('workOrders')).toBe('Werkorders');
  expect(nav('pl-PL')('workOrders')).toBe('Zlecenia');
  expect(nav('de-DE')('workOrders')).toBe('Arbeitsaufträge');
});

// interpolation preserved across locales
it('row.blocked interpolates {blockers} in every locale', () => {
  for (const locale of SUPPORTED_LOCALES) {
    expect(wo(locale)('row.blocked', { blockers: 'missing_stock' })).toContain('missing_stock');
  }
});

// 12/13 — canonical enum tokens unchanged; only labels localize
describe('canonical enum safety', () => {
  const OPERATION_TOKENS = ['soil_preparation', 'sow', 'fertilise', 'spray', 'irrigate', 'scout', 'tillage', 'harvest', 'custom'];
  const STATUS_TOKENS = ['draft', 'ready', 'assigned', 'in_progress', 'blocked', 'completed', 'cancelled'];
  it('12 — operationType/workOrderStatus keys are exactly the canonical tokens in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(getNamespace(locale, 'enums').operationType as object).sort()).toEqual([...OPERATION_TOKENS].sort());
      expect(Object.keys(getNamespace(locale, 'enums').workOrderStatus as object).sort()).toEqual([...STATUS_TOKENS].sort());
    }
  });
  it('13 — labels localize but the token passed in is returned unchanged on miss', () => {
    expect(getEnumLabel('pl-PL', 'operationType', 'spray')).toBe('Oprysk');
    expect(getEnumLabel('de-DE', 'workOrderStatus', 'in_progress')).toBe('In Bearbeitung');
    expect(getEnumLabel('nl-NL', 'operationType', 'not_a_token')).toBe('not_a_token'); // canonical fallback
  });
});

// 13(select) — Work Order selects bind explicit canonical values (source audit)
it('every Work Order select binds value={canonical}, never text content', () => {
  const source = readFileSync(path.resolve(process.cwd(), 'src/components/operations/OperationForms.tsx'), 'utf8');
  expect(source).toMatch(/operationTypes\.map\(x => <option value=\{x\} key=\{x\}>/);
  expect(source).toMatch(/priorities\.map\(p => <option value=\{p\} key=\{p\}>/);
  expect(source).not.toMatch(/<option>medium<\/option>/); // old value-less shape gone
});

// 20 — the option-value audit regex flags a value-less option
it('20 — audit-options logic detects an option without an explicit value', () => {
  const bad = '<option>medium</option>';
  const good = '<option value="medium">Medium</option>';
  const hasValue = (line: string) => [...line.matchAll(/<option\b([^>]*)>/g)].every((m) => /\bvalue\s*=/.test(m[1]));
  expect(hasValue(bad)).toBe(false);
  expect(hasValue(good)).toBe(true);
});
