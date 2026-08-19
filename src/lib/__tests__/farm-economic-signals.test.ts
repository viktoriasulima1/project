import { describe, it, expect } from 'vitest';
import { buildEconomicSignals, getEconomicSignalRoute, getFarmEconomicSignals } from '../farm-economic-signals';
import type { FinanceData, FieldEconomicsRow } from '../finance-data';
import { resolveBudgetVariance, resolveEconomicsCompleteness, resolveGrossMargin } from '../economics';
const variance = (amount: number | null, percentage?: number | null) => amount == null
  ? resolveBudgetVariance({ budget: null, actual: null })
  : resolveBudgetVariance({ budget: percentage ? Math.abs(amount / (percentage / 100)) : 1000, actual: (percentage ? Math.abs(amount / (percentage / 100)) : 1000) + amount });
const completeness = (over: Partial<Parameters<typeof resolveEconomicsCompleteness>[0]> = {}) => resolveEconomicsCompleteness({productPricesKnown:true,labourApplicable:false,labourRatesKnown:false,machineryApplicable:false,machineryRatesKnown:false,contractorApplicable:false,contractorRecorded:false,harvestRecorded:true,revenueRecorded:true,overheadChoiceRecorded:true,unitsCompatible:true,...over});

function field(over: Partial<FieldEconomicsRow> = {}): FieldEconomicsRow {
  return {
    fieldSeasonId: 'fs1', fieldId: 'f1', field: 'Noordkamp', crop: 'wheat', hectares: 10,
    recordedCostEur: 1000, recordedRevenueEur: 1500, grossMarginEur: 500, costPerHaEur: 100,
    revenuePerHaEur: 150, grossMarginPerHaEur: 50, yieldQuantity: 60, yieldUnit: 'tonnes', yieldPerHa: 6, harvestRecorded: true, harvestRecordCount: 1,
    costPerYieldUnit: 16.6, breakEvenPrice: 16, breakEvenYield: 40, completenessPercent: 100,
    completenessStatus: 'profitability_ready', completenessResult: completeness(), budgetCostEur: 1200, budgetRevenueEur: 1600,
    costVariance: resolveBudgetVariance({ budget: 1200, actual: 1000 }), ...over,
    grossMarginResult: over.grossMarginResult ?? resolveGrossMargin({ recordedRevenue: over.recordedRevenueEur ?? 1500, totalRecordedCost: over.recordedCostEur ?? 1000, fieldAreaHa: over.hectares ?? 10, completeness: over.completenessResult ?? completeness() }),
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
const ids = (d: FinanceData) => buildEconomicSignals(d).map((s) => s.id);

describe('buildEconomicSignals (Parts 2-4)', () => {
  it('returns nothing without an active season', () => {
    expect(buildEconomicSignals(finance({ seasonId: null }))).toEqual([]);
  });

  it('1 — largest budget variance names the worst field and carries its amount', () => {
    const s = buildEconomicSignals(finance({ fields: [
      field({ field: 'A', costVariance: variance(300, 30) }),
      field({ field: 'B', fieldId: 'fB', costVariance: variance(900, 40) }),
    ] })).find((x) => x.id === 'econ-field-over-budget')!;
    expect(s.metadata.affectedFieldNames[0]).toBe('B');
    expect(s.metadata.amountCents).toBe(90000);
    expect(getEconomicSignalRoute(s)).toBe('/fields/fB');
  });

  it('2 — missing price signal', () => {
    expect(ids(finance({ missingPriceProducts: ['Amistar'], linesWithPrice: 4 }))).toContain('econ-missing-price');
  });
  it('3 — missing labour rate', () => {
    expect(ids(finance({ fields: [field({ completenessResult: completeness({labourApplicable:true,labourRatesKnown:false}) })] }))).toContain('econ-missing-labour-rate');
  });
  it('4 — missing machinery rate', () => {
    expect(ids(finance({ fields: [field({ completenessResult: completeness({machineryApplicable:true,machineryRatesKnown:false}) })] }))).toContain('econ-missing-machine-rate');
  });
  it('5 — unallocated expense; 6 — unallocated revenue (only when positive)', () => {
    expect(ids(finance({ unallocatedCostEur: 250 }))).toContain('econ-unallocated-cost');
    expect(ids(finance({ unallocatedRevenueEur: 120 }))).toContain('econ-unallocated-revenue');
    expect(ids(finance({ unallocatedCostEur: 0 }))).not.toContain('econ-unallocated-cost');
  });

  it('7 — break-even above sale price only on complete fields, never on incomplete data', () => {
    // sale price = 1500/60 = 25; break-even 30 > 25 → warning
    expect(ids(finance({ fields: [field({ breakEvenPrice: 30 })] }))).toContain('econ-breakeven-above-sale');
    // same numbers but incomplete → NOT ranked/warned
    expect(ids(finance({ fields: [field({ breakEvenPrice: 30, completenessStatus: 'partial_profitability' })] }))).not.toContain('econ-breakeven-above-sale');
  });

  it('8 — incomplete fields are excluded from the strongest-margin ranking', () => {
    // Only an incomplete field present → no strongest-margin signal.
    expect(ids(finance({ fields: [field({ completenessStatus: 'partial_profitability', grossMarginPerHaEur: 999 })] }))).not.toContain('econ-strongest-margin');
  });

  it('9 — strongest COMPLETE margin picks the best profitability-ready field', () => {
    const s = buildEconomicSignals(finance({ fields: [
      field({ field: 'Low', fieldId: 'fLow', grossMarginPerHaEur: 20 }),
      field({ field: 'High', fieldId: 'fHigh', grossMarginPerHaEur: 80 }),
    ] })).find((x) => x.id === 'econ-strongest-margin')!;
    expect(s.metadata.affectedFieldNames[0]).toBe('High');
    expect(s.role).toBe('positive');
  });

  it('14 — a missing metric is never treated as zero (no fabricated signal)', () => {
    // A field with null cost/revenue produces no over-budget / break-even signal.
    const s = ids(finance({ fields: [field({ recordedCostEur: null, recordedRevenueEur: null, grossMarginEur: null, grossMarginPerHaEur: null, yieldQuantity: null, breakEvenPrice: null, completenessStatus: 'insufficient_data', costVariance: variance(null) })] }));
    expect(s).not.toContain('econ-field-over-budget');
    expect(s).not.toContain('econ-breakeven-above-sale');
    expect(s).not.toContain('econ-strongest-margin');
  });
});

describe('getFarmEconomicSignals (Parts 3-5)', () => {
  it('10 — caps the above-the-fold list at 3, ordered by priority', () => {
    const res = getFarmEconomicSignals(finance({
      missingPriceProducts: ['X'], unallocatedCostEur: 500, unallocatedRevenueEur: 300,
      fields: [
        field({ field: 'A', fieldId: 'fA', completenessResult: completeness({labourApplicable:true,labourRatesKnown:false}), costVariance: variance(900, 40), completenessStatus: 'partial_profitability', grossMarginEur: 100, completenessPercent: 60 }),
      ],
    }));
    expect(res.topSignals.length).toBeLessThanOrEqual(3);
    expect(res.signals.length).toBeGreaterThan(3);
    // 11 — descending priority score
    const scores = res.topSignals.map((s) => s.priorityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('builds the season strip and flags incomplete profitability honestly', () => {
    const res = getFarmEconomicSignals(finance({ completenessStatus: 'cost_tracking_active', grossMarginEur: null }));
    expect(res.seasonStrip.profitabilityReady).toBe(false);
    expect(res.seasonStrip.grossMarginEur).toBeNull(); // never fabricated 0
  });

  it('13 — shared source: every Dashboard signal maps 1:1 from buildEconomicSignals', () => {
    const f = finance({ unallocatedCostEur: 250 });
    expect(getFarmEconomicSignals(f).signals.map((s) => s.id).sort()).toEqual(buildEconomicSignals(f).map((s) => s.id).sort());
  });
});
