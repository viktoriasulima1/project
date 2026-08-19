import type { Locale } from './locales';
import { FALLBACK_LOCALE } from './locales';
import { getNamespace } from './catalog';

/**
 * Canonical enum value → localized label.
 *
 * This is the core of the iPhone browser-translation fix: labels are ALWAYS
 * derived FROM the canonical value, never the reverse. A `<select>` binds
 * `option.value` to the canonical token and shows `getEnumLabel(...)` as text,
 * so translating (or mistranslating) the label can never change the submitted
 * value. Missing labels fall back to English, then to the canonical token — a
 * value is always displayable and never blank.
 */
export type EnumKind =
  | 'condition'
  | 'severity'
  | 'observationStatus'
  | 'priority'
  | 'activityType'
  | 'operationType'
  | 'workOrderStatus'
  | 'complianceStatus'
  | 'syncState'
  | 'soilType'
  | 'crop'
  | 'inventoryCategory'
  | 'unit'
  | 'fieldStatus'
  | 'costCategory'
  | 'financialSourceType'
  | 'financialAttribution'
  | 'financialVersionState';

function lookupLabel(locale: Locale, kind: EnumKind, value: string): string | undefined {
  const kindTree = getNamespace(locale, 'enums')[kind];
  if (kindTree && typeof kindTree === 'object') {
    const label = (kindTree as Record<string, unknown>)[value];
    if (typeof label === 'string') return label;
  }
  return undefined;
}

export function getEnumLabel(locale: Locale, kind: EnumKind, value: string, safeFallback?: string): string {
  return lookupLabel(locale, kind, value)
    ?? lookupLabel(FALLBACK_LOCALE, kind, value)
    ?? (safeFallback ? lookupLabel(locale, kind, safeFallback) ?? lookupLabel(FALLBACK_LOCALE, kind, safeFallback) : undefined)
    ?? value;
}

/** All labels for a kind — handy to pass to a Client Component as a prop map. */
export function getEnumLabels<T extends string>(locale: Locale, kind: EnumKind, values: readonly T[]): Record<T, string> {
  const out = {} as Record<T, string>;
  for (const value of values) out[value] = getEnumLabel(locale, kind, value);
  return out;
}
