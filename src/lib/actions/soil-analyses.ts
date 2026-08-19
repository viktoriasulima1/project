'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { handleActionError, userError, type UserFacingError } from '@/lib/user-error';

const SoilAnalysisSchema = z.object({
  fieldId: z.string().uuid(),
  analysisDate: z.string().date(),
  phLevel: z.coerce.number().min(0).max(14).optional(),
  pIndex: z.coerce.number().int().min(0).max(999).optional(),
  kIndex: z.coerce.number().int().min(0).max(999).optional(),
  mgIndex: z.coerce.number().int().min(0).max(999).optional(),
  organicMatterPct: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type SoilAnalysisInput = z.infer<typeof SoilAnalysisSchema>;

export type SoilAnalysisActionResult =
  | { success: true; soilAnalysisId: string }
  | { success: false; error: UserFacingError };

function safeCaught(context: string, error: unknown): UserFacingError {
  const { message: _legacy, ...safe } = handleActionError(context, error, randomUUID());
  return safe;
}

export async function createSoilAnalysis(input: SoilAnalysisInput): Promise<SoilAnalysisActionResult> {
  const parsed = SoilAnalysisSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || undefined;
    const code = field === 'analysisDate' ? 'INVALID_DATE'
      : field === 'fieldId' ? 'NOT_FOUND'
        : issue?.code === 'too_small' ? 'REQUIRED_FIELD'
          : 'INVALID_VALUE';
    return { success: false, error: userError(code, { field }) };
  }

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { success: false, error: userError('AUTH_REQUIRED') };
  }

  const d = parsed.data;
  try {
    const field = await db.field.findFirst({ where: { id: d.fieldId, farmId: farm.id, deletedAt: null } });
    if (!field) return { success: false, error: userError('NOT_FOUND', { field: 'fieldId' }) };

    const analysis = await db.soilAnalysis.create({
      data: {
        fieldId: d.fieldId,
        analysisDate: new Date(d.analysisDate),
        phLevel: d.phLevel,
        pIndex: d.pIndex,
        kIndex: d.kIndex,
        mgIndex: d.mgIndex,
        organicMatterPct: d.organicMatterPct,
        notes: d.notes || undefined,
      },
    });
    revalidatePath('/soil');
    return { success: true, soilAnalysisId: analysis.id };
  } catch (error) {
    return { success: false, error: safeCaught('createSoilAnalysis', error) };
  }
}

export async function deleteSoilAnalysis(soilAnalysisId: string): Promise<SoilAnalysisActionResult> {
  const parsed = z.string().uuid().safeParse(soilAnalysisId);
  if (!parsed.success) return { success: false, error: userError('NOT_FOUND') };

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { success: false, error: userError('AUTH_REQUIRED') };
  }

  try {
    const existing = await db.soilAnalysis.findFirst({ where: { id: soilAnalysisId, field: { farmId: farm.id } } });
    if (!existing) return { success: false, error: userError('NOT_FOUND') };
    await db.soilAnalysis.delete({ where: { id: soilAnalysisId } });
    revalidatePath('/soil');
    return { success: true, soilAnalysisId };
  } catch (error) {
    return { success: false, error: safeCaught('deleteSoilAnalysis', error) };
  }
}

// ── useActionState-compatible form wrapper for create ──────────────────────

export type SoilAnalysisFormState = { error?: UserFacingError; success?: boolean };

export async function createSoilAnalysisForm(_previous: SoilAnalysisFormState, formData: FormData): Promise<SoilAnalysisFormState> {
  const raw = {
    fieldId: String(formData.get('fieldId') ?? ''),
    analysisDate: String(formData.get('analysisDate') ?? ''),
    phLevel: formData.get('phLevel') ? String(formData.get('phLevel')) : undefined,
    pIndex: formData.get('pIndex') ? String(formData.get('pIndex')) : undefined,
    kIndex: formData.get('kIndex') ? String(formData.get('kIndex')) : undefined,
    mgIndex: formData.get('mgIndex') ? String(formData.get('mgIndex')) : undefined,
    organicMatterPct: formData.get('organicMatterPct') ? String(formData.get('organicMatterPct')) : undefined,
    notes: String(formData.get('notes') ?? ''),
  };
  const result = await createSoilAnalysis(raw as unknown as SoilAnalysisInput);
  return result.success ? { success: true } : { error: result.error };
}
