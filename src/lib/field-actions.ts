/**
 * Field Detail action availability — PURE domain resolver.
 *
 * Extracted from field-economics.ts (Resolver Localization Stage 1) so this
 * module returns only stable, language-independent CODES + canonical metadata,
 * never final English prose. UI wording lives in the presentation adapter
 * (src/i18n/adapters/field-action.ts), so `i18n:audit -- resolvers` is zero for
 * this file. This module imports no i18n catalog and no React.
 *
 * Availability decisions are IDENTICAL to the previous implementation:
 * add_expense/add_harvest/review_breakdown/view_history are always available;
 * add_revenue needs an active season; allocate/correct/reverse/export_report are
 * online-only (atomic-across-fields or external-system mutations, never queued).
 */
export type FieldAction =
  | 'add_expense' | 'add_harvest' | 'add_revenue' | 'allocate' | 'correct' | 'reverse'
  | 'review_breakdown' | 'view_history' | 'export_report';

export interface FieldActionContext { online: boolean; hasActiveSeason: boolean }

/** Only codes with a real current decision are defined (per the brief). Add a
 *  code ONLY when a new decision branch requires it. */
export type FieldActionReasonCode = 'AVAILABLE' | 'OFFLINE_ONLY' | 'NO_ACTIVE_SEASON';

export interface FieldActionReasonMetadata {
  /** Canonical action token — never localized text. */
  actionType: FieldAction;
}

export type FieldActionAvailability =
  | { available: true; code: 'AVAILABLE' }
  | { available: false; code: Exclude<FieldActionReasonCode, 'AVAILABLE'>; metadata: FieldActionReasonMetadata };

const AVAILABLE: FieldActionAvailability = { available: true, code: 'AVAILABLE' };

export function fieldActionAvailability(ctx: FieldActionContext): Record<FieldAction, FieldActionAvailability> {
  const { online, hasActiveSeason } = ctx;
  const offlineOnly = (action: FieldAction): FieldActionAvailability =>
    ({ available: false, code: 'OFFLINE_ONLY', metadata: { actionType: action } });

  return {
    add_expense: AVAILABLE,
    add_harvest: AVAILABLE,
    add_revenue: hasActiveSeason ? AVAILABLE : { available: false, code: 'NO_ACTIVE_SEASON', metadata: { actionType: 'add_revenue' } },
    allocate: online ? AVAILABLE : offlineOnly('allocate'),
    correct: online ? AVAILABLE : offlineOnly('correct'),
    reverse: online ? AVAILABLE : offlineOnly('reverse'),
    review_breakdown: AVAILABLE,
    view_history: AVAILABLE,
    export_report: online ? AVAILABLE : offlineOnly('export_report'),
  };
}
