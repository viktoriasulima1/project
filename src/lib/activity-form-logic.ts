export interface StockPreview {
  totalUsed: number;
  resultingStock: number;
  insufficient: boolean;
}

/** Pure client-side stock projection — dose × area vs. current stock.
 * Returns null when there isn't enough input yet to compute anything. */
export function computeStockPreview(
  currentStock: number | undefined,
  dosePerHa: string,
  areaHa: string,
): StockPreview | null {
  if (currentStock === undefined || !dosePerHa || !areaHa) return null;
  const dose = parseFloat(dosePerHa);
  const area = parseFloat(areaHa);
  if (!Number.isFinite(dose) || !Number.isFinite(area)) return null;
  const totalUsed = dose * area;
  const resultingStock = currentStock - totalUsed;
  return { totalUsed, resultingStock, insufficient: resultingStock < 0 };
}

/** Pure client-side product-cost projection — dose × area × the product's
 * own current purchase price. Returns null whenever there isn't enough
 * input to compute anything, INCLUDING when the product has no recorded
 * price — this mirrors economics-recording.ts's own totalCost rule
 * (unitCost == null → no total, never a fabricated €0) so the preview
 * never promises a number the saved record won't actually have. Preview
 * only, and product cost only — machine/labour/fuel cost aren't included,
 * since actualHours/machineHours/fuelUsed are optional, often-blank
 * fields at the point of logging, not this activity's real total cost. */
export function computeCostPreview(
  unitCost: number | null | undefined,
  dosePerHa: string,
  areaHa: string,
): { totalCost: number } | null {
  if (unitCost == null || !dosePerHa || !areaHa) return null;
  const dose = parseFloat(dosePerHa);
  const area = parseFloat(areaHa);
  if (!Number.isFinite(dose) || !Number.isFinite(area)) return null;
  return { totalCost: dose * area * unitCost };
}

export interface ScoutingNotesInput {
  category: string;
  severity: string;
  affectedHa: string;
  userNotes: string;
}

/** Composes the scouting-only fields (no dedicated schema columns exist for
 * them — see Sprint 11 report) into the single `notes` string actually sent
 * to createActivity. */
export function composeScoutingNotes({ category, severity, affectedHa, userNotes }: ScoutingNotesInput): string {
  return [
    `Category: ${category}`,
    `Severity: ${severity}`,
    affectedHa ? `Affected: ${affectedHa} ha` : null,
    userNotes || null,
  ].filter(Boolean).join(' · ');
}
