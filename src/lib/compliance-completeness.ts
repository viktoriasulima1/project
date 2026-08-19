/**
 * Sprint 19 Part 8 — a single, centralized resolver for "how complete is
 * this compliance record," so the Compliance page, PDF export, and CSV
 * export can never independently disagree about what counts as missing.
 *
 * Deliberately named "FarmOS record completeness" everywhere this is
 * surfaced — never "government-certified" or "legally approved." See
 * CTGB_COMPLIANCE_DISCLAIMER in ctgb-compliance-check.ts for the sibling
 * disclaimer this one is meant to be read alongside.
 */
export type ComplianceCompletenessStatus =
  | 'complete'
  | 'incomplete'
  | 'verification_unavailable'
  | 'corrected'
  | 'reversed';

export const FARMOS_COMPLETENESS_LABEL = 'FarmOS record completeness';

export interface ComplianceCompletenessData {
  fieldName?: string | null;
  crop?: string | null;
  date?: string | null;
  areaHa?: number | null;
  operatorName?: string | null;
  certificateNumber?: string | null;
  machineName?: string | null;
  nozzleType?: string | null;
  waterVolumePerHa?: number | null;
  productName?: string | null;
  productRegistrationNumber?: string | null;
  dosePerHa?: number | null;
  doseUnit?: string | null;
  bbchStage?: number | null;
  weatherTempC?: number | null;
  weatherWindKmh?: number | null;
  weatherHumidity?: number | null;
  /** From CtgbSnapshotExtra.ctgbComplianceStatus — 'manual_unverified' when
   * there is no Ctgb-linked product at all. */
  ctgbComplianceStatus?: string | null;
}

export interface ComplianceCompletenessInput {
  activityType: string;
  isReversal: boolean;
  correctionCount: number;
  effectiveVersion: number;
  data: ComplianceCompletenessData;
}

export interface ComplianceCompletenessResult {
  status: ComplianceCompletenessStatus;
  missingFields: string[];
  warnings: string[];
  sourceStatus: string;
  effectiveVersion: number;
  correctionCount: number;
}

const REGULATED_PRODUCT_TYPES = new Set(['spray', 'fertilise']);

export function resolveComplianceCompleteness(input: ComplianceCompletenessInput): ComplianceCompletenessResult {
  const d = input.data;
  const sourceStatus = d.ctgbComplianceStatus ?? 'manual_unverified';

  if (input.isReversal) {
    return {
      status: 'reversed',
      missingFields: [],
      warnings: ['This record has been reversed — excluded from active compliance totals by default.'],
      sourceStatus,
      effectiveVersion: input.effectiveVersion,
      correctionCount: input.correctionCount,
    };
  }

  const missing: string[] = [];
  if (!d.fieldName) missing.push('field');
  if (!d.crop) missing.push('crop');
  if (!d.date) missing.push('date/time');
  if (d.areaHa == null) missing.push('treated area');

  if (REGULATED_PRODUCT_TYPES.has(input.activityType)) {
    if (!d.productName) missing.push('product');
    if (d.dosePerHa == null) missing.push('dose');
    if (!d.doseUnit) missing.push('dose unit');
  }

  if (input.activityType === 'spray') {
    if (!d.operatorName) missing.push('operator');
    if (!d.certificateNumber) missing.push('operator certificate');
    if (!d.machineName) missing.push('machine');
    if (!d.nozzleType) missing.push('nozzle');
    if (d.waterVolumePerHa == null) missing.push('water volume');
    if (!d.productRegistrationNumber) missing.push('authorisation number');
  }

  if (d.weatherTempC == null && d.weatherWindKmh == null && d.weatherHumidity == null) {
    missing.push('weather snapshot');
  }

  const warnings: string[] = [];
  if (sourceStatus === 'manual_unverified') {
    warnings.push('Product was entered manually and is not verified against the official Ctgb register.');
  } else if (sourceStatus === 'use_not_found') {
    warnings.push('No official Ctgb use was matched for this crop.');
  } else if (sourceStatus === 'expired') {
    warnings.push('The linked Ctgb authorisation was not active at last verification.');
  } else if (sourceStatus === 'incomplete') {
    warnings.push('The matched official Ctgb use has incomplete structured data.');
  } else if (sourceStatus === 'unavailable') {
    warnings.push('Official Ctgb verification was unavailable at the time this was checked.');
  }

  let status: ComplianceCompletenessStatus;
  if (input.correctionCount > 0) {
    status = 'corrected';
  } else if (sourceStatus === 'unavailable') {
    status = 'verification_unavailable';
  } else if (missing.length > 0) {
    status = 'incomplete';
  } else {
    status = 'complete';
  }

  return {
    status,
    missingFields: missing,
    warnings,
    sourceStatus,
    effectiveVersion: input.effectiveVersion,
    correctionCount: input.correctionCount,
  };
}
