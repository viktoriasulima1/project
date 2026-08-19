import type { EffectiveComplianceRecord } from '@/lib/compliance-data';
import type { ExportContext } from './types';

/**
 * Sprint 19 Part 11 — CSV spray diary export for machine/accountant/advisor
 * use. Stable column names, ISO dates, explicit units, one row per
 * effective record (or per version when correction history is included).
 */
export const CSV_COLUMNS = [
  'export_id', 'record_id', 'original_record_id', 'effective_version', 'correction_count', 'record_status',
  'activity_date', 'farm', 'field', 'crop', 'field_area_ha', 'treated_area_ha', 'product_name',
  'authorisation_number', 'ctgb_verification_status', 'intended_use', 'dose', 'dose_unit', 'total_quantity',
  'quantity_unit', 'water_volume_l_ha', 'operator', 'machine', 'nozzle', 'bbch', 'weather_temperature_c',
  'weather_wind_kmh', 'weather_humidity_pct', 'completeness_status', 'missing_fields', 'created_at', 'corrected_at',
] as const;

// OWASP CSV-injection mitigation: a cell that a spreadsheet would interpret
// as a formula (leading =, +, -, or @) is prefixed with a single quote so
// it opens as inert text instead of executing.
const FORMULA_INJECTION_PREFIX = /^[=+\-@]/;

export function escapeCsvValue(raw: string | number | null | undefined): string {
  const value = raw == null ? '' : String(raw);
  const safe = FORMULA_INJECTION_PREFIX.test(value) ? `'${value}` : value;
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function isoDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString();
}

function num(n: number | null | undefined): string {
  // Fixed-point, '.' decimal separator only — never locale-formatted
  // (Part 11: "no locale-dependent ambiguous decimal formatting").
  return n == null ? '' : String(Number(n));
}

export function buildComplianceCsv(records: EffectiveComplianceRecord[], ctx: ExportContext): string {
  const rows: string[][] = [[...CSV_COLUMNS]];

  for (const r of records) {
    const d = r.data as {
      fieldName?: string; crop?: string; fieldHectares?: string; areaHa?: number; productName?: string;
      productRegistrationNumber?: string; ctgbComplianceStatus?: string; ctgbSelectedUse?: { cropOrUseTarget?: string } | null;
      dosePerHa?: number; doseUnit?: string; waterVolumePerHa?: number; operatorName?: string; machineName?: string;
      nozzleType?: string; bbchStage?: number; weatherTempC?: number; weatherWindKmh?: number; weatherHumidity?: number;
    };
    const totalQuantity = d.dosePerHa != null && d.areaHa != null ? d.dosePerHa * d.areaHa : null;

    rows.push([
      ctx.exportId,
      r.activityId,
      r.rootActivityId,
      String(r.version),
      String(r.correctionCount),
      r.isReversal ? 'reversed' : r.correctionCount > 0 ? 'corrected' : 'original',
      isoDate(r.date),
      ctx.farmName,
      d.fieldName ?? '',
      d.crop ?? '',
      d.fieldHectares ?? '',
      num(d.areaHa),
      d.productName ?? '',
      d.productRegistrationNumber ?? '',
      d.ctgbComplianceStatus ?? '',
      d.ctgbSelectedUse?.cropOrUseTarget ?? '',
      num(d.dosePerHa),
      d.doseUnit ?? '',
      num(totalQuantity),
      d.doseUnit ?? '',
      num(d.waterVolumePerHa),
      d.operatorName ?? '',
      d.machineName ?? '',
      d.nozzleType ?? '',
      d.bbchStage != null ? String(d.bbchStage) : '',
      num(d.weatherTempC),
      num(d.weatherWindKmh),
      num(d.weatherHumidity),
      r.completeness.status,
      r.completeness.missingFields.join('; '),
      isoDate(r.originalCreatedAt),
      r.correctionCount > 0 ? isoDate(r.versionCreatedAt) : '',
    ].map(escapeCsvValue));
  }

  // UTF-8 BOM for Dutch Excel compatibility (Part 11) — Excel on Windows
  // otherwise mis-detects encoding and mangles diacritics (ë, ï, ü, ...).
  // Built via String.fromCharCode rather than a literal character in source
  // so it can never be silently lost/duplicated by an editor's encoding.
  const BOM = String.fromCharCode(0xfeff);
  return BOM + rows.map((row) => row.join(',')).join('\r\n') + '\r\n';
}
