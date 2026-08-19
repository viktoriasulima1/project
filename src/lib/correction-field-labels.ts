/**
 * Human-readable labels for `Activity.correctionDiff` field keys — shared
 * between the correction action (which writes the diff) and the record
 * detail view (which displays it). Deliberately its own plain module: a
 * `'use server'` file may only export async functions, so this constant
 * cannot live in `compliance-corrections.ts` alongside the actions
 * themselves.
 */
export const CORRECTION_FIELD_LABEL: Record<string, string> = {
  areaHa: 'Treated area (ha)',
  dosePerHa: 'Dose per ha',
  doseUnit: 'Dose unit',
  waterVolumePerHa: 'Water volume (L/ha)',
  operatorName: 'Operator',
  machineId: 'Machine',
  nozzleType: 'Nozzle',
  date: 'Date/time',
  bbchStage: 'BBCH stage',
  notes: 'Notes',
  productId: 'Product',
};
