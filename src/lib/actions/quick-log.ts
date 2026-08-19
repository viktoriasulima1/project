'use server';

import { getActiveFarmOrThrow } from '@/lib/farm';
import { getActivityFormContext } from '@/lib/activity-form-context';
import type { ActivityFormContext } from '@/lib/activity-form-context';
import { userError, type UserFacingError } from '@/lib/user-error';

export type QuickLogOptionsResult =
  | { success: true; farmId: string; farmName: string; context: ActivityFormContext }
  | { success: false; error: UserFacingError };

/**
 * Fetched on-demand (when Quick Log is opened), not on every page load —
 * Quick Log is meant to be available from anywhere (dashboard, activities,
 * topbar, mobile FAB) without every single farm page paying the cost of
 * fetching field/product/machine lists it doesn't otherwise need.
 *
 * Read-only — the actual write still goes through createActivity, the same
 * action the full activity form uses. This is not a second business-logic
 * path, just a lazy way to get the same options.
 */
export async function getQuickLogOptions(): Promise<QuickLogOptionsResult> {
  try {
    const farm = await getActiveFarmOrThrow();
    const context = await getActivityFormContext(farm);
    return { success: true, farmId: farm.id, farmName: farm.name, context };
  } catch {
    return { success: false, error: userError('AUTH_REQUIRED') };
  }
}
