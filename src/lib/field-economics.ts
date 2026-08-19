// Sprint 25 — pure field-economics presentation logic. Deliberately NOT in a
// 'use server' file: these are ordinary synchronous functions shared by the
// server resolvers (field-economics-detail.ts) and unit-tested directly. They
// compute NOTHING about allocation math (that stays in reallocation-preview.ts)
// and INVENT NOTHING — missing inputs stay null and surface an explicit reason,
// never €0.

import type { EconomicSourceType, InventoryCategory } from '@prisma/client';

// ─── Part 3 — cost categories ────────────────────────────────────────────────

export type CostCategory =
  | 'crop_protection' | 'fertiliser' | 'seed' | 'labour' | 'machinery' | 'fuel'
  | 'contractor' | 'irrigation_utilities' | 'field_expenses' | 'allocated_overhead' | 'other';

// Fixed display order so the breakdown is stable regardless of record order.
export const FINANCIAL_COST_CATEGORY_ORDER: readonly CostCategory[] = [
  'crop_protection', 'fertiliser', 'seed', 'labour', 'machinery', 'fuel',
  'contractor', 'irrigation_utilities', 'field_expenses', 'allocated_overhead', 'other',
];

/** Maps a cost EconomicEntry to a Part-3 category. `inventoryCategory` is the
 * product category for inventory_input costs (reachable via activity.product);
 * `isAllocated` is true when allocationMethod !== 'direct_field'. */
export function categoryForSource(
  sourceType: EconomicSourceType,
  opts: { inventoryCategory?: InventoryCategory | null; isAllocated?: boolean } = {},
): CostCategory {
  switch (sourceType) {
    case 'inventory_input':
      switch (opts.inventoryCategory) {
        case 'herbicide': case 'fungicide': case 'insecticide': return 'crop_protection';
        case 'fertiliser': return 'fertiliser';
        case 'seed': return 'seed';
        case 'fuel': return 'fuel';
        default: return 'other';
      }
    case 'labour': return 'labour';
    case 'machinery': return 'machinery';
    case 'fuel': return 'fuel';
    case 'contractor': return 'contractor';
    case 'utilities': return 'irrigation_utilities';
    case 'field_rent': case 'soil_lab': return 'field_expenses';
    case 'miscellaneous': case 'manual_expense':
      return opts.isAllocated ? 'allocated_overhead' : 'field_expenses';
    default: return 'other';
  }
}

export interface CategoryInputRecord {
  category: CostCategory;
  /** null when this record's cost is not priced yet (never treated as 0). */
  amount: number | null;
  isAllocated: boolean;
}

export interface CategoryBreakdownRow {
  category: CostCategory;
  /** null if any record in the category is unpriced — the category is partial. */
  recordedAmount: number | null;
  directAmount: number;
  allocatedAmount: number;
  recordCount: number;
  hasDirect: boolean;
  hasAllocated: boolean;
  complete: boolean;
  /** Share of *recorded* (known) cost — never of an incomplete "true total". */
  shareOfRecordedCost: number | null;
}

export interface CostBreakdown {
  rows: CategoryBreakdownRow[];
  /** Sum of every category's known recorded amount. Not a claim of completeness. */
  totalRecordedCost: number;
  anyPartial: boolean;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Groups classified cost records into the fixed category set. A category with
 * any unpriced record has a null recordedAmount and complete=false; its known
 * direct/allocated sums are still shown, but it is excluded from the share
 * denominator so percentages never imply a false whole. */
export function buildCostBreakdown(records: CategoryInputRecord[]): CostBreakdown {
  const byCat = new Map<CostCategory, CategoryInputRecord[]>();
  for (const r of records) byCat.set(r.category, [...(byCat.get(r.category) ?? []), r]);

  const rows: CategoryBreakdownRow[] = [];
  for (const category of FINANCIAL_COST_CATEGORY_ORDER) {
    const items = byCat.get(category);
    if (!items || items.length === 0) continue;
    const complete = items.every((i) => i.amount != null);
    const direct = round2(items.filter((i) => !i.isAllocated).reduce((s, i) => s + (i.amount ?? 0), 0));
    const allocated = round2(items.filter((i) => i.isAllocated).reduce((s, i) => s + (i.amount ?? 0), 0));
    rows.push({
      category,
      recordedAmount: complete ? round2(direct + allocated) : null,
      directAmount: direct, allocatedAmount: allocated, recordCount: items.length,
      hasDirect: items.some((i) => !i.isAllocated), hasAllocated: items.some((i) => i.isAllocated),
      complete, shareOfRecordedCost: null,
    });
  }
  const totalRecordedCost = round2(rows.reduce((s, r) => s + (r.recordedAmount ?? 0), 0));
  for (const row of rows) {
    row.shareOfRecordedCost = row.recordedAmount != null && totalRecordedCost > 0
      ? round2((row.recordedAmount / totalRecordedCost) * 100) : null;
  }
  return { rows, totalRecordedCost, anyPartial: rows.some((r) => !r.complete) };
}

// ─── Part 5 — direct vs allocated split ──────────────────────────────────────

export interface DirectAllocatedInput {
  /** allocationMethod for the cost entry (direct_field, per_hectare, …). */
  allocationMethod: string;
  fieldSeasonId: string | null;
  crop: string | null;
  amount: number;
  reversed: boolean;
}

export interface DirectAllocatedSplit {
  recordedDirect: number;
  allocatedToField: number;
  cropLevel: number;
  farmUnallocated: number;
  excludedReversed: number;
  /** recordedDirect + allocatedToField — what actually enters field cost. */
  totalFieldCost: number;
}

/** Separates recorded-direct, allocated-to-field, crop-level, farm-unallocated,
 * and excluded/reversed amounts (Part 5). Farm-unallocated is NEVER folded into
 * the field total — it is reported separately so field margin stays honest. */
export function directVsAllocated(records: DirectAllocatedInput[]): DirectAllocatedSplit {
  let recordedDirect = 0, allocatedToField = 0, cropLevel = 0, farmUnallocated = 0, excludedReversed = 0;
  for (const r of records) {
    if (r.reversed) { excludedReversed += r.amount; continue; }
    if (r.allocationMethod === 'unallocated' || (!r.fieldSeasonId && !r.crop)) { farmUnallocated += r.amount; continue; }
    if (r.allocationMethod === 'per_crop_area' && !r.fieldSeasonId) { cropLevel += r.amount; continue; }
    if (r.allocationMethod === 'direct_field') recordedDirect += r.amount;
    else if (r.fieldSeasonId) allocatedToField += r.amount;
    else cropLevel += r.amount;
  }
  return {
    recordedDirect: round2(recordedDirect), allocatedToField: round2(allocatedToField),
    cropLevel: round2(cropLevel), farmUnallocated: round2(farmUnallocated),
    excludedReversed: round2(excludedReversed), totalFieldCost: round2(recordedDirect + allocatedToField),
  };
}

// ─── Part 8 — break-even explanation ─────────────────────────────────────────

export interface BreakEvenInput {
  totalRecordedCost: number | null;
  costsComplete: boolean;
  saleableYield: number | null;
  yieldUnit: string | null;
  recordedPricePerUnit: number | null;
  unitsCompatible: boolean;
  hasUnallocatedRemainder: boolean;
}

// Stage 3: the break-even resolver is CODE-ONLY. Blocking reasons and the formula
// are stable, language-independent codes; monetary values stay EUR floats with the
// same round2 rounding (unchanged). All wording comes from the presentation
// adapter (src/i18n/adapters/break-even.ts). Decisions/formulas/eligibility are
// byte-for-byte unchanged.
export type BreakEvenReasonCode =
  | 'INCOMPLETE_COST'
  | 'MISSING_HARVEST'
  | 'MISSING_SALE_PRICE'
  | 'INCOMPATIBLE_UNITS'
  | 'UNALLOCATED_COSTS';

export type BreakEvenFormulaCode = 'COST_PER_YIELD' | 'COST_PER_PRICE';

/** Structured value; `yieldUnit` is the canonical unit token (e.g. "tonnes"),
 * formatted by the adapter (€/unit for price, plain unit for yield). */
export interface BreakEvenValue {
  result: number;
  totalCost: number;
  divisor: number;
  yieldUnit: string;
  formulaCode: BreakEvenFormulaCode;
}

/** One break-even computation (price or yield). `available` discriminates. */
export interface BreakEvenComputation {
  available: boolean;
  value: BreakEvenValue | null;
  reasonCodes: BreakEvenReasonCode[];
}

export interface BreakEvenExplanation {
  price: BreakEvenComputation;
  yieldValue: BreakEvenComputation;
}

/** Break-even price (cost ÷ saleable yield) and break-even yield (cost ÷ price),
 * each shown only when its inputs are all present, complete, and reconciled.
 * Otherwise the exact blocking reason CODES are returned — never a low-confidence
 * number dressed up as a strong one, and never a fabricated €0. */
export function breakEvenExplanation(input: BreakEvenInput): BreakEvenExplanation {
  const costOk = input.costsComplete && input.totalRecordedCost != null;
  const yieldUnit = input.yieldUnit ?? 'unit';

  const priceReasons: BreakEvenReasonCode[] = [];
  if (!costOk) priceReasons.push('INCOMPLETE_COST');
  if (input.saleableYield == null || input.saleableYield <= 0) priceReasons.push('MISSING_HARVEST');
  if (!input.unitsCompatible) priceReasons.push('INCOMPATIBLE_UNITS');
  if (input.hasUnallocatedRemainder) priceReasons.push('UNALLOCATED_COSTS');
  const price: BreakEvenComputation = priceReasons.length === 0
    ? { available: true, value: { result: round2(input.totalRecordedCost! / input.saleableYield!), totalCost: input.totalRecordedCost!, divisor: input.saleableYield!, yieldUnit, formulaCode: 'COST_PER_YIELD' }, reasonCodes: [] }
    : { available: false, value: null, reasonCodes: priceReasons };

  const yieldReasons: BreakEvenReasonCode[] = [];
  if (!costOk) yieldReasons.push('INCOMPLETE_COST');
  if (input.recordedPricePerUnit == null || input.recordedPricePerUnit <= 0) yieldReasons.push('MISSING_SALE_PRICE');
  if (!input.unitsCompatible) yieldReasons.push('INCOMPATIBLE_UNITS');
  if (input.hasUnallocatedRemainder) yieldReasons.push('UNALLOCATED_COSTS');
  const yieldValue: BreakEvenComputation = yieldReasons.length === 0
    ? { available: true, value: { result: round2(input.totalRecordedCost! / input.recordedPricePerUnit!), totalCost: input.totalRecordedCost!, divisor: input.recordedPricePerUnit!, yieldUnit, formulaCode: 'COST_PER_PRICE' }, reasonCodes: [] }
    : { available: false, value: null, reasonCodes: yieldReasons };

  return { price, yieldValue };
}

// ─── Part 11 — before/after comparison ───────────────────────────────────────

export interface AllocationSlice { field: string; percentage: number; amount: number }

export interface VersionComparison {
  amount: { old: number; new: number; delta: number } | null;
  allocationOld: AllocationSlice[];
  allocationNew: AllocationSlice[];
  fieldImpact: Array<{ field: string; delta: number }>;
  /** Present only when both cost and revenue are recorded. */
  marginImpact: number | null;
  marginReasonCode: 'MISSING_REVENUE' | null;
}

/** Structured before/after for a correction or reallocation (Part 11). Field
 * impact is the per-field allocated-amount delta between the two versions.
 * Margin impact is stated only when revenue is known. */
export function compareVersions(input: {
  oldAmount?: number | null; newAmount?: number | null;
  oldAllocation?: AllocationSlice[]; newAllocation?: AllocationSlice[];
  revenueRecorded: boolean;
}): VersionComparison {
  const amount = input.oldAmount != null && input.newAmount != null
    ? { old: input.oldAmount, new: input.newAmount, delta: round2(input.newAmount - input.oldAmount) } : null;

  const oldMap = new Map((input.oldAllocation ?? []).map((a) => [a.field, a.amount]));
  const newMap = new Map((input.newAllocation ?? []).map((a) => [a.field, a.amount]));
  const fields = [...new Set([...oldMap.keys(), ...newMap.keys()])];
  const fieldImpact = fields
    .map((field) => ({ field, delta: round2((newMap.get(field) ?? 0) - (oldMap.get(field) ?? 0)) }))
    .filter((f) => f.delta !== 0);

  const marginImpact = input.revenueRecorded && amount ? round2(-(amount.delta)) : null;
  const marginReasonCode = input.revenueRecorded ? null : 'MISSING_REVENUE';

  return { amount, allocationOld: input.oldAllocation ?? [], allocationNew: input.newAllocation ?? [], fieldImpact, marginImpact, marginReasonCode };
}

// ─── Part 6 — completeness actions ───────────────────────────────────────────


// ─── Parts 14 & 15 — contextual + offline action gating ──────────────────────

// Field Detail action availability moved to src/lib/field-actions.ts (Resolver
// Localization Stage 1): it now returns stable CODES + metadata instead of
// English reason prose, and the offline last-synced banner is localized at the
// UI boundary (fields.actions.lastSyncedAt). See field-actions.ts + the
// src/i18n/adapters/field-action.ts presentation adapter.
