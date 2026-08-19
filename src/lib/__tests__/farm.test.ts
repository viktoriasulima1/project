import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    farm: { findUnique: vi.fn(), findFirst: vi.fn() },
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('./db', () => ({ db: mockDb }));

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: mockAuth }));

import { getActiveFarm } from '../farm';

const SEED_FARM = { id: 'dev-farm-gelderland', clerkUserId: 'user_seed_owner' };

describe('getActiveFarm — Clerk-farm linking', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.stubEnv('NODE_ENV', originalNodeEnv ?? 'test');
    vi.unstubAllEnvs();
  });

  it('resolves the seeded farm for the Clerk user it is linked to', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_seed_owner' });
    mockDb.farm.findUnique.mockResolvedValue(SEED_FARM);

    const result = await getActiveFarm();

    expect(mockDb.farm.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_seed_owner' },
    });
    expect(result).toEqual(SEED_FARM);
  });

  it('rejects cross-user access — a different signed-in user does not see the seeded farm', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_someone_else' });
    mockDb.farm.findUnique.mockResolvedValue(null); // no farm row has this clerkUserId

    const result = await getActiveFarm();

    expect(mockDb.farm.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_someone_else' },
    });
    expect(mockDb.farm.findFirst).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('never falls back to "first farm in the database" in production, even with no session', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mockAuth.mockResolvedValue({ userId: null });

    const result = await getActiveFarm();

    expect(mockDb.farm.findFirst).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('falls back to the first farm in development, but only with no session AND the explicit opt-in flag', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ALLOW_DEV_FARM_FALLBACK', 'true');
    mockAuth.mockResolvedValue({ userId: null });
    mockDb.farm.findFirst.mockResolvedValue(SEED_FARM);

    const result = await getActiveFarm();

    expect(mockDb.farm.findUnique).not.toHaveBeenCalled();
    expect(mockDb.farm.findFirst).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } });
    expect(result).toEqual(SEED_FARM);
  });

  it('does NOT fall back in development when ALLOW_DEV_FARM_FALLBACK is unset — NODE_ENV alone is not enough', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    // Deliberately not setting ALLOW_DEV_FARM_FALLBACK.
    mockAuth.mockResolvedValue({ userId: null });

    const result = await getActiveFarm();

    expect(mockDb.farm.findFirst).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('does NOT fall back in development when ALLOW_DEV_FARM_FALLBACK is set to anything other than "true"', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ALLOW_DEV_FARM_FALLBACK', '1');
    mockAuth.mockResolvedValue({ userId: null });

    const result = await getActiveFarm();

    expect(mockDb.farm.findFirst).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('does not use the development fallback when a real session exists but its farm lookup misses', async () => {
    // This is the exact bug scenario from the Sprint 7 audit: a real Clerk
    // session with no matching farm must return null, not silently grab
    // whatever farm happens to be first in the database.
    vi.stubEnv('NODE_ENV', 'development');
    mockAuth.mockResolvedValue({ userId: 'user_real_session_no_farm' });
    mockDb.farm.findUnique.mockResolvedValue(null);

    const result = await getActiveFarm();

    expect(mockDb.farm.findFirst).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('does not use the fallback for a real session even with ALLOW_DEV_FARM_FALLBACK=true — never masks a missing farm as someone else\'s', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ALLOW_DEV_FARM_FALLBACK', 'true');
    mockAuth.mockResolvedValue({ userId: 'user_real_session_no_farm' });
    mockDb.farm.findUnique.mockResolvedValue(null);

    const result = await getActiveFarm();

    expect(mockDb.farm.findFirst).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
