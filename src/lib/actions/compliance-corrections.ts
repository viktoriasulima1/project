'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { handleActionError } from '@/lib/user-error';
import { recordAuditEvent, newCorrelationId } from '@/lib/audit';
import { buildCtgbSnapshotExtra } from '@/lib/ctgb-snapshot';
import { recordActivityInputEconomics } from '@/lib/economics-recording';
import { getRootId, getVersionChain, getEffectiveVersion } from '@/lib/activity-versions';
import { computeCorrectionPreview, type CorrectionPreview, type CorrectableData } from '@/lib/correction-preview';
import type { Prisma } from '@prisma/client';

// Deliberately NOT re-exported from this file, even as a type-only
// `export type { X }` — Next.js's "use server" bundler transform chokes on
// that pattern (it tries to generate a server-action reference for the
// re-exported name regardless of it being type-only, producing a real
// `ReferenceError` at runtime once the type is erased). Client components
// import `CorrectionPreview`/`CorrectionFieldDiff`/`StockChangePreview`
// directly from `@/lib/correction-preview` instead.

/**
 * Sprint 19 Parts 3-6 — the ONLY sanctioned way to change or negate the
 * effect of a completed spray activity. Both actions here always create a
 * NEW Activity row referencing the one it corrects/reverses; neither ever
 * updates or deletes the original. See
 * docs/COMPLIANCE_RECORD_CORRECTION_POLICY.md for the full policy this
 * file implements.
 *
 * Deliberately scoped to `type === 'spray'` only this sprint — Part 4's
 * correctable-field list (dose, water volume, nozzle, ...) and the whole
 * Compliance page/export system are spray-diary-shaped. Extending
 * correction/reversal to fertilise/harvest/etc. is documented as future
 * work, not silently half-supported.
 */

class FieldValidationError extends Error {
  constructor(public fieldErrors: Record<string, string[]>) {
    super('Validation failed.');
  }
}

class StaleVersionError extends Error {
  constructor() {
    super('This record was changed by another action. Reload and review the latest version.');
  }
}

const CorrectableFieldsSchema = z.object({
  operatorName: z.string().max(100).default(''),
  certificateNumber: z.string().max(50).optional().or(z.literal('')),
  waterVolumePerHa: z.coerce.number().positive().max(2000).optional().or(z.literal('')),
  nozzleType: z.string().max(50).optional().or(z.literal('')),
  machineId: z.string().uuid().optional().or(z.literal('')),
  areaHa: z.coerce.number().positive().max(9999),
  productId: z.string().uuid().optional().or(z.literal('')),
  dosePerHa: z.coerce.number().positive().max(9999).optional().or(z.literal('')),
  doseUnit: z.string().max(10).optional().or(z.literal('')),
  bbchStage: z.coerce.number().int().min(0).max(99).optional().or(z.literal('')),
  date: z.string().min(1),
  weatherTempC: z.coerce.number().min(-30).max(60).optional().or(z.literal('')),
  weatherWindKmh: z.coerce.number().min(0).max(200).optional().or(z.literal('')),
  weatherWindDir: z.string().max(3).optional().or(z.literal('')),
  weatherHumidity: z.coerce.number().int().min(0).max(100).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

const CorrectActivitySchema = CorrectableFieldsSchema.extend({
  activityId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
  correctionReason: z.string().min(10, 'Explain what was wrong and what the correct value is (at least 10 characters).').max(1000),
  idempotencyKey: z.string().uuid(),
});

export type CorrectionFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  correctedActivityId?: string;
};

function assertSpraySubmissionComplete(d: CorrectableData): void {
  const fieldErrors: Record<string, string[]> = {};
  if (!d.operatorName) fieldErrors.operatorName = ['Operator is required for spraying.'];
  if (!d.machineId) fieldErrors.machineId = ['Select the sprayer used.'];
  if (!d.nozzleType) fieldErrors.nozzleType = ['Select a nozzle type.'];
  if (!d.productId) fieldErrors.productId = ['Select a product.'];
  if (!d.dosePerHa) fieldErrors.dosePerHa = ['Enter a dose.'];
  if (!d.doseUnit) fieldErrors.doseUnit = ['Select a dose unit.'];
  if (!d.waterVolumePerHa) fieldErrors.waterVolumePerHa = ['Enter the water volume per hectare.'];
  if (Object.keys(fieldErrors).length > 0) throw new FieldValidationError(fieldErrors);
}

/** Read-only preview for the correction dialog — computes everything
 * `correctActivity` would do, without writing anything. */
export async function previewActivityCorrection(activityId: string, formData: FormData): Promise<{ error?: string; preview?: CorrectionPreview }> {
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Farm not found.' };
  }

  const parsed = CorrectableFieldsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Check the highlighted fields.' };

  const previous = await db.activity.findFirst({
    where: { id: activityId, fieldSeason: { field: { farmId: farm.id } }, deletedAt: null },
    include: {
      product: { select: { id: true, name: true, farmId: true, currentStock: true } },
      machine: { select: { id: true, name: true, farmId: true } },
    },
  });
  if (!previous) return { error: 'Activity not found or does not belong to this farm.' };

  const stockMap = new Map<string, number>();
  if (previous.product) stockMap.set(previous.product.id, Number(previous.product.currentStock));
  if (parsed.data.productId && parsed.data.productId !== previous.product?.id) {
    const other = await db.inventoryItem.findFirst({ where: { id: parsed.data.productId, farmId: farm.id }, select: { currentStock: true } });
    if (other) stockMap.set(parsed.data.productId, Number(other.currentStock));
  }

  return { preview: computeCorrectionPreview(previous, parsed.data, stockMap) };
}

export async function correctActivity(_prev: CorrectionFormState, formData: FormData): Promise<CorrectionFormState> {
  const raw = Object.fromEntries(formData);
  const parsed = CorrectActivitySchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Farm not found.' };
  }
  const actorUserId = await getClerkUserId();
  const d = parsed.data;
  const correlationId = newCorrelationId();

  try {
    const result = await db.$transaction(async (tx) => {
      // Sprint 19 Part 16 — a real row lock, not just the optimistic version
      // check below. Two truly simultaneous corrections of the same
      // activity would otherwise both read the chain BEFORE either commits
      // and both pass the "still effective" check, forking the chain. This
      // makes the second transaction's read of `previous`/the chain wait
      // until the first one has fully committed (or rolled back), so it
      // always sees the up-to-date chain state before deciding.
      await tx.$queryRaw`SELECT id FROM activities WHERE id = ${d.activityId} FOR UPDATE`;

      // Idempotency (Part 16): the same idempotencyKey must never produce a
      // second correction, even under a double-submit race. Farm-scoped
      // like every other lookup in this action (Part 14) — without the
      // fieldSeason.field.farmId filter here, a crafted request naming
      // another farm's real activity id could probe for whether that
      // record has ever been corrected, before farm ownership is checked
      // below.
      const existing = await tx.activity.findFirst({
        where: { correctionOfId: d.activityId, correctionReason: { not: null }, fieldSeason: { field: { farmId: farm.id } } },
        select: { id: true, correctionDiff: true },
      });
      if (existing) {
        const existingDiff = existing.correctionDiff as { idempotencyKey?: string } | null;
        if (existingDiff?.idempotencyKey === d.idempotencyKey) {
          return { correctedActivityId: existing.id };
        }
      }

      const previous = await tx.activity.findFirst({
        where: { id: d.activityId, fieldSeason: { field: { farmId: farm.id } }, deletedAt: null },
        include: {
          fieldSeason: { include: { field: { select: { name: true, hectares: true } }, season: { select: { year: true } } } },
          product: { select: { id: true, name: true, farmId: true, currentStock: true } },
          machine: { select: { id: true, name: true, farmId: true } },
        },
      });
      if (!previous) throw new Error('Activity not found or does not belong to this farm.');
      if (previous.status !== 'completed') throw new Error('Only a completed activity can be corrected.');
      if (previous.type !== 'spray') throw new Error('Only completed spray activities can be corrected this sprint.');
      if (previous.isReversal) throw new Error('A reversed record cannot be corrected further.');

      const rootId = getRootId(previous);
      const chain = await getVersionChain(tx, rootId);
      const effective = getEffectiveVersion(chain);
      // Both sides of this check describe the same fact (a chain's
      // effective member and its version number always move together) —
      // checked together because either divergence means the same thing:
      // this record changed since the correction screen was opened.
      if (effective.id !== previous.id || effective.version !== d.expectedVersion) {
        throw new StaleVersionError();
      }

      assertSpraySubmissionComplete(d);

      if (d.machineId) {
        const machine = await tx.machine.findFirst({ where: { id: d.machineId }, select: { farmId: true, name: true } });
        if (!machine) throw new Error('Machine not found.');
        if (machine.farmId !== farm.id) throw new Error('Machine does not belong to this farm.');
      }

      let newProductRow: {
        id: string; name: string; registrationNumber: string | null; farmId: string; currentStock: Prisma.Decimal;
        unit: string; purchasePricePerUnit: Prisma.Decimal | null; valuationEffectiveAt: Date | null;
        ctgbProductReference: Parameters<typeof buildCtgbSnapshotExtra>[0];
      } | null = null;
      if (d.productId) {
        const item = await tx.inventoryItem.findFirst({
          where: { id: d.productId },
          select: {
            id: true, name: true, registrationNumber: true, farmId: true, currentStock: true, unit: true, purchasePricePerUnit: true, valuationEffectiveAt: true,
            ctgbProductReference: {
              select: {
                id: true, sourceProductId: true, authorisationNumber: true, officialName: true,
                authorisationStatus: true, authorisationStart: true, authorisationEnd: true,
                holder: true, activeSubstances: true, sourceUrl: true, fetchedAt: true,
                sourceVersion: true, rawChecksum: true,
                uses: {
                  select: {
                    cropOrUseTarget: true, purpose: true, dosePerHaMin: true, dosePerHaMax: true,
                    doseUnit: true, maxApplicationsPerSeason: true, applicationIntervalDays: true,
                    bbchMin: true, bbchMax: true, phiDays: true, bufferZoneMetres: true,
                    otherRestrictions: true, sourceDocumentRef: true,
                  },
                },
              },
            },
          },
        });
        if (!item) throw new Error('Product not found.');
        if (item.farmId !== farm.id) throw new Error('Product does not belong to this farm.');
        newProductRow = item;
      }

      const stockMap = new Map<string, number>();
      if (previous.product) stockMap.set(previous.product.id, Number(previous.product.currentStock));
      if (newProductRow) stockMap.set(newProductRow.id, Number(newProductRow.currentStock));
      const preview = computeCorrectionPreview(previous, d, stockMap);

      // ─── Reconcile inventory (Part 5) — additive movements only, never
      // rewriting the original. Each movement shares this correction's
      // correlationId so they can be queried together later. ───────────────
      const stockMovementIds: string[] = [];
      for (const change of preview.stockChanges) {
        if (change.direction === 'out') {
          const rowsUpdated = await tx.$executeRaw`
            UPDATE inventory_items
            SET "currentStock" = "currentStock" - ${change.quantityDelta}::numeric,
                "updatedAt"    = NOW()
            WHERE id = ${change.inventoryItemId}
              AND "farmId" = ${farm.id}
              AND "currentStock" >= ${change.quantityDelta}::numeric
          `;
          if (rowsUpdated === 0) {
            throw new Error(
              `Insufficient stock to apply this correction for ${change.productName}: the additional ` +
              `${change.quantityDelta.toFixed(3)} required is not available. Adjust the correction or restock first.`,
            );
          }
        } else {
          const restoreAmount = Math.abs(change.quantityDelta);
          await tx.$executeRaw`
            UPDATE inventory_items
            SET "currentStock" = "currentStock" + ${restoreAmount}::numeric,
                "updatedAt"    = NOW()
            WHERE id = ${change.inventoryItemId}
          `;
        }
        const movement = await tx.stockMovement.create({
          data: {
            inventoryItemId: change.inventoryItemId,
            activityId: d.activityId, // tied to the ORIGINAL activity id — the chain's stable anchor
            quantity: Math.abs(change.quantityDelta),
            direction: change.direction === 'out' ? 'out' : 'correction',
            notes: `Correction: ${d.correctionReason}`.slice(0, 500),
            correlationId,
          },
        });
        stockMovementIds.push(movement.id);
      }

      // ─── Create the new, corrected version — the original row is never
      // touched. ─────────────────────────────────────────────────────────
      const correctionDiffWithKey = { ...preview.diff, idempotencyKey: d.idempotencyKey };
      const corrected = await tx.activity.create({
        data: {
          fieldSeasonId: previous.fieldSeasonId,
          type: 'spray',
          status: 'completed',
          date: new Date(d.date),
          operatorName: d.operatorName,
          certificateNumber: d.certificateNumber || null,
          waterVolumePerHa: d.waterVolumePerHa || null,
          nozzleType: d.nozzleType || null,
          machineId: d.machineId || null,
          areaHa: d.areaHa,
          productId: d.productId || null,
          dosePerHa: d.dosePerHa || null,
          doseUnit: d.doseUnit || null,
          weatherTempC: d.weatherTempC || previous.weatherTempC,
          weatherWindKmh: d.weatherWindKmh ? Math.round(d.weatherWindKmh) : previous.weatherWindKmh,
          weatherWindDir: d.weatherWindDir || previous.weatherWindDir,
          weatherHumidity: d.weatherHumidity || previous.weatherHumidity,
          bbchStage: d.bbchStage || null,
          notes: d.notes || null,
          version: previous.version + 1,
          correctionOfId: previous.id,
          rootActivityId: rootId,
          isReversal: false,
          correctionReason: d.correctionReason,
          correctionDiff: correctionDiffWithKey,
        },
      });

      const ctgbExtra = buildCtgbSnapshotExtra(
        newProductRow?.ctgbProductReference ?? null,
        previous.fieldSeason.crop,
        d.dosePerHa || null,
        d.doseUnit || null,
      );
      const complianceRecord = await tx.complianceRecord.create({
        data: {
          activityId: corrected.id,
          framework: 'EU_SPRAY_DIARY_2009_128_EC',
          data: {
            fieldName: previous.fieldSeason.field.name,
            fieldHectares: String(previous.fieldSeason.field.hectares),
            crop: previous.fieldSeason.crop,
            seasonYear: previous.fieldSeason.season.year,
            date: d.date.slice(0, 10),
            operatorName: d.operatorName,
            certificateNumber: d.certificateNumber || null,
            areaHa: d.areaHa,
            waterVolumePerHa: d.waterVolumePerHa || null,
            nozzleType: d.nozzleType || null,
            machineId: d.machineId || null,
            bbchStage: d.bbchStage || null,
            productName: newProductRow?.name ?? null,
            productRegistrationNumber: newProductRow?.registrationNumber ?? null,
            ctgbAuthorisationStatusAtCompletion: newProductRow?.ctgbProductReference?.authorisationStatus ?? null,
            ctgbSourceUrl: newProductRow?.ctgbProductReference?.sourceUrl ?? null,
            ctgbFetchedAt: newProductRow?.ctgbProductReference?.fetchedAt?.toISOString() ?? null,
            ...ctgbExtra,
            dosePerHa: d.dosePerHa || null,
            doseUnit: d.doseUnit || null,
            weatherTempC: d.weatherTempC || (previous.weatherTempC ? Number(previous.weatherTempC) : null),
            weatherWindKmh: d.weatherWindKmh || previous.weatherWindKmh,
            weatherWindDir: d.weatherWindDir || previous.weatherWindDir,
            weatherHumidity: d.weatherHumidity || previous.weatherHumidity,
            notes: d.notes || null,
          },
          confirmed: false,
        },
      });

      const previousCost = tx.activityCostSnapshot ? await tx.activityCostSnapshot.findFirst({ where: { activityId: previous.id, sourceType: 'inventory_input' } }) : null;
      const previousEntry = tx.economicEntry ? await tx.economicEntry.findFirst({ where: { farmId: farm.id, sourceType: 'inventory_input', sourceEntityId: previous.id, status: 'active' }, orderBy: { createdAt: 'desc' } }) : null;
      if (previousEntry) await tx.economicEntry.create({ data: {
        farmId: farm.id, seasonId: previous.fieldSeason.seasonId, fieldSeasonId: previous.fieldSeasonId, fieldId: previous.fieldSeason.fieldId, crop: previous.fieldSeason.crop,
        kind: 'cost', sourceType: 'inventory_input', sourceEntityId: corrected.id, amount: -Number(previousEntry.amount), currency: previousEntry.currency,
        quantity: previousEntry.quantity ? -Number(previousEntry.quantity) : null, unit: previousEntry.unit, unitCost: previousEntry.unitCost,
        costDate: new Date(d.date), allocationMethod: 'direct_field', confidence: previousEntry.confidence, reversalOfId: previousEntry.id, correlationId,
      } });
      if (newProductRow && d.dosePerHa) {
        const sameProduct = previous.productId === newProductRow.id;
        await recordActivityInputEconomics(tx, { farmId: farm.id, seasonId: previous.fieldSeason.seasonId, fieldSeasonId: previous.fieldSeasonId, fieldId: previous.fieldSeason.fieldId, crop: previous.fieldSeason.crop,
          activityId: corrected.id, inventoryItemId: newProductRow.id, productName: newProductRow.name, quantity: d.dosePerHa * d.areaHa, unit: newProductRow.unit,
          unitCost: sameProduct && previousCost?.unitCost != null ? Number(previousCost.unitCost) : newProductRow.purchasePricePerUnit == null ? null : Number(newProductRow.purchasePricePerUnit),
          priceEffectiveDate: sameProduct ? previousCost?.priceEffectiveDate ?? null : newProductRow.valuationEffectiveAt, currency: farm.currency, costDate: new Date(d.date), correlationId });
      }

      await recordAuditEvent(tx, {
        farmId: farm.id,
        actorUserId,
        entityType: 'Activity',
        entityId: corrected.id,
        action: 'corrected',
        source: 'web',
        correlationId,
        previousVersionId: previous.id,
        reason: d.correctionReason,
        metadata: {
          idempotencyKey: d.idempotencyKey,
          fieldsChanged: Object.keys(preview.diff).join(','),
          significantProductChange: preview.isSignificantProductChange,
        },
      });
      await recordAuditEvent(tx, {
        farmId: farm.id, actorUserId, entityType: 'ComplianceRecord', entityId: complianceRecord.id,
        action: 'compliance_snapshot_created', source: 'web', correlationId,
      });
      for (const movementId of stockMovementIds) {
        await recordAuditEvent(tx, {
          farmId: farm.id, actorUserId, entityType: 'StockMovement', entityId: movementId,
          action: 'inventory_adjusted', source: 'web', correlationId,
        });
      }

      return { correctedActivityId: corrected.id };
    });

    revalidatePath('/compliance');
    revalidatePath('/activities');
    revalidatePath('/inventory');
    return { success: true, correctedActivityId: result.correctedActivityId };
  } catch (e) {
    if (e instanceof FieldValidationError) return { fieldErrors: e.fieldErrors };
    return { error: handleActionError('correctActivity', e).message };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Reversal (Sprint 19 Part 6) — negates a completed activity's effect
// without editing or deleting it. Not a normal edit mechanism: it carries
// no corrected field values, only a reason.
// ─────────────────────────────────────────────────────────────────────────

const ReverseActivitySchema = z.object({
  activityId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
  reason: z.string().min(10, 'Explain why this record is being reversed (at least 10 characters).').max(1000),
  idempotencyKey: z.string().uuid(),
});

export type ReversalFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  reversedActivityId?: string;
};

export interface ReversalPreview {
  stockRestored: { productName: string; quantity: number }[];
}

export async function previewActivityReversal(activityId: string): Promise<{ error?: string; preview?: ReversalPreview }> {
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Farm not found.' };
  }

  const activity = await db.activity.findFirst({
    where: { id: activityId, fieldSeason: { field: { farmId: farm.id } }, deletedAt: null },
    include: { product: { select: { name: true } } },
  });
  if (!activity) return { error: 'Activity not found or does not belong to this farm.' };
  if (activity.isReversal) return { error: 'This record has already been reversed.' };

  const stockRestored: ReversalPreview['stockRestored'] = [];
  if (activity.productId && activity.dosePerHa && activity.product) {
    stockRestored.push({
      productName: activity.product.name,
      quantity: Number(activity.dosePerHa) * Number(activity.areaHa),
    });
  }
  return { preview: { stockRestored } };
}

export async function reverseActivity(_prev: ReversalFormState, formData: FormData): Promise<ReversalFormState> {
  const parsed = ReverseActivitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Farm not found.' };
  }
  const actorUserId = await getClerkUserId();
  const d = parsed.data;
  const correlationId = newCorrelationId();

  try {
    const result = await db.$transaction(async (tx) => {
      // See the identical lock in correctActivity above — same reasoning.
      await tx.$queryRaw`SELECT id FROM activities WHERE id = ${d.activityId} FOR UPDATE`;

      // Farm-scoped — see the identical comment in correctActivity above.
      const existing = await tx.activity.findFirst({
        where: { correctionOfId: d.activityId, isReversal: true, fieldSeason: { field: { farmId: farm.id } } },
        select: { id: true, correctionDiff: true },
      });
      if (existing) {
        const existingDiff = existing.correctionDiff as { idempotencyKey?: string } | null;
        if (existingDiff?.idempotencyKey === d.idempotencyKey) {
          return { reversedActivityId: existing.id };
        }
      }

      const previous = await tx.activity.findFirst({
        where: { id: d.activityId, fieldSeason: { field: { farmId: farm.id } }, deletedAt: null },
        include: {
          fieldSeason: { include: { field: { select: { name: true, hectares: true } }, season: { select: { year: true } } } },
          product: { select: { id: true, name: true, farmId: true } },
        },
      });
      if (!previous) throw new Error('Activity not found or does not belong to this farm.');
      if (previous.status !== 'completed') throw new Error('Only a completed activity can be reversed.');
      if (previous.isReversal) throw new Error('This record has already been reversed.');

      const rootId = getRootId(previous);
      const chain = await getVersionChain(tx, rootId);
      const effective = getEffectiveVersion(chain);
      if (effective.id !== previous.id || effective.version !== d.expectedVersion) {
        throw new StaleVersionError();
      }

      const stockMovementIds: string[] = [];
      if (previous.productId && previous.dosePerHa) {
        const restoreAmount = Number(previous.dosePerHa) * Number(previous.areaHa);
        await tx.$executeRaw`
          UPDATE inventory_items
          SET "currentStock" = "currentStock" + ${restoreAmount}::numeric,
              "updatedAt"    = NOW()
          WHERE id = ${previous.productId}
        `;
        const movement = await tx.stockMovement.create({
          data: {
            inventoryItemId: previous.productId,
            activityId: d.activityId,
            quantity: restoreAmount,
            direction: 'correction',
            notes: `Reversal: ${d.reason}`.slice(0, 500),
            correlationId,
          },
        });
        stockMovementIds.push(movement.id);
      }

      const reversed = await tx.activity.create({
        data: {
          fieldSeasonId: previous.fieldSeasonId,
          type: previous.type,
          status: 'completed',
          date: previous.date,
          operatorName: previous.operatorName,
          certificateNumber: previous.certificateNumber,
          waterVolumePerHa: previous.waterVolumePerHa,
          nozzleType: previous.nozzleType,
          machineId: previous.machineId,
          areaHa: previous.areaHa,
          productId: previous.productId,
          dosePerHa: previous.dosePerHa,
          doseUnit: previous.doseUnit,
          weatherTempC: previous.weatherTempC,
          weatherWindKmh: previous.weatherWindKmh,
          weatherWindDir: previous.weatherWindDir,
          weatherHumidity: previous.weatherHumidity,
          bbchStage: previous.bbchStage,
          notes: previous.notes,
          version: previous.version + 1,
          correctionOfId: previous.id,
          rootActivityId: rootId,
          isReversal: true,
          correctionReason: d.reason,
          correctionDiff: { idempotencyKey: d.idempotencyKey },
        },
      });

      const previousEntry = tx.economicEntry ? await tx.economicEntry.findFirst({ where: { farmId: farm.id, sourceType: 'inventory_input', sourceEntityId: previous.id, status: 'active' }, orderBy: { createdAt: 'desc' } }) : null;
      if (previousEntry) await tx.economicEntry.create({ data: {
        farmId: farm.id, seasonId: previous.fieldSeason.seasonId, fieldSeasonId: previous.fieldSeasonId, fieldId: previous.fieldSeason.fieldId, crop: previous.fieldSeason.crop,
        kind: 'cost', sourceType: 'inventory_input', sourceEntityId: reversed.id, amount: -Number(previousEntry.amount), currency: previousEntry.currency,
        quantity: previousEntry.quantity ? -Number(previousEntry.quantity) : null, unit: previousEntry.unit, unitCost: previousEntry.unitCost,
        costDate: previous.date, allocationMethod: 'direct_field', confidence: previousEntry.confidence, reversalOfId: previousEntry.id, correlationId,
      } });

      // Same factual snapshot as the effective version being reversed —
      // nothing about what happened changes, only that it's now reversed.
      const previousRecord = await tx.complianceRecord.findFirst({
        where: { activityId: previous.id },
        orderBy: { createdAt: 'desc' },
      });
      let complianceRecordId: string | null = null;
      if (previousRecord) {
        const created = await tx.complianceRecord.create({
          data: {
            activityId: reversed.id,
            framework: previousRecord.framework,
            data: previousRecord.data as Prisma.InputJsonValue,
            confirmed: false,
          },
        });
        complianceRecordId = created.id;
      }

      await recordAuditEvent(tx, {
        farmId: farm.id,
        actorUserId,
        entityType: 'Activity',
        entityId: reversed.id,
        action: 'reversed',
        source: 'web',
        correlationId,
        previousVersionId: previous.id,
        reason: d.reason,
        metadata: { idempotencyKey: d.idempotencyKey },
      });
      if (complianceRecordId) {
        await recordAuditEvent(tx, {
          farmId: farm.id, actorUserId, entityType: 'ComplianceRecord', entityId: complianceRecordId,
          action: 'verification_status_changed', source: 'web', correlationId, metadata: { newStatus: 'reversed' },
        });
      }
      for (const movementId of stockMovementIds) {
        await recordAuditEvent(tx, {
          farmId: farm.id, actorUserId, entityType: 'StockMovement', entityId: movementId,
          action: 'inventory_adjusted', source: 'web', correlationId,
        });
      }

      return { reversedActivityId: reversed.id };
    });

    revalidatePath('/compliance');
    revalidatePath('/activities');
    revalidatePath('/inventory');
    return { success: true, reversedActivityId: result.reversedActivityId };
  } catch (e) {
    if (e instanceof StaleVersionError) return { error: e.message };
    return { error: handleActionError('reverseActivity', e).message };
  }
}
