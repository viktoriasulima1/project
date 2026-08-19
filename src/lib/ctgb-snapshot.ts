import { normalizeProductRow } from '@/integrations/ctgb/cache';
import { checkCtgbCompliance, type CtgbComplianceStatus } from '@/lib/ctgb-compliance-check';

/**
 * Sprint 19 Part 7 — everything about a Ctgb authorisation that must be
 * frozen into a completed spray's compliance record, beyond the narrower
 * 3-field snapshot (`ctgbAuthorisationStatusAtCompletion`/`ctgbSourceUrl`/
 * `ctgbFetchedAt`) captured since Sprint 18. Those 3 keys are preserved
 * unchanged in `ComplianceRecord.data` for backward compatibility — this
 * type describes the additional fields layered alongside them.
 */
export interface CtgbSnapshotExtra {
  ctgbSourceProductId: string | null;
  ctgbSourceVersion: string | null;
  ctgbRawChecksum: string | null;
  ctgbComplianceStatus: CtgbComplianceStatus;
  /** The official use FarmOS matched against, auto-selected by crop name
   * unless a correction explicitly overrides it (Part 4/7) — null when no
   * use could be matched (or there's no Ctgb-linked product at all). */
  ctgbSelectedUse: {
    cropOrUseTarget: string;
    purpose: string | null;
    dosePerHaMin: number | null;
    dosePerHaMax: number | null;
    doseUnit: string | null;
    bbchMin: number | null;
    bbchMax: number | null;
    phiDays: number | null;
    bufferZoneMetres: number | null;
  } | null;
}

/** The shape needed from a Prisma query — a superset of what createActivity
 * / completeActivity already select, plus the product's `uses` relation. */
export interface CtgbProductReferenceRowForSnapshot {
  id: string;
  sourceProductId: string;
  authorisationNumber: string;
  officialName: string;
  authorisationStatus: string;
  authorisationStart: Date | null;
  authorisationEnd: Date | null;
  holder: string | null;
  activeSubstances: unknown;
  sourceUrl: string;
  fetchedAt: Date;
  sourceVersion: string | null;
  rawChecksum: string;
  uses: {
    cropOrUseTarget: string;
    purpose: string | null;
    dosePerHaMin: unknown;
    dosePerHaMax: unknown;
    doseUnit: string | null;
    maxApplicationsPerSeason: number | null;
    applicationIntervalDays: number | null;
    bbchMin: number | null;
    bbchMax: number | null;
    phiDays: number | null;
    bufferZoneMetres: unknown;
    otherRestrictions: string | null;
    sourceDocumentRef: string | null;
  }[];
}

/**
 * Builds the extra Ctgb snapshot fields for a completed/planned spray.
 * `ctgbProductReferenceRow` is null for a manual (non-Ctgb-linked) product —
 * the result is then honestly `manual_unverified` with no selected use,
 * never a fabricated one.
 */
export function buildCtgbSnapshotExtra(
  ctgbProductReferenceRow: CtgbProductReferenceRowForSnapshot | null,
  cropName: string | undefined,
  dosePerHa: number | null,
  doseUnit: string | null,
  selectedUseIndex?: number,
): CtgbSnapshotExtra {
  if (!ctgbProductReferenceRow) {
    return {
      ctgbSourceProductId: null,
      ctgbSourceVersion: null,
      ctgbRawChecksum: null,
      ctgbComplianceStatus: 'manual_unverified',
      ctgbSelectedUse: null,
    };
  }

  const product = normalizeProductRow(ctgbProductReferenceRow);
  const result = checkCtgbCompliance({
    isManualEntry: false,
    product,
    selectedUseIndex,
    cropName,
    dosePerHa: dosePerHa ?? undefined,
    doseUnit: doseUnit ?? undefined,
  });

  return {
    ctgbSourceProductId: product.sourceProductId,
    ctgbSourceVersion: product.sourceVersion,
    ctgbRawChecksum: product.rawChecksum,
    ctgbComplianceStatus: result.status,
    ctgbSelectedUse: result.matchedUse
      ? {
          cropOrUseTarget: result.matchedUse.cropOrUseTarget,
          purpose: result.matchedUse.purpose,
          dosePerHaMin: result.matchedUse.dosePerHaMin,
          dosePerHaMax: result.matchedUse.dosePerHaMax,
          doseUnit: result.matchedUse.doseUnit,
          bbchMin: result.matchedUse.bbchMin,
          bbchMax: result.matchedUse.bbchMax,
          phiDays: result.matchedUse.phiDays,
          bufferZoneMetres: result.matchedUse.bufferZoneMetres,
        }
      : null,
  };
}
