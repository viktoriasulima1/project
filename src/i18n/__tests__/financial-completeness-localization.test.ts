import { describe, expect, it } from 'vitest';
import { getNamespace } from '../catalog';
import { SUPPORTED_LOCALES } from '../locales';
import { createTranslator } from '../translator';
import { buildFinancialCompletenessDisplayModel } from '../adapters/financial-completeness';
import { resolveEconomicsCompleteness } from '@/lib/economics';

const tf = (locale: (typeof SUPPORTED_LOCALES)[number]) =>
  createTranslator(locale, { messages: getNamespace(locale, 'fields'), fallback: getNamespace('en-GB', 'fields') });
const base = { productPricesKnown: true, labourApplicable: false, labourRatesKnown: false, machineryApplicable: false, machineryRatesKnown: false, contractorApplicable: false, contractorRecorded: false, harvestRecorded: true, revenueRecorded: true, overheadChoiceRecorded: true, unitsCompatible: true };

describe('financial completeness canonical contract', () => {
  it('preserves complete status, percentage and ordered recorded codes', () => {
    const result = resolveEconomicsCompleteness(base);
    expect(result.status).toBe('profitability_ready');
    expect(result.percentage).toBe(100);
    expect(result.reasons).toEqual([]);
    expect(result.recordedCodes).toEqual(['PRODUCT_PRICES_RECORDED','LABOUR_RATES_RECORDED','MACHINE_RATES_RECORDED','CONTRACTOR_COSTS_RECORDED','HARVEST_RECORDED','REVENUE_RECORDED','OVERHEAD_CHOICE_RECORDED','UNITS_COMPATIBLE']);
  });

  it('preserves deterministic multiple-reason and action ordering without duplicates', () => {
    const result = resolveEconomicsCompleteness({ ...base, productPricesKnown: false, labourApplicable: true, harvestRecorded: false, revenueRecorded: false, unitsCompatible: false });
    expect(result.reasons.map((reason) => reason.code)).toEqual(['MISSING_PRODUCT_PRICE','MISSING_LABOUR_RATE','MISSING_HARVEST','MISSING_REVENUE','INCOMPATIBLE_UNITS']);
    expect(result.actionCodes).toEqual(['ADD_PURCHASE_PRICE','ADD_LABOUR_RATE','ADD_HARVEST','ADD_REVENUE','ALIGN_UNITS']);
    expect(new Set(result.reasons.map((reason) => reason.code)).size).toBe(result.reasons.length);
  });

  it('returns canonical metadata and no final prose', () => {
    const result = resolveEconomicsCompleteness({ ...base, machineryApplicable: true });
    expect(result.metadata).toEqual({ applicableCheckCount: 8, passedCheckCount: 7 });
    expect(JSON.stringify(result)).not.toMatch(/missing\.|record |cost is|yield is/i);
  });

  it('distinguishes all current missing decisions', () => {
    const result = resolveEconomicsCompleteness({ productPricesKnown:false,labourApplicable:true,labourRatesKnown:false,machineryApplicable:true,machineryRatesKnown:false,contractorApplicable:true,contractorRecorded:false,harvestRecorded:false,revenueRecorded:false,overheadChoiceRecorded:false,unitsCompatible:false });
    expect(result.reasons.map((reason) => reason.code)).toEqual(['MISSING_PRODUCT_PRICE','MISSING_LABOUR_RATE','MISSING_MACHINE_RATE','MISSING_CONTRACTOR_COST','MISSING_HARVEST','MISSING_REVENUE','MISSING_OVERHEAD_CHOICE','INCOMPATIBLE_UNITS']);
    expect(result.percentage).toBe(0);
  });
});

describe('financial completeness presentation', () => {
  it('translates every status/reason/recorded/action in four locales without raw codes', () => {
    const result = resolveEconomicsCompleteness({ productPricesKnown:false,labourApplicable:true,labourRatesKnown:false,machineryApplicable:true,machineryRatesKnown:false,contractorApplicable:true,contractorRecorded:false,harvestRecorded:false,revenueRecorded:false,overheadChoiceRecorded:false,unitsCompatible:false });
    for (const locale of SUPPORTED_LOCALES) {
      const display = buildFinancialCompletenessDisplayModel(tf(locale), locale, result);
      expect(display.title).toBeTruthy();
      expect(display.reasonItems).toHaveLength(8);
      expect(display.actions).toHaveLength(8);
      expect(JSON.stringify([display.title, display.statusLabel, display.summary, display.recordedItems, display.reasonItems, display.actions.map(action => action.label)])).not.toMatch(/MISSING_|_RECORDED|ADD_|ALIGN_UNITS|RECORD_OVERHEAD/);
    }
  });

  it('uses a safe localized fallback for unknown runtime reason code', () => {
    const result = resolveEconomicsCompleteness({ ...base, harvestRecorded: false });
    result.reasons[0].code = 'FUTURE_CODE' as never;
    expect(buildFinancialCompletenessDisplayModel(tf('en-GB'), 'en-GB', result).reasonItems).toEqual(['Details are unavailable.']);
  });
});
