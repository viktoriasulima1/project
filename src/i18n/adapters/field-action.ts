import type { Translate } from '../translator';
import type { FieldActionAvailability } from '@/lib/field-actions';

/**
 * Presentation adapter (Part 7): maps a Field Action availability CODE to a
 * localized reason. Kept OUT of the pure resolver (which imports no i18n).
 *
 * `t` must be bound to the `fields` namespace — server `getServerI18n(['fields']).t`
 * or client `useTranslations('fields')`. Exhaustive by construction: adding a new
 * reason code fails to compile here until a case is added; genuinely unknown
 * runtime data degrades to a safe generic message — never a raw code.
 */
export function translateFieldActionReason(t: Translate, availability: FieldActionAvailability): string | null {
  if (availability.available) return null;
  switch (availability.code) {
    case 'OFFLINE_ONLY':
      return t('actions.reasons.offlineOnly');
    case 'NO_ACTIVE_SEASON':
      return t('actions.reasons.noActiveSeason');
    default: {
      // Compile-time exhaustiveness: this fails if a FieldActionReasonCode is
      // added without a case above.
      const _exhaustive: never = availability;
      void _exhaustive;
      // Runtime safety: never surface a raw code to the farmer.
      return t('actions.reasons.unavailable');
    }
  }
}
