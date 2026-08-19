import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedirect, mockGetActiveFarm } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  mockGetActiveFarm: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('@/lib/farm', () => ({ getActiveFarm: mockGetActiveFarm }));
vi.mock('./farm', () => ({ getActiveFarm: mockGetActiveFarm }));

import { requireFarm } from '../require-farm';

describe('requireFarm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects protected modules to /onboarding when there is no farm', async () => {
    mockGetActiveFarm.mockResolvedValue(null);
    await expect(requireFarm()).rejects.toThrow('REDIRECT:/onboarding');
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding');
  });

  it('returns the farm without redirecting when one exists', async () => {
    const farm = { id: 'farm-1', clerkUserId: 'user-1' };
    mockGetActiveFarm.mockResolvedValue(farm);
    const result = await requireFarm();
    expect(result).toEqual(farm);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
