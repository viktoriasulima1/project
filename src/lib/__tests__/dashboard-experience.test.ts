import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    activity: { count: vi.fn() },
    field: { count: vi.fn() },
    inventoryItem: { count: vi.fn() },
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('./db', () => ({ db: mockDb }));

const { mockGetFarmSetupState } = vi.hoisted(() => ({ mockGetFarmSetupState: vi.fn() }));
vi.mock('@/lib/farm-setup', () => ({ getFarmSetupState: mockGetFarmSetupState }));
vi.mock('./farm-setup', () => ({ getFarmSetupState: mockGetFarmSetupState }));

import { getDashboardExperienceState } from '../dashboard-experience';

const READY_SETUP_STATE = {
  state: 'ready' as const,
  missing: [],
  nextRoute: '/dashboard',
  completionPercent: 100,
  farmId: 'farm-1',
  activeSeasonId: 'season-1',
  farm: { id: 'farm-1', clerkUserId: 'user-1' },
};

const NOT_READY_SETUP_STATE = {
  state: 'no_fields' as const,
  missing: ['field'],
  nextRoute: '/onboarding?step=field',
  completionPercent: 50,
  farmId: 'farm-1',
  activeSeasonId: 'season-1',
  farm: { id: 'farm-1', clerkUserId: 'user-1' },
};

describe('getDashboardExperienceState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves onboarding_incomplete when setup is not ready, without querying activity/field/inventory counts', async () => {
    mockGetFarmSetupState.mockResolvedValue(NOT_READY_SETUP_STATE);

    const result = await getDashboardExperienceState();

    expect(result.state).toBe('onboarding_incomplete');
    expect(result.primaryAction).toBeNull();
    expect(mockDb.activity.count).not.toHaveBeenCalled();
  });

  it('resolves first_run for a ready farm with zero recorded activities', async () => {
    mockGetFarmSetupState.mockResolvedValue(READY_SETUP_STATE);
    mockDb.activity.count.mockResolvedValue(0);
    mockDb.field.count.mockResolvedValue(1);
    mockDb.inventoryItem.count.mockResolvedValue(0);

    const result = await getDashboardExperienceState();

    expect(result.state).toBe('first_run');
    expect(result.activityCount).toBe(0);
  });

  it('recommends adding inventory first when a first_run farm has none', async () => {
    mockGetFarmSetupState.mockResolvedValue(READY_SETUP_STATE);
    mockDb.activity.count.mockResolvedValue(0);
    mockDb.field.count.mockResolvedValue(1);
    mockDb.inventoryItem.count.mockResolvedValue(0);

    const result = await getDashboardExperienceState();

    expect(result.primaryAction?.key).toBe('add_inventory');
  });

  it('recommends recording the first activity once inventory exists but no activity has been logged', async () => {
    mockGetFarmSetupState.mockResolvedValue(READY_SETUP_STATE);
    mockDb.activity.count.mockResolvedValue(0);
    mockDb.field.count.mockResolvedValue(1);
    mockDb.inventoryItem.count.mockResolvedValue(2);

    const result = await getDashboardExperienceState();

    expect(result.primaryAction?.key).toBe('record_activity');
  });

  it('resolves early_usage once at least one activity exists but below the active-farm threshold', async () => {
    mockGetFarmSetupState.mockResolvedValue(READY_SETUP_STATE);
    mockDb.activity.count.mockResolvedValue(2);
    mockDb.field.count.mockResolvedValue(1);
    mockDb.inventoryItem.count.mockResolvedValue(2);

    const result = await getDashboardExperienceState();

    expect(result.state).toBe('early_usage');
  });

  it('recommends adding a second field during early_usage when only one field exists', async () => {
    mockGetFarmSetupState.mockResolvedValue(READY_SETUP_STATE);
    mockDb.activity.count.mockResolvedValue(2);
    mockDb.field.count.mockResolvedValue(1);
    mockDb.inventoryItem.count.mockResolvedValue(2);

    const result = await getDashboardExperienceState();

    expect(result.primaryAction?.key).toBe('add_field');
  });

  it('recommends reviewing weather during early_usage once multiple fields exist', async () => {
    mockGetFarmSetupState.mockResolvedValue(READY_SETUP_STATE);
    mockDb.activity.count.mockResolvedValue(2);
    mockDb.field.count.mockResolvedValue(3);
    mockDb.inventoryItem.count.mockResolvedValue(2);

    const result = await getDashboardExperienceState();

    expect(result.primaryAction?.key).toBe('review_weather');
  });

  it('resolves active_farm at or above the activity threshold, with no primary action (defers to the normal briefing)', async () => {
    mockGetFarmSetupState.mockResolvedValue(READY_SETUP_STATE);
    mockDb.activity.count.mockResolvedValue(5);
    mockDb.field.count.mockResolvedValue(3);
    mockDb.inventoryItem.count.mockResolvedValue(2);

    const result = await getDashboardExperienceState();

    expect(result.state).toBe('active_farm');
    expect(result.primaryAction).toBeNull();
  });
});
