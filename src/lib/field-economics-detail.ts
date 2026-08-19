import type { EconomicSourceType, Farm, InventoryCategory } from '@prisma/client';
import { db } from './db';
import { getFinanceData, type FieldEconomicsRow } from './finance-data';
import { resolveBudgetVariance, financialDrivers, resolveEconomicsCompleteness, type BudgetVarianceResult, type FinancialCompletenessResult, type FinancialDriverCode } from './economics';
import {
  buildCostBreakdown, categoryForSource, directVsAllocated, breakEvenExplanation,
  type CostBreakdown, type DirectAllocatedSplit, type BreakEvenExplanation,
} from './field-economics';

// Sprint 25 Part 18 — shared, farm-scoped economic-history query layer. Every
// function takes an authoritative `farm` and scopes every read to it; a record
// belonging to another farm resolves to `null`/empty (never revealed — Part
// 19). Reversed rows are excluded from active totals but preserved in history.
// Bounded queries only; Decimals are normalized to numbers at this boundary.

const round2 = (v: number) => Math.round(v * 100) / 100;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// ─── Part 2–8 — the field economics detail ───────────────────────────────────

export type BudgetRowCode = 'INPUT_COST' | 'LABOUR' | 'MACHINERY' | 'CONTRACTOR' | 'TOTAL_COST' | 'YIELD' | 'REVENUE' | 'GROSS_MARGIN';
export type BudgetRowNoteCode = 'PLANNED_NOT_RECORDED' | 'ACTUAL_INCOMPLETE' | 'HARVEST_NOT_RECORDED' | 'REVENUE_NOT_RECORDED' | 'GROSS_MARGIN_INCOMPLETE';
export interface BudgetRow { code: BudgetRowCode; planned: number | null; actual: number | null; variance: BudgetVarianceResult; noteCode: BudgetRowNoteCode | null }

export interface FieldEconomicsDetail {
  field: { id: string; name: string; hectares: number; soilType: string; status: string };
  season: { id: string; year: number } | null;
  fieldSeasonId: string | null;
  crop: string | null;
  header: { completenessPercent: number; completenessStatus: string; lastCalculatedAt: string };
  summary: FieldEconomicsRow | null;
  breakdown: CostBreakdown;
  split: DirectAllocatedSplit;
  farmUnallocatedCostEur: number | null;
  breakEven: BreakEvenExplanation;
  completeness: FinancialCompletenessResult;
  budget: { result: BudgetVarianceResult; rows: BudgetRow[]; drivers: FinancialDriverCode[] };
}

/** Full economics section for one field (Parts 2–8). Returns null when the
 * field does not belong to this farm (cross-farm access is indistinguishable
 * from "not found"). Reuses the vetted getFinanceData resolver for the summary
 * metrics so the detail page can never disagree with the Finance page. */
export async function getFieldEconomicsDetail(farm: Farm, fieldId: string, seasonId?: string): Promise<FieldEconomicsDetail | null> {
  const field = await db.field.findFirst({ where: { id: fieldId, farmId: farm.id, deletedAt: null } });
  if (!field) return null;

  const season = await db.season.findFirst({ where: { farmId: farm.id, ...(seasonId ? { id: seasonId } : { isActive: true }) }, orderBy: { year: 'desc' } });
  const fieldSeason = season ? await db.fieldSeason.findFirst({ where: { fieldId: field.id, seasonId: season.id } }) : null;

  const finance = await getFinanceData(farm, season?.id);
  const summary = finance.fields.find((f) => f.fieldId === field.id) ?? null;

  // One bounded bundle: active cost entries + completed activities (with product
  // category + cost snapshots) for this field. Covers breakdown enrichment,
  // direct/allocated split and unpriced-input markers with no N+1.
  const [costEntries, activities] = fieldSeason
    ? await Promise.all([
        db.economicEntry.findMany({ where: { farmId: farm.id, fieldSeasonId: fieldSeason.id, kind: 'cost', status: 'active' } }),
        db.activity.findMany({
          where: { fieldSeasonId: fieldSeason.id, status: 'completed', deletedAt: null },
          include: { product: { select: { category: true } }, costSnapshots: { select: { unitCost: true, sourceType: true, inventoryItem: { select: { category: true } } } } },
        }),
      ])
    : [[], []];

  const catByActivity = new Map(activities.map((a) => [a.id, a.product?.category ?? null] as const));

  const breakdownRecords = [
    ...costEntries.map((e) => ({
      category: categoryForSource(e.sourceType, {
        inventoryCategory: e.sourceType === 'inventory_input' ? (catByActivity.get(e.sourceEntityId) ?? null) : null,
        isAllocated: e.allocationMethod !== 'direct_field',
      }),
      amount: Number(e.amount) as number | null,
      isAllocated: e.allocationMethod !== 'direct_field',
    })),
    // Unpriced input snapshots have no EconomicEntry — record them as null-amount
    // so their category reads "partial" instead of silently complete.
    ...activities.flatMap((a) => a.costSnapshots.filter((s) => s.unitCost == null).map((s) => ({
      category: categoryForSource(s.sourceType, { inventoryCategory: (s.inventoryItem?.category ?? null) as InventoryCategory | null, isAllocated: false }),
      amount: null as number | null, isAllocated: false,
    }))),
  ];
  const breakdown = buildCostBreakdown(breakdownRecords);

  const split = directVsAllocated(costEntries.map((e) => ({
    allocationMethod: e.allocationMethod, fieldSeasonId: e.fieldSeasonId, crop: e.crop, amount: Number(e.amount), reversed: false,
  })));

  // Break-even explanation (Part 8) — recorded price + unit compatibility from
  // the field's active revenue and harvest.
  const revenueRows = fieldSeason ? await db.revenueEntry.findMany({ where: { farmId: farm.id, fieldSeasonId: fieldSeason.id, status: 'active' }, select: { totalAmount: true, quantity: true, unit: true } }) : [];
  const harvestRows = fieldSeason ? await db.harvestResult.findMany({ where: { farmId: farm.id, fieldSeasonId: fieldSeason.id, status: 'active' }, select: { unit: true } }) : [];
  const harvestUnits = new Set(harvestRows.map((h) => h.unit));
  const revenueUnits = new Set(revenueRows.filter((r) => r.quantity != null).map((r) => r.unit).filter(Boolean) as string[]);
  const unitsCompatible = harvestUnits.size <= 1 && revenueUnits.size <= 1 && (!harvestUnits.size || !revenueUnits.size || [...harvestUnits][0] === [...revenueUnits][0]);
  const priced = revenueRows.filter((r) => r.quantity != null && Number(r.quantity) > 0);
  const recordedPricePerUnit = priced.length ? Number(priced[0].totalAmount) / Number(priced[0].quantity) : null;

  const breakEven = breakEvenExplanation({
    totalRecordedCost: summary?.recordedCostEur ?? null,
    costsComplete: summary != null && summary.recordedCostEur != null,
    saleableYield: summary?.yieldQuantity ?? null,
    yieldUnit: summary?.yieldUnit ?? null,
    recordedPricePerUnit, unitsCompatible, hasUnallocatedRemainder: false,
  });

  const completeness = summary?.completenessResult ?? resolveEconomicsCompleteness({
    productPricesKnown: false, labourApplicable: false, labourRatesKnown: false,
    machineryApplicable: false, machineryRatesKnown: false, contractorApplicable: false,
    contractorRecorded: false, harvestRecorded: false, revenueRecorded: false,
    overheadChoiceRecorded: false, unitsCompatible: true,
  });

  // Budget vs actual (Part 7).
  const plans = fieldSeason ? await db.seasonPlanItem.findMany({ where: { fieldSeasonId: fieldSeason.id, status: { not: 'cancelled' } } }) : [];
  const sumPlan = (pick: (p: (typeof plans)[number]) => unknown) => {
    const vals = plans.map(pick).filter((v) => v != null).map((v) => Number(v));
    return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
  };
  const actualByCat = (cats: string[]) => {
    const rows = costEntries.filter((e) => cats.includes(e.sourceType));
    return rows.length ? round2(rows.reduce((s, e) => s + Number(e.amount), 0)) : null;
  };
  const plannedInput = sumPlan((p) => p.expectedInputCostEur);
  const plannedLabour = sumPlan((p) => p.expectedLabourCostEur);
  const plannedMachine = sumPlan((p) => p.expectedMachineCostEur);
  const plannedContractor = sumPlan((p) => p.expectedContractorCostEur);
  const plannedYield = sumPlan((p) => p.expectedYieldQuantity);
  const plannedRevenue = sumPlan((p) => p.expectedRevenueEur);
  const actualRevenue = summary?.recordedRevenueEur ?? null;
  const variance = (budget: number | null, actual: number | null) => resolveBudgetVariance({ budget, actual, currency: farm.currency });
  const budgetRows: BudgetRow[] = [
    { code: 'INPUT_COST', planned: plannedInput, actual: actualByCat(['inventory_input']), variance: variance(plannedInput, actualByCat(['inventory_input'])), noteCode: plannedInput == null ? 'PLANNED_NOT_RECORDED' : null },
    { code: 'LABOUR', planned: plannedLabour, actual: actualByCat(['labour']), variance: variance(plannedLabour, actualByCat(['labour'])), noteCode: plannedLabour == null ? 'PLANNED_NOT_RECORDED' : null },
    { code: 'MACHINERY', planned: plannedMachine, actual: actualByCat(['machinery', 'fuel']), variance: variance(plannedMachine, actualByCat(['machinery', 'fuel'])), noteCode: plannedMachine == null ? 'PLANNED_NOT_RECORDED' : null },
    { code: 'CONTRACTOR', planned: plannedContractor, actual: actualByCat(['contractor']), variance: variance(plannedContractor, actualByCat(['contractor'])), noteCode: plannedContractor == null ? 'PLANNED_NOT_RECORDED' : null },
    { code: 'TOTAL_COST', planned: summary?.budgetCostEur ?? null, actual: summary?.recordedCostEur ?? null, variance: summary?.costVariance ?? variance(null, null), noteCode: summary?.recordedCostEur == null ? 'ACTUAL_INCOMPLETE' : null },
    { code: 'YIELD', planned: plannedYield, actual: summary?.yieldQuantity ?? null, variance: variance(plannedYield, summary?.yieldQuantity ?? null), noteCode: (summary?.yieldQuantity ?? null) == null ? 'HARVEST_NOT_RECORDED' : null },
    { code: 'REVENUE', planned: plannedRevenue, actual: actualRevenue, variance: variance(plannedRevenue, actualRevenue), noteCode: actualRevenue == null ? 'REVENUE_NOT_RECORDED' : null },
    { code: 'GROSS_MARGIN', planned: plannedRevenue != null && summary?.budgetCostEur != null ? round2(plannedRevenue - summary.budgetCostEur) : null, actual: summary?.grossMarginEur ?? null, variance: variance(plannedRevenue != null && summary?.budgetCostEur != null ? plannedRevenue - summary.budgetCostEur : null, summary?.grossMarginEur ?? null), noteCode: (summary?.grossMarginEur ?? null) == null ? 'GROSS_MARGIN_INCOMPLETE' : null },
  ];
  const drivers = financialDrivers({
    plannedUnitCost: plannedInput, actualUnitCost: actualByCat(['inventory_input']),
    plannedYield, actualYield: summary?.yieldQuantity ?? null, plannedPrice: plannedRevenue, actualPrice: actualRevenue,
  });

  return {
    field: { id: field.id, name: field.name, hectares: Number(field.hectares), soilType: field.soilType, status: field.status },
    season: season ? { id: season.id, year: season.year } : null,
    fieldSeasonId: fieldSeason?.id ?? null,
    crop: fieldSeason?.crop ?? null,
    header: { completenessPercent: summary?.completenessPercent ?? 0, completenessStatus: summary?.completenessStatus ?? 'insufficient_data', lastCalculatedAt: finance.lastCalculatedAt },
    summary, breakdown, split, farmUnallocatedCostEur: finance.unallocatedCostEur,
    breakEven,
    completeness,
    budget: { result: summary?.costVariance ?? variance(null, null), rows: budgetRows, drivers },
  };
}

// ─── Part 4 — source-record drill-down ───────────────────────────────────────

export interface SourceRecord {
  economicEntryId: string;
  sourceTypeCode: EconomicSourceType;
  categoryCode: import('./field-economics').CostCategory;
  attributionCode: 'direct' | 'allocated';
  versionStateCode: 'effective' | 'corrected';
  date: string;
  description: string;
  amount: number;
  kind: 'cost' | 'revenue';
  isAllocated: boolean;
  version: number | null;
  activityId: string | null;
  correlationId: string;
}

/** Traceable source records behind a field's economics (Part 4). Every active
 * cost/revenue EconomicEntry, enriched with a human label and its source
 * module — no raw database ids as primary labels. Bounded + paginated. */
export async function getFieldEconomicSourceRecords(
  farm: Farm, fieldSeasonId: string, opts: { skip?: number; take?: number } = {},
): Promise<{ records: SourceRecord[]; total: number }> {
  // Ownership: the fieldSeason must belong to this farm.
  const owns = await db.fieldSeason.findFirst({ where: { id: fieldSeasonId, field: { farmId: farm.id } }, select: { id: true } });
  if (!owns) return { records: [], total: 0 };

  const take = Math.min(opts.take ?? 50, 100);
  const where = { farmId: farm.id, fieldSeasonId, status: 'active' as const };
  const [entries, total] = await Promise.all([
    db.economicEntry.findMany({ where, orderBy: { costDate: 'desc' }, skip: opts.skip ?? 0, take }),
    db.economicEntry.count({ where }),
  ]);

  const activityIds = [...new Set(entries.filter((e) => ['inventory_input', 'labour', 'machinery', 'fuel'].includes(e.sourceType)).map((e) => e.sourceEntityId))];
  const expenseIds = entries.filter((e) => ['field_rent', 'utilities', 'soil_lab', 'miscellaneous', 'manual_expense'].includes(e.sourceType)).map((e) => e.sourceEntityId);
  const revenueIds = entries.filter((e) => e.kind === 'revenue').map((e) => e.sourceEntityId);
  const contractorIds = entries.filter((e) => e.sourceType === 'contractor').map((e) => e.sourceEntityId);
  const [activities, expenses, revenues, contractors] = await Promise.all([
    activityIds.length ? db.activity.findMany({ where: { id: { in: activityIds } }, include: { product: { select: { name: true, category: true } } } }) : Promise.resolve([]),
    expenseIds.length ? db.financialExpense.findMany({ where: { id: { in: expenseIds } }, select: { id: true, description: true, version: true } }) : Promise.resolve([]),
    revenueIds.length ? db.revenueEntry.findMany({ where: { id: { in: revenueIds } }, select: { id: true, name: true, version: true } }) : Promise.resolve([]),
    contractorIds.length ? db.contractorCost.findMany({ where: { id: { in: contractorIds } }, select: { id: true, contractor: true, operation: true, version: true } }) : Promise.resolve([]),
  ]);
  const actMap = new Map(activities.map((a) => [a.id, a]));
  const expMap = new Map(expenses.map((e) => [e.id, e]));
  const revMap = new Map(revenues.map((r) => [r.id, r]));
  const conMap = new Map(contractors.map((c) => [c.id, c]));

  const records: SourceRecord[] = entries.map((e) => {
    const act = actMap.get(e.sourceEntityId);
    const exp = expMap.get(e.sourceEntityId);
    const rev = revMap.get(e.sourceEntityId);
    const con = conMap.get(e.sourceEntityId);
    const description = act ? `${act.type}${act.product ? ` · ${act.product.name}` : ''}` : exp?.description ?? rev?.name ?? (con ? `${con.contractor} · ${con.operation}` : e.sourceType.replaceAll('_', ' '));
    const version = exp?.version ?? rev?.version ?? con?.version ?? null;
    const isAllocated = e.allocationMethod !== 'direct_field';
    return {
      economicEntryId: e.id, sourceTypeCode: e.sourceType,
      categoryCode: categoryForSource(e.sourceType, { inventoryCategory: act?.product?.category ?? null, isAllocated }),
      attributionCode: isAllocated ? 'allocated' : 'direct',
      versionStateCode: version != null && version > 1 ? 'corrected' : 'effective',
      date: isoDate(e.costDate), description, amount: Number(e.amount), kind: e.kind,
      isAllocated, version, activityId: act ? e.sourceEntityId : null, correlationId: e.correlationId,
    };
  });
  return { records, total };
}

// ─── Part 10 — financial record version history ──────────────────────────────

export type VersionedType = 'expense' | 'revenue' | 'harvest' | 'purchase';

interface ChainRow { id: string; version: number; status: string; createdAt: Date; correctionOfId: string | null; correctionReason: string | null; values: Record<string, number | string | null>; label: string }

async function loadChain(farm: Farm, type: VersionedType, id: string): Promise<ChainRow[] | null> {
  const map = (r: Record<string, unknown>): ChainRow | null => {
    if (!r) return null;
    if (type === 'expense') return { id: r.id as string, version: r.version as number, status: r.status as string, createdAt: r.createdAt as Date, correctionOfId: (r.correctionOfId as string) ?? null, correctionReason: (r.correctionReason as string) ?? null, label: r.description as string, values: { amount: Number(r.amount), description: r.description as string } };
    if (type === 'revenue') return { id: r.id as string, version: r.version as number, status: r.status as string, createdAt: r.createdAt as Date, correctionOfId: (r.correctionOfId as string) ?? null, correctionReason: (r.correctionReason as string) ?? null, label: r.name as string, values: { totalAmount: Number(r.totalAmount), revenueStatus: r.revenueStatus as string } };
    if (type === 'harvest') return { id: r.id as string, version: r.version as number, status: r.status as string, createdAt: r.createdAt as Date, correctionOfId: (r.correctionOfId as string) ?? null, correctionReason: (r.correctionReason as string) ?? null, label: 'Harvest', values: { grossQuantity: Number(r.grossQuantity), saleableQuantity: r.saleableQuantity == null ? null : Number(r.saleableQuantity) } };
    return { id: r.id as string, version: r.version as number, status: r.status as string, createdAt: r.createdAt as Date, correctionOfId: (r.correctionOfId as string) ?? null, correctionReason: (r.correctionReason as string) ?? null, label: 'Purchase', values: { totalAmount: Number(r.totalAmount), quantity: Number(r.quantity) } };
  };
  const findById = async (rid: string) => {
    if (type === 'expense') return db.financialExpense.findFirst({ where: { id: rid, farmId: farm.id } });
    if (type === 'revenue') return db.revenueEntry.findFirst({ where: { id: rid, farmId: farm.id } });
    if (type === 'harvest') return db.harvestResult.findFirst({ where: { id: rid, farmId: farm.id } });
    return db.inventoryPurchase.findFirst({ where: { id: rid, farmId: farm.id } });
  };
  const start = await findById(id);
  if (!start) return null;

  // Walk up to the root, then breadth-first down all corrections. Bounded.
  const collected = new Map<string, ChainRow>();
  let cursor: Record<string, unknown> | null = start as Record<string, unknown>;
  let guard = 0;
  while (cursor && guard++ < 100) {
    const row = map(cursor);
    if (!row) break;
    collected.set(row.id, row);
    if (!row.correctionOfId) break;
    cursor = (await findById(row.correctionOfId)) as Record<string, unknown> | null;
  }
  // Forward from every known id via the corrections relation.
  const queue = [...collected.keys()];
  guard = 0;
  while (queue.length && guard++ < 500) {
    const cur = queue.shift()!;
    const children = type === 'expense' ? await db.financialExpense.findMany({ where: { correctionOfId: cur, farmId: farm.id } })
      : type === 'revenue' ? await db.revenueEntry.findMany({ where: { correctionOfId: cur, farmId: farm.id } })
      : type === 'harvest' ? await db.harvestResult.findMany({ where: { correctionOfId: cur, farmId: farm.id } })
      : await db.inventoryPurchase.findMany({ where: { correctionOfId: cur, farmId: farm.id } });
    for (const child of children) {
      const row = map(child as Record<string, unknown>);
      if (row && !collected.has(row.id)) { collected.set(row.id, row); queue.push(row.id); }
    }
  }
  return [...collected.values()].sort((a, b) => a.version - b.version || a.createdAt.getTime() - b.createdAt.getTime());
}

/** Ordered version history for a corrected/reversed financial record (Part 10).
 * Reversed and corrected versions stay present; the effective one is marked.
 * Returns null when the record does not belong to this farm. */
export async function getFinancialRecordVersionHistory(farm: Farm, type: VersionedType, id: string) {
  const chain = await loadChain(farm, type, id);
  if (!chain) return null;

  // Actor + audit reason by entity id.
  const entityType = type === 'expense' ? 'FinancialExpense' : type === 'revenue' ? 'RevenueEntry' : type === 'harvest' ? 'HarvestResult' : 'InventoryPurchase';
  const audits = await db.auditEvent.findMany({ where: { farmId: farm.id, entityType, entityId: { in: chain.map((c) => c.id) } }, orderBy: { occurredAt: 'asc' } });
  const auditByEntity = new Map<string, (typeof audits)[number]>();
  for (const a of audits) if (!auditByEntity.has(a.entityId)) auditByEntity.set(a.entityId, a);

  const entries = chain.map((row, i) => {
    const prev = i > 0 ? chain[i - 1] : null;
    const diff: Record<string, { old: number | string | null; new: number | string | null }> = {};
    if (prev) for (const key of Object.keys(row.values)) {
      if (String(prev.values[key] ?? '') !== String(row.values[key] ?? '')) diff[key] = { old: prev.values[key] ?? null, new: row.values[key] ?? null };
    }
    const audit = auditByEntity.get(row.id);
    // Reversed takes precedence over position: a reversed record is "Reversed"
    // even when it is the only (version-1) row in its chain.
    const statusCode = row.status === 'reversed' ? 'reversed' : i === 0 ? 'original' : row.status === 'active' ? 'effective' : 'corrected';
    return {
      id: row.id, version: row.version, statusCode, rawStatus: row.status, createdAt: row.createdAt.toISOString(),
      reason: row.correctionReason ?? audit?.reason ?? null, actor: audit?.actorUserId ?? null, label: row.label,
      values: row.values, diff, isCurrentEffective: row.status === 'active',
    };
  });
  return { type, entries, currentEffectiveVersion: entries.find((e) => e.isCurrentEffective)?.version ?? null };
}

// ─── Part 13 — allocation history ────────────────────────────────────────────

export interface AllocationVersion {
  version: number;
  statusCode: 'effective' | 'superseded';
  method: string;
  reason: string | null;
  createdAt: string;
  actor: string | null;
  destinations: Array<{ field: string | null; percentage: number; amount: number }>;
  allocatedAmount: number;
  unallocatedAmount: number;
  isCurrentEffective: boolean;
}

/** Version history of a source record's allocation (Part 13). Groups
 * EconomicAllocation rows by version; the active version is current-effective.
 * Returns null when the source record does not belong to this farm. */
export async function getAllocationHistory(farm: Farm, economicEntryId: string) {
  const entry = await db.economicEntry.findFirst({ where: { id: economicEntryId, farmId: farm.id } });
  if (!entry) return null;

  const rows = await db.economicAllocation.findMany({
    where: { economicEntryId: entry.id, farmId: farm.id },
    include: { fieldSeason: { include: { field: { select: { name: true } } } } },
    orderBy: [{ version: 'asc' }, { createdAt: 'asc' }],
  });
  const audits = await db.auditEvent.findMany({ where: { farmId: farm.id, entityType: 'EconomicAllocation', entityId: entry.id }, orderBy: { occurredAt: 'asc' } });

  const byVersion = new Map<number, typeof rows>();
  for (const r of rows) byVersion.set(r.version, [...(byVersion.get(r.version) ?? []), r]);

  const recordAmount = Number(entry.amount);
  const versions: AllocationVersion[] = [...byVersion.entries()].sort((a, b) => a[0] - b[0]).map(([version, group]) => {
    const allocated = round2(group.filter((g) => g.fieldSeasonId).reduce((s, g) => s + Number(g.amount), 0));
    const audit = audits.find((a) => (a.metadataJson as { newVersion?: number })?.newVersion === version) ?? null;
    return {
      version, statusCode: group[0].status === 'active' ? 'effective' : 'superseded', method: group[0].method,
      reason: group[0].reason ?? audit?.reason ?? null, createdAt: group[0].createdAt.toISOString(), actor: audit?.actorUserId ?? null,
      destinations: group.filter((g) => g.fieldSeasonId).map((g) => ({ field: g.fieldSeason?.field.name ?? null, percentage: Number(g.percentage), amount: Number(g.amount) })),
      allocatedAmount: allocated, unallocatedAmount: round2(recordAmount - allocated), isCurrentEffective: group[0].status === 'active',
    };
  });
  return { economicEntryId: entry.id, recordAmount, currency: entry.currency, sourceType: entry.sourceType, versions };
}

// ─── Part 9 — unified field economic timeline ────────────────────────────────

export interface TimelineEvent {
  id: string;
  occurredAt: string;
  type: string;
  actor: string | null;
  effect: string;
  amount: number | null;
  reason: string | null;
  source: string;
  resultingStatus: string;
}

/** Unified, farm-scoped economic timeline for a field (Part 9). Built from the
 * field's audit events (append-only) which already record created/corrected/
 * reversed/allocation actions with actor, reason and correlation. Newest-first
 * by default; pass chronological for oldest-first. Bounded + paginated. */
export async function getFieldEconomicTimeline(
  farm: Farm, fieldSeasonId: string, opts: { chronological?: boolean; skip?: number; take?: number } = {},
): Promise<{ events: TimelineEvent[]; total: number }> {
  const fs = await db.fieldSeason.findFirst({ where: { id: fieldSeasonId, field: { farmId: farm.id } }, select: { id: true } });
  if (!fs) return { events: [], total: 0 };

  // Gather the field's economic entity ids (source records + activities) so we
  // can pull only their audit events — never another field's or farm's.
  const [entries, activities, harvests, expenses, revenues] = await Promise.all([
    db.economicEntry.findMany({ where: { farmId: farm.id, fieldSeasonId }, select: { id: true, sourceEntityId: true } }),
    db.activity.findMany({ where: { fieldSeasonId }, select: { id: true } }),
    db.harvestResult.findMany({ where: { farmId: farm.id, fieldSeasonId }, select: { id: true } }),
    db.financialExpense.findMany({ where: { farmId: farm.id, fieldSeasonId }, select: { id: true } }),
    db.revenueEntry.findMany({ where: { farmId: farm.id, fieldSeasonId }, select: { id: true } }),
  ]);
  const entityIds = [...new Set([
    ...entries.map((e) => e.id), ...entries.map((e) => e.sourceEntityId), ...activities.map((a) => a.id),
    ...harvests.map((h) => h.id), ...expenses.map((e) => e.id), ...revenues.map((r) => r.id),
  ])];
  if (!entityIds.length) return { events: [], total: 0 };

  const take = Math.min(opts.take ?? 50, 100);
  const where = { farmId: farm.id, entityId: { in: entityIds } };
  const [audits, total] = await Promise.all([
    db.auditEvent.findMany({ where, orderBy: { occurredAt: opts.chronological ? 'asc' : 'desc' }, skip: opts.skip ?? 0, take }),
    db.auditEvent.count({ where }),
  ]);

  const ACTION_LABEL: Record<string, string> = {
    created: 'Recorded', corrected: 'Corrected', reversed: 'Reversed', completed: 'Activity completed',
    allocation_created: 'Allocation created', allocation_changed: 'Reallocated', allocation_reversed: 'Allocation reversed',
    inventory_adjusted: 'Inventory adjusted',
  };
  const events: TimelineEvent[] = audits.map((a) => {
    const meta = a.metadataJson as { newAllocatedCents?: number };
    return {
      id: a.id, occurredAt: a.occurredAt.toISOString(), type: ACTION_LABEL[a.action] ?? a.action,
      actor: a.actorUserId ?? (a.actorType === 'system' ? 'FarmOS' : null),
      effect: `${a.entityType.replace(/([A-Z])/g, ' $1').trim()} ${ACTION_LABEL[a.action]?.toLowerCase() ?? a.action}`,
      amount: meta.newAllocatedCents != null ? round2(meta.newAllocatedCents / 100) : null,
      reason: a.reason ?? null, source: a.source, resultingStatus: a.action === 'reversed' ? 'reversed' : 'active',
    };
  });
  return { events, total };
}
