import type { NormalizedCtgbProduct, NormalizedCtgbUse } from '@/integrations/ctgb/types';

/**
 * Exactly the status vocabulary required by Sprint 18 Part 7 — this is a
 * SEPARATE concern from weather suitability (src/lib/spray-window.ts) and
 * from FarmOS's own rule-based warnings (e.g. stock sufficiency). Never
 * merge these into one blended score: Ctgb governs legal
 * crop/dose/BBCH/PHI/buffer restrictions; weather suitability is a
 * physical-conditions estimate; FarmOS warnings are operational
 * (inventory, certification, etc.). Combining them into a single number
 * would misrepresent what each one actually is.
 */
export type CtgbComplianceStatus =
  | 'verified'
  | 'incomplete'
  | 'manual_unverified'
  | 'expired'
  | 'use_not_found'
  | 'unavailable';

export interface CtgbComplianceResult {
  status: CtgbComplianceStatus;
  matchedUse: NormalizedCtgbUse | null;
  /** Every official use on this product, so the UI can offer an explicit
   * "select the intended use" control (Part 7) rather than relying only on
   * automatic crop-name matching. Empty when there's no linked product. */
  availableUses: NormalizedCtgbUse[];
  blockers: string[];
  warnings: string[];
  product: NormalizedCtgbProduct | null;
  disclaimer: string;
}

export const CTGB_COMPLIANCE_DISCLAIMER =
  'This check reflects only the fields present in the official Ctgb record at the time it was fetched. It is not a substitute for reading the actual product label. FarmOS never states that spraying is legally approved or guaranteed compliant.';

export interface CtgbComplianceInput {
  isManualEntry: boolean;
  product: NormalizedCtgbProduct | null;
  /** Explicit selection from the user, when the product has more than one
   * use (Part 7: "require explicit selection of the intended Ctgb use when
   * available"). Falls back to a best-effort crop-name match when absent. */
  selectedUseIndex?: number;
  cropName?: string;
  bbchStage?: number;
  dosePerHa?: number;
  doseUnit?: string;
}

function findMatchingUse(product: NormalizedCtgbProduct, cropName?: string): NormalizedCtgbUse | null {
  if (!cropName) return null;
  const needle = cropName.trim().toLowerCase();
  return (
    product.uses.find((u) => u.cropOrUseTarget.trim().toLowerCase().includes(needle)) ??
    product.uses.find((u) => needle.includes(u.cropOrUseTarget.trim().toLowerCase())) ??
    null
  );
}

/**
 * Evaluates ONLY the official Ctgb restriction dimension. Does not touch
 * weather at all — see spray-window.ts for that, and the caller (Sprint
 * 18 Part 7's ActivityDialog integration) for how the two are shown
 * side by side, never combined.
 */
export function checkCtgbCompliance(input: CtgbComplianceInput): CtgbComplianceResult {
  if (input.isManualEntry || !input.product) {
    return {
      status: 'manual_unverified',
      matchedUse: null,
      availableUses: [],
      blockers: [],
      warnings: ['This product was entered manually and has not been validated against the official Ctgb register.'],
      product: null,
      disclaimer: CTGB_COMPLIANCE_DISCLAIMER,
    };
  }

  const product = input.product;

  if (product.authorisationStatus !== 'authorised') {
    return {
      status: 'expired',
      matchedUse: null,
      availableUses: product.uses,
      blockers: [`Ctgb authorisation status is "${product.authorisationStatus}", not authorised.`],
      warnings: [],
      product,
      disclaimer: CTGB_COMPLIANCE_DISCLAIMER,
    };
  }

  const matchedUse =
    input.selectedUseIndex != null && product.uses[input.selectedUseIndex]
      ? product.uses[input.selectedUseIndex]
      : findMatchingUse(product, input.cropName);

  if (!matchedUse) {
    return {
      status: 'use_not_found',
      matchedUse: null,
      availableUses: product.uses,
      blockers: [],
      warnings: [
        input.cropName
          ? `No official Ctgb use was found for "${input.cropName}" — select the intended use manually if one applies, or treat this as unverified for this crop.`
          : 'Select the intended official use for this application.',
      ],
      product,
      disclaimer: CTGB_COMPLIANCE_DISCLAIMER,
    };
  }

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.dosePerHa != null) {
    if (matchedUse.dosePerHaMin != null && input.dosePerHa < matchedUse.dosePerHaMin) {
      blockers.push(`Dose ${input.dosePerHa}${input.doseUnit ?? ''} is below the official minimum of ${matchedUse.dosePerHaMin}${matchedUse.doseUnit ?? ''}/ha.`);
    }
    if (matchedUse.dosePerHaMax != null && input.dosePerHa > matchedUse.dosePerHaMax) {
      blockers.push(`Dose ${input.dosePerHa}${input.doseUnit ?? ''} exceeds the official maximum of ${matchedUse.dosePerHaMax}${matchedUse.doseUnit ?? ''}/ha.`);
    }
  } else {
    warnings.push('Dose was not compared against the official range — enter a dose to check it.');
  }

  if (input.bbchStage != null && (matchedUse.bbchMin != null || matchedUse.bbchMax != null)) {
    if (matchedUse.bbchMin != null && input.bbchStage < matchedUse.bbchMin) {
      blockers.push(`BBCH stage ${input.bbchStage} is below the official minimum of ${matchedUse.bbchMin}.`);
    }
    if (matchedUse.bbchMax != null && input.bbchStage > matchedUse.bbchMax) {
      blockers.push(`BBCH stage ${input.bbchStage} is above the official maximum of ${matchedUse.bbchMax}.`);
    }
  }

  const fieldsMissing =
    matchedUse.dosePerHaMin == null && matchedUse.dosePerHaMax == null &&
    matchedUse.bbchMin == null && matchedUse.bbchMax == null &&
    matchedUse.phiDays == null && matchedUse.bufferZoneMetres == null;

  if (fieldsMissing) {
    warnings.push('The matched official use has no structured dose/BBCH/PHI/buffer data recorded — only the crop/use match itself is verified.');
  }

  return {
    status: (product.isIncomplete || fieldsMissing) ? 'incomplete' : 'verified',
    matchedUse,
    availableUses: product.uses,
    blockers,
    warnings,
    product,
    disclaimer: CTGB_COMPLIANCE_DISCLAIMER,
  };
}
