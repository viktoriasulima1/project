export type CompletenessStatus = 'insufficient_data' | 'cost_tracking_active' | 'partial_profitability' | 'profitability_ready';
export type FinancialCompletenessReasonCode =
  | 'MISSING_PRODUCT_PRICE' | 'MISSING_LABOUR_RATE' | 'MISSING_MACHINE_RATE'
  | 'MISSING_CONTRACTOR_COST' | 'MISSING_HARVEST' | 'MISSING_REVENUE'
  | 'MISSING_OVERHEAD_CHOICE' | 'INCOMPATIBLE_UNITS';
export type FinancialRecordedDataCode =
  | 'PRODUCT_PRICES_RECORDED' | 'LABOUR_RATES_RECORDED' | 'MACHINE_RATES_RECORDED'
  | 'CONTRACTOR_COSTS_RECORDED' | 'HARVEST_RECORDED' | 'REVENUE_RECORDED'
  | 'OVERHEAD_CHOICE_RECORDED' | 'UNITS_COMPATIBLE';
export type FinancialCompletenessActionCode =
  | 'ADD_PURCHASE_PRICE' | 'ADD_LABOUR_RATE' | 'ADD_MACHINE_RATE'
  | 'ADD_CONTRACTOR_COST' | 'ADD_HARVEST' | 'ADD_REVENUE'
  | 'RECORD_OVERHEAD_CHOICE' | 'ALIGN_UNITS';
export interface FinancialCompletenessReason { code: FinancialCompletenessReasonCode; metadata: Record<string, never> }
export interface FinancialCompletenessResult {
  status: CompletenessStatus;
  percentage: number;
  reasons: FinancialCompletenessReason[];
  actionCodes: FinancialCompletenessActionCode[];
  recordedCodes: FinancialRecordedDataCode[];
  metadata: { applicableCheckCount: number; passedCheckCount: number };
}

export function weightedAverageCost(input: { currentQuantity: number; currentUnitCost: number | null; purchaseQuantity: number; purchaseTotal: number }): number | null {
  if (input.currentQuantity < 0 || input.purchaseQuantity <= 0 || input.purchaseTotal < 0) return null;
  const purchaseUnitCost = input.purchaseTotal / input.purchaseQuantity;
  if (input.currentQuantity === 0) return purchaseUnitCost;
  if (input.currentUnitCost == null) return null;
  const totalQuantity = input.currentQuantity + input.purchaseQuantity;
  return totalQuantity === 0 ? null : ((input.currentQuantity * input.currentUnitCost) + input.purchaseTotal) / totalQuantity;
}

export function allocateAmount(amount: number, weights: number[]): number[] | null {
  if (amount < 0 || weights.some((weight) => weight < 0)) return null;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return null;
  const allocated = weights.map((weight) => amount * weight / total);
  const rounded = allocated.map((value) => Math.round(value * 100) / 100);
  rounded[rounded.length - 1] += Math.round((amount - rounded.reduce((sum, value) => sum + value, 0)) * 100) / 100;
  return rounded;
}

export function yieldPerHectare(quantity: number | null, hectares: number | null): number | null {
  return quantity == null || hectares == null || quantity < 0 || hectares <= 0 ? null : quantity / hectares;
}

export type EconomicsCompletenessInput = {
  productPricesKnown: boolean;
  labourApplicable: boolean;
  labourRatesKnown: boolean;
  machineryApplicable: boolean;
  machineryRatesKnown: boolean;
  contractorApplicable: boolean;
  contractorRecorded: boolean;
  harvestRecorded: boolean;
  revenueRecorded: boolean;
  overheadChoiceRecorded: boolean;
  unitsCompatible: boolean;
};

export function resolveEconomicsCompleteness(input: EconomicsCompletenessInput): FinancialCompletenessResult {
  const checks = [
    ['PRODUCT_PRICES_RECORDED', 'MISSING_PRODUCT_PRICE', 'ADD_PURCHASE_PRICE', input.productPricesKnown],
    ['LABOUR_RATES_RECORDED', 'MISSING_LABOUR_RATE', 'ADD_LABOUR_RATE', !input.labourApplicable || input.labourRatesKnown],
    ['MACHINE_RATES_RECORDED', 'MISSING_MACHINE_RATE', 'ADD_MACHINE_RATE', !input.machineryApplicable || input.machineryRatesKnown],
    ['CONTRACTOR_COSTS_RECORDED', 'MISSING_CONTRACTOR_COST', 'ADD_CONTRACTOR_COST', !input.contractorApplicable || input.contractorRecorded],
    ['HARVEST_RECORDED', 'MISSING_HARVEST', 'ADD_HARVEST', input.harvestRecorded],
    ['REVENUE_RECORDED', 'MISSING_REVENUE', 'ADD_REVENUE', input.revenueRecorded],
    ['OVERHEAD_CHOICE_RECORDED', 'MISSING_OVERHEAD_CHOICE', 'RECORD_OVERHEAD_CHOICE', input.overheadChoiceRecorded],
    ['UNITS_COMPATIBLE', 'INCOMPATIBLE_UNITS', 'ALIGN_UNITS', input.unitsCompatible],
  ] as const;
  const recordedCodes = checks.filter(([, , , passed]) => passed).map(([recorded]) => recorded);
  const failed = checks.filter(([, , , passed]) => !passed);
  const reasons = failed.map(([, code]) => ({ code, metadata: {} }));
  const actionCodes = failed.map(([, , action]) => action);
  const percentage = Math.round(recordedCodes.length / checks.length * 100);
  const costReady = input.productPricesKnown && (!input.labourApplicable || input.labourRatesKnown) && (!input.machineryApplicable || input.machineryRatesKnown) && (!input.contractorApplicable || input.contractorRecorded);
  const status: CompletenessStatus = !costReady ? 'insufficient_data' : !input.harvestRecorded ? 'cost_tracking_active' : !input.revenueRecorded || !input.unitsCompatible ? 'partial_profitability' : 'profitability_ready';
  return { status, percentage, reasons, actionCodes, recordedCodes, metadata: { applicableCheckCount: checks.length, passedCheckCount: recordedCodes.length } };
}

export type FieldEconomicsInput = {
  hectares: number;
  directCosts: Array<number | null>;
  allocatedCosts: Array<number | null>;
  recordedRevenue: Array<number>;
  saleableYield: number | null;
  yieldUnit: string | null;
  recordedPricePerUnit?: number | null;
  expectedPricePerUnit?: number | null;
  completeness: ReturnType<typeof resolveEconomicsCompleteness>;
  calculatedAt?: string;
};

export type GrossMarginStatus = 'positive' | 'zero' | 'negative' | 'unavailable' | 'partial';
export type GrossMarginReasonCode = 'POSITIVE_MARGIN' | 'ZERO_MARGIN' | 'NEGATIVE_MARGIN' | 'MISSING_REVENUE' | 'MISSING_COST' | 'INCOMPLETE_COST';
export type GrossMarginActionCode = 'ADD_REVENUE' | 'ADD_EXPENSE' | 'REVIEW_UNPRICED_COSTS' | 'NO_ACTION_REQUIRED';
export interface GrossMarginMetadata {
  revenueCents: number | null;
  totalCostCents: number | null;
  grossMarginCents: number | null;
  fieldAreaHa: number;
  marginPerHaCents: number | null;
  currency: string;
  unpricedRecordCount: number;
  completenessStatus: CompletenessStatus;
  completenessPercentage: number;
  completenessReasonCodes: FinancialCompletenessReasonCode[];
}
export type GrossMarginResult =
  | { available: true; status: 'positive' | 'zero' | 'negative'; reasonCode: 'POSITIVE_MARGIN' | 'ZERO_MARGIN' | 'NEGATIVE_MARGIN'; actionCode: 'NO_ACTION_REQUIRED'; metadata: GrossMarginMetadata }
  | { available: false; status: 'unavailable' | 'partial'; reasonCode: 'MISSING_REVENUE' | 'MISSING_COST' | 'INCOMPLETE_COST'; actionCode: 'ADD_REVENUE' | 'ADD_EXPENSE' | 'REVIEW_UNPRICED_COSTS'; metadata: GrossMarginMetadata };

/** Canonical presentation contract over the existing margin inputs. The caller
 * remains authoritative for inclusion/exclusion; this function only preserves
 * missing-vs-zero, sign classification and cent serialization. */
export function resolveGrossMargin(input: {
  recordedRevenue: number | null;
  totalRecordedCost: number | null;
  fieldAreaHa: number;
  completeness: FinancialCompletenessResult;
  unpricedRecordCount?: number;
  currency?: string;
}): GrossMarginResult {
  const revenueCents = input.recordedRevenue == null ? null : Math.round(input.recordedRevenue * 100);
  const totalCostCents = input.totalRecordedCost == null ? null : Math.round(input.totalRecordedCost * 100);
  const grossMarginCents = revenueCents == null || totalCostCents == null ? null : revenueCents - totalCostCents;
  const metadata: GrossMarginMetadata = {
    revenueCents, totalCostCents, grossMarginCents, fieldAreaHa: input.fieldAreaHa,
    marginPerHaCents: grossMarginCents == null || input.fieldAreaHa <= 0 ? null : Math.round(grossMarginCents / input.fieldAreaHa),
    currency: input.currency ?? 'EUR', unpricedRecordCount: input.unpricedRecordCount ?? 0,
    completenessStatus: input.completeness.status, completenessPercentage: input.completeness.percentage,
    completenessReasonCodes: input.completeness.reasons.map((reason) => reason.code),
  };
  if (revenueCents == null) return { available: false, status: 'unavailable', reasonCode: 'MISSING_REVENUE', actionCode: 'ADD_REVENUE', metadata };
  if (totalCostCents == null && metadata.unpricedRecordCount > 0) return { available: false, status: 'partial', reasonCode: 'INCOMPLETE_COST', actionCode: 'REVIEW_UNPRICED_COSTS', metadata };
  if (totalCostCents == null) return { available: false, status: 'unavailable', reasonCode: 'MISSING_COST', actionCode: 'ADD_EXPENSE', metadata };
  if (grossMarginCents! > 0) return { available: true, status: 'positive', reasonCode: 'POSITIVE_MARGIN', actionCode: 'NO_ACTION_REQUIRED', metadata };
  if (grossMarginCents! < 0) return { available: true, status: 'negative', reasonCode: 'NEGATIVE_MARGIN', actionCode: 'NO_ACTION_REQUIRED', metadata };
  return { available: true, status: 'zero', reasonCode: 'ZERO_MARGIN', actionCode: 'NO_ACTION_REQUIRED', metadata };
}

export function resolveFieldEconomics(input: FieldEconomicsInput) {
  const missingCostSources: string[] = [];
  if (input.directCosts.some((value) => value == null)) missingCostSources.push('unpriced_direct_cost');
  if (input.allocatedCosts.some((value) => value == null)) missingCostSources.push('unpriced_allocated_cost');
  const knownDirect = input.directCosts.filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0);
  const knownAllocated = input.allocatedCosts.filter((value): value is number => value != null).reduce((sum, value) => sum + value, 0);
  const costsComplete = missingCostSources.length === 0;
  const totalRecordedCosts = costsComplete ? knownDirect + knownAllocated : null;
  const hasRevenue = input.recordedRevenue.length > 0;
  const recordedRevenue = hasRevenue ? input.recordedRevenue.reduce((sum, value) => sum + value, 0) : null;
  const missingRevenueSources = hasRevenue ? [] : ['recorded_revenue'];
  const grossMargin = totalRecordedCosts != null && recordedRevenue != null ? recordedRevenue - totalRecordedCosts : null;
  const grossMarginResult = resolveGrossMargin({ recordedRevenue, totalRecordedCost: totalRecordedCosts, fieldAreaHa: input.hectares, completeness: input.completeness, unpricedRecordCount: missingCostSources.length });
  const safePerHa = (value: number | null) => value == null || input.hectares <= 0 ? null : value / input.hectares;
  const yieldPerHa = yieldPerHectare(input.saleableYield, input.hectares);
  const costPerYieldUnit = totalRecordedCosts != null && input.saleableYield != null && input.saleableYield > 0 ? totalRecordedCosts / input.saleableYield : null;
  const price = input.recordedPricePerUnit ?? input.expectedPricePerUnit ?? null;
  const breakEvenAllowed = input.completeness.status === 'profitability_ready' && totalRecordedCosts != null;
  return {
    directCosts: costsComplete ? knownDirect : null,
    allocatedCosts: costsComplete ? knownAllocated : null,
    totalRecordedCosts,
    recordedRevenue,
    grossMargin,
    grossMarginResult,
    costPerHa: safePerHa(totalRecordedCosts),
    revenuePerHa: safePerHa(recordedRevenue),
    grossMarginPerHa: safePerHa(grossMargin),
    yieldPerHa,
    yieldUnit: input.yieldUnit,
    costPerYieldUnit,
    breakEvenPrice: breakEvenAllowed && input.saleableYield != null && input.saleableYield > 0 ? totalRecordedCosts / input.saleableYield : null,
    breakEvenYield: breakEvenAllowed && price != null && price > 0 ? totalRecordedCosts / price : null,
    completeness: input.completeness.percentage,
    completenessStatus: input.completeness.status,
    missingCostSources,
    missingRevenueSources,
    confidence: input.completeness.status === 'profitability_ready' ? 'recorded' : input.completeness.status === 'partial_profitability' ? 'partial' : 'insufficient',
    calculatedAt: input.calculatedAt ?? new Date().toISOString(),
  };
}

export type BudgetVarianceStatus = 'within_budget' | 'over_budget' | 'under_budget' | 'unavailable';
export type BudgetVarianceReasonCode =
  | 'WITHIN_BUDGET' | 'OVER_BUDGET' | 'UNDER_BUDGET'
  | 'BUDGET_NOT_RECORDED' | 'ACTUAL_COST_NOT_RECORDED'
  | 'BUDGET_AND_ACTUAL_NOT_RECORDED' | 'ACTUAL_COST_INCOMPLETE'
  | 'CURRENCY_MISMATCH';
export type BudgetVarianceActionCode =
  | 'ADD_BUDGET' | 'RECORD_ACTUAL_COST' | 'REVIEW_COSTS' | 'REVIEW_UNPRICED_COSTS'
  | 'OPEN_FINANCE' | 'NO_ACTION_REQUIRED';

export interface BudgetVarianceMetadata {
  budgetCents: number | null;
  actualCents: number | null;
  varianceCents: number | null;
  variancePercent: number | null;
  currency: string;
  budgetRecorded: boolean;
  actualRecorded: boolean;
  actualCostComplete: boolean;
  unpricedRecordCount: number;
}

export type BudgetVarianceResult =
  | { available: true; status: Exclude<BudgetVarianceStatus, 'unavailable'>; reasonCode: 'WITHIN_BUDGET' | 'OVER_BUDGET' | 'UNDER_BUDGET'; actionCode: 'REVIEW_COSTS' | 'NO_ACTION_REQUIRED'; metadata: BudgetVarianceMetadata }
  | { available: false; status: 'unavailable'; reasonCode: Exclude<BudgetVarianceReasonCode, 'WITHIN_BUDGET' | 'OVER_BUDGET' | 'UNDER_BUDGET'>; actionCode: Exclude<BudgetVarianceActionCode, 'REVIEW_COSTS' | 'NO_ACTION_REQUIRED'>; metadata: BudgetVarianceMetadata };

export interface BudgetVarianceInput {
  budget: number | null;
  actual: number | null;
  currency?: string;
  actualCurrency?: string | null;
  actualCostComplete?: boolean;
  unpricedRecordCount?: number;
}

/** Canonical budget variance. Formula and sign policy are deliberately frozen:
 * variance = actual - budget; positive is over budget, negative is under.
 * Inputs are operational currency units; serialized metadata uses integer cents. */
export function resolveBudgetVariance(input: BudgetVarianceInput): BudgetVarianceResult {
  const currency = input.currency ?? 'EUR';
  const actualCostComplete = input.actualCostComplete ?? true;
  const budgetRecorded = input.budget != null;
  const actualRecorded = input.actual != null;
  const budgetCents = budgetRecorded ? Math.round(input.budget! * 100) : null;
  const actualCents = actualRecorded ? Math.round(input.actual! * 100) : null;
  const base = {
    budgetCents, actualCents, varianceCents: null, variancePercent: null, currency,
    budgetRecorded, actualRecorded, actualCostComplete,
    unpricedRecordCount: input.unpricedRecordCount ?? 0,
  } satisfies BudgetVarianceMetadata;
  if (input.actualCurrency != null && input.actualCurrency !== currency) {
    return { available: false, status: 'unavailable', reasonCode: 'CURRENCY_MISMATCH', actionCode: 'OPEN_FINANCE', metadata: base };
  }
  if (!actualCostComplete) {
    return { available: false, status: 'unavailable', reasonCode: 'ACTUAL_COST_INCOMPLETE', actionCode: 'REVIEW_UNPRICED_COSTS', metadata: base };
  }
  if (!budgetRecorded && !actualRecorded) {
    return { available: false, status: 'unavailable', reasonCode: 'BUDGET_AND_ACTUAL_NOT_RECORDED', actionCode: 'ADD_BUDGET', metadata: base };
  }
  if (!budgetRecorded) {
    return { available: false, status: 'unavailable', reasonCode: 'BUDGET_NOT_RECORDED', actionCode: 'ADD_BUDGET', metadata: base };
  }
  if (!actualRecorded) {
    return { available: false, status: 'unavailable', reasonCode: 'ACTUAL_COST_NOT_RECORDED', actionCode: 'RECORD_ACTUAL_COST', metadata: base };
  }
  const varianceCents = actualCents! - budgetCents!;
  const variancePercent = budgetCents === 0 ? null : varianceCents / budgetCents! * 100;
  const metadata = { ...base, varianceCents, variancePercent };
  if (varianceCents > 0) return { available: true, status: 'over_budget', reasonCode: 'OVER_BUDGET', actionCode: 'REVIEW_COSTS', metadata };
  if (varianceCents < 0) return { available: true, status: 'under_budget', reasonCode: 'UNDER_BUDGET', actionCode: 'NO_ACTION_REQUIRED', metadata };
  return { available: true, status: 'within_budget', reasonCode: 'WITHIN_BUDGET', actionCode: 'NO_ACTION_REQUIRED', metadata };
}

export type FinancialDriverCode = 'PRODUCT_QUANTITY_ABOVE_PLAN' | 'PURCHASE_PRICE_ABOVE_PLAN' | 'YIELD_BELOW_PLAN' | 'SALE_PRICE_BELOW_PLAN';
export function financialDrivers(input: { plannedQuantity?: number | null; actualQuantity?: number | null; plannedUnitCost?: number | null; actualUnitCost?: number | null; plannedYield?: number | null; actualYield?: number | null; plannedPrice?: number | null; actualPrice?: number | null }) {
  const drivers: FinancialDriverCode[] = [];
  if (input.plannedQuantity != null && input.actualQuantity != null && input.actualQuantity > input.plannedQuantity) drivers.push('PRODUCT_QUANTITY_ABOVE_PLAN');
  if (input.plannedUnitCost != null && input.actualUnitCost != null && input.actualUnitCost > input.plannedUnitCost) drivers.push('PURCHASE_PRICE_ABOVE_PLAN');
  if (input.plannedYield != null && input.actualYield != null && input.actualYield < input.plannedYield) drivers.push('YIELD_BELOW_PLAN');
  if (input.plannedPrice != null && input.actualPrice != null && input.actualPrice < input.plannedPrice) drivers.push('SALE_PRICE_BELOW_PLAN');
  return drivers;
}
