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
