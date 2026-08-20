'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { handleActionError, userError, type UserFacingError } from '@/lib/user-error';
import { fetchNdviStatisticsCached } from '@/integrations/copernicus/cache';
import { CopernicusGeometryError } from '@/integrations/copernicus/errors';
import type { CopernicusGeometry } from '@/integrations/copernicus/types';

export type NdviActionResult =
  | { success: true; readingCount: number }
  | { success: false; error: UserFacingError };

function safeCaught(context: string, error: unknown): UserFacingError {
  const { message: _legacy, ...safe } = handleActionError(context, error, randomUUID());
  return safe;
}

/**
 * Fetches the last `lookbackDays` of NDVI for a field from Copernicus and
 * upserts each period as a FieldNdviReading row. Farm-scoped; refuses a
 * field with no recorded geometry rather than guessing one — same rule as
 * spray-suitability's "missing context is a hard blocker, not a soft
 * warning" in planned-application mode.
 */
export async function refreshFieldNdvi(fieldId: string, lookbackDays = 60): Promise<NdviActionResult> {
  const parsedId = z.string().uuid().safeParse(fieldId);
  if (!parsedId.success) return { success: false, error: userError('NOT_FOUND') };

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { success: false, error: userError('AUTH_REQUIRED') };
  }

  const field = await db.field.findFirst({ where: { id: fieldId, farmId: farm.id, deletedAt: null }, select: { id: true, coordinates: true } });
  if (!field) return { success: false, error: userError('NOT_FOUND') };
  if (!field.coordinates) return { success: false, error: userError('INVALID_COORDINATES', { field: 'fieldId' }) };

  const to = new Date();
  const from = new Date(to.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  try {
    const readings = await fetchNdviStatisticsCached(field.coordinates as unknown as CopernicusGeometry, from.toISOString(), to.toISOString());

    await db.$transaction(
      readings.map((reading) =>
        db.fieldNdviReading.upsert({
          where: { fieldId_periodFrom: { fieldId: field.id, periodFrom: new Date(reading.periodFrom) } },
          create: {
            fieldId: field.id,
            periodFrom: new Date(reading.periodFrom),
            periodTo: new Date(reading.periodTo),
            meanNdvi: reading.meanNdvi,
            sampleCount: reading.sampleCount,
            cloudCoveragePct: reading.cloudCoveragePct,
          },
          update: {
            periodTo: new Date(reading.periodTo),
            meanNdvi: reading.meanNdvi,
            sampleCount: reading.sampleCount,
            cloudCoveragePct: reading.cloudCoveragePct,
            fetchedAt: new Date(),
          },
        }),
      ),
    );

    revalidatePath(`/fields/${fieldId}`);
    return { success: true, readingCount: readings.length };
  } catch (error) {
    if (error instanceof CopernicusGeometryError) return { success: false, error: userError('INVALID_COORDINATES', { field: 'fieldId' }) };
    return { success: false, error: safeCaught('refreshFieldNdvi', error) };
  }
}
