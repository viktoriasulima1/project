import type { Farm, EconomicSourceType } from '@prisma/client';
import { db } from './db';

// Sprint 25 — bounded loader for the Finance reallocation sections. Lists the
// farm's allocatable EconomicEntry records (cost/revenue) with their current
// allocation status and effective version. Activity-derived source types are
// excluded (they are directly-linked and not reallocatable). Never unbounded.

export type AllocationStatus = 'unallocated' | 'partially_allocated' | 'fully_allocated' | 'reallocated';

export interface AllocatableRecord {
  economicEntryId: string;
  kind: 'cost' | 'revenue';
  sourceType: string;
  label: string;
  reference: string | null;
  date: string;
  amount: number;
  currency: string;
  allocatedAmount: number;
  unallocatedAmount: number;
  version: number;
  status: AllocationStatus;
  destinationsSummary: string;
}

const ACTIVITY_DERIVED: EconomicSourceType[] = ['inventory_input', 'labour', 'machinery', 'fuel'];

export async function getAllocatableRecords(farm: Farm, seasonId?: string): Promise<{ records: AllocatableRecord[]; seasonId: string | null }> {
  const season = await db.season.findFirst({ where: { farmId: farm.id, ...(seasonId ? { id: seasonId } : { isActive: true }) }, orderBy: { year: 'desc' } });
  if (!season) return { records: [], seasonId: null };

  const entries = await db.economicEntry.findMany({
    where: { farmId: farm.id, seasonId: season.id, status: 'active', sourceType: { notIn: ACTIVITY_DERIVED } },
    include: { allocations: { where: { status: 'active' }, include: { fieldSeason: { include: { field: { select: { name: true } } } } } } },
    orderBy: { costDate: 'desc' },
    take: 100,
  });

  const expenseIds = entries.filter((e) => e.kind === 'cost').map((e) => e.sourceEntityId);
  const revenueIds = entries.filter((e) => e.kind === 'revenue').map((e) => e.sourceEntityId);
  const [expenses, revenues] = await Promise.all([
    expenseIds.length ? db.financialExpense.findMany({ where: { id: { in: expenseIds } }, select: { id: true, description: true, reference: true } }) : Promise.resolve([]),
    revenueIds.length ? db.revenueEntry.findMany({ where: { id: { in: revenueIds } }, select: { id: true, name: true, reference: true } }) : Promise.resolve([]),
  ]);
  const expMap = new Map(expenses.map((e) => [e.id, e]));
  const revMap = new Map(revenues.map((r) => [r.id, r]));

  const records: AllocatableRecord[] = entries.map((e) => {
    const amount = Number(e.amount);
    const allocated = e.allocations.filter((a) => a.fieldSeasonId).reduce((s, a) => s + Number(a.amount), 0);
    const version = e.allocations.reduce((m, a) => Math.max(m, a.version), 0);
    const unallocatedAmount = Math.round((amount - allocated) * 100) / 100;
    let status: AllocationStatus;
    if (version > 1) status = 'reallocated';
    else if (allocated <= 0.005) status = 'unallocated';
    else if (unallocatedAmount > 0.005) status = 'partially_allocated';
    else status = 'fully_allocated';
    const exp = expMap.get(e.sourceEntityId);
    const rev = revMap.get(e.sourceEntityId);
    return {
      economicEntryId: e.id, kind: e.kind, sourceType: e.sourceType,
      label: exp?.description ?? rev?.name ?? e.sourceType.replaceAll('_', ' '),
      reference: exp?.reference ?? rev?.reference ?? null,
      date: e.costDate.toISOString().slice(0, 10), amount, currency: e.currency,
      allocatedAmount: Math.round(allocated * 100) / 100, unallocatedAmount, version, status,
      destinationsSummary: e.allocations.filter((a) => a.fieldSeason).map((a) => a.fieldSeason!.field.name).join(', ') || '—',
    };
  });

  return { records, seasonId: season.id };
}
