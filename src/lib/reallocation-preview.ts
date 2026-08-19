// Sprint 25 — pure reallocation preview/resolution engine. Deliberately NOT a
// 'use server' file: it is called from both the read-only preview action and
// (for re-validation) the write action, and is unit-tested directly with plain
// objects. All money is handled in integer cents; never floating-point euros
// (Part 5/6). It computes nothing about another farm — callers pass only their
// own farm's data — so it cannot leak cross-farm economics (Part 14).

export type AllocationMethod = 'direct_field' | 'selected_fields' | 'per_hectare' | 'per_yield' | 'crop_level' | 'unallocated';

/** Economics for one candidate destination field-season (the farm's own). */
export interface DestinationField {
  fieldSeasonId: string;
  field: string;
  crop: string;
  hectares: number;
  saleableYield: number | null;
  currentCostEur: number | null;
  currentRevenueEur: number | null;
}

export interface ProposedDestination {
  fieldSeasonId: string;
  /** For selected_fields: an explicit percentage OR an explicit amount (not both). Ignored for the proportional methods. */
  percentage?: number;
  amount?: number;
}

export interface ReallocationInput {
  record: {
    kind: 'cost' | 'revenue';
    /** The effective record amount (already reversed-aware — callers pass the active amount). */
    amount: number;
    currency: string;
    reversed: boolean;
    /** True for costs already assigned through a completed activity (inventory_input / labour / machinery snapshots) — cannot be reallocated. */
    directlyLinked: boolean;
    sourceType: string;
  };
  method: AllocationMethod;
  /** Which fields the user chose (+ pct/amount for selected_fields). Empty for unallocated / crop_level. */
  proposed: ProposedDestination[];
  /** Economics for every proposed destination (and any others, ignored). Must be the farm's own fields only. */
  destinations: DestinationField[];
  /** Existing effective allocation being replaced, so impact is the DELTA. Empty when the record is currently unallocated. */
  currentAllocations: Array<{ fieldSeasonId: string; amount: number }>;
  /** True = the user intends to fully allocate (must total 100%). False = partial allocation; the remainder stays unallocated. */
  fullAllocation: boolean;
  /** Passed only to reject a cross-currency mix (Part 6). */
  farmCurrency: string;
}

export interface FieldImpact {
  fieldSeasonId: string;
  field: string;
  crop: string;
  allocatedAmount: number;
  beforeCostEur: number | null;
  afterCostEur: number | null;
  beforeRevenueEur: number | null;
  afterRevenueEur: number | null;
  marginBeforeEur: number | null;
  marginAfterEur: number | null;
  marginPerHaChangeEur: number | null;
  /** Canonical reason when a margin change cannot be computed honestly. */
  marginReasonCode: 'MISSING_REVENUE' | 'MISSING_COST' | null;
}

export interface ReallocationPreview {
  blocked: string[];
  warnings: string[];
  resolved: Array<{ fieldSeasonId: string; percentage: number; amount: number }>;
  totalAllocated: number;
  remainingUnallocated: number;
  /** Total cents redistributed by largest-remainder rounding, in euros (0 when it divides evenly). */
  roundingDifference: number;
  perField: FieldImpact[];
  perCrop: Array<{ crop: string; costChangeEur: number; revenueChangeEur: number }>;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Deterministic largest-remainder distribution of `totalCents` across weights.
 * Sum of results equals `totalCents` exactly; ties broken by ascending index.
 * Returns per-weight cents and how many remainder cents were redistributed. */
function distributeCents(totalCents: number, weights: number[]): { cents: number[]; redistributed: number } {
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum <= 0) return { cents: weights.map(() => 0), redistributed: 0 };
  const raw = weights.map(w => (totalCents * w) / weightSum);
  const floors = raw.map(Math.floor);
  const assigned = floors.reduce((sum, v) => sum + v, 0);
  const remainder = totalCents - assigned;
  const order = raw
    .map((value, index) => ({ index, frac: value - floors[index] }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (let i = 0; i < remainder; i++) floors[order[i].index] += 1;
  return { cents: floors, redistributed: remainder };
}

/** Resolve a method + proposal into per-destination percentages (0..100).
 * Returns blocked reasons instead of throwing, so the preview can surface them. */
function resolvePercentages(input: ReallocationInput): { percentages: Map<string, number>; blocked: string[] } {
  const blocked: string[] = [];
  const byId = new Map(input.destinations.map(d => [d.fieldSeasonId, d]));
  const proposedIds = input.proposed.map(p => p.fieldSeasonId);

  if (new Set(proposedIds).size !== proposedIds.length) blocked.push('A field was selected more than once.');
  for (const p of input.proposed) if (!byId.has(p.fieldSeasonId)) blocked.push('A selected field does not belong to this farm and season.');

  const percentages = new Map<string, number>();
  switch (input.method) {
    case 'unallocated':
    case 'crop_level':
      return { percentages, blocked }; // no per-field split
    case 'direct_field':
      if (input.proposed.length !== 1) blocked.push('Direct-field allocation needs exactly one field.');
      else percentages.set(input.proposed[0].fieldSeasonId, 100);
      break;
    case 'selected_fields':
      for (const p of input.proposed) {
        const pct = p.percentage != null ? p.percentage : p.amount != null && input.record.amount > 0 ? (p.amount / input.record.amount) * 100 : 0;
        if (pct < 0) blocked.push('An allocation cannot be negative.');
        if (pct === 0) blocked.push('An allocation destination cannot be zero.');
        percentages.set(p.fieldSeasonId, pct);
      }
      break;
    case 'per_hectare': {
      const rows = input.proposed.map(p => byId.get(p.fieldSeasonId)).filter((d): d is DestinationField => !!d);
      const sum = rows.reduce((s, d) => s + d.hectares, 0);
      if (sum <= 0) blocked.push('Per-hectare allocation needs fields with a positive area.');
      else for (const d of rows) percentages.set(d.fieldSeasonId, (d.hectares / sum) * 100);
      break;
    }
    case 'per_yield': {
      const rows = input.proposed.map(p => byId.get(p.fieldSeasonId)).filter((d): d is DestinationField => !!d);
      if (rows.some(d => d.saleableYield == null)) { blocked.push('Per-yield allocation is blocked: recorded saleable yield is missing for one or more fields.'); break; }
      const sum = rows.reduce((s, d) => s + (d.saleableYield ?? 0), 0);
      if (sum <= 0) blocked.push('Per-yield allocation needs a positive recorded yield.');
      else for (const d of rows) percentages.set(d.fieldSeasonId, ((d.saleableYield ?? 0) / sum) * 100);
      break;
    }
  }
  return { percentages, blocked };
}

export function previewReallocation(input: ReallocationInput): ReallocationPreview {
  const warnings: string[] = [];
  const { percentages, blocked } = resolvePercentages(input);

  if (input.record.reversed) blocked.push('This record has been reversed and cannot be allocated.');
  if (input.record.directlyLinked) blocked.push('This cost is already assigned through the completed activity.');
  if (input.record.currency !== input.farmCurrency) blocked.push('Records in another currency cannot be reallocated here.');

  const entries = [...percentages.entries()];
  const totalPct = entries.reduce((sum, [, pct]) => sum + pct, 0);
  if (input.fullAllocation && input.method !== 'unallocated' && input.method !== 'crop_level' && Math.abs(totalPct - 100) > 0.01) {
    blocked.push(`Full allocation must total 100% — the selected split totals ${totalPct.toFixed(2)}%.`);
  }
  if (totalPct > 100.01) blocked.push('Allocation percentages exceed 100%.');

  const emptyImpact: ReallocationPreview = {
    blocked, warnings, resolved: [], totalAllocated: 0, remainingUnallocated: round2(input.record.amount), roundingDifference: 0, perField: [], perCrop: [],
  };
  if (blocked.length) return emptyImpact;
  if (input.method === 'unallocated') { warnings.push('Left unallocated — excluded from field-level profitability until allocated.'); return emptyImpact; }
  // Crop level tags the record to a crop aggregate but allocates nothing to any
  // individual field, so at the FIELD level the full amount stays unallocated
  // (the persisted `method` distinguishes crop-level from truly unallocated).
  if (input.method === 'crop_level') { warnings.push('Allocated at crop level; not distributed to individual fields. Distribute later if needed.'); return { ...emptyImpact }; }

  // Deterministic cent distribution of the allocated portion.
  const amountCents = Math.round(input.record.amount * 100);
  const targetCents = Math.round((amountCents * totalPct) / 100); // allocated portion (full: == amountCents)
  const ids = entries.map(([id]) => id);
  const weights = entries.map(([, pct]) => pct);
  const { cents, redistributed } = distributeCents(targetCents, weights);
  const resolved = ids.map((id, i) => ({ fieldSeasonId: id, percentage: round2(weights[i]), amount: cents[i] / 100 }));
  const totalAllocated = round2(cents.reduce((s, c) => s + c, 0) / 100);
  const remainingUnallocated = round2(input.record.amount - totalAllocated);
  if (remainingUnallocated > 0) warnings.push(`${remainingUnallocated.toFixed(2)} left visibly unallocated.`);

  // Per-field before/after impact = delta vs current effective allocation.
  const currentById = new Map(input.currentAllocations.map(a => [a.fieldSeasonId, a.amount]));
  const byId = new Map(input.destinations.map(d => [d.fieldSeasonId, d]));
  const perField: FieldImpact[] = resolved.map(r => {
    const dest = byId.get(r.fieldSeasonId)!;
    const delta = round2(r.amount - (currentById.get(r.fieldSeasonId) ?? 0));
    const isCost = input.record.kind === 'cost';
    const beforeCost = dest.currentCostEur;
    const beforeRevenue = dest.currentRevenueEur;
    const afterCost = isCost ? round2((beforeCost ?? 0) + delta) : beforeCost;
    const afterRevenue = isCost ? beforeRevenue : round2((beforeRevenue ?? 0) + delta);
    const marginBefore = beforeCost != null && beforeRevenue != null ? round2(beforeRevenue - beforeCost) : null;
    const marginAfter = afterCost != null && afterRevenue != null ? round2(afterRevenue - afterCost) : null;
    // Honesty (Part 11): never invent a margin change when revenue (or cost) is Not recorded.
    let marginReasonCode: FieldImpact['marginReasonCode'] = null;
    let marginPerHaChangeEur: number | null = null;
    if (marginBefore != null && marginAfter != null && dest.hectares > 0) {
      marginPerHaChangeEur = round2((marginAfter - marginBefore) / dest.hectares);
    } else if (isCost && beforeRevenue == null) {
      marginReasonCode = 'MISSING_REVENUE';
    } else if (!isCost && beforeCost == null) {
      marginReasonCode = 'MISSING_COST';
    }
    return { fieldSeasonId: r.fieldSeasonId, field: dest.field, crop: dest.crop, allocatedAmount: r.amount, beforeCostEur: beforeCost, afterCostEur: afterCost, beforeRevenueEur: beforeRevenue, afterRevenueEur: afterRevenue, marginBeforeEur: marginBefore, marginAfterEur: marginAfter, marginPerHaChangeEur, marginReasonCode };
  });

  const cropMap = new Map<string, { costChangeEur: number; revenueChangeEur: number }>();
  for (const r of resolved) {
    const dest = byId.get(r.fieldSeasonId)!;
    const delta = round2(r.amount - (currentById.get(r.fieldSeasonId) ?? 0));
    const bucket = cropMap.get(dest.crop) ?? { costChangeEur: 0, revenueChangeEur: 0 };
    if (input.record.kind === 'cost') bucket.costChangeEur = round2(bucket.costChangeEur + delta);
    else bucket.revenueChangeEur = round2(bucket.revenueChangeEur + delta);
    cropMap.set(dest.crop, bucket);
  }
  const perCrop = [...cropMap].map(([crop, v]) => ({ crop, ...v }));

  return { blocked, warnings, resolved, totalAllocated, remainingUnallocated, roundingDifference: round2(redistributed / 100), perField, perCrop };
}
