import { describe, it, expect } from 'vitest';
import {
  categoryForSource, buildCostBreakdown, directVsAllocated, breakEvenExplanation,
  compareVersions, FINANCIAL_COST_CATEGORY_ORDER,
} from '../field-economics';
import { SUPPORTED_LOCALES } from '../../i18n/locales';
import { getFinancialAttributionLabel, getFinancialCategoryLabel, getFinancialSourceTypeLabel, getFinancialVersionStateLabel } from '../../i18n/adapters/financial-categories';

describe('categoryForSource (Part 3)', () => {
  it('sub-categorises inventory inputs by product category', () => {
    expect(categoryForSource('inventory_input', { inventoryCategory: 'herbicide' })).toBe('crop_protection');
    expect(categoryForSource('inventory_input', { inventoryCategory: 'fungicide' })).toBe('crop_protection');
    expect(categoryForSource('inventory_input', { inventoryCategory: 'fertiliser' })).toBe('fertiliser');
    expect(categoryForSource('inventory_input', { inventoryCategory: 'seed' })).toBe('seed');
  });
  it('maps operational and expense sources', () => {
    expect(categoryForSource('labour')).toBe('labour');
    expect(categoryForSource('machinery')).toBe('machinery');
    expect(categoryForSource('fuel')).toBe('fuel');
    expect(categoryForSource('contractor')).toBe('contractor');
    expect(categoryForSource('utilities')).toBe('irrigation_utilities');
  });
  it('routes a generic expense to overhead only when allocated', () => {
    expect(categoryForSource('miscellaneous', { isAllocated: true })).toBe('allocated_overhead');
    expect(categoryForSource('miscellaneous', { isAllocated: false })).toBe('field_expenses');
  });
});

describe('buildCostBreakdown (Part 3)', () => {
  it('preserves canonical, locale-independent category order without display prose', () => {
    const records = [...FINANCIAL_COST_CATEGORY_ORDER].reverse().map((category) => ({ category, amount: 1, isAllocated: false }));
    const result = buildCostBreakdown(records);
    expect(result.rows.map((row) => row.category)).toEqual(FINANCIAL_COST_CATEGORY_ORDER);
    expect(result.totalRecordedCost).toBe(FINANCIAL_COST_CATEGORY_ORDER.length);
    expect(result.rows.every((row) => !('label' in row))).toBe(true);
  });
  it('sums direct vs allocated and shares against recorded cost only', () => {
    const b = buildCostBreakdown([
      { category: 'crop_protection', amount: 300, isAllocated: false },
      { category: 'fertiliser', amount: 100, isAllocated: true },
    ]);
    expect(b.totalRecordedCost).toBe(400);
    const cp = b.rows.find((r) => r.category === 'crop_protection')!;
    expect(cp.directAmount).toBe(300);
    expect(cp.shareOfRecordedCost).toBe(75);
    const fert = b.rows.find((r) => r.category === 'fertiliser')!;
    expect(fert.allocatedAmount).toBe(100);
    expect(fert.shareOfRecordedCost).toBe(25);
  });

  // Test 9 — a missing (unpriced) cost makes its category partial, not zero.
  it('marks a category with an unpriced record as partial and excludes it from the share denominator', () => {
    const b = buildCostBreakdown([
      { category: 'crop_protection', amount: null, isAllocated: false },
      { category: 'labour', amount: 200, isAllocated: false },
    ]);
    const cp = b.rows.find((r) => r.category === 'crop_protection')!;
    expect(cp.complete).toBe(false);
    expect(cp.recordedAmount).toBeNull();
    expect(cp.shareOfRecordedCost).toBeNull();
    expect(b.anyPartial).toBe(true);
    expect(b.totalRecordedCost).toBe(200); // labour only
  });
});

describe('financial category presentation adapter', () => {
  it('localizes every canonical category in all supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) for (const code of FINANCIAL_COST_CATEGORY_ORDER) {
      expect(getFinancialCategoryLabel(locale, code)).not.toBe(code);
    }
  });

  it('keeps source, attribution and version state as distinct contracts', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(getFinancialSourceTypeLabel(locale, 'inventory_input')).not.toBe('inventory_input');
      expect(getFinancialAttributionLabel(locale, 'allocated')).not.toBe('allocated');
      expect(getFinancialVersionStateLabel(locale, 'effective')).not.toBe('effective');
    }
  });

  it('uses a safe localized fallback and never exposes an unknown internal code', () => {
    expect(getFinancialCategoryLabel('nl-NL', 'future_internal_code')).toBe('Overig');
    expect(getFinancialSourceTypeLabel('de-DE', 'future_internal_code')).toBe('Unbekannte Quelle');
    expect(getFinancialAttributionLabel('pl-PL', 'future_internal_code')).toBe('Nieznane przypisanie');
  });
});

describe('directVsAllocated (Parts 1-5)', () => {
  it('separates direct, allocated, unallocated and reversed', () => {
    const s = directVsAllocated([
      { allocationMethod: 'direct_field', fieldSeasonId: 'fs1', crop: 'wheat', amount: 4200, reversed: false }, // 1 direct
      { allocationMethod: 'per_hectare', fieldSeasonId: 'fs1', crop: 'wheat', amount: 450, reversed: false },   // 2 allocated
      { allocationMethod: 'unallocated', fieldSeasonId: null, crop: null, amount: 900, reversed: false },        // 3 unallocated excluded
      { allocationMethod: 'direct_field', fieldSeasonId: 'fs1', crop: 'wheat', amount: 500, reversed: true },    // 4 reversed excluded
    ]);
    expect(s.recordedDirect).toBe(4200);
    expect(s.allocatedToField).toBe(450);
    expect(s.farmUnallocated).toBe(900);
    expect(s.excludedReversed).toBe(500);
    expect(s.totalFieldCost).toBe(4650); // unallocated + reversed NOT included
  });
});

// Stage 3 — break-even resolver is now code-only. These characterization tests
// lock every eligibility decision, value and reason CODE (formulas/rounding
// unchanged; no fabricated €0; no prose).
describe('breakEvenExplanation (Stage 3 — codes)', () => {
  const base = { totalRecordedCost: 4650, costsComplete: true, saleableYield: 60, yieldUnit: 'tonnes', recordedPricePerUnit: 200, unitsCompatible: true, hasUnallocatedRemainder: false };

  it('computes break-even price when data is complete', () => {
    const r = breakEvenExplanation(base);
    expect(r.price.available).toBe(true);
    expect(r.price.value!.result).toBe(77.5); // 4650 / 60 — value/rounding unchanged
    expect(r.price.value!.yieldUnit).toBe('tonnes');
    expect(r.price.value!.formulaCode).toBe('COST_PER_YIELD');
    expect(r.price.reasonCodes).toEqual([]);
  });
  it('computes break-even yield when price is present', () => {
    const r = breakEvenExplanation(base);
    expect(r.yieldValue.available).toBe(true);
    expect(r.yieldValue.value!.result).toBe(23.25); // 4650 / 200
    expect(r.yieldValue.value!.formulaCode).toBe('COST_PER_PRICE');
  });
  it('blocks price on missing yield → MISSING_HARVEST, never a fabricated 0', () => {
    const r = breakEvenExplanation({ ...base, saleableYield: null });
    expect(r.price.available).toBe(false);
    expect(r.price.value).toBeNull(); // not 0
    expect(r.price.reasonCodes).toContain('MISSING_HARVEST');
  });
  it('treats zero yield as missing (no divide-by-zero)', () => {
    const r = breakEvenExplanation({ ...base, saleableYield: 0 });
    expect(r.price.available).toBe(false);
    expect(r.price.value).toBeNull();
    expect(r.price.reasonCodes).toContain('MISSING_HARVEST');
  });
  it('blocks yield on missing sale price → MISSING_SALE_PRICE (distinct from harvest)', () => {
    const r = breakEvenExplanation({ ...base, recordedPricePerUnit: null });
    expect(r.yieldValue.available).toBe(false);
    expect(r.yieldValue.value).toBeNull();
    expect(r.yieldValue.reasonCodes).toContain('MISSING_SALE_PRICE');
    expect(r.yieldValue.reasonCodes).not.toContain('MISSING_HARVEST');
  });
  it('blocks both on unit mismatch → INCOMPATIBLE_UNITS', () => {
    const r = breakEvenExplanation({ ...base, unitsCompatible: false });
    expect(r.price.available).toBe(false);
    expect(r.yieldValue.available).toBe(false);
    expect(r.price.reasonCodes).toContain('INCOMPATIBLE_UNITS');
  });
  it('blocks both when costs are incomplete → INCOMPLETE_COST', () => {
    const r = breakEvenExplanation({ ...base, costsComplete: false });
    expect(r.price.available).toBe(false);
    expect(r.price.reasonCodes).toContain('INCOMPLETE_COST');
  });
  it('blocks when unallocated cost remains → UNALLOCATED_COSTS', () => {
    const r = breakEvenExplanation({ ...base, hasUnallocatedRemainder: true });
    expect(r.price.reasonCodes).toContain('UNALLOCATED_COSTS');
    expect(r.yieldValue.reasonCodes).toContain('UNALLOCATED_COSTS');
  });
  it('metadata is canonical numbers + unit token only (no prose keys)', () => {
    const v = breakEvenExplanation(base).price.value! as unknown as Record<string, unknown>;
    expect(v.formula).toBeUndefined();
    expect(v.unit).toBeUndefined();
    expect(typeof v.result).toBe('number');
    expect(typeof v.totalCost).toBe('number');
    expect(typeof v.divisor).toBe('number');
  });
});

describe('compareVersions (Part 11)', () => {
  it('shows amount delta, field impact and margin when revenue is recorded', () => {
    const c = compareVersions({
      oldAmount: 500, newAmount: 450, revenueRecorded: true,
      oldAllocation: [{ field: 'Noord', percentage: 100, amount: 500 }],
      newAllocation: [{ field: 'Noord', percentage: 60, amount: 270 }, { field: 'Zuid', percentage: 40, amount: 180 }],
    });
    expect(c.amount).toEqual({ old: 500, new: 450, delta: -50 });
    expect(c.fieldImpact).toEqual(expect.arrayContaining([
      { field: 'Noord', delta: -230 }, { field: 'Zuid', delta: 180 },
    ]));
    expect(c.marginImpact).toBe(50); // -(-50)
    expect(c.marginReasonCode).toBeNull();
  });
  it('states honestly when margin cannot be computed (no revenue)', () => {
    const c = compareVersions({ oldAmount: 8000, newAmount: 8600, revenueRecorded: false });
    expect(c.marginImpact).toBeNull();
    expect(c.marginReasonCode).toBe('MISSING_REVENUE');
  });
});

// fieldActionAvailability + the last-synced banner moved to
// src/lib/field-actions.ts (codes, not prose) — see field-actions.test.ts, which
// carries these characterization tests forward against the new code contract.
