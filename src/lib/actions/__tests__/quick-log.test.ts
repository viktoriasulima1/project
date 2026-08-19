import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));
vi.mock('@/lib/activity-form-context', () => ({ getActivityFormContext: vi.fn() }));

import { getQuickLogOptions } from '../quick-log';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { getActivityFormContext } from '@/lib/activity-form-context';

const farm = { id: 'farm-1', name: 'Safe farm' };
const context = {
  fieldSeasons: [], products: [], machines: [], recentOperatorName: null,
  recentMachineId: null, weather: null,
};

describe('getQuickLogOptions target boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the existing farm-scoped context without mutation', async () => {
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(farm as never);
    vi.mocked(getActivityFormContext).mockResolvedValue(context);
    await expect(getQuickLogOptions()).resolves.toEqual({
      success: true, farmId: farm.id, farmName: farm.name, context,
    });
    expect(getActivityFormContext).toHaveBeenCalledWith(farm);
  });

  it('returns the current safe setup failure without requesting context', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('private authentication detail'));
    const result = await getQuickLogOptions();
    expect(result).toEqual({ success: false, error: { code: 'AUTH_REQUIRED', category: 'authentication', retryable: false } });
    expect(JSON.stringify(result)).not.toContain('private authentication detail');
    expect(getActivityFormContext).not.toHaveBeenCalled();
  });
});
