/**
 * GPS accuracy policy for field detection.
 *
 * The physical iPhone test returned accuracy ≈ 5632 m yet the UI presented it
 * as ordinary "live location" evidence. A point that coarse cannot identify a
 * field, so it must never be auto-suggested as a reliable match or silently
 * stored as strong evidence. Accuracy is always persisted alongside the
 * coordinates so the confidence of every stored point is auditable.
 *
 * Thresholds (metres). These mirror the ranges the physical-test brief
 * proposed; if product policy later refines them, change them here only.
 */
export const GPS_ACCURACY_THRESHOLDS = {
  high: 30, // ≤ 30 m
  usable: 150, // > 30 m and ≤ 150 m
  low: 1000, // > 150 m and ≤ 1000 m
} as const;

export type GpsConfidence = 'high' | 'usable' | 'low' | 'unusable';

export interface GpsAccuracyAssessment {
  confidence: GpsConfidence;
  accuracyM: number;
  /** True only when the fix is precise enough to auto-suggest a field. */
  usableForFieldSuggestion: boolean;
  /** Whether a low/unusable fix should require explicit farmer confirmation. */
  requiresConfirmation: boolean;
  /** Farmer-facing, localizable message. */
  message: string;
}

export function classifyGpsAccuracy(accuracyM: number | null | undefined): GpsAccuracyAssessment {
  // A missing/invalid accuracy is treated as unusable, never as precise.
  if (accuracyM == null || !Number.isFinite(accuracyM) || accuracyM < 0) {
    return {
      confidence: 'unusable',
      accuracyM: Number.isFinite(accuracyM as number) ? (accuracyM as number) : Number.POSITIVE_INFINITY,
      usableForFieldSuggestion: false,
      requiresConfirmation: true,
      message: 'Location accuracy is unknown. Select the field manually and confirm.',
    };
  }
  const rounded = Math.round(accuracyM);
  if (accuracyM <= GPS_ACCURACY_THRESHOLDS.high) {
    return {
      confidence: 'high',
      accuracyM,
      usableForFieldSuggestion: true,
      requiresConfirmation: false,
      message: `Location accuracy ${rounded} m — high confidence.`,
    };
  }
  if (accuracyM <= GPS_ACCURACY_THRESHOLDS.usable) {
    return {
      confidence: 'usable',
      accuracyM,
      usableForFieldSuggestion: true,
      requiresConfirmation: true,
      message: `Location accuracy ${rounded} m — usable, but confirm the field before saving.`,
    };
  }
  if (accuracyM <= GPS_ACCURACY_THRESHOLDS.low) {
    return {
      confidence: 'low',
      accuracyM,
      usableForFieldSuggestion: false,
      requiresConfirmation: true,
      message: `Location accuracy ${rounded} m is too low to identify a field. Retry or select the field manually.`,
    };
  }
  return {
    confidence: 'unusable',
    accuracyM,
    usableForFieldSuggestion: false,
    requiresConfirmation: true,
    message: `Location accuracy is too low to identify a field (±${rounded} m). Retry location or select the field manually.`,
  };
}

export interface LocationEvidence {
  latitude: number;
  longitude: number;
  /** Always stored with the coordinates so the confidence of a point is auditable. */
  locationAccuracyM: number;
}

/**
 * Decides whether a captured point may be stored as field evidence. A point is
 * attached only when it is precise enough to suggest a field, OR the farmer has
 * explicitly confirmed a low-accuracy point — never silently. Accuracy is
 * always persisted alongside the coordinates.
 */
export function buildLocationEvidence(
  point: { latitude: number; longitude: number; accuracy: number } | null,
  assessment: GpsAccuracyAssessment | null,
  confirmed: boolean,
): LocationEvidence | null {
  if (!point) return null;
  const trusted = Boolean(assessment?.usableForFieldSuggestion) || confirmed;
  if (!trusted) return null;
  return { latitude: point.latitude, longitude: point.longitude, locationAccuracyM: point.accuracy };
}
