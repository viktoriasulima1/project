import { describe, it, expect } from 'vitest';
import { getNamespace } from '../catalog';
import { SUPPORTED_LOCALES } from '../locales';
import { createTranslator } from '../translator';
import { buildBreakEvenDisplayModel } from '../adapters/break-even';
import { breakEvenExplanation, type BreakEvenExplanation, type BreakEvenReasonCode } from '@/lib/field-economics';
import { resolveFieldEconomics, resolveEconomicsCompleteness } from '@/lib/economics';

const tf = (locale: (typeof SUPPORTED_LOCALES)[number]) =>
  createTranslator(locale, { messages: getNamespace(locale, 'fields'), fallback: getNamespace('en-GB', 'fields') });

const base = { totalRecordedCost: 4650, costsComplete: true, saleableYield: 60, yieldUnit: 'tonnes', recordedPricePerUnit: 200, unitsCompatible: true, hasUnallocatedRemainder: false };
const REASONS: BreakEvenReasonCode[] = ['INCOMPLETE_COST', 'MISSING_HARVEST', 'MISSING_SALE_PRICE', 'INCOMPATIBLE_UNITS', 'UNALLOCATED_COSTS'];
const blocking = (code: BreakEvenReasonCode): BreakEvenExplanation => ({
  price: { available: false, value: null, reasonCodes: [code] },
  yieldValue: { available: false, value: null, reasonCodes: [code] },
});

describe('break-even adapter', () => {
  it('available price/yield render localized value + formula, no raw code, all locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const m = buildBreakEvenDisplayModel(tf(locale), locale, breakEvenExplanation(base));
      expect(m.title).toBeTruthy();
      expect(m.price.available).toBe(true);
      expect(m.price.valueText).toContain('tonnes'); // €77.50/tonnes
      expect(m.price.formulaText).toBeTruthy();
      expect(m.yieldValue.valueText).toContain('tonnes'); // 23.25 tonnes
    }
  });

  it('every reason code + derived action localizes to non-code text in all locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const code of REASONS) {
        const m = buildBreakEvenDisplayModel(tf(locale), locale, blocking(code));
        expect(m.price.reasonText).toBeTruthy();
        expect(m.price.reasonText).not.toContain(code);
        expect(m.price.actionText).toBeTruthy();
        expect(m.price.actionText).not.toMatch(/ADD_|ALIGN_|REVIEW_/);
      }
    }
  });

  it('unknown runtime reason code degrades safely (never a raw code)', () => {
    const m = buildBreakEvenDisplayModel(tf('en-GB'), 'en-GB', blocking('BOGUS_CODE' as BreakEvenReasonCode));
    expect(m.price.reasonText).not.toContain('BOGUS');
  });

  it('nl-NL formats the break-even currency with a comma decimal', () => {
    const m = buildBreakEvenDisplayModel(tf('nl-NL'), 'nl-NL', breakEvenExplanation(base));
    expect(m.price.valueText).toMatch(/77,50/); // value unchanged, separators localized
  });

  // Part 11/Flow D: Field Detail (adapter) and Finance (numeric resolveFieldEconomics)
  // share the same canonical break-even value from the same cost/yield inputs.
  it('Field Detail and Finance produce the same canonical break-even value', () => {
    const displayVal = breakEvenExplanation({ ...base, totalRecordedCost: 600, saleableYield: 20 }).price.value!.result;
    const completeness = resolveEconomicsCompleteness({ productPricesKnown: true, labourApplicable: false, labourRatesKnown: false, machineryApplicable: false, machineryRatesKnown: false, contractorApplicable: false, contractorRecorded: false, harvestRecorded: true, revenueRecorded: true, overheadChoiceRecorded: true, unitsCompatible: true });
    const numeric = resolveFieldEconomics({ hectares: 10, directCosts: [500], allocatedCosts: [100], recordedRevenue: [1000], saleableYield: 20, yieldUnit: 'tonnes', recordedPricePerUnit: 50, completeness, calculatedAt: 'now' }).breakEvenPrice;
    expect(displayVal).toBe(30);
    expect(numeric).toBe(30);
    expect(displayVal).toBe(numeric);
  });
});
