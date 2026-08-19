'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { handleActionError } from '@/lib/user-error';
import { searchBrpParcelsByBboxCached } from '@/integrations/pdok/cache';
import { bboxAroundPoint } from '@/integrations/pdok/brp-client';
import { checksumGeometry } from '@/integrations/pdok/mapper';
import { validateGeometry } from '@/integrations/pdok/geometry';
import type { PdokParcelSearchResult } from '@/integrations/pdok/types';
import { isRateLimited } from '@/lib/rate-limit';

const FALLBACK_LAT = parseFloat(process.env.NEXT_PUBLIC_FARM_LATITUDE ?? '51.9652');
const FALLBACK_LON = parseFloat(process.env.NEXT_PUBLIC_FARM_LONGITUDE ?? '5.9307');

/**
 * Searches BRP Gewaspercelen near the current farm's own coordinates
 * (Sprint 18 Part 10 step 1). A proximity match is NOT ownership evidence
 * — see docs/BRP_PDOK_Official_Data_Audit.md Part 2 — the UI must always
 * ask the farmer to confirm, never auto-select.
 */
export async function searchBrpNearFarmAction(radiusMetres = 1500): Promise<PdokParcelSearchResult> {
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { state: 'unavailable', parcels: [], unavailableReason: 'Sign in required.' };
  }
  if (isRateLimited(`brp-search:${farm.id}`)) {
    return { state: 'unavailable', parcels: [], unavailableReason: 'Too many searches — wait a moment and try again.' };
  }
  const lat = farm.latitude != null ? Number(farm.latitude) : FALLBACK_LAT;
  const lon = farm.longitude != null ? Number(farm.longitude) : FALLBACK_LON;
  return searchBrpParcelsByBboxCached(bboxAroundPoint(lat, lon, radiusMetres));
}

const ConfirmImportSchema = z.object({
  fieldName: z.string().min(1).max(120),
  // A <select> always submits a value for its name — "don't assign yet"
  // submits crop="" (empty string), not an absent field. `.optional()`
  // alone only treats `undefined` as absent, so an empty string would
  // otherwise fail enum validation and silently produce fieldErrors this
  // form never surfaces (see the E2E fix in Sprint 18's validation pass —
  // this was a genuine bug, not a test-authoring issue).
  crop: z.enum(['wheat', 'potato', 'onion', 'sugar_beet', 'barley', 'oilseed_rape', 'cover_crop', 'grass', 'other']).optional().or(z.literal('')),
  seasonId: z.string().uuid().optional().or(z.literal('')),
  datasetYear: z.coerce.number().int().min(2000).max(2100),
  importedAreaHa: z.coerce.number().positive().max(99999),
  importedCropValue: z.string().max(200).optional(),
  importedCropCode: z.coerce.number().int().optional(),
  sourceUrl: z.string().url(),
  geometry: z.string(), // JSON-encoded PdokGeometry
});

export type ConfirmBrpImportState = { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean; fieldId?: string };

/**
 * Creates a Field + FieldExternalProvenance (and optionally a FieldSeason)
 * only after the farmer has explicitly reviewed and confirmed a parcel —
 * never automatically from proximity alone (Sprint 18 Part 10 step 6).
 */
export async function confirmBrpParcelImport(
  _prev: ConfirmBrpImportState,
  formData: FormData,
): Promise<ConfirmBrpImportState> {
  const raw = Object.fromEntries(formData);
  const parsed = ConfirmImportSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { error: 'Set up your farm before importing a field.' };
  }

  const d = parsed.data;

  let geometry;
  try {
    geometry = validateGeometry(JSON.parse(d.geometry));
  } catch {
    return { error: 'The parcel boundary could not be validated. Try searching again.' };
  }

  const geometryChecksum = checksumGeometry(geometry);

  try {
    // Idempotency: refuse a second import of the exact same geometry for
    // this farm, rather than silently creating a duplicate field (Part 17
    // test #18).
    const existing = await db.fieldExternalProvenance.findFirst({
      where: { geometryChecksum, field: { farmId: farm.id, deletedAt: null } },
    });
    if (existing) {
      return { error: 'This parcel has already been imported as a field on this farm.' };
    }

    const result = await db.$transaction(async (tx) => {
      const field = await tx.field.create({
        data: {
          farmId: farm.id,
          name: d.fieldName,
          hectares: d.importedAreaHa,
          coordinates: geometry,
        },
      });

      await tx.fieldExternalProvenance.create({
        data: {
          fieldId: field.id,
          source: 'PDOK_BRPGewaspercelen',
          datasetYear: d.datasetYear,
          importedGeometry: geometry,
          importedAreaHa: d.importedAreaHa,
          importedCropValue: d.importedCropValue,
          importedCropCode: d.importedCropCode,
          sourceUrl: d.sourceUrl,
          userConfirmedAt: new Date(),
          geometryChecksum,
        },
      });

      if (d.crop && d.seasonId) {
        await tx.fieldSeason.create({
          data: { fieldId: field.id, seasonId: d.seasonId, crop: d.crop },
        });
      }

      return field.id;
    });

    revalidatePath('/fields');
    return { success: true, fieldId: result };
  } catch (e) {
    return { error: handleActionError('confirmBrpParcelImport', e).message };
  }
}
