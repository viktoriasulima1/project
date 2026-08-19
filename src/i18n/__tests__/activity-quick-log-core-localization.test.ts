import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import { CATALOG } from '@/i18n/catalog';
import { SUPPORTED_LOCALES } from '@/i18n/locales';
import { createTranslator } from '@/i18n/translator';
import { userError } from '@/lib/user-error';

const TARGET_CODES = [
  'AUTH_REQUIRED', 'REQUIRED_FIELD', 'INVALID_ENUM', 'INVALID_VALUE',
  'INVALID_QUANTITY', 'INVALID_DATE', 'NOT_FOUND', 'INSUFFICIENT_STOCK',
  'SYNC_CONFLICT', 'AI_REQUIRES_CONNECTION', 'PROVIDER_UNAVAILABLE',
] as const;

describe('Activities and Quick Log core user-error localization', () => {
  it('renders every target contract in all four supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const translator = createTranslator(locale, {
        messages: CATALOG[locale].errors,
        fallback: CATALOG['en-GB'].errors,
      });
      for (const code of TARGET_CODES) {
        const display = buildUserErrorDisplayModel({ translator, locale, error: userError(code) });
        expect(display.message, `${locale}/${code}`).not.toBe(code);
        expect(display.message, `${locale}/${code}`).not.toMatch(/\[missing:/);
      }
    }
  });

  it('keeps server actions structured and localizes only in their UI consumers', () => {
    const action = readFileSync(path.resolve('src/lib/actions/activities.ts'), 'utf8');
    const quickLog = readFileSync(path.resolve('src/lib/actions/quick-log.ts'), 'utf8');
    const dialog = readFileSync(path.resolve('src/components/activities/ActivityDialog.tsx'), 'utf8');
    const client = readFileSync(path.resolve('src/components/activities/ActivitiesClient.tsx'), 'utf8');
    const button = readFileSync(path.resolve('src/components/activities/QuickLogButton.tsx'), 'utf8');

    expect(action).toContain('UserFacingError');
    expect(quickLog).toContain('UserFacingError');
    expect(dialog).toContain('buildUserErrorDisplayModel');
    expect(client).toContain('buildUserErrorDisplayModel');
    expect(button).toContain('buildUserErrorDisplayModel');
    expect(dialog).not.toContain('error instanceof Error ? error.message');
  });

  it('uses structured errors at the activity-parse API boundary', () => {
    const route = readFileSync(path.resolve('src/app/api/ai/activity-parse/route.ts'), 'utf8');
    expect(route).toContain("userError('INVALID_VALUE'");
    expect(route).toContain("userError('RATE_LIMITED'");
    expect(route).not.toContain('Enter a short description of one activity.');
    expect(route).not.toContain('Daily AI parsing limit reached.');
  });
});
