import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    season: { count: vi.fn(), findFirst: vi.fn() },
    field: { count: vi.fn() },
    fieldSeason: { count: vi.fn() },
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('./db', () => ({ db: mockDb }));

const { mockGetActiveFarm } = vi.hoisted(() => ({ mockGetActiveFarm: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarm: mockGetActiveFarm }));
vi.mock('./farm', () => ({ getActiveFarm: mockGetActiveFarm }));

import { getFarmSetupState } from '../farm-setup';

const FARM = { id: 'farm-1', clerkUserId: 'user-1' };

describe('getFarmSetupState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves no_farm for a brand-new Clerk user with no farm', async () => {
    mockGetActiveFarm.mockResolvedValue(null);
    const result = await getFarmSetupState();
    expect(result.state).toBe('no_farm');
    expect(result.completionPercent).toBe(0);
    expect(result.farmId).toBeNull();
    expect(result.activeSeasonId).toBeNull();
    expect(result.nextRoute).toBe('/onboarding');
  });

  it('resolves farm_created when the farm has never had any season', async () => {
    mockGetActiveFarm.mockResolvedValue(FARM);
    mockDb.season.count.mockResolvedValue(0);
    const result = await getFarmSetupState();
    expect(result.state).toBe('farm_created');
    expect(result.farmId).toBe('farm-1');
  });

  it('resolves no_active_season when seasons exist but none is currently active', async () => {
    mockGetActiveFarm.mockResolvedValue(FARM);
    mockDb.season.count.mockResolvedValue(1);
    mockDb.season.findFirst.mockResolvedValue(null);
    const result = await getFarmSetupState();
    expect(result.state).toBe('no_active_season');
    expect(result.activeSeasonId).toBeNull();
  });

  it('resolves no_fields when there is an active season but zero fields', async () => {
    mockGetActiveFarm.mockResolvedValue(FARM);
    mockDb.season.count.mockResolvedValue(1);
    mockDb.season.findFirst.mockResolvedValue({ id: 'season-1', year: 2026 });
    mockDb.field.count.mockResolvedValue(0);
    const result = await getFarmSetupState();
    expect(result.state).toBe('no_fields');
    expect(result.activeSeasonId).toBe('season-1');
  });

  it('resolves no_field_seasons when fields exist but none are assigned to the active season', async () => {
    mockGetActiveFarm.mockResolvedValue(FARM);
    mockDb.season.count.mockResolvedValue(1);
    mockDb.season.findFirst.mockResolvedValue({ id: 'season-1', year: 2026 });
    mockDb.field.count.mockResolvedValue(2);
    mockDb.fieldSeason.count.mockResolvedValue(0);
    const result = await getFarmSetupState();
    expect(result.state).toBe('no_field_seasons');
  });

  it('reaches ready once farm, active season, fields, and field seasons all exist', async () => {
    mockGetActiveFarm.mockResolvedValue(FARM);
    mockDb.season.count.mockResolvedValue(1);
    mockDb.season.findFirst.mockResolvedValue({ id: 'season-1', year: 2026 });
    mockDb.field.count.mockResolvedValue(2);
    mockDb.fieldSeason.count.mockResolvedValue(1);
    const result = await getFarmSetupState();
    expect(result.state).toBe('ready');
    expect(result.completionPercent).toBe(100);
    expect(result.nextRoute).toBe('/dashboard');
  });

  it('never routes a ready farm back to /onboarding — no redirect loop', async () => {
    mockGetActiveFarm.mockResolvedValue(FARM);
    mockDb.season.count.mockResolvedValue(1);
    mockDb.season.findFirst.mockResolvedValue({ id: 'season-1', year: 2026 });
    mockDb.field.count.mockResolvedValue(2);
    mockDb.fieldSeason.count.mockResolvedValue(1);
    const result = await getFarmSetupState();
    expect(result.nextRoute).not.toBe('/onboarding');
  });

  it('returns the resolved farm object itself, so callers never need a second getActiveFarm() call', async () => {
    mockGetActiveFarm.mockResolvedValue(FARM);
    mockDb.season.count.mockResolvedValue(1);
    mockDb.season.findFirst.mockResolvedValue({ id: 'season-1', year: 2026 });
    mockDb.field.count.mockResolvedValue(2);
    mockDb.fieldSeason.count.mockResolvedValue(1);
    const result = await getFarmSetupState();
    expect(result.farm).toEqual(FARM);
    expect(mockGetActiveFarm).toHaveBeenCalledTimes(1);
  });

  it('resolves independently per farm — two different users get two different results (no cross-user leakage)', async () => {
    const FARM_A = { id: 'farm-a', clerkUserId: 'user-a' };
    const FARM_B = { id: 'farm-b', clerkUserId: 'user-b' };

    mockGetActiveFarm.mockResolvedValueOnce(FARM_A);
    mockDb.season.count.mockResolvedValueOnce(1);
    mockDb.season.findFirst.mockResolvedValueOnce({ id: 'season-a', year: 2026 });
    mockDb.field.count.mockResolvedValueOnce(1);
    mockDb.fieldSeason.count.mockResolvedValueOnce(1);
    const resultA = await getFarmSetupState();

    mockGetActiveFarm.mockResolvedValueOnce(FARM_B);
    mockDb.season.count.mockResolvedValueOnce(0);
    const resultB = await getFarmSetupState();

    expect(resultA.farm?.id).toBe('farm-a');
    expect(resultA.state).toBe('ready');
    expect(resultB.farm?.id).toBe('farm-b');
    expect(resultB.state).toBe('farm_created');
    expect(resultA.farmId).not.toBe(resultB.farmId);
  });
});
