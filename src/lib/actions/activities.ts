'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { handleActionError, userError, type UserFacingError } from '@/lib/user-error';
import { logProductEvent } from '@/lib/product-events';
import { fetchWeather, windDirectionLabel } from '@/lib/weather';
import { getAmsterdamDateString } from '@/lib/spray-window';
import { recordAuditEvent, newCorrelationId } from '@/lib/audit';
import { buildCtgbSnapshotExtra } from '@/lib/ctgb-snapshot';
import { createHash } from 'node:crypto';
import { recordActivityInputEconomics, recordActivityOperationalEconomics } from '@/lib/economics-recording';

const FALLBACK_LAT = parseFloat(process.env.NEXT_PUBLIC_FARM_LATITUDE ?? '51.9652');
const FALLBACK_LON = parseFloat(process.env.NEXT_PUBLIC_FARM_LONGITUDE ?? '5.9307');

// Base shape is intentionally permissive — DB-required columns (operatorName,
// areaHa) get safe defaults here, and the *actual* per-type requirements
// (Sprint 11 Parts 4–6: spray needs product/dose/water volume/machine/nozzle;
// fertilise needs product/quantity; scout needs only field+date+category)
// are enforced below in .superRefine(), so each activity type only demands
// what it genuinely needs — not one universal required-field list.
const CreateActivitySchema = z.object({
  workOrderId: z.string().uuid().optional().or(z.literal('')),
  workOrderVersion: z.coerce.number().int().positive().optional(),
  localDraftId: z.string().uuid().optional().or(z.literal('')),
  idempotencyKey: z.string().uuid().optional().or(z.literal('')),
  fieldSeasonId: z.string().uuid(),
  type: z.enum([
    'spray', 'fertilise', 'harvest', 'tillage',
    'sow', 'irrigate', 'scout', 'soil_sample', 'other',
  ]),
  date: z.string().date(),
  // Required for spray (enforced below), optional/blank ("not recorded")
  // for everything else — the DB column is NOT NULL, so an empty string
  // (not undefined) is the honest "not recorded" value, never a guess.
  operatorName: z.string().max(100).default(''),
  // Dutch RVO compliance
  certificateNumber: z.string().max(50).optional().or(z.literal('')),
  waterVolumePerHa: z.coerce.number().positive().max(2000).optional().or(z.literal('')),
  nozzleType: z.string().max(50).optional().or(z.literal('')),
  machineId: z.string().uuid().optional().or(z.literal('')),
  actualHours: z.coerce.number().positive().max(9999).optional().or(z.literal('')),
  machineHours: z.coerce.number().positive().max(9999).optional().or(z.literal('')),
  fuelUsed: z.coerce.number().positive().max(999999).optional().or(z.literal('')),
  fuelInventoryItemId: z.string().uuid().optional().or(z.literal('')),
  // Area and product
  areaHa: z.coerce.number().positive().max(9999),
  productId: z.string().uuid().optional().or(z.literal('')),
  dosePerHa: z.coerce.number().positive().max(9999).optional().or(z.literal('')),
  doseUnit: z.string().max(10).optional().or(z.literal('')),
  // Weather
  weatherTempC: z.coerce.number().min(-30).max(60).optional().or(z.literal('')),
  // Not .int() — wind speed is fractional everywhere else in the app
  // (spray-window.ts, Open-Meteo), and an overly strict whole-number-only
  // rule here silently rejected a plausible farmer-entered reading like
  // "10.5" with no obvious explanation.
  weatherWindKmh: z.coerce.number().min(0).max(200).optional().or(z.literal('')),
  weatherWindDir: z.string().max(3).optional().or(z.literal('')),
  weatherHumidity: z.coerce.number().int().min(0).max(100).optional().or(z.literal('')),
  // Sprint 19 — BBCH growth stage at the time of this specific application.
  bbchStage: z.coerce.number().int().min(0).max(99).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  // 'planned' = a future intent to act: no stock deducted, no compliance
  // record created yet. 'completed' (default, and the only behavior that
  // existed before Sprint 16) deducts stock and creates the compliance
  // record immediately, exactly as it always has.
  status: z.enum(['planned', 'completed']).default('completed'),
}).superRefine((data, ctx) => {
  if (data.type === 'spray') {
    if (!data.operatorName) ctx.addIssue({ code: 'custom', path: ['operatorName'], message: 'Operator is required for spraying.' });
    if (!data.machineId) ctx.addIssue({ code: 'custom', path: ['machineId'], message: 'Select the sprayer used.' });
    if (!data.nozzleType) ctx.addIssue({ code: 'custom', path: ['nozzleType'], message: 'Select a nozzle type.' });
    if (!data.productId) ctx.addIssue({ code: 'custom', path: ['productId'], message: 'Select a product.' });
    if (!data.dosePerHa) ctx.addIssue({ code: 'custom', path: ['dosePerHa'], message: 'Enter a dose.' });
    if (!data.doseUnit) ctx.addIssue({ code: 'custom', path: ['doseUnit'], message: 'Select a dose unit.' });
    if (!data.waterVolumePerHa) ctx.addIssue({ code: 'custom', path: ['waterVolumePerHa'], message: 'Enter the water volume per hectare.' });
  }
  if (data.type === 'fertilise') {
    if (!data.productId) ctx.addIssue({ code: 'custom', path: ['productId'], message: 'Select a fertiliser product.' });
    if (!data.dosePerHa) ctx.addIssue({ code: 'custom', path: ['dosePerHa'], message: 'Enter a quantity.' });
    if (!data.doseUnit) ctx.addIssue({ code: 'custom', path: ['doseUnit'], message: 'Select a unit.' });
  }
});

export type ActivityFormState = {
  error?: UserFacingError;
  fieldErrors?: Record<string, UserFacingError>;
  success?: boolean;
  activityId?: string;
  safeErrorCategory?: 'authorization' | 'validation' | 'conflict' | 'insufficient_stock' | 'stale_reference' | 'server';
};

function activityValidationErrors(error: z.ZodError): Record<string, UserFacingError> {
  const fieldErrors: Record<string, UserFacingError> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.');
    if (!field || fieldErrors[field]) continue;
    const code = field === 'type' || field === 'status' ? 'INVALID_ENUM'
      : field === 'date' ? 'INVALID_DATE'
        : ['areaHa', 'dosePerHa', 'waterVolumePerHa', 'actualHours', 'machineHours', 'fuelUsed', 'weatherTempC', 'weatherWindKmh', 'weatherHumidity', 'bbchStage'].includes(field) ? 'INVALID_QUANTITY'
          : issue.code === 'too_small' || issue.code === 'custom' ? 'REQUIRED_FIELD' : 'INVALID_VALUE';
    fieldErrors[field] = userError(code, { field });
  }
  return fieldErrors;
}

function safeActivityError(context: string, error: unknown, correlationId: string): UserFacingError {
  const { message: _legacy, ...safe } = handleActionError(context, error, correlationId);
  return safe;
}

function legacyCategory(error: UserFacingError): ActivityFormState['safeErrorCategory'] {
  if (error.code === 'INSUFFICIENT_STOCK') return 'insufficient_stock';
  if (error.code === 'SYNC_CONFLICT' || error.category === 'conflict') return 'conflict';
  if (error.category === 'authorization' || error.category === 'authentication' || error.category === 'not_found') return 'authorization';
  if (error.category === 'validation') return 'validation';
  return 'server';
}

function submissionHash(data: z.infer<typeof CreateActivitySchema>): string {
  const canonical = Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => key !== 'idempotencyKey' && key !== 'localDraftId')
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export async function createActivity(
  _prev: ActivityFormState,
  formData: FormData
): Promise<ActivityFormState> {
  const raw = Object.fromEntries(formData);
  const parsed = CreateActivitySchema.safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: activityValidationErrors(parsed.error) };
  }

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: userError('AUTH_REQUIRED'), safeErrorCategory: 'authorization' };
  }

  const d = parsed.data;
  const actorUserId = await getClerkUserId();
  const correlationId = newCorrelationId();
  const payloadHash = submissionHash(d);

  if (d.idempotencyKey || d.localDraftId) {
    const existing = await db.activity.findFirst({
      where: {
        OR: [
          ...(d.idempotencyKey ? [{ idempotencyKey: d.idempotencyKey }] : []),
          ...(d.localDraftId ? [{ offlineDraftId: d.localDraftId }] : []),
        ],
        fieldSeason: { field: { farmId: farm.id } },
      },
      select: { id: true, submissionHash: true },
    });
    if (existing) {
      if (existing.submissionHash !== payloadHash) {
        return { error: userError('SYNC_CONFLICT'), safeErrorCategory: 'conflict' };
      }
      return { success: true, activityId: existing.id };
    }
  }

  // Only used to tell whether this is the farm's very first activity, for
  // the first_activity_* product events below — not a business rule.
  const priorActivityCount = await db.activity.count({
    where: { fieldSeason: { field: { farmId: farm.id } }, deletedAt: null },
  });
  const isFirstActivity = priorActivityCount === 0;

  if (isFirstActivity) {
    logProductEvent({ event: 'first_activity_started', farmId: farm.id, activityType: d.type });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // 1. Verify fieldSeason belongs to this farm — inside transaction for consistency
      const fieldSeason = await tx.fieldSeason.findFirst({
        where: {
          id: d.fieldSeasonId,
          field: { farmId: farm.id, deletedAt: null },
        },
        include: {
          field: { select: { name: true, hectares: true } },
          season: { select: { year: true } },
        },
      });
      if (!fieldSeason) {
        throw new Error('Field not found or does not belong to this farm.');
      }

      const workOrder = d.workOrderId ? await tx.workOrder.findFirst({
        where: { id: d.workOrderId, farmId: farm.id, fieldSeasonId: d.fieldSeasonId, status: { in: ['ready', 'assigned', 'in_progress'] } },
      }) : null;
      if (d.workOrderId && !workOrder) throw new Error('Work order not found or does not match this field season.');
      if (workOrder?.completedActivityId) throw new Error('This work order already has an actual activity.');
      if (workOrder && d.workOrderVersion != null && workOrder.version !== d.workOrderVersion) throw new Error('This work order changed while you were reviewing it. Reopen the match before saving.');
      if (workOrder && workOrder.operationType !== d.type) throw new Error('The Activity type conflicts with the selected work order.');
      if (workOrder && d.status !== 'completed') throw new Error('A work order can only be linked to a completed actual activity.');

      // 2. Verify product ownership and check stock sufficiency (early read for error message)
      let productSnapshot: {
        name: string;
        registrationNumber: string | null;
        currentStock: number;
        farmId: string;
        // Sprint 18 — a frozen-at-this-moment Ctgb snapshot, only present
        // when the product is Ctgb-linked. Never re-read later — see
        // docs/Sprint_18_Ctgb_BRP_Report.md Part 5 (historical compliance
        // records must not silently change when Ctgb data changes).
        ctgb: {
          authorisationStatus: string;
          sourceUrl: string;
          fetchedAt: string;
        } | null;
        // Sprint 19 Part 7 — the full reference row (with uses), so the
        // richer snapshot below can compute a selected use / compliance
        // status, not just the narrow 3-field Sprint 18 snapshot.
        ctgbFullRow: Parameters<typeof buildCtgbSnapshotExtra>[0];
        unit: string;
        unitCost: number | null;
        valuationEffectiveAt: Date | null;
      } | null = null;

      if (d.productId && d.dosePerHa && d.areaHa) {
        const item = await tx.inventoryItem.findFirst({
          where: { id: d.productId },
          select: {
            name: true, registrationNumber: true, currentStock: true, farmId: true, unit: true, purchasePricePerUnit: true, valuationEffectiveAt: true,
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

        const totalUsed = d.dosePerHa * d.areaHa;
        // Application-level pre-check for a friendly error message — only
        // for a completed activity. A planned one records a future intent;
        // stock may well change (restock, other usage) before it's actually
        // completed, so current stock is not a valid reason to block saving
        // the plan itself.
        if (d.status === 'completed' && Number(item.currentStock) < totalUsed) {
          throw new Error(
            `Insufficient stock for ${item.name}: ` +
            `${Number(item.currentStock).toFixed(3)} available, ` +
            `${totalUsed.toFixed(3)} required.`
          );
        }

        productSnapshot = {
          name: item.name,
          registrationNumber: item.registrationNumber,
          currentStock: Number(item.currentStock),
          farmId: item.farmId,
          unit: item.unit,
          unitCost: item.purchasePricePerUnit == null ? null : Number(item.purchasePricePerUnit),
          valuationEffectiveAt: item.valuationEffectiveAt,
          ctgb: item.ctgbProductReference
            ? {
                authorisationStatus: item.ctgbProductReference.authorisationStatus,
                sourceUrl: item.ctgbProductReference.sourceUrl,
                fetchedAt: item.ctgbProductReference.fetchedAt.toISOString(),
              }
            : null,
          ctgbFullRow: item.ctgbProductReference ?? null,
        };
      }

      // 2b. Verify machine ownership — Sprint 12 finding: this check was
      // missing entirely (fieldSeason and product were already verified,
      // machineId was not), so a crafted request with another farm's
      // machine id would have been silently attached with no rejection.
      let machineName: string | null = null;
      if (d.machineId) {
        const machine = await tx.machine.findFirst({
          where: { id: d.machineId },
          select: { farmId: true, name: true },
        });
        if (!machine) throw new Error('Machine not found.');
        if (machine.farmId !== farm.id) throw new Error('Machine does not belong to this farm.');
        machineName = machine.name;
      }
      if (d.fuelInventoryItemId) {
        const fuel = await tx.inventoryItem.findFirst({ where: { id: d.fuelInventoryItemId, farmId: farm.id, category: 'fuel' }, select: { unit: true } });
        if (!fuel) throw new Error('Fuel inventory item does not belong to this farm.');
        if (fuel.unit !== 'L') throw new Error('Fuel inventory must be recorded in litres.');
      }
      if (d.fuelUsed && !d.fuelInventoryItemId) throw new Error('Select the fuel inventory item used.');

      // 3. Create the activity record
      const activity = await tx.activity.create({
        data: {
          fieldSeasonId: d.fieldSeasonId,
          type: d.type,
          status: d.status,
          date: new Date(d.date),
          operatorName: d.operatorName,
          certificateNumber: d.certificateNumber || null,
          waterVolumePerHa: d.waterVolumePerHa || null,
          nozzleType: d.nozzleType || null,
          machineId: d.machineId || null,
          actualHours: d.actualHours || null,
          machineHours: d.machineHours || null,
          fuelUsed: d.fuelUsed || null,
          fuelInventoryItemId: d.fuelInventoryItemId || null,
          areaHa: d.areaHa,
          productId: d.productId || null,
          dosePerHa: d.dosePerHa || null,
          doseUnit: d.doseUnit || null,
          weatherTempC: d.weatherTempC || null,
          // Column is SmallInt — round the (now decimal-permitting) input.
          weatherWindKmh: d.weatherWindKmh ? Math.round(d.weatherWindKmh) : null,
          weatherWindDir: d.weatherWindDir || null,
          weatherHumidity: d.weatherHumidity || null,
          bbchStage: d.bbchStage || null,
          notes: d.notes || null,
          offlineDraftId: d.localDraftId || null,
          idempotencyKey: d.idempotencyKey || null,
          submissionHash: d.idempotencyKey || d.localDraftId ? payloadHash : null,
          syncCorrelationId: d.idempotencyKey || d.localDraftId ? correlationId : null,
        },
      });

      // 4. Auto-generate EU spray diary compliance record — denormalize
      // required fields. Only for a completed activity: a compliance record
      // asserts something actually happened, which is not true yet for a
      // planned one (see completeActivity, which creates it later).
      let complianceRecordId: string | null = null;
      if (d.type === 'spray' && d.status === 'completed') {
        const ctgbExtra = buildCtgbSnapshotExtra(
          productSnapshot?.ctgbFullRow ?? null,
          fieldSeason.crop,
          d.dosePerHa || null,
          d.doseUnit || null,
        );
        const created = await tx.complianceRecord.create({
          data: {
            activityId: activity.id,
            framework: 'EU_SPRAY_DIARY_2009_128_EC',
            data: {
              // Denormalized snapshot — survives future renames/deletes
              fieldName: fieldSeason.field.name,
              fieldHectares: String(fieldSeason.field.hectares),
              crop: fieldSeason.crop,
              seasonYear: fieldSeason.season.year,
              date: d.date,
              operatorName: d.operatorName,
              certificateNumber: d.certificateNumber || null,
              areaHa: d.areaHa,
              waterVolumePerHa: d.waterVolumePerHa || null,
              nozzleType: d.nozzleType || null,
              machineName,
              bbchStage: d.bbchStage || null,
              productName: productSnapshot?.name || null,
              productRegistrationNumber: productSnapshot?.registrationNumber || null,
              // Sprint 18 — frozen at completion time. A later Ctgb update
              // (or re-sync) must never rewrite this record — see Part 5.
              ctgbAuthorisationStatusAtCompletion: productSnapshot?.ctgb?.authorisationStatus ?? null,
              ctgbSourceUrl: productSnapshot?.ctgb?.sourceUrl ?? null,
              ctgbFetchedAt: productSnapshot?.ctgb?.fetchedAt ?? null,
              // Sprint 19 Part 7 — the richer snapshot alongside the 3
              // narrower Sprint 18 fields above.
              ...ctgbExtra,
              dosePerHa: d.dosePerHa || null,
              doseUnit: d.doseUnit || null,
              weatherTempC: d.weatherTempC || null,
              weatherWindKmh: d.weatherWindKmh || null,
              weatherWindDir: d.weatherWindDir || null,
              weatherHumidity: d.weatherHumidity || null,
              notes: d.notes || null,
            },
            confirmed: false,
          },
        });
        complianceRecordId = created.id;
      }

      // 5. Atomic stock deduction — DB-level check prevents races and
      // negative stock. Only for a completed activity: a planned one has
      // not consumed anything yet.
      let stockMovementId: string | null = null;
      if (d.productId && d.dosePerHa && d.areaHa && d.status === 'completed') {
        const totalUsed = d.dosePerHa * d.areaHa;

        // Raw UPDATE with WHERE currentStock >= totalUsed is atomic.
        // Returns 0 if stock was exhausted by a concurrent transaction.
        const rowsUpdated = await tx.$executeRaw`
          UPDATE inventory_items
          SET "currentStock" = "currentStock" - ${totalUsed}::numeric,
              "updatedAt"    = NOW()
          WHERE id = ${d.productId}
            AND "farmId" = ${farm.id}
            AND "currentStock" >= ${totalUsed}::numeric
        `;

        if (rowsUpdated === 0) {
          // Another transaction consumed the stock between our read and this write
          throw new Error(
            `Stock was exhausted by a concurrent update. ` +
            `Please check current inventory levels and try again.`
          );
        }

        const movement = await tx.stockMovement.create({
          data: {
            inventoryItemId: d.productId,
            activityId: activity.id,
            quantity: totalUsed,
            direction: 'out',
            correlationId,
          },
        });
        stockMovementId = movement.id;
      }

      // Sprint 19 Part 2 — one audit event per entity actually touched by
      // this transaction, all sharing `correlationId` so a reviewer can
      // reconstruct the whole business transaction from any one of them
      // (Part 17 test 2).
      await recordAuditEvent(tx, {
        farmId: farm.id,
        actorUserId,
        entityType: 'Activity',
        entityId: activity.id,
        action: d.status === 'planned' ? 'planned' : 'completed',
        source: d.idempotencyKey || d.localDraftId ? 'offline_sync' : 'web',
        correlationId,
        metadata: { activityType: d.type },
      });
      if (complianceRecordId) {
        await recordAuditEvent(tx, {
          farmId: farm.id,
          actorUserId,
          entityType: 'ComplianceRecord',
          entityId: complianceRecordId,
          action: 'compliance_snapshot_created',
          source: d.idempotencyKey || d.localDraftId ? 'offline_sync' : 'web',
          correlationId,
        });
      }
      if (stockMovementId) {
        await recordAuditEvent(tx, {
          farmId: farm.id,
          actorUserId,
          entityType: 'StockMovement',
          entityId: stockMovementId,
          action: 'inventory_adjusted',
          source: d.idempotencyKey || d.localDraftId ? 'offline_sync' : 'web',
          correlationId,
        });
      }
      if (d.status === 'completed' && d.productId && d.dosePerHa && productSnapshot) {
        await recordActivityInputEconomics(tx, { farmId: farm.id, seasonId: fieldSeason.seasonId, fieldSeasonId: fieldSeason.id, fieldId: fieldSeason.fieldId, crop: fieldSeason.crop, activityId: activity.id, inventoryItemId: d.productId, productName: productSnapshot.name, quantity: d.dosePerHa * d.areaHa, unit: productSnapshot.unit, unitCost: productSnapshot.unitCost, priceEffectiveDate: productSnapshot.valuationEffectiveAt, currency: farm.currency, costDate: new Date(d.date), correlationId });
      }

      if (workOrder) {
        await tx.workOrder.update({ where: { id: workOrder.id }, data: {
          status: 'completed', completedActivityId: activity.id, blockerReason: null, version: { increment: 1 },
        } });
        await tx.inventoryReservation.updateMany({ where: { workOrderId: workOrder.id, status: 'active' }, data: { status: 'consumed', releasedAt: new Date() } });
        if (workOrder.sourcePlanItemId) await tx.seasonPlanItem.update({ where: { id: workOrder.sourcePlanItemId }, data: { status: 'completed' } });
        await recordAuditEvent(tx, { farmId: farm.id, actorUserId, entityType: 'WorkOrder', entityId: workOrder.id, action: 'completed', source: d.idempotencyKey || d.localDraftId ? 'offline_sync' : 'web', correlationId, metadata: { activityId: activity.id } });
      }
      if (d.status === 'completed') await recordActivityOperationalEconomics(tx, { activityId: activity.id, farmId: farm.id, currency: farm.currency, correlationId });

      return { activityId: activity.id };
    });

    revalidatePath('/activities');
    revalidatePath('/dashboard');
    revalidatePath('/work-orders');
    revalidatePath('/planning');
    logProductEvent({ event: 'activity_created', farmId: farm.id, activityType: d.type, success: true });
    if (isFirstActivity) {
      logProductEvent({ event: 'first_activity_completed', farmId: farm.id, activityType: d.type, success: true });
    }
    return { success: true, activityId: result.activityId };
  } catch (e) {
    // A concurrent retry can lose the unique-index race after the first
    // transaction commits. Resolve it as the same idempotent receipt.
    if (d.idempotencyKey || d.localDraftId) {
      const existing = await db.activity.findFirst({
        where: {
          OR: [
            ...(d.idempotencyKey ? [{ idempotencyKey: d.idempotencyKey }] : []),
            ...(d.localDraftId ? [{ offlineDraftId: d.localDraftId }] : []),
          ],
          fieldSeason: { field: { farmId: farm.id } },
        },
        select: { id: true, submissionHash: true },
      });
      if (existing?.submissionHash === payloadHash) return { success: true, activityId: existing.id };
      if (existing) return { error: userError('SYNC_CONFLICT'), safeErrorCategory: 'conflict' };
    }
    const safe = safeActivityError('createActivity', e, correlationId);
    logProductEvent({
      event: 'activity_failed',
      farmId: farm.id,
      activityType: d.type,
      success: false,
      errorCategory: safe.category,
    });
    if (isFirstActivity) {
      logProductEvent({
        event: 'first_activity_failed',
        farmId: farm.id,
        activityType: d.type,
        success: false,
        errorCategory: safe.category,
      });
    }
    return { error: safe, safeErrorCategory: legacyCategory(safe) };
  }
}

/**
 * Sprint 19 Part 6/9 finding: this action used to soft-delete a `completed`
 * activity exactly like a `planned` one — no reason, no audit trail, and
 * (per docs/Sprint_19_Compliance_Audit.md §3) a silent, unaudited way to
 * make a regulated record disappear from the farmer-facing activity list.
 * A `completed` activity now MUST go through `reverseActivity` instead,
 * which requires a reason, creates a compensating stock movement without
 * touching the original, and records an audit event. This action still
 * handles `planned` activities exactly as before — nothing regulated has
 * happened yet for those, so plain removal remains appropriate.
 */
export async function deleteActivity(id: string): Promise<{ error?: UserFacingError }> {
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: userError('AUTH_REQUIRED') };
  }
  const actorUserId = await getClerkUserId();
  const correlationId = newCorrelationId();

  try {
    await db.$transaction(async (tx) => {
      const activity = await tx.activity.findFirst({
        where: {
          id,
          fieldSeason: { field: { farmId: farm.id } },
          deletedAt: null,
        },
        include: {
          // Find outbound stock movements to reverse
          stockMovements: { where: { direction: 'out' } },
        },
      });

      if (!activity) throw new Error('Activity not found or already deleted.');
      if (activity.status === 'completed') {
        throw new Error(
          'Completed activities cannot be deleted directly. Use "Reverse" from the Compliance page ' +
          'to record why this application did not happen or was recorded in error.',
        );
      }

      // Reverse stock for each outbound movement
      for (const movement of activity.stockMovements) {
        const qty = Number(movement.quantity);

        await tx.$executeRaw`
          UPDATE inventory_items
          SET "currentStock" = "currentStock" + ${qty}::numeric,
              "updatedAt"    = NOW()
          WHERE id = ${movement.inventoryItemId}
        `;

        await tx.stockMovement.create({
          data: {
            inventoryItemId: movement.inventoryItemId,
            activityId: activity.id,
            quantity: qty,
            direction: 'correction',
            notes: 'Stock restored: activity soft-deleted',
            correlationId,
          },
        });
      }

      // Soft delete — ComplianceRecords are preserved (RESTRICT FK prevents hard delete)
      await tx.activity.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await recordAuditEvent(tx, {
        farmId: farm.id,
        actorUserId,
        entityType: 'Activity',
        entityId: activity.id,
        action: 'archived',
        source: 'web',
        correlationId,
      });
    });
  } catch (e) {
    return { error: safeActivityError('deleteActivity', e, correlationId) };
  }

  revalidatePath('/activities');
  return {};
}

/**
 * Transitions a 'planned' activity to 'completed' — the moment stock is
 * actually deducted and (for spray) a compliance record is actually
 * created, using a fresh weather snapshot captured now rather than the
 * estimate that was current when the activity was planned. A 'completed'
 * activity cannot be re-completed; this only ever moves one direction.
 */
export async function completeActivity(id: string): Promise<{ error?: UserFacingError; success?: boolean }> {
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: userError('AUTH_REQUIRED') };
  }
  const actorUserId = await getClerkUserId();
  const correlationId = newCorrelationId();

  try {
    await db.$transaction(async (tx) => {
      const activity = await tx.activity.findFirst({
        where: { id, fieldSeason: { field: { farmId: farm.id } }, deletedAt: null },
        include: {
          fieldSeason: {
            include: {
              field: { select: { name: true, hectares: true } },
              season: { select: { year: true } },
            },
          },
          machine: { select: { name: true } },
          product: {
            select: {
              name: true, registrationNumber: true, currentStock: true, farmId: true, unit: true, purchasePricePerUnit: true, valuationEffectiveAt: true,
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
          },
        },
      });
      if (!activity) throw new Error('Activity not found or does not belong to this farm.');
      if (activity.status !== 'planned') throw new Error('Only a planned activity can be marked completed.');

      // Fresh weather snapshot at completion time — the conditions estimated
      // when this was planned are not the conditions the application
      // actually happened in.
      let freshWeather: {
        weatherTempC: number;
        weatherWindKmh: number;
        weatherWindDir: string;
        weatherHumidity: number;
      } | null = null;
      try {
        const lat = farm.latitude != null ? Number(farm.latitude) : FALLBACK_LAT;
        const lon = farm.longitude != null ? Number(farm.longitude) : FALLBACK_LON;
        const weather = await fetchWeather(lat, lon);
        const today = getAmsterdamDateString();
        const currentHour = weather.hourly.find((h) => h.time.startsWith(today));
        if (currentHour) {
          freshWeather = {
            weatherTempC: currentHour.temperature,
            weatherWindKmh: Math.round(currentHour.windSpeed),
            weatherWindDir: windDirectionLabel(currentHour.windDirection),
            weatherHumidity: Math.round(currentHour.relativeHumidity),
          };
        }
      } catch {
        // Weather unavailable at completion time — keep whatever snapshot
        // was recorded at planning time rather than fail the whole action.
      }

      const now = new Date();
      let productSnapshot: {
        name: string;
        registrationNumber: string | null;
        unit: string;
        unitCost: number | null;
        valuationEffectiveAt: Date | null;
        ctgb: { authorisationStatus: string; sourceUrl: string; fetchedAt: string } | null;
        ctgbFullRow: Parameters<typeof buildCtgbSnapshotExtra>[0];
      } | null = null;
      let stockMovementId: string | null = null;

      // Deduct stock now — this is the moment it is actually consumed.
      if (activity.productId && activity.dosePerHa && activity.areaHa) {
        if (!activity.product || activity.product.farmId !== farm.id) {
          throw new Error('Product does not belong to this farm.');
        }
        const totalUsed = Number(activity.dosePerHa) * Number(activity.areaHa);
        if (Number(activity.product.currentStock) < totalUsed) {
          throw new Error(
            `Insufficient stock for ${activity.product.name}: ` +
            `${Number(activity.product.currentStock).toFixed(3)} available, ` +
            `${totalUsed.toFixed(3)} required.`
          );
        }

        const rowsUpdated = await tx.$executeRaw`
          UPDATE inventory_items
          SET "currentStock" = "currentStock" - ${totalUsed}::numeric,
              "updatedAt"    = NOW()
          WHERE id = ${activity.productId}
            AND "farmId" = ${farm.id}
            AND "currentStock" >= ${totalUsed}::numeric
        `;
        if (rowsUpdated === 0) {
          throw new Error(
            `Stock was exhausted by a concurrent update. ` +
            `Please check current inventory levels and try again.`
          );
        }

        const movement = await tx.stockMovement.create({
          data: {
            inventoryItemId: activity.productId,
            activityId: activity.id,
            quantity: totalUsed,
            direction: 'out',
            correlationId,
          },
        });
        stockMovementId = movement.id;
        productSnapshot = {
          name: activity.product.name,
          registrationNumber: activity.product.registrationNumber,
          unit: activity.product.unit,
          unitCost: activity.product.purchasePricePerUnit == null ? null : Number(activity.product.purchasePricePerUnit),
          valuationEffectiveAt: activity.product.valuationEffectiveAt,
          ctgb: activity.product.ctgbProductReference
            ? {
                authorisationStatus: activity.product.ctgbProductReference.authorisationStatus,
                sourceUrl: activity.product.ctgbProductReference.sourceUrl,
                fetchedAt: activity.product.ctgbProductReference.fetchedAt.toISOString(),
              }
            : null,
          ctgbFullRow: activity.product.ctgbProductReference ?? null,
        };
      }

      // Create the compliance record now — this is the first moment the
      // activity represents something that actually happened.
      let complianceRecordId: string | null = null;
      if (activity.type === 'spray') {
        const ctgbExtra = buildCtgbSnapshotExtra(
          productSnapshot?.ctgbFullRow ?? null,
          activity.fieldSeason.crop,
          activity.dosePerHa ? Number(activity.dosePerHa) : null,
          activity.doseUnit,
        );
        const created = await tx.complianceRecord.create({
          data: {
            activityId: activity.id,
            framework: 'EU_SPRAY_DIARY_2009_128_EC',
            data: {
              fieldName: activity.fieldSeason.field.name,
              fieldHectares: String(activity.fieldSeason.field.hectares),
              crop: activity.fieldSeason.crop,
              seasonYear: activity.fieldSeason.season.year,
              date: now.toISOString().slice(0, 10),
              operatorName: activity.operatorName,
              certificateNumber: activity.certificateNumber,
              areaHa: Number(activity.areaHa),
              waterVolumePerHa: activity.waterVolumePerHa ? Number(activity.waterVolumePerHa) : null,
              nozzleType: activity.nozzleType,
              machineName: activity.machine?.name ?? null,
              bbchStage: activity.bbchStage,
              productName: productSnapshot?.name ?? null,
              productRegistrationNumber: productSnapshot?.registrationNumber ?? null,
              ctgbAuthorisationStatusAtCompletion: productSnapshot?.ctgb?.authorisationStatus ?? null,
              ctgbSourceUrl: productSnapshot?.ctgb?.sourceUrl ?? null,
              ctgbFetchedAt: productSnapshot?.ctgb?.fetchedAt ?? null,
              ...ctgbExtra,
              dosePerHa: activity.dosePerHa ? Number(activity.dosePerHa) : null,
              doseUnit: activity.doseUnit,
              weatherTempC: freshWeather?.weatherTempC ?? (activity.weatherTempC ? Number(activity.weatherTempC) : null),
              weatherWindKmh: freshWeather?.weatherWindKmh ?? activity.weatherWindKmh,
              weatherWindDir: freshWeather?.weatherWindDir ?? activity.weatherWindDir,
              weatherHumidity: freshWeather?.weatherHumidity ?? activity.weatherHumidity,
              notes: activity.notes,
            },
            confirmed: false,
          },
        });
        complianceRecordId = created.id;
      }

      await tx.activity.update({
        where: { id },
        data: {
          status: 'completed',
          date: now,
          ...(freshWeather ?? {}),
        },
      });

      await recordAuditEvent(tx, {
        farmId: farm.id,
        actorUserId,
        entityType: 'Activity',
        entityId: activity.id,
        action: 'completed',
        source: 'web',
        correlationId,
        metadata: { activityType: activity.type },
      });
      if (complianceRecordId) {
        await recordAuditEvent(tx, {
          farmId: farm.id,
          actorUserId,
          entityType: 'ComplianceRecord',
          entityId: complianceRecordId,
          action: 'compliance_snapshot_created',
          source: 'web',
          correlationId,
        });
      }
      if (stockMovementId) {
        await recordAuditEvent(tx, {
          farmId: farm.id,
          actorUserId,
          entityType: 'StockMovement',
          entityId: stockMovementId,
          action: 'inventory_adjusted',
          source: 'web',
          correlationId,
        });
      }
      if (activity.productId && activity.dosePerHa && productSnapshot) {
        await recordActivityInputEconomics(tx, { farmId: farm.id, seasonId: activity.fieldSeason.seasonId, fieldSeasonId: activity.fieldSeasonId, fieldId: activity.fieldSeason.fieldId, crop: activity.fieldSeason.crop, activityId: activity.id, inventoryItemId: activity.productId, productName: productSnapshot.name, quantity: Number(activity.dosePerHa) * Number(activity.areaHa), unit: productSnapshot.unit, unitCost: productSnapshot.unitCost, priceEffectiveDate: productSnapshot.valuationEffectiveAt, currency: farm.currency, costDate: now, correlationId });
      }
      await recordActivityOperationalEconomics(tx, { activityId: activity.id, farmId: farm.id, currency: farm.currency, correlationId });
    });
  } catch (e) {
    return { error: safeActivityError('completeActivity', e, correlationId) };
  }

  revalidatePath('/activities');
  revalidatePath('/dashboard');
  return { success: true };
}
