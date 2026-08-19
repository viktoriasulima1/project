'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { handleActionError, userError, type UserFacingError } from '@/lib/user-error';

const CROP_NAMES = ['wheat', 'potato', 'onion', 'sugar_beet', 'barley', 'oilseed_rape', 'cover_crop', 'grass', 'other'] as const;

const NutrientNormSchema = z.object({
  crop: z.enum(CROP_NAMES),
  nitrogenNormKgPerHa: z.coerce.number().min(0).max(999).optional(),
  phosphateNormKgPerHa: z.coerce.number().min(0).max(999).optional(),
  source: z.string().max(200).optional().or(z.literal('')),
  verifiedAt: z.string().date().optional().or(z.literal('')),
});

export type NutrientNormActionResult =
  | { success: true; normId: string }
  | { success: false; error: UserFacingError };

function safeCaught(context: string, error: unknown): UserFacingError {
  const { message: _legacy, ...safe } = handleActionError(context, error, randomUUID());
  return safe;
}

/** One reference per (farm, crop) — deliberately entered by the farmer/
 * advisor, never looked up automatically. See NutrientNormReference's own
 * schema comment for why. */
export async function upsertNutrientNormReference(input: z.infer<typeof NutrientNormSchema>): Promise<NutrientNormActionResult> {
  const parsed = NutrientNormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || undefined;
    const code = field === 'verifiedAt' ? 'INVALID_DATE'
      : field === 'crop' ? 'INVALID_VALUE'
        : 'INVALID_QUANTITY';
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
    const norm = await db.nutrientNormReference.upsert({
      where: { farmId_crop: { farmId: farm.id, crop: d.crop } },
      create: {
        farmId: farm.id,
        crop: d.crop,
        nitrogenNormKgPerHa: d.nitrogenNormKgPerHa,
        phosphateNormKgPerHa: d.phosphateNormKgPerHa,
        source: d.source || undefined,
        verifiedAt: d.verifiedAt ? new Date(d.verifiedAt) : undefined,
      },
      update: {
        nitrogenNormKgPerHa: d.nitrogenNormKgPerHa ?? null,
        phosphateNormKgPerHa: d.phosphateNormKgPerHa ?? null,
        source: d.source || null,
        verifiedAt: d.verifiedAt ? new Date(d.verifiedAt) : null,
      },
    });
    revalidatePath('/nutrients');
    return { success: true, normId: norm.id };
  } catch (error) {
    return { success: false, error: safeCaught('upsertNutrientNormReference', error) };
  }
}

export type NutrientNormFormState = { error?: UserFacingError; success?: boolean };

export async function upsertNutrientNormReferenceForm(
  _previous: NutrientNormFormState,
  formData: FormData,
): Promise<NutrientNormFormState> {
  const result = await upsertNutrientNormReference({
    crop: String(formData.get('crop') ?? '') as (typeof CROP_NAMES)[number],
    nitrogenNormKgPerHa: formData.get('nitrogenNormKgPerHa') ? String(formData.get('nitrogenNormKgPerHa')) : undefined,
    phosphateNormKgPerHa: formData.get('phosphateNormKgPerHa') ? String(formData.get('phosphateNormKgPerHa')) : undefined,
    source: String(formData.get('source') ?? ''),
    verifiedAt: String(formData.get('verifiedAt') ?? ''),
  } as unknown as z.infer<typeof NutrientNormSchema>);
  return result.success ? { success: true } : { error: result.error };
}
