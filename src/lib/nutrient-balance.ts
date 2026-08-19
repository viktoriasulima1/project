import 'server-only';
import { db } from '@/lib/db';

/**
 * Kg of nutrient applied to a field this season, derived ONLY from what a
 * farmer already recorded: fertilise Activities linked to an InventoryItem
 * that has its N/P composition filled in. Never estimates a missing
 * composition — a product with no nitrogenPercent/phosphorusPercent on file
 * is surfaced as `incompleteProducts`, not silently skipped or guessed.
 *
 * Unit handling: dosePerHa × areaHa gives total product used in the
 * activity's own doseUnit. Composition percentages assume that quantity is
 * a mass (kg or L, treating L≈kg — a reasonable approximation for common
 * liquid fertilisers' density, not exact). Any other unit is excluded from
 * the total and reported so the number never silently under-counts without
 * a visible reason.
 */
export interface FieldNutrientBalance {
  fieldId: string;
  fieldName: string;
  crop: string;
  nitrogenKg: number;
  phosphateKg: number;
  incompleteProducts: string[]; // distinct product names used with no composition on file
  excludedUnitActivities: number; // fertilise activities whose doseUnit couldn't be summed
}

const MASS_LIKE_UNITS = new Set(['kg', 'L']);

export async function getSeasonNutrientBalance(farmId: string, seasonId: string): Promise<FieldNutrientBalance[]> {
  const fieldSeasons = await db.fieldSeason.findMany({
    where: { seasonId, field: { farmId, deletedAt: null } },
    select: {
      id: true,
      crop: true,
      field: { select: { id: true, name: true } },
      activities: {
        where: { type: 'fertilise', deletedAt: null, isReversal: false },
        select: {
          dosePerHa: true,
          doseUnit: true,
          areaHa: true,
          product: { select: { name: true, nitrogenPercent: true, phosphorusPercent: true } },
        },
      },
    },
  });

  return fieldSeasons.map((fs) => {
    let nitrogenKg = 0;
    let phosphateKg = 0;
    let excludedUnitActivities = 0;
    const incomplete = new Set<string>();

    for (const activity of fs.activities) {
      if (!activity.product || activity.dosePerHa == null) continue;
      const unit = (activity.doseUnit ?? '').trim();
      if (!MASS_LIKE_UNITS.has(unit)) { excludedUnitActivities += 1; continue; }

      const totalKg = Number(activity.dosePerHa) * Number(activity.areaHa);
      const nPct = activity.product.nitrogenPercent != null ? Number(activity.product.nitrogenPercent) : null;
      const pPct = activity.product.phosphorusPercent != null ? Number(activity.product.phosphorusPercent) : null;

      if (nPct == null && pPct == null) { incomplete.add(activity.product.name); continue; }
      if (nPct != null) nitrogenKg += totalKg * (nPct / 100);
      if (pPct != null) phosphateKg += totalKg * (pPct / 100);
    }

    return {
      fieldId: fs.field.id,
      fieldName: fs.field.name,
      crop: fs.crop,
      nitrogenKg: Math.round(nitrogenKg * 10) / 10,
      phosphateKg: Math.round(phosphateKg * 10) / 10,
      incompleteProducts: [...incomplete],
      excludedUnitActivities,
    };
  });
}
