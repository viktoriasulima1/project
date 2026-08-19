/**
 * Canonical scouting overall-condition contract.
 *
 * The submitted/stored value is ALWAYS one of these language-independent
 * English enum tokens. Labels are localizable and may be translated (by the
 * product's own localization OR by a browser page-translation feature) without
 * ever changing the stored value — provided the UI binds option `value` to the
 * canonical token and never to visible text. See
 * docs/FARMOS_LOCALIZATION_AND_BROWSER_TRANSLATION_POLICY.md.
 */
export const CROP_CONDITIONS = ['good', 'satisfactory', 'poor', 'critical'] as const;
export type CropCondition = (typeof CROP_CONDITIONS)[number];

/**
 * Aliases we accept on the way IN only (legacy rows / old clients), normalised
 * to a canonical token before storage. `fair` is the pre-standardisation label
 * that shipped in earlier builds. Browser-translated visible labels are NOT
 * aliases and must never appear here.
 */
const CONDITION_ALIASES: Record<string, CropCondition> = {
  fair: 'satisfactory',
};

/** Default English labels. A real locale table can replace this per language. */
export const CROP_CONDITION_LABELS: Record<CropCondition, string> = {
  good: 'Good',
  satisfactory: 'Satisfactory',
  poor: 'Poor',
  critical: 'Critical',
};

export function isCropCondition(value: unknown): value is CropCondition {
  return typeof value === 'string' && (CROP_CONDITIONS as readonly string[]).includes(value);
}

/**
 * Normalise an inbound value to a canonical token.
 * - already-canonical values pass through
 * - known aliases (e.g. legacy `fair`) map to their canonical token
 * - anything else (including a translated label) returns null
 */
export function normalizeCropCondition(value: string | null | undefined): CropCondition | null {
  if (value == null) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (isCropCondition(trimmed)) return trimmed;
  return CONDITION_ALIASES[trimmed] ?? null;
}

export interface ConditionValidation {
  ok: boolean;
  value: CropCondition | null;
  /** A localizable, farmer-facing message — never a raw enum dump. */
  message: string | null;
}

/**
 * Field-level validation for the overall-condition control. Distinguishes an
 * empty selection from an invalid/translated value, and never leaks the raw
 * `expected one of ...` enum internals to the farmer.
 */
export function validateCropCondition(raw: string | null | undefined): ConditionValidation {
  if (raw == null || raw.trim() === '') {
    return { ok: false, value: null, message: 'Choose the overall crop condition before saving.' };
  }
  const normalized = normalizeCropCondition(raw);
  if (!normalized) {
    return { ok: false, value: null, message: 'Choose a valid overall crop condition before saving.' };
  }
  return { ok: true, value: normalized, message: null };
}
