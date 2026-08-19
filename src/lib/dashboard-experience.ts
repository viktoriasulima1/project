import { db } from './db';
import { getFarmSetupState } from './farm-setup';
import type { FarmSetupState } from './farm-setup';

export type DashboardExperienceStateName =
  | 'onboarding_incomplete'
  | 'first_run'
  | 'early_usage'
  | 'active_farm';

export type PrimaryActionKey =
  | 'add_inventory'
  | 'record_activity'
  | 'add_field'
  | 'review_weather';

export interface PrimaryAction {
  key: PrimaryActionKey;
  label: string;
  href: string;
}

export interface DashboardExperience {
  state: DashboardExperienceStateName;
  setupState: FarmSetupState;
  activityCount: number;
  fieldCount: number;
  inventoryCount: number;
  /**
   * Set for first_run and early_usage — active_farm has enough real history
   * that the normal rule-based briefing (generateDailyBriefing) is a better
   * "what next" signal than this static priority list.
   */
  primaryAction: PrimaryAction | null;
}

// Thresholds are a deliberately simple, documented heuristic, not a tuned
// model: a farm with zero recorded activities has nothing real for
// financial/compliance/AI widgets to summarize yet (first_run). A farm
// with a handful of activities is still building up history — showing
// the full dashboard is fine, but it hasn't produced enough data for
// aggregate metrics (cost/ha, margins) to be meaningful (early_usage).
// At or above this many activities, normal aggregate widgets are treated
// as trustworthy (active_farm).
const ACTIVE_FARM_MIN_ACTIVITIES = 5;

/**
 * Resolves which "shape" of dashboard experience to show. Distinct from
 * getFarmSetupState() (which answers "is setup done") — this answers "does
 * this farm have enough real activity yet for aggregate metrics (finance,
 * compliance, AI briefing) to be meaningful, or would showing them just be
 * zeros dressed up as insight."
 */
export async function getDashboardExperienceState(): Promise<DashboardExperience> {
  const setupState = await getFarmSetupState();

  if (setupState.state !== 'ready' || !setupState.farmId) {
    return {
      state: 'onboarding_incomplete',
      setupState,
      activityCount: 0,
      fieldCount: 0,
      inventoryCount: 0,
      primaryAction: null,
    };
  }

  const farmId = setupState.farmId;

  const [activityCount, fieldCount, inventoryCount] = await Promise.all([
    db.activity.count({
      where: { fieldSeason: { field: { farmId } }, deletedAt: null },
    }),
    db.field.count({ where: { farmId, deletedAt: null } }),
    db.inventoryItem.count({ where: { farmId } }),
  ]);

  let state: DashboardExperienceStateName;
  if (activityCount === 0) {
    state = 'first_run';
  } else if (activityCount < ACTIVE_FARM_MIN_ACTIVITIES) {
    state = 'early_usage';
  } else {
    state = 'active_farm';
  }

  // Reachable in both first_run (activityCount === 0, so only the
  // add_inventory/record_activity tiers ever apply) and early_usage
  // (activityCount 1..4, where the add_field/review_weather tiers become
  // reachable too) — active_farm defers to the normal briefing instead.
  const primaryAction =
    state === 'first_run' || state === 'early_usage'
      ? computePrimaryAction({ inventoryCount, activityCount, fieldCount })
      : null;

  return { state, setupState, activityCount, fieldCount, inventoryCount, primaryAction };
}

// Priority order per the spec: inventory first (an activity usually needs a
// product to log against), then the activity itself, then growing the farm
// (a second field), then a lower-urgency review action.
function computePrimaryAction(params: {
  inventoryCount: number;
  activityCount: number;
  fieldCount: number;
}): PrimaryAction {
  const { inventoryCount, activityCount, fieldCount } = params;

  if (inventoryCount === 0) {
    return {
      key: 'add_inventory',
      label: 'Add your first inventory item',
      href: '/onboarding?step=inventory',
    };
  }
  if (activityCount === 0) {
    return {
      key: 'record_activity',
      label: 'Record your first activity',
      href: '/activities',
    };
  }
  if (fieldCount === 1) {
    return {
      key: 'add_field',
      label: 'Add a second field',
      href: '/fields',
    };
  }
  return {
    key: 'review_weather',
    label: 'Review local weather',
    href: '/weather',
  };
}
