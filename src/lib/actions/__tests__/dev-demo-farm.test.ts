import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = { farm: { findUnique: vi.fn(), update: vi.fn() } };
  return { mockDb };
});
vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: mockAuth }));

import { loadDemoFarm } from '../dev-demo-farm';

describe('loadDemoFarm', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    vi.stubEnv('NODE_ENV', originalNodeEnv ?? 'test');
    vi.unstubAllEnvs();
  });

  it('refuses to run outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = await loadDemoFarm({}, new FormData());
    expect(result.error).toBeDefined();
    expect(mockDb.farm.update).not.toHaveBeenCalled();
  });

  it('refuses to relink when the signed-in user already owns a different, real farm', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mockAuth.mockResolvedValue({ userId: 'user_real_farmer' });
    mockDb.farm.findUnique.mockResolvedValue({ id: 'farm-real-owned', clerkUserId: 'user_real_farmer' });

    const result = await loadDemoFarm({}, new FormData());

    expect(result.error).toContain('already have a farm');
    expect(mockDb.farm.update).not.toHaveBeenCalled();
  });

  it('relinks the demo farm to the signed-in user when they own no farm yet', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mockAuth.mockResolvedValue({ userId: 'user_new_dev' });
    mockDb.farm.findUnique.mockResolvedValue(null);
    mockDb.farm.update.mockResolvedValue({});

    const result = await loadDemoFarm({}, new FormData());

    expect(result.success).toBe(true);
    expect(mockDb.farm.update).toHaveBeenCalledWith({
      where: { id: 'dev-farm-gelderland' },
      data: { clerkUserId: 'user_new_dev' },
    });
  });

  it('is a no-op success when the user already owns the demo farm itself (duplicate click safe)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mockAuth.mockResolvedValue({ userId: 'user_demo_owner' });
    mockDb.farm.findUnique.mockResolvedValue({ id: 'dev-farm-gelderland', clerkUserId: 'user_demo_owner' });

    const result = await loadDemoFarm({}, new FormData());

    expect(result.success).toBe(true);
    expect(mockDb.farm.update).not.toHaveBeenCalled();
  });

  it('requires a signed-in session', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mockAuth.mockResolvedValue({ userId: null });

    const result = await loadDemoFarm({}, new FormData());

    expect(result.error).toBeDefined();
    expect(mockDb.farm.update).not.toHaveBeenCalled();
  });
});
