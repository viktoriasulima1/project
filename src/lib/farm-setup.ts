import { db } from './db';
import { getActiveFarm } from './farm';
import type { Farm } from '@prisma/client';

export type FarmSetupStateName =
  | 'no_farm'
  | 'farm_created'
  | 'no_active_season'
  | 'no_fields'
  | 'no_field_seasons'
  | 'ready';

export interface FarmSetupState {
  state: FarmSetupStateName;
  missing: string[];
  nextRoute: string;
  completionPercent: number;
  farmId: string | null;
  activeSeasonId: string | null;
  /**
   * The resolved farm itself, if any — callers should use this instead of
   * calling getActiveFarm() again. Two calls to getActiveFarm() in the same
   * request means two Clerk auth() calls and two farm queries for no
   * reason; this field exists specifically to prevent that (see
   * docs/Active_Farm_Security_Audit.md).
   */
  farm: Farm | null;
}

/**
 * Single source of truth for "how far along is this farm's setup." Every
 * page that needs to know whether to redirect to onboarding, or what empty
 * state to show, should call this instead of re-deriving the same checks —
 * and should use the returned `farm` field instead of calling
 * getActiveFarm() a second time in the same request.
 */
export async function getFarmSetupState(): Promise<FarmSetupState> {
  const farm = await getActiveFarm();

  if (!farm) {
    return {
      state: 'no_farm',
      missing: ['farm'],
      nextRoute: '/onboarding',
      completionPercent: 0,
      farmId: null,
      activeSeasonId: null,
      farm: null,
    };
  }

  const seasonCount = await db.season.count({ where: { farmId: farm.id } });
  if (seasonCount === 0) {
    return {
      state: 'farm_created',
      missing: ['active season'],
      nextRoute: '/onboarding?step=season',
      completionPercent: 20,
      farmId: farm.id,
      activeSeasonId: null,
      farm,
    };
  }

  const activeSeason = await db.season.findFirst({
    where: { farmId: farm.id, isActive: true },
    orderBy: { year: 'desc' },
  });
  if (!activeSeason) {
    return {
      state: 'no_active_season',
      missing: ['active season'],
      nextRoute: '/onboarding?step=season',
      completionPercent: 20,
      farmId: farm.id,
      activeSeasonId: null,
      farm,
    };
  }

  const fieldCount = await db.field.count({ where: { farmId: farm.id, deletedAt: null } });
  if (fieldCount === 0) {
    return {
      state: 'no_fields',
      missing: ['field'],
      nextRoute: '/onboarding?step=field',
      completionPercent: 50,
      farmId: farm.id,
      activeSeasonId: activeSeason.id,
      farm,
    };
  }

  const fieldSeasonCount = await db.fieldSeason.count({
    where: { seasonId: activeSeason.id, field: { deletedAt: null } },
  });
  if (fieldSeasonCount === 0) {
    return {
      state: 'no_field_seasons',
      missing: ['crop assignment'],
      nextRoute: '/onboarding?step=crop',
      completionPercent: 75,
      farmId: farm.id,
      activeSeasonId: activeSeason.id,
      farm,
    };
  }

  return {
    state: 'ready',
    missing: [],
    nextRoute: '/dashboard',
    completionPercent: 100,
    farmId: farm.id,
    activeSeasonId: activeSeason.id,
    farm,
  };
}
