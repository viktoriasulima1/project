import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveLocale } from '../resolve';
import { HTML_LANG, LOCALE_DIR, SUPPORTED_LOCALES, isSupportedLocale } from '../locales';
import { clerkLocaleFor } from '../clerk-locale';
import { clerkLocalization } from '../clerk-localization';
import { translateErrorCode, isSafeErrorCode, SAFE_ERROR_CODES } from '../error-codes';
import { pickNamespaces } from '../catalog';
import { getEnumLabel } from '../enum-labels';
import { CROP_CONDITIONS } from '@/lib/scouting/condition';

// Part 17.3/5 — DB preference overrides cookie; cross-device precedence
describe('DB preference precedence', () => {
  it('a stored preference overrides the cookie and Accept-Language', () => {
    expect(resolveLocale({ userPreference: 'pl-PL', cookieLocale: 'de-DE', acceptLanguage: 'nl' })).toBe('pl-PL');
  });
  it('cookie is used when there is no stored preference (anonymous)', () => {
    expect(resolveLocale({ userPreference: null, cookieLocale: 'de-DE' })).toBe('de-DE');
  });
});

// Part 17.2 — html lang + direction
describe('html lang + dir', () => {
  it('maps each locale to a short lang code', () => {
    expect(HTML_LANG['nl-NL']).toBe('nl');
    expect(HTML_LANG['en-GB']).toBe('en');
    expect(HTML_LANG['pl-PL']).toBe('pl');
    expect(HTML_LANG['de-DE']).toBe('de');
  });
  it('all current locales are LTR (RTL-ready map)', () => {
    for (const locale of SUPPORTED_LOCALES) expect(LOCALE_DIR[locale]).toBe('ltr');
  });
});

// Part 17.6 — unsupported locale rejected
it('unsupported locale is rejected by validation', () => {
  expect(isSupportedLocale('ru-RU')).toBe(false);
  expect(isSupportedLocale('nl-NL')).toBe(true);
});

// Part 17.9 — Clerk locale mapping + resource resolution
describe('Clerk localization', () => {
  it('maps to keys that exist in the installed pack', () => {
    expect(clerkLocaleFor('en-GB')).toBe('enGB');
  });
  it('resolves a localization resource object per locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const resource = clerkLocalization(locale);
      expect(resource).toBeTypeOf('object');
      expect(resource).not.toBeNull();
    }
  });
});

// Part 14 — extended error codes localized; unknown → GENERIC
describe('extended error codes', () => {
  it('new codes translate in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const code of ['OPERATOR_CERTIFICATE_EXPIRED', 'SYNC_CONFLICT', 'AUTH_REQUIRED', 'INVALID_CTGB_USE']) {
        expect(translateErrorCode(code, locale).length).toBeGreaterThan(0);
      }
    }
  });
  it('an unknown/raw error never leaks, degrading to GENERIC', () => {
    expect(isSafeErrorCode('PrismaClientKnownRequestError: P2002')).toBe(false);
    expect(translateErrorCode('PrismaClientKnownRequestError', 'nl-NL')).toBe(translateErrorCode('GENERIC', 'nl-NL'));
  });
  it('all safe codes have an en-GB message', () => {
    for (const code of SAFE_ERROR_CODES) expect(translateErrorCode(code, 'en-GB')).not.toBe('');
  });
});

// Part 2/8 — global provider payload only ships requested namespaces
it('pickNamespaces returns locale messages + English fallback for the global set', () => {
  const { messages, fallback } = pickNamespaces('de-DE', ['common', 'navigation']);
  expect(Object.keys(messages).sort()).toEqual(['common', 'navigation']);
  expect(Object.keys(fallback).sort()).toEqual(['common', 'navigation']);
  expect((messages.navigation as Record<string, string>).today).toBe('Heute');
});

// Part 11 — every Scouting enum select uses an explicit canonical value
describe('Scouting select value safety (source audit)', () => {
  const source = readFileSync(path.resolve(process.cwd(), 'src/components/scouting/ScoutingVisitForm.tsx'), 'utf8');
  it('condition/severity/category options bind value={canonical}, never text content', () => {
    expect(source).toMatch(/CROP_CONDITIONS\.map\(\(c\) => <option key=\{c\} value=\{c\}>/);
    expect(source).toMatch(/SEVERITIES\.map\(\(s\) => <option key=\{s\} value=\{s\}>/);
    expect(source).toMatch(/OBSERVATION_CATEGORIES\.map\(\(c\) => <option key=\{c\} value=\{c\}>/);
    // no value-less <option> for the condition enum (the original iPhone defect)
    expect(source).not.toMatch(/<option>good<\/option>/);
  });
  it('labels differ by locale while the value stays canonical', () => {
    expect(getEnumLabel('nl-NL', 'condition', 'satisfactory')).toBe('Voldoende');
    expect(getEnumLabel('de-DE', 'condition', 'satisfactory')).toBe('Zufriedenstellend');
    expect(CROP_CONDITIONS).toContain('satisfactory'); // value unchanged
  });
});
