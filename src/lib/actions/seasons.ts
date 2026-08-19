'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { handleActionError, classifyError, toUserFacingError } from '@/lib/user-error';
import type { CropName } from '@prisma/client';

const CreateSeasonSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2035),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

// Each field-to-add comes as: fieldId_<uuid>=<cropName>
// Form sends hidden inputs with that pattern
const CROP_VALUES: CropName[] = [
  'wheat', 'potato', 'onion', 'sugar_beet', 'barley',
  'oilseed_rape', 'cover_crop', 'grass', 'other',
];

export type SeasonFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  seasonId?: string;
};

export async function createSeason(
  _prev: SeasonFormState,
  formData: FormData
): Promise<SeasonFormState> {
  const raw = Object.fromEntries(formData);
  const parsed = CreateSeasonSchema.safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Farm not found.' };
  }

  const { year, startDate, endDate } = parsed.data;

  if (new Date(startDate) >= new Date(endDate)) {
    return { error: 'End date must be after start date.' };
  }

  try {
    const season = await db.$transaction(async (tx) => {
      // Deactivate all current active seasons for this farm
      await tx.season.updateMany({
        where: { farmId: farm.id, isActive: true },
        data: { isActive: false },
      });

      return tx.season.create({
        data: {
          farmId: farm.id,
          year,
          isActive: true,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      });
    });

    revalidatePath('/activities');
    return { success: true, seasonId: season.id };
  } catch (e: unknown) {
    const classified = classifyError(e);
    if (classified.category === 'conflict') {
      return { error: toUserFacingError('conflict', `A season for ${year} already exists on this farm.`).message };
    }
    return { error: handleActionError('createSeason', e).message };
  }
}

export async function addFieldToSeason(
  _prev: SeasonFormState,
  formData: FormData
): Promise<SeasonFormState> {
  const fieldId = formData.get('fieldId') as string;
  const seasonId = formData.get('seasonId') as string;
  const crop = formData.get('crop') as string;

  if (!fieldId || !seasonId || !crop) {
    return { error: 'Field, season, and crop are all required.' };
  }

  if (!CROP_VALUES.includes(crop as CropName)) {
    return { error: 'Invalid crop selection.' };
  }

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Farm not found.' };
  }

  // Verify field belongs to farm
  const field = await db.field.findFirst({
    where: { id: fieldId, farmId: farm.id, deletedAt: null },
  });
  if (!field) return { error: 'Field not found.' };

  // Verify season belongs to farm
  const season = await db.season.findFirst({
    where: { id: seasonId, farmId: farm.id },
  });
  if (!season) return { error: 'Season not found.' };

  try {
    await db.fieldSeason.create({
      data: {
        fieldId,
        seasonId,
        crop: crop as CropName,
      },
    });
  } catch (e: unknown) {
    const classified = classifyError(e);
    if (classified.category === 'conflict') {
      return { error: toUserFacingError('conflict', `${field.name} is already added to this season.`).message };
    }
    return { error: handleActionError('addFieldToSeason', e).message };
  }

  revalidatePath('/activities');
  return { success: true };
}
