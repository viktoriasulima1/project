import { describe, it, expect } from 'vitest';
import { resolveEconomicsInsights } from '../economics-insights';
import type { FinanceData, FieldEconomicsRow } from '../finance-data';
import { resolveBudgetVariance, resolveEconomicsCompleteness, resolveGrossMargin } from '../economics';
import { getEconomicSignalRoute } from '../farm-economic-signals';
const variance = (amount: number, percentage: number) => { const budget = Math.abs(amount / (percentage / 100)); return resolveBudgetVariance({ budget, actual: budget + amount }); };

function field(over: Partial<FieldEconomicsRow> = {}): FieldEconomicsRow {
  return {
    fieldSeasonId: 'fs1', fieldId: 'f1', field: 'Noordkamp', crop: 'wheat', hectares: 10,
    recordedCostEur: 1000, recordedRevenueEur: 1500, grossMarginEur: 500, costPerHaEur: 100,
    revenuePerHaEur: 150, grossMarginPerHaEur: 50, yieldQuantity: 60, yieldUnit: 'tonnes', yieldPerHa: 6, harvestRecorded: true, harvestRecordCount: 1,
    costPerYieldUnit: 16.6, breakEvenPrice: 16, breakEvenYield: 40, completenessPercent: 100,
    completenessStatus: 'profitability_ready', completenessResult: resolveEconomicsCompleteness({productPricesKnown:true,labourApplicable:false,labourRatesKnown:false,machineryApplicable:false,machineryRatesKnown:false,contractorApplicable:false,contractorRecorded:false,harvestRecorded:true,revenueRecorded:true,overheadChoiceRecorded:true,unitsCompatible:true}), budgetCostEur: 1200, budgetRevenueEur: 1600,
    costVariance: resolveBudgetVariance({ budget: 1200, actual: 1000 }), ...over,
    grossMarginResult: over.grossMarginResult ?? resolveGrossMargin({ recordedRevenue: over.recordedRevenueEur ?? 1500, totalRecordedCost: over.recordedCostEur ?? 1000, fieldAreaHa: over.hectares ?? 10, completeness: over.completenessResult ?? resolveEconomicsCompleteness({productPricesKnown:true,labourApplicable:false,labourRatesKnown:false,machineryApplicable:false,machineryRatesKnown:false,contractorApplicable:false,contractorRecorded:false,harvestRecorded:true,revenueRecorded:true,overheadChoiceRecorded:true,unitsCompatible:true}) }),
  };
}

function finance(over: Partial<FinanceData> = {}): FinanceData {
  return {
    hasFinancialData: true, seasonId: 's1', seasonYear: 2026, currency: 'EUR',
    totalRecordedCostEur: 1000, totalRecordedRevenueEur: 1500, grossMarginEur: 500,
    completenessPercent: 100, completenessStatus: 'profitability_ready', fields: [field()], crops: [],
    unallocatedCostEur: null, unallocatedRevenueEur: null, missingData: [],
    recentPurchases: [], recentEntries: [], expectedRevenueEur: null, approvedRevenueEur: null,
    lastCalculatedAt: '', hasActivityData: true, costByField: [], costByCrop: [],
    totalProductLines: 5, linesWithPrice: 5, missingPriceProducts: [], dateRangeStart: null, dateRangeEnd: null,
    ...over,
  };
}
const ids = (d: FinanceData) => resolveEconomicsInsights(d).map(i => i.id);

describe('resolveEconomicsInsights', () => {
  it('returns nothing when there is no active season', () => {
    expect(resolveEconomicsInsights(finance({ seasonId: null }))).toEqual([]);
  });

  it('a fully complete, allocated, priced, in-budget season produces no economics insights', () => {
    expect(resolveEconomicsInsights(finance())).toEqual([]);
  });

  it('flags missing product prices with real evidence', () => {
    const result = resolveEconomicsInsights(finance({ missingPriceProducts: ['Amistar', 'KAS'], linesWithPrice: 3, totalProductLines: 5 }));
    const insight = result.find(i => i.id === 'econ-missing-price');
    expect(insight).toBeDefined();
    expect(insight!.evidence).toContainEqual({ type: 'product_price_coverage', pricedLineCount: 3, totalLineCount: 5 });
    expect(getEconomicSignalRoute(insight!)).toBe('/inventory');
  });

  it('flags unallocated cost and revenue separately, only when positive', () => {
    expect(ids(finance({ unallocatedCostEur: 250 }))).toContain('econ-unallocated-cost');
    expect(ids(finance({ unallocatedRevenueEur: 250 }))).toContain('econ-unallocated-revenue');
    expect(ids(finance({ unallocatedCostEur: 0 }))).not.toContain('econ-unallocated-cost');
    expect(ids(finance({ unallocatedCostEur: null }))).not.toContain('econ-unallocated-cost');
  });

  it('flags a field over its planned cost and names the worst overrun', () => {
    const result = resolveEconomicsInsights(finance({ fields: [
      field({ field: 'A', costVariance: variance(300, 30) }),
      field({ field: 'B', costVariance: variance(900, 40) }),
    ] }));
    const insight = result.find(i => i.id === 'econ-field-over-budget');
    expect(insight).toBeDefined();
    expect(insight!.metadata.affectedFieldNames[0]).toBe('B');
    expect(insight!.metadata.affectedCount).toBe(2);
    expect(insight!.budgetVariance).toMatchObject({ status: 'over_budget', reasonCode: 'OVER_BUDGET', metadata: { varianceCents: 90000 } });
    expect(insight!.signalCode).toBe('BUDGET_OVER_LIMIT');
  });

  it('does not flag over-budget when actual is under plan (negative variance)', () => {
    expect(ids(finance())).not.toContain('econ-field-over-budget'); // base has amount -200
  });

  it('flags a field with cost but no harvest', () => {
    expect(ids(finance({ fields: [field({ recordedCostEur: 500, yieldQuantity: null })] }))).toContain('econ-missing-harvest');
  });

  it('flags a harvested field with cost but no recorded revenue', () => {
    expect(ids(finance({ fields: [field({ recordedCostEur: 500, yieldQuantity: 40, recordedRevenueEur: null })] }))).toContain('econ-missing-revenue');
  });

  it('flags incomplete profitability only for fields that have some recorded cost', () => {
    expect(ids(finance({ fields: [field({ recordedCostEur: 500, completenessStatus: 'partial_profitability', completenessResult: resolveEconomicsCompleteness({productPricesKnown:true,labourApplicable:false,labourRatesKnown:false,machineryApplicable:false,machineryRatesKnown:false,contractorApplicable:false,contractorRecorded:false,harvestRecorded:true,revenueRecorded:false,overheadChoiceRecorded:true,unitsCompatible:true}) })] }))).toContain('econ-profitability-incomplete');
    // a field with no cost at all should not raise the incomplete-profitability alarm
    expect(ids(finance({ fields: [field({ recordedCostEur: null, completenessStatus: 'insufficient_data' })] }))).not.toContain('econ-profitability-incomplete');
  });

  it('flags a margin that rests on incomplete data (margin present, completeness < 100)', () => {
    expect(ids(finance({ fields: [field({ grossMarginEur: 400, completenessPercent: 70 })] }))).toContain('econ-margin-incomplete-data');
    expect(ids(finance({ fields: [field({ grossMarginEur: 400, completenessPercent: 100 })] }))).not.toContain('econ-margin-incomplete-data');
  });

  it('every insight is well-formed: title, evidence, why-it-matters, confidence, next action, priority', () => {
    const result = resolveEconomicsInsights(finance({
      missingPriceProducts: ['X'], unallocatedCostEur: 100, unallocatedRevenueEur: 100,
      fields: [field({ recordedCostEur: 500, yieldQuantity: null, completenessStatus: 'partial_profitability', completenessPercent: 60, grossMarginEur: 100, costVariance: variance(50, 5) })],
    }));
    expect(result.length).toBeGreaterThanOrEqual(5);
    for (const i of result) {
      expect(i.signalCode).toBeTruthy();
      expect(i.evidence.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(i.confidence);
      expect(i.actionCode).toBeTruthy();
      expect(getEconomicSignalRoute(i)).toMatch(/^\//);
      expect(i.priority.financialImpact).toBeGreaterThan(0);
    }
  });
});
