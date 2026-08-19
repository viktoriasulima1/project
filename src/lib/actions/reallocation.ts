'use server';

import { randomUUID, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma, CostAllocationMethod } from '@prisma/client';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { getFinanceData } from '@/lib/finance-data';
import { previewReallocation, type AllocationMethod, type DestinationField, type ProposedDestination, type ReallocationPreview } from '@/lib/reallocation-preview';

// Sprint 25 — persisted reallocation write path. previewReallocation() is the
// ONLY source of allocation math; this action never reproduces a formula. It
// resolves the source record and destinations from authoritative DB data
// (never client-supplied amounts/farm IDs), versions the allocation
// append-only, guards stale versions + idempotency, and audits.

export type ReallocationErrorCategory =
  | 'unauthenticated' | 'no_active_farm' | 'record_not_found' | 'record_not_allocatable'
  | 'record_reversed' | 'directly_linked_cost' | 'stale_version' | 'invalid_destination'
  | 'invalid_percentage' | 'invalid_amount' | 'allocation_mismatch' | 'missing_yield'
  | 'currency_mismatch' | 'idempotency_conflict' | 'offline_required_online' | 'internal_error';

export interface ReallocationResult {
  success?: boolean;
  error?: string;
  category?: ReallocationErrorCategory;
  effectiveVersion?: number;
  totalAllocatedCents?: number;
  unallocatedCents?: number;
  affectedFieldSeasonIds?: string[];
}

class AllocationError extends Error {
  constructor(public category: ReallocationErrorCategory, message: string) { super(message); }
}

const destinationSchema = z.object({
  fieldSeasonId: z.string().uuid().optional(),
  fieldId: z.string().uuid().optional(),
  crop: z.string().max(40).optional(),
  percentage: z.coerce.number().optional(),
  amountCents: z.coerce.number().int().optional(),
}).strict();

const reallocateSchema = z.object({
  // The allocatable source record is an EconomicEntry (expense/revenue/etc.).
  economicEntryId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(0),
  allocationMethod: z.enum(['direct_field', 'selected_fields', 'per_hectare', 'per_yield', 'crop_level', 'unallocated']),
  destinations: z.array(destinationSchema).default([]),
  partialAllocationAllowed: z.coerce.boolean().default(false),
  reason: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
}).strict();

export type ReallocationInputContract = z.input<typeof reallocateSchema>;

const ACTIVITY_DERIVED = new Set(['inventory_input', 'labour', 'machinery', 'fuel']);
const METHOD_TO_ENUM: Record<AllocationMethod, CostAllocationMethod> = {
  direct_field: 'direct_field', selected_fields: 'selected_fields', per_hectare: 'per_hectare',
  per_yield: 'yield_proportional', crop_level: 'per_crop_area', unallocated: 'unallocated',
};

function payloadHash(input: z.infer<typeof reallocateSchema>): string {
  const canonical = { e: input.economicEntryId, m: input.allocationMethod, p: input.partialAllocationAllowed, d: [...input.destinations].sort((a, b) => (a.fieldSeasonId ?? '').localeCompare(b.fieldSeasonId ?? '')) };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export interface RecordPreviewResult {
  error?: string;
  category?: ReallocationErrorCategory;
  preview?: ReallocationPreview & {
    recordAmount: number;
    currency: string;
    currentVersion: number;
    currentAllocation: Array<{ fieldSeasonId: string | null; amount: number }>;
  };
}

/**
 * Read-only authoritative preview for the ReallocationDialog. Loads the source
 * record and per-field economics from the DB (via the shared getFinanceData
 * resolver) and runs previewReallocation() — the SAME engine the write action
 * uses — so the dialog never computes allocation math itself and can never
 * disagree with what will be persisted. Returns before/after field & crop
 * impact for display. Farm-scoped throughout; leaks no cross-farm data.
 */
export async function previewReallocationForRecord(input: {
  economicEntryId: string;
  allocationMethod: AllocationMethod;
  destinations: Array<{ fieldSeasonId?: string; percentage?: number; amountCents?: number }>;
  partialAllocationAllowed: boolean;
}): Promise<RecordPreviewResult> {
  const actorUserId = await getClerkUserId();
  if (!actorUserId) return { error: 'Please sign in to continue.', category: 'unauthenticated' };
  let farm;
  try { farm = await getActiveFarmOrThrow(); } catch { return { error: 'Set up your farm first.', category: 'no_active_farm' }; }

  const entry = await db.economicEntry.findFirst({ where: { id: input.economicEntryId, farmId: farm.id } });
  if (!entry) return { error: 'This financial record was not found for your farm.', category: 'record_not_found' };
  if (entry.status === 'reversed') return { error: 'This record is reversed and cannot be allocated.', category: 'record_reversed' };
  if (entry.status !== 'active') return { error: 'This record cannot be allocated.', category: 'record_not_allocatable' };
  if (ACTIVITY_DERIVED.has(entry.sourceType)) return { error: 'This cost is already assigned through the completed activity. Correct or reverse the activity to change its field impact.', category: 'directly_linked_cost' };
  if (entry.currency !== farm.currency) return { error: 'This record is in another currency and cannot be reallocated here.', category: 'currency_mismatch' };

  const [finance, currentRows] = await Promise.all([
    getFinanceData(farm),
    db.economicAllocation.findMany({ where: { economicEntryId: entry.id, status: 'active' } }),
  ]);
  const currentVersion = currentRows.reduce((max, r) => Math.max(max, r.version), 0);
  const destinations: DestinationField[] = finance.fields.map((f) => ({
    fieldSeasonId: f.fieldSeasonId, field: f.field, crop: f.crop, hectares: f.hectares,
    saleableYield: f.yieldQuantity, currentCostEur: f.recordedCostEur, currentRevenueEur: f.recordedRevenueEur,
  }));
  const proposed: ProposedDestination[] = input.destinations
    .filter((d) => d.fieldSeasonId)
    .map((d) => ({ fieldSeasonId: d.fieldSeasonId!, percentage: d.percentage, amount: d.amountCents != null ? d.amountCents / 100 : undefined }));

  const preview = previewReallocation({
    record: { kind: entry.kind, amount: Number(entry.amount), currency: entry.currency, reversed: false, directlyLinked: false, sourceType: entry.sourceType },
    method: input.allocationMethod, proposed, destinations,
    currentAllocations: currentRows.map((r) => ({ fieldSeasonId: r.fieldSeasonId ?? '', amount: Number(r.amount) })),
    fullAllocation: !input.partialAllocationAllowed, farmCurrency: farm.currency,
  });

  return { preview: { ...preview, recordAmount: Number(entry.amount), currency: entry.currency, currentVersion, currentAllocation: currentRows.map((r) => ({ fieldSeasonId: r.fieldSeasonId, amount: Number(r.amount) })) } };
}

export async function reallocateEconomicRecord(rawInput: ReallocationInputContract): Promise<ReallocationResult> {
  const parsed = reallocateSchema.safeParse(rawInput);
  if (!parsed.success) return { error: 'Check the allocation details.', category: 'invalid_destination' };
  const input = parsed.data;

  const actorUserId = await getClerkUserId();
  if (!actorUserId) return { error: 'Please sign in to continue.', category: 'unauthenticated' };
  let farm;
  try { farm = await getActiveFarmOrThrow(); } catch { return { error: 'Set up your farm first.', category: 'no_active_farm' }; }

  const correlationId = randomUUID();
  const submissionHash = payloadHash(input);

  try {
    const result = await db.$transaction(async (tx) => {
      // Idempotency (Part 8) — one reallocation writes many rows sharing a key.
      const existing = await tx.economicAllocation.findFirst({ where: { farmId: farm.id, idempotencyKey: input.idempotencyKey }, select: { submissionHash: true, version: true } });
      if (existing) {
        if (existing.submissionHash !== submissionHash) throw new AllocationError('idempotency_conflict', 'This allocation key was already used with different data.');
        return { idempotent: true, version: existing.version, allocated: 0, unallocated: 0, affected: [] as string[] };
      }

      // Lock + resolve the source EconomicEntry from DB (never trust client amount/farm).
      await tx.$queryRaw`SELECT id FROM economic_entries WHERE id = ${input.economicEntryId} FOR UPDATE`;
      const entry = await tx.economicEntry.findFirst({ where: { id: input.economicEntryId, farmId: farm.id } });
      if (!entry) throw new AllocationError('record_not_found', 'This financial record was not found for your farm.');
      if (entry.status === 'reversed') throw new AllocationError('record_reversed', 'This record is reversed and cannot be allocated.');
      if (entry.status !== 'active') throw new AllocationError('record_not_allocatable', 'This record cannot be allocated.');
      if (ACTIVITY_DERIVED.has(entry.sourceType)) throw new AllocationError('directly_linked_cost', 'This cost is already assigned through the completed activity. Correct or reverse the activity to change its field impact.');
      if (entry.currency !== farm.currency) throw new AllocationError('currency_mismatch', 'This record is in another currency and cannot be reallocated here.');

      // Current effective allocation + stale-version guard (Part 7).
      const currentRows = await tx.economicAllocation.findMany({ where: { economicEntryId: entry.id, status: 'active' } });
      const currentVersion = currentRows.reduce((max, r) => Math.max(max, r.version), 0);
      if (input.expectedVersion !== currentVersion) throw new AllocationError('stale_version', 'This financial record changed while you were reviewing it. Reload and review the current allocation.');
      if (currentVersion > 0 && (input.reason?.trim().length ?? 0) < 10) throw new AllocationError('invalid_destination', 'Give a reason (at least 10 characters) when changing an existing allocation.');

      // Resolve destinations from DB (ownership + method inputs), never client amounts.
      const proposed: ProposedDestination[] = input.destinations
        .filter((d) => d.fieldSeasonId)
        .map((d) => ({ fieldSeasonId: d.fieldSeasonId!, percentage: d.percentage, amount: d.amountCents != null ? d.amountCents / 100 : undefined }));
      const fieldSeasonIds = [...new Set(proposed.map((p) => p.fieldSeasonId))];
      const dbFieldSeasons = fieldSeasonIds.length
        ? await tx.fieldSeason.findMany({ where: { id: { in: fieldSeasonIds }, seasonId: entry.seasonId, field: { farmId: farm.id, deletedAt: null } }, include: { field: { select: { name: true, hectares: true } } } })
        : [];
      if (dbFieldSeasons.length !== fieldSeasonIds.length) throw new AllocationError('invalid_destination', 'One or more selected fields do not belong to your farm and this season.');

      // Saleable yield only needed for per-yield.
      const yieldByFieldSeason = new Map<string, number | null>();
      if (input.allocationMethod === 'per_yield') {
        const harvests = await tx.harvestResult.findMany({ where: { fieldSeasonId: { in: fieldSeasonIds }, status: 'active' }, select: { fieldSeasonId: true, grossQuantity: true, saleableQuantity: true } });
        for (const id of fieldSeasonIds) {
          const rows = harvests.filter((h) => h.fieldSeasonId === id);
          yieldByFieldSeason.set(id, rows.length ? rows.reduce((s, h) => s + Number(h.saleableQuantity ?? h.grossQuantity), 0) : null);
        }
      }

      const destinations: DestinationField[] = dbFieldSeasons.map((fs) => ({
        fieldSeasonId: fs.id, field: fs.field.name, crop: fs.crop, hectares: Number(fs.field.hectares),
        saleableYield: yieldByFieldSeason.get(fs.id) ?? null, currentCostEur: null, currentRevenueEur: null,
      }));

      // Single source of allocation truth (Part 5). The action never recomputes.
      const preview = previewReallocation({
        record: { kind: entry.kind, amount: Number(entry.amount), currency: entry.currency, reversed: false, directlyLinked: false, sourceType: entry.sourceType },
        method: input.allocationMethod, proposed, destinations, currentAllocations: currentRows.map((r) => ({ fieldSeasonId: r.fieldSeasonId ?? '', amount: Number(r.amount) })),
        fullAllocation: !input.partialAllocationAllowed, farmCurrency: farm.currency,
      });
      if (preview.blocked.length) {
        const reason = preview.blocked[0];
        const category: ReallocationErrorCategory = /yield/i.test(reason) ? 'missing_yield'
          : /100%|exceed/i.test(reason) ? 'invalid_percentage' : /negative|zero/i.test(reason) ? 'invalid_amount'
          : /currency/i.test(reason) ? 'currency_mismatch' : /belong/i.test(reason) ? 'invalid_destination' : 'record_not_allocatable';
        throw new AllocationError(category, reason);
      }

      // Reconcile exactly (Part 5 step 8) — defensive; the engine guarantees it.
      const allocatedCents = Math.round(preview.totalAllocated * 100);
      const unallocatedCents = Math.round(preview.remainingUnallocated * 100);
      if (allocatedCents + unallocatedCents !== Math.round(Number(entry.amount) * 100)) throw new AllocationError('allocation_mismatch', 'Allocation did not reconcile with the record total.');

      // Versioned persistence (Part 6) — supersede prior effective rows, insert new.
      if (currentRows.length) await tx.economicAllocation.updateMany({ where: { id: { in: currentRows.map((r) => r.id) } }, data: { status: 'corrected' } });
      const previousVersionId = currentRows[0]?.id ?? null;
      const method = METHOD_TO_ENUM[input.allocationMethod];
      const nextVersion = currentVersion + 1;
      const rows = preview.resolved.length
        ? preview.resolved.map((r) => ({ fieldSeasonId: r.fieldSeasonId, percentage: r.percentage, amount: r.amount }))
        : [{ fieldSeasonId: null as string | null, percentage: 0, amount: 0 }]; // unallocated / crop-level marker row
      await tx.economicAllocation.createMany({
        data: rows.map((r) => ({
          farmId: farm.id, economicEntryId: entry.id, fieldSeasonId: r.fieldSeasonId, percentage: r.percentage, amount: r.amount,
          originalAmount: entry.amount, method, version: nextVersion, status: 'active' as const, correctionOfId: previousVersionId,
          reason: input.reason?.trim() || null, idempotencyKey: input.idempotencyKey, submissionHash, correlationId, createdBy: actorUserId, sourceRecordVersion: currentVersion,
        })),
      });

      await tx.auditEvent.create({ data: {
        farmId: farm.id, actorUserId, entityType: 'EconomicAllocation', entityId: entry.id,
        action: currentVersion === 0 ? 'allocation_created' : 'allocation_changed', source: 'web', correlationId, previousVersionId,
        reason: input.reason?.trim() || null,
        metadataJson: {
          schemaVersion: 1, sourceRecordType: entry.sourceType, sourceRecordId: entry.id, oldVersion: currentVersion, newVersion: nextVersion,
          newMethod: input.allocationMethod, newAllocatedCents: allocatedCents, newUnallocatedCents: unallocatedCents,
          affectedFieldSeasonIds: preview.resolved.map((r) => r.fieldSeasonId),
        },
      } });

      return { idempotent: false, version: nextVersion, allocated: allocatedCents, unallocated: unallocatedCents, affected: preview.resolved.map((r) => r.fieldSeasonId) };
    }, { isolationLevel: 'Serializable' });

    for (const path of ['/finance', '/dashboard', '/ai']) revalidatePath(path);
    return { success: true, effectiveVersion: result.version, totalAllocatedCents: result.allocated, unallocatedCents: result.unallocated, affectedFieldSeasonIds: result.affected };
  } catch (error) {
    if (error instanceof AllocationError) return { error: error.message, category: error.category };
    // Never expose a raw Prisma/SQL error (Part 10).
    return { error: 'The allocation could not be saved. Please try again.', category: 'internal_error' };
  }
}
