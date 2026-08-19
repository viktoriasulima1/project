'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { handleActionError } from '@/lib/user-error';

const CreateFieldSchema = z.object({
  name: z.string().min(1).max(100),
  hectares: z.coerce.number().positive().max(9999),
  soilType: z.enum(['clay', 'sandy', 'loam', 'peat', 'silt']),
});

const UpdateFieldSchema = CreateFieldSchema.partial().extend({
  id: z.string().uuid(),
  status: z.enum(['healthy', 'attention', 'critical', 'fallow']).optional(),
});

export type FieldFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  fieldId?: string;
};

export async function createField(
  _prev: FieldFormState,
  formData: FormData
): Promise<FieldFormState> {
  const raw = Object.fromEntries(formData);
  const parsed = CreateFieldSchema.safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Farm not found. Please complete onboarding.' };
  }

  try {
    const field = await db.field.create({
      data: {
        farmId: farm.id,
        name: parsed.data.name,
        hectares: parsed.data.hectares,
        soilType: parsed.data.soilType,
      },
    });

    revalidatePath('/fields');
    return { success: true, fieldId: field.id };
  } catch (e) {
    return { error: handleActionError('createField', e).message };
  }
}

export async function updateField(
  _prev: FieldFormState,
  formData: FormData
): Promise<FieldFormState> {
  const raw = Object.fromEntries(formData);
  const parsed = UpdateFieldSchema.safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Farm not found.' };
  }

  const { id, ...data } = parsed.data;

  try {
    const field = await db.field.findFirst({ where: { id, farmId: farm.id, deletedAt: null } });
    if (!field) return { error: 'Field not found.' };

    await db.field.update({ where: { id }, data });

    revalidatePath('/fields');
    revalidatePath(`/fields/${id}`);
    return { success: true };
  } catch (e) {
    return { error: handleActionError('updateField', e).message };
  }
}

export async function deleteField(id: string): Promise<{ error?: string }> {
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Farm not found.' };
  }

  try {
    const field = await db.field.findFirst({
      where: { id, farmId: farm.id, deletedAt: null },
    });
    if (!field) return { error: 'Field not found.' };

    // Count activities with compliance records — these must be retained per EU law
    const complianceCount = await db.complianceRecord.count({
      where: { activity: { fieldSeason: { fieldId: id } } },
    });

    if (complianceCount > 0) {
      // Soft delete: hide the field from all UI but preserve data
      await db.field.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      revalidatePath('/fields');
      return {};
    }

    // No compliance records: check for any activities at all
    const activityCount = await db.activity.count({
      where: { fieldSeason: { fieldId: id } },
    });

    if (activityCount > 0) {
      // Still soft-delete to preserve the activity history
      await db.field.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      revalidatePath('/fields');
      return {};
    }

    // No activities at all: safe to hard delete
    await db.field.delete({ where: { id } });
    revalidatePath('/fields');
    return {};
  } catch (e) {
    return { error: handleActionError('deleteField', e).message };
  }
}
