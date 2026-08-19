import { describe, expect, it } from 'vitest';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import { CATALOG } from '@/i18n/catalog';
import { SUPPORTED_LOCALES } from '@/i18n/locales';
import { createTranslator } from '@/i18n/translator';
import { SAFE_ERROR_CODES } from '@/i18n/error-codes';
import { userError } from '@/lib/user-error';

function translator(locale: (typeof SUPPORTED_LOCALES)[number]) {
  return createTranslator(locale, { messages: CATALOG[locale].errors, fallback: CATALOG['en-GB'].errors });
}

describe('user error localization adapter', () => {
  it('renders every canonical code in all four locales without exposing its token', () => {
    for (const locale of SUPPORTED_LOCALES) for (const code of SAFE_ERROR_CODES) {
      const display = buildUserErrorDisplayModel({ translator: translator(locale), locale, error: userError(code) });
      expect(display.message).not.toBe(code);
      expect(display.message).not.toMatch(/\[missing:/);
      expect(display.announcement).toContain(display.message);
    }
  });

  it('returns localized actions, field association and safe correlation ID', () => {
    const display = buildUserErrorDisplayModel({
      translator: translator('de-DE'), locale: 'de-DE',
      error: userError('PROVIDER_UNAVAILABLE', { field: 'photo', correlationId: 'corr-safe' }),
    });
    expect(display.fieldMessage).toBe(display.message);
    expect(display.actionLabels.retry).toBe('Erneut versuchen');
    expect(display.correlationId).toBe('corr-safe');
  });

  it('unknown runtime codes use the localized generic fallback before presentation', () => {
    const display = buildUserErrorDisplayModel({
      translator: translator('nl-NL'), locale: 'nl-NL', error: userError('GENERIC'),
    });
    expect(display.message).toBe(CATALOG['nl-NL'].errors.GENERIC);
    expect(display.message).not.toContain('GENERIC');
  });
});
