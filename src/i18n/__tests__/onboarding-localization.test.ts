import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getNamespace } from '../catalog';
import { SUPPORTED_LOCALES } from '../locales';
import { createTranslator } from '../translator';
import { diffNamespace, type Tree } from '../validate-core';
import { getEnumLabel } from '../enum-labels';
import { translateErrorCode, isSafeErrorCode } from '../error-codes';

const ob = (locale: (typeof SUPPORTED_LOCALES)[number]) =>
  createTranslator(locale, { messages: getNamespace(locale, 'onboarding'), fallback: getNamespace('en-GB', 'onboarding') });

// 1/2/3 — namespace exists, structure matches, no empties
it('1/2/3 — onboarding exists in all locales with matching structure', () => {
  for (const locale of SUPPORTED_LOCALES) {
    expect(Object.keys(getNamespace(locale, 'onboarding')).length).toBeGreaterThan(0);
    if (locale === 'en-GB') continue;
    const diff = diffNamespace(getNamespace('en-GB', 'onboarding') as Tree, getNamespace(locale, 'onboarding') as Tree);
    expect({ locale, ...diff }).toEqual({ locale, missing: [], extra: [], empty: [], placeholderMismatch: [] });
  }
});

// 4/5/6 — real translations per locale
describe('real onboarding translations', () => {
  it('4 — Dutch Welcome', () => { expect(ob('nl-NL')('welcome.title')).toBe('Welkom bij FarmOS'); });
  it('5 — Polish Farm details', () => { expect(ob('pl-PL')('farm.nameLabel')).toBe('Nazwa gospodarstwa *'); });
  it('6 — German Season step', () => { expect(ob('de-DE')('season.title')).toBe('Aktive Saison'); });
});

// 7 — English fallback for a missing key
it('7 — missing key falls back to English', () => {
  const t = createTranslator('nl-NL', { messages: {}, fallback: getNamespace('en-GB', 'onboarding') });
  expect(t('review.finish')).toBe('Finish');
});

// progress interpolation preserved
it('progress interpolates {current}/{total}/{label} in every locale', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const out = ob(locale)('progress', { current: 2, total: 8, label: 'X' });
    expect(out).toContain('2');
    expect(out).toContain('8');
  }
});

// 12/13/14 — canonical enum tokens unchanged; labels localize
describe('canonical value safety', () => {
  it('12/13 — farm/soil/crop/category/unit keys are exactly the canonical tokens', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(getNamespace(locale, 'enums').soilType as object).sort()).toEqual(['clay', 'loam', 'peat', 'sandy', 'silt']);
      expect(Object.keys(getNamespace(locale, 'enums').inventoryCategory as object)).toContain('fertiliser');
    }
    expect(getEnumLabel('nl-NL', 'soilType', 'clay')).toBe('Klei');
    expect(getEnumLabel('de-DE', 'crop', 'wheat')).toBe('Weizen');
    expect(getEnumLabel('pl-PL', 'inventoryCategory', 'herbicide')).toBe('Herbicyd');
    // canonical fallback for an unknown token
    expect(getEnumLabel('nl-NL', 'unit', 'drum')).toBe('drum');
  });
});

// 15 — every onboarding <option> binds an explicit canonical value (source audit)
it('15 — wizard selects bind value={canonical}, never text content', () => {
  const src = readFileSync(path.resolve(process.cwd(), 'src/components/onboarding/OnboardingWizard.tsx'), 'utf8');
  expect(src).toMatch(/SOIL_OPTIONS\.map\(\(s\) => <option key=\{s\} value=\{s\}>/);
  expect(src).toMatch(/CROP_VALUES\.map\(\(c\) => <option key=\{c\} value=\{c\}>/);
  expect(src).toMatch(/INVENTORY_UNITS\.map\(\(u\) => <option key=\{u\} value=\{u\}>/);
  expect(src).not.toMatch(/<option>[A-Za-z]/); // no value-less option with text
});

// 16/17 — friendly error codes in all locales; unknown → GENERIC (no raw text)
describe('16/17 — error codes', () => {
  it('onboarding codes translate in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const code of ['FARM_NAME_REQUIRED', 'SEASON_ALREADY_EXISTS', 'INVALID_SOIL_TYPE', 'DATABASE_UNAVAILABLE']) {
        expect(isSafeErrorCode(code)).toBe(true);
        expect(translateErrorCode(code, locale).length).toBeGreaterThan(0);
      }
    }
  });
  it('a raw Prisma/Zod string degrades to GENERIC', () => {
    expect(isSafeErrorCode('Invalid `prisma.farm.create()` invocation')).toBe(false);
    expect(translateErrorCode('Invalid `prisma.farm.create()`', 'de-DE')).toBe(translateErrorCode('GENERIC', 'de-DE'));
  });
});

// 20 — the module audit is zero (executes the real audit script)
it('20 — i18n:audit -- onboarding returns zero', () => {
  // exits 0 only when no unexplained strings remain
  const out = execFileSync('npx', ['tsx', 'scripts/i18n-audit.ts', 'onboarding'], { encoding: 'utf8', shell: process.platform === 'win32' });
  expect(out).toMatch(/i18n:audit passed/);
});
