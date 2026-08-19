'use server';

import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { recordAuditEvent } from '@/lib/audit';
import { OBSERVATION_CATEGORIES } from '@/lib/scouting/categories';
import { CROP_CONDITIONS, normalizeCropCondition } from '@/lib/scouting/condition';
import { friendlyScoutingIssue } from '@/lib/scouting/scouting-errors';

const observationSchema = z.object({ category: z.enum(OBSERVATION_CATEGORIES), issueType: z.string().trim().min(1).max(120), certainty: z.enum(['symptom_observed','suspected_cause','farmer_confirmed','agronomist_confirmed','laboratory_confirmed','ai_suggestion']).default('symptom_observed'), severity: z.enum(['low','moderate','high','critical']), affectedAreaHa: z.number().nonnegative().optional(), affectedPercent: z.number().min(0).max(100).optional(), confidence: z.enum(['low','medium','high']).default('medium'), description: z.string().trim().min(1).max(2000) });
// Overall condition is the canonical, language-independent enum. Legacy/aliased
// inputs (e.g. the pre-standardisation `fair`) are normalised before the enum
// check; browser-translated labels normalise to null and are rejected — but the
// farmer never sees the raw "expected one of ..." message (see friendlyIssue).
const conditionField = z.preprocess((v) => (typeof v === 'string' ? normalizeCropCondition(v) ?? v : v), z.enum(CROP_CONDITIONS).optional());
const visitSchema = z.object({ fieldSeasonId: z.string().uuid(), visitDate: z.coerce.date(), source: z.enum(['manual','work_order','imported']).default('manual'), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), locationAccuracyM: z.number().nonnegative().optional(), overallCondition: conditionField, notes: z.string().trim().max(4000).optional(), stageCode: z.string().trim().max(20).optional(), stageLabel: z.string().trim().max(120).optional(), stageSystem: z.string().trim().max(30).default('BBCH'), observations: z.array(observationSchema).min(1).max(20), localVisitId: z.string().uuid().optional() });

export type CreateScoutingVisitInput = z.input<typeof visitSchema>;

export async function createScoutingVisit(input: CreateScoutingVisitInput): Promise<{ success?: true; id?: string; observationIds?: string[]; error?: string }> {
  const parsed = visitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0] ? friendlyScoutingIssue(parsed.error.issues[0]) : 'Please review the scouting visit before saving.' };
  const farm = await getActiveFarmOrThrow();
  const actor = await getClerkUserId() ?? farm.clerkUserId;
  const data = parsed.data;
  const fieldSeason = await db.fieldSeason.findFirst({ where: { id: data.fieldSeasonId, field: { farmId: farm.id, deletedAt: null } }, select: { id: true, fieldId: true } });
  if (!fieldSeason) return { error: 'Field season not found.' };
  if (Boolean(data.stageCode) !== Boolean(data.stageLabel)) return { error: 'Growth-stage code and label must be recorded together.' };
  const submissionHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  try {
    const id = await db.$transaction(async (tx) => {
      if (data.localVisitId) {
        const existing = await tx.scoutingVisit.findUnique({ where: { localVisitId: data.localVisitId } });
        if (existing) {
          if (existing.farmId !== farm.id || existing.submissionHash !== submissionHash) throw new Error('Offline visit conflict requires review.');
          return existing.id;
        }
      }
      const visit = await tx.scoutingVisit.create({ data: { farmId: farm.id, fieldId: fieldSeason.fieldId, fieldSeasonId: fieldSeason.id, visitDate: data.visitDate, observerId: actor, source: data.source, latitude: data.latitude, longitude: data.longitude, locationAccuracyM: data.locationAccuracyM, overallCondition: data.overallCondition, notes: data.notes, status: 'completed', completedAt: new Date(), localVisitId: data.localVisitId, submissionHash, observations: { create: data.observations.map((o) => ({ ...o, farmId: farm.id })) } } });
      if (data.stageCode && data.stageLabel) {
        await tx.cropStageRecord.updateMany({ where: { fieldSeasonId: fieldSeason.id, isEffective: true }, data: { isEffective: false } });
        await tx.cropStageRecord.create({ data: { farmId: farm.id, fieldSeasonId: fieldSeason.id, stageSystem: data.stageSystem, stageCode: data.stageCode, label: data.stageLabel, observedAt: data.visitDate, source: 'farmer_observed', confidence: 'confirmed', observerId: actor } });
        const numericBbch = data.stageSystem.toUpperCase() === 'BBCH' && /^\d{1,2}$/.test(data.stageCode) ? Number(data.stageCode) : null;
        if (numericBbch != null) await tx.fieldSeason.update({ where: { id: fieldSeason.id }, data: { bbchStage: numericBbch } });
      }
      await recordAuditEvent(tx, { farmId: farm.id, actorUserId: actor, entityType: 'ScoutingVisit', entityId: visit.id, action: 'created', source: 'web', correlationId: randomUUID(), metadata: { fieldSeasonId: fieldSeason.id, observationCount: data.observations.length, containsConfirmedDiagnosis: data.observations.some((o) => o.certainty.includes('confirmed')) } });
      return visit.id;
    }, { isolationLevel: 'Serializable' });
    for (const path of ['/scouting', `/fields/${fieldSeason.fieldId}`, '/fields/map', '/dashboard']) revalidatePath(path);
    const observationIds=(await db.scoutingObservation.findMany({where:{visitId:id,farmId:farm.id},orderBy:{createdAt:'asc'},select:{id:true}})).map(row=>row.id);
    return { success: true, id, observationIds };
  } catch (error) { return { error: error instanceof Error ? error.message : 'Could not save scouting visit.' }; }
}

export async function correctGrowthStage(input: { recordId: string; stageCode: string; label: string; reason: string }) {
  const farm = await getActiveFarmOrThrow();
  const actor = await getClerkUserId() ?? farm.clerkUserId;
  const existing = await db.cropStageRecord.findFirst({ where: { id: input.recordId, farmId: farm.id, fieldSeason: { field: { farmId: farm.id } } } });
  if (!existing) return { error: 'Growth-stage record not found.' };
  if (!input.reason.trim()) return { error: 'A correction reason is required.' };
  const replacement = await db.$transaction(async (tx) => {
    await tx.cropStageRecord.updateMany({ where: { fieldSeasonId: existing.fieldSeasonId, isEffective: true }, data: { isEffective: false } });
    const row = await tx.cropStageRecord.create({ data: { farmId: farm.id, fieldSeasonId: existing.fieldSeasonId, stageSystem: existing.stageSystem, stageCode: input.stageCode, label: input.label, observedAt: existing.observedAt, source: 'correction', confidence: 'confirmed', observerId: actor, correctsRecordId: existing.id, correctionReason: input.reason } });
    await recordAuditEvent(tx, { farmId: farm.id, actorUserId: actor, entityType: 'CropStageRecord', entityId: row.id, previousVersionId: existing.id, action: 'corrected', source: 'web', correlationId: randomUUID(), reason: input.reason, metadata: { fieldSeasonId: existing.fieldSeasonId, stageSystem: existing.stageSystem } });
    return row;
  });
  revalidatePath('/scouting');
  return { success: true, id: replacement.id };
}

export async function setObservationStatus(input: { observationId: string; status: 'open'|'monitoring'|'action_planned'|'resolved'|'dismissed'|'superseded'; reason: string }) {
  const farm = await getActiveFarmOrThrow();
  const actor = await getClerkUserId() ?? farm.clerkUserId;
  const observation = await db.scoutingObservation.findFirst({ where: { id: input.observationId, farmId: farm.id } });
  if (!observation) return { error: 'Observation not found.' };
  if (!input.reason.trim()) return { error: 'A reason is required; original evidence is preserved.' };
  await db.$transaction(async (tx) => {
    await tx.scoutingObservation.update({ where: { id: observation.id }, data: { status: input.status, resolvedAt: ['resolved','dismissed','superseded'].includes(input.status) ? new Date() : null, resolvedBy: actor, resolutionReason: input.reason } });
    await recordAuditEvent(tx, { farmId: farm.id, actorUserId: actor, entityType: 'ScoutingObservation', entityId: observation.id, action: 'corrected', source: 'web', correlationId: randomUUID(), reason: input.reason, metadata: { previousStatus: observation.status, status: input.status } });
  });
  revalidatePath('/scouting');
  return { success: true };
}

export async function createObservationWorkOrder(input: { observationId: string; title: string; priority: 'critical'|'high'|'medium'|'low'; dueDate?: Date; instructions?: string }) {
  const farm = await getActiveFarmOrThrow();
  const actor = await getClerkUserId() ?? farm.clerkUserId;
  const observation = await db.scoutingObservation.findFirst({ where: { id: input.observationId, farmId: farm.id }, include: { visit: true } });
  if (!observation) return { error: 'Observation not found.' };
  if (observation.followUpWorkOrderId) return { success: true, id: observation.followUpWorkOrderId };
  const order = await db.$transaction(async (tx) => {
    const created = await tx.workOrder.create({ data: { farmId: farm.id, fieldSeasonId: observation.visit.fieldSeasonId, operationType: 'scout', title: input.title, priority: input.priority, dueDate: input.dueDate, instructions: input.instructions, status: 'ready', createdBy: actor } });
    await tx.scoutingObservation.update({ where: { id: observation.id }, data: { followUpWorkOrderId: created.id, status: 'action_planned' } });
    await recordAuditEvent(tx, { farmId: farm.id, actorUserId: actor, entityType: 'WorkOrder', entityId: created.id, action: 'created', source: 'web', correlationId: randomUUID(), metadata: { sourceObservationId: observation.id, treatmentAuthorized: false } });
    return created;
  });
  revalidatePath('/work-orders'); revalidatePath('/scouting');
  return { success: true, id: order.id };
}
