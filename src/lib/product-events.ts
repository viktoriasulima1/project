import type { ErrorCategory } from './user-error';

export type ProductEventName =
  | 'onboarding_completed'
  | 'first_inventory_item_created'
  | 'first_activity_started'
  | 'first_activity_completed'
  | 'first_activity_failed'
  | 'first_dashboard_value_reached'
  | 'empty_state_cta_clicked'
  // Sprint 11 — activity dialog / Quick Log
  | 'quick_log_opened'
  | 'activity_type_selected'
  | 'activity_review_opened'
  | 'activity_created'
  | 'activity_failed'
  | 'repeat_activity_used';

/**
 * Deliberately narrow — only these fields exist on the type, so there is no
 * way to accidentally pass through certificate numbers, addresses, raw form
 * payloads, or Clerk tokens even by mistake. `userId` here is the Clerk user
 * id, which is already an opaque internal identifier (not the user's email
 * or name), safe to log as-is per the "internal ID if already used" rule.
 */
export interface ProductEventInput {
  event: ProductEventName;
  farmId?: string;
  userId?: string;
  activityType?: string;
  module?: string;
  success?: boolean;
  errorCategory?: ErrorCategory;
}

export interface ProductEvent extends ProductEventInput {
  timestamp: string;
}

/**
 * Lightweight internal structured logging — console output today, not an
 * external analytics platform (see Sprint_10_First_Value_Report.md for why:
 * this is a "log a fact happened," not a growth/analytics tool, and adding
 * a vendor SDK for 7 event names would be disproportionate).
 */
export function logProductEvent(input: ProductEventInput): void {
  const event: ProductEvent = { ...input, timestamp: new Date().toISOString() };
  // eslint-disable-next-line no-console
  console.log('[product-event]', JSON.stringify(event));
}
