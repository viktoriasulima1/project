import { describe, expect, it } from 'vitest';
import { getNamespace } from '../catalog';
import { SUPPORTED_LOCALES } from '../locales';
import { createTranslator } from '../translator';
import { buildBudgetVarianceDisplayModel } from '../adapters/budget-variance';
import { resolveBudgetVariance } from '@/lib/economics';

const tf = (locale: (typeof SUPPORTED_LOCALES)[number]) => createTranslator(locale, {
  messages: getNamespace(locale, 'fields'), fallback: getNamespace('en-GB', 'fields'),
});

describe('budget variance presentation', () => {
  it('translates every available status in all four locales without exposing codes', () => {
    const cases = [
      resolveBudgetVariance({ budget: 100, actual: 100 }),
      resolveBudgetVariance({ budget: 100, actual: 125 }),
      resolveBudgetVariance({ budget: 100, actual: 75 }),
    ];
    for (const locale of SUPPORTED_LOCALES) for (const result of cases) {
      const display = buildBudgetVarianceDisplayModel(tf(locale), locale, result);
      expect(display.statusLabel).toBeTruthy();
      expect(display.explanation).toBeTruthy();
      expect(JSON.stringify(display)).not.toMatch(/WITHIN_BUDGET|OVER_BUDGET|UNDER_BUDGET|REVIEW_COSTS|NO_ACTION_REQUIRED/);
    }
  });

  it('translates every unavailable reason and action in all four locales', () => {
    const cases = [
      resolveBudgetVariance({ budget: null, actual: 10 }),
      resolveBudgetVariance({ budget: 10, actual: null }),
      resolveBudgetVariance({ budget: null, actual: null }),
      resolveBudgetVariance({ budget: 10, actual: null, actualCostComplete: false, unpricedRecordCount: 1 }),
      resolveBudgetVariance({ budget: 10, actual: 10, currency: 'EUR', actualCurrency: 'GBP' }),
    ];
    for (const locale of SUPPORTED_LOCALES) for (const result of cases) {
      const display = buildBudgetVarianceDisplayModel(tf(locale), locale, result);
      expect(display.explanation).toBeTruthy();
      expect(display.actionLabel).toBeTruthy();
      expect(JSON.stringify(display)).not.toMatch(/NOT_RECORDED|INCOMPLETE|CURRENCY_MISMATCH|ADD_BUDGET|OPEN_FINANCE/);
    }
  });

  it('formats values by locale while preserving canonical cents and sign', () => {
    const result = resolveBudgetVariance({ budget: 1000, actual: 1125 });
    const en = buildBudgetVarianceDisplayModel(tf('en-GB'), 'en-GB', result);
    const de = buildBudgetVarianceDisplayModel(tf('de-DE'), 'de-DE', result);
    expect(en.varianceText).not.toBe(de.varianceText);
    expect(result.metadata).toMatchObject({ budgetCents: 100000, actualCents: 112500, varianceCents: 12500, variancePercent: 12.5 });
  });

  it('shows explicit zero as zero and missing as Not recorded', () => {
    const zero = buildBudgetVarianceDisplayModel(tf('en-GB'), 'en-GB', resolveBudgetVariance({ budget: 0, actual: 0 }));
    const missing = buildBudgetVarianceDisplayModel(tf('en-GB'), 'en-GB', resolveBudgetVariance({ budget: null, actual: null }));
    expect(zero.budgetText).toMatch(/0/);
    expect(zero.actualText).toMatch(/0/);
    expect(missing.budgetText).toBe('Not recorded');
    expect(missing.actualText).toBe('Not recorded');
  });
});
