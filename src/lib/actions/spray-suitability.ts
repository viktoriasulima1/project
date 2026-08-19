'use server';

import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { fetchWeather } from '@/lib/weather';
import {
  computeSprayWindows,
  MOCK_DEFAULT_PRODUCT_PROFILE,
} from '@/lib/spray-window';
import type { SprayWindowSummary } from '@/lib/spray-window';
import { handleActionError } from '@/lib/user-error';
import type { CropName } from '@/types/farm';
import { getCachedProductByLocalId } from '@/integrations/ctgb/cache';
import { checkCtgbCompliance } from '@/lib/ctgb-compliance-check';
import type { CtgbComplianceResult } from '@/lib/ctgb-compliance-check';

const FALLBACK_LAT = parseFloat(process.env.NEXT_PUBLIC_FARM_LATITUDE ?? '51.9652');
const FALLBACK_LON = parseFloat(process.env.NEXT_PUBLIC_FARM_LONGITUDE ?? '5.9307');

// prisma's CropName enum has a wider/different vocabulary than the engine's
// own CropName type (see dashboard-data.ts's identical PRISMA_CROP_MAP) —
// crops with no real mapping are honestly omitted, not guessed.
const PRISMA_CROP_MAP: Partial<Record<string, CropName>> = {
  wheat: 'wheat',
  potato: 'potato',
  onion: 'onion',
  sugar_beet: 'sugar_beet',
  barley: 'barley',
  oilseed_rape: 'rapeseed',
};

// Best-effort Dutch crop names for matching against Ctgb's own
// `cropOrUseTarget` field, which is recorded in Dutch. This mapping is NOT
// independently verified against a live Ctgb response (see
// docs/Ctgb_Official_Data_Audit.md) — it is a reasonable guess, not an
// official lookup table. A future sprint should replace this with the real
// `/masterdata/ppp/targetcrops` list once Ctgb access is confirmed working.
const DUTCH_CROP_NAME: Partial<Record<string, string>> = {
  wheat: 'Tarwe',
  potato: 'Aardappelen',
  onion: 'Uien',
  sugar_beet: 'Suikerbieten',
  barley: 'Gerst',
  oilseed_rape: 'Koolzaad',
};

export interface SpraySuitabilityInput {
  fieldSeasonId: string;
  productId?: string;
  machineId?: string;
  nozzleType?: string;
  operatorName?: string;
  areaHa?: number;
  dosePerHa?: number;
  doseUnit?: string;
  date: string;
  /** Explicit choice from the UI when a product has more than one official
   * use (Sprint 18 Part 7). Index into the product's own `uses` array. */
  selectedCtgbUseIndex?: number;
}

export type SpraySuitabilityResult =
  | { success: true; summary: SprayWindowSummary; ctgbCompliance: CtgbComplianceResult | null }
  | { success: false; error: string };

/**
 * Runs the real spray-window engine (src/lib/spray-window.ts) against the
 * real field/product/machine/operator/stock inputs for a specific planned
 * spray, in 'planned-application' mode (missing context becomes a hard
 * blocker, not a soft warning — fail closed). This is the connection the
 * engine was missing: it previously only ran in 'advisory' mode on the
 * standalone Weather page with no product/operator/inventory/machine/crop
 * context at all.
 */
export async function evaluateSpraySuitability(
  input: SpraySuitabilityInput,
): Promise<SpraySuitabilityResult> {
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { success: false, error: 'Set up your farm before checking spray suitability.' };
  }

  try {
    const [fieldSeason, product, machine, employees] = await Promise.all([
      db.fieldSeason.findFirst({
        where: { id: input.fieldSeasonId, field: { farmId: farm.id, deletedAt: null } },
        select: { crop: true, bbchStage: true },
      }),
      input.productId
        ? db.inventoryItem.findFirst({
            where: { id: input.productId },
            select: { currentStock: true, unit: true, farmId: true, isManualEntry: true, ctgbProductReferenceId: true },
          })
        : Promise.resolve(null),
      input.machineId
        ? db.machine.findFirst({ where: { id: input.machineId }, select: { farmId: true } })
        : Promise.resolve(null),
      db.employee.findMany({
        where: { farmId: farm.id, isActive: true },
        select: { name: true, hasSpraying: true, certExpiry: true, certNumber: true },
      }),
    ]);

    if (!fieldSeason) {
      return { success: false, error: 'Field not found or does not belong to this farm.' };
    }
    if (input.productId && (!product || product.farmId !== farm.id)) {
      return { success: false, error: 'Product not found or does not belong to this farm.' };
    }
    if (input.machineId && (!machine || machine.farmId !== farm.id)) {
      return { success: false, error: 'Machine not found or does not belong to this farm.' };
    }

    const lat = farm.latitude != null ? Number(farm.latitude) : FALLBACK_LAT;
    const lon = farm.longitude != null ? Number(farm.longitude) : FALLBACK_LON;
    let weather;
    try {
      weather = await fetchWeather(lat, lon);
    } catch (weatherError) {
      // A network/API failure here is not this app's own deliberately-safe
      // error text (unlike the Error()s thrown below) — it can contain raw
      // fetch/DNS/socket detail, so it gets its own generic, honest message
      // rather than falling through to handleActionError's pass-through.
      handleActionError('evaluateSpraySuitability:fetchWeather', weatherError);
      return { success: false, error: 'Weather suitability cannot be calculated right now — weather data is unavailable.' };
    }

    // Best-effort match against real Employee records — no FK exists between
    // Activity.operatorName (free text) and Employee, so an honest name
    // match is the only real signal available without inventing one.
    const normalizedOperator = input.operatorName?.trim().toLowerCase();
    const matchedEmployee = normalizedOperator
      ? employees.find((e) => e.name.trim().toLowerCase() === normalizedOperator)
      : undefined;

    const operatorContext = matchedEmployee
      ? {
          hasCertification: matchedEmployee.hasSpraying,
          certNumber: matchedEmployee.certNumber,
          certExpiry: matchedEmployee.certExpiry ? matchedEmployee.certExpiry.toISOString() : null,
        }
      : undefined;

    const inventoryContext =
      product && input.dosePerHa != null && input.areaHa != null
        ? {
            requiredQuantity: input.dosePerHa * input.areaHa,
            availableStock: Number(product.currentStock),
            unit: input.doseUnit || product.unit,
          }
        : undefined;

    const machineContext = input.machineId
      ? {
          nozzleType: input.nozzleType ?? null,
          // 'air_inclusion' nozzles are a real drift-reduction technology;
          // every other option in the form is not.
          isDriftReductionNozzle: input.nozzleType === 'air_inclusion',
        }
      : undefined;

    const fieldCropContext = {
      crop: PRISMA_CROP_MAP[fieldSeason.crop as string],
      bbchStage: fieldSeason.bbchStage ?? undefined,
    };

    const summary = computeSprayWindows(weather.hourly, input.date, {
      productProfile: MOCK_DEFAULT_PRODUCT_PROFILE,
      operator: operatorContext,
      inventory: inventoryContext,
      machine: machineContext,
      fieldCrop: fieldCropContext,
      mode: 'planned-application',
      weatherFetchedAt: weather.fetchedAt,
    });

    // Sprint 18 Part 7 — a SEPARATE check from the weather engine above.
    // Ctgb governs legal crop/dose/BBCH/PHI/buffer restrictions; it has
    // nothing to do with wind/temperature/rain, which is why this is never
    // merged into `summary`'s score.
    let ctgbCompliance: CtgbComplianceResult | null = null;
    if (product) {
      const cachedProduct = product.ctgbProductReferenceId
        ? await getCachedProductByLocalId(product.ctgbProductReferenceId)
        : null;
      ctgbCompliance = checkCtgbCompliance({
        isManualEntry: product.isManualEntry,
        product: cachedProduct?.product ?? null,
        selectedUseIndex: input.selectedCtgbUseIndex,
        cropName: DUTCH_CROP_NAME[fieldSeason.crop as string],
        bbchStage: fieldSeason.bbchStage ?? undefined,
        dosePerHa: input.dosePerHa,
        doseUnit: input.doseUnit,
      });
    }

    return { success: true, summary, ctgbCompliance };
  } catch (e) {
    return { success: false, error: handleActionError('evaluateSpraySuitability', e).message };
  }
}
