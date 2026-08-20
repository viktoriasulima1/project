import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    field: { findFirst: vi.fn() },
    fieldNdviReading: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/db', () => ({ db: mockDb }));

const { mockFetchNdviStatisticsCached } = vi.hoisted(() => ({ mockFetchNdviStatisticsCached: vi.fn() }));
vi.mock('@/integrations/copernicus/cache', () => ({ fetchNdviStatisticsCached: mockFetchNdviStatisticsCached }));

import { refreshFieldNdvi } from '../ndvi';
import { getActiveFarmOrThrow } from '@/lib/farm';

const FIELD_ID = 'a2661b3b-2333-4cdd-82f1-746b9124312f';
const POLYGON = { type: 'Polygon', coordinates: [[[5.9, 51.9], [5.91, 51.9], [5.91, 51.91], [5.9, 51.91], [5.9, 51.9]]] };

describe('refreshFieldNdvi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1' } as never);
    mockDb.field.findFirst.mockResolvedValue({ id: FIELD_ID, coordinates: POLYGON });
    mockDb.$transaction.mockResolvedValue(undefined);
    mockFetchNdviStatisticsCached.mockResolvedValue([
      { periodFrom: '2026-08-01T00:00:00.000Z', periodTo: '2026-08-10T00:00:00.000Z', meanNdvi: 0.62, sampleCount: 900, cloudCoveragePct: 10, fetchedAt: '2026-08-20T00:00:00.000Z' },
    ]);
  });

  it('fetches NDVI for the field geometry and upserts each reading', async () => {
    const result = await refreshFieldNdvi(FIELD_ID);
    expect(result).toEqual({ success: true, readingCount: 1 });
    expect(mockFetchNdviStatisticsCached).toHaveBeenCalledWith(POLYGON, expect.any(String), expect.any(String));
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuses a field with no recorded geometry without calling Copernicus', async () => {
    mockDb.field.findFirst.mockResolvedValue({ id: FIELD_ID, coordinates: null });
    const result = await refreshFieldNdvi(FIELD_ID);
    expect(result).toMatchObject({ success: false, error: { code: 'INVALID_COORDINATES' } });
    expect(mockFetchNdviStatisticsCached).not.toHaveBeenCalled();
  });

  it('refuses a field belonging to another farm', async () => {
    mockDb.field.findFirst.mockResolvedValue(null);
    const result = await refreshFieldNdvi(FIELD_ID);
    expect(result).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(mockFetchNdviStatisticsCached).not.toHaveBeenCalled();
  });

  it('does not reveal farm details when there is no active farm', async () => {
    vi.mocked(getActiveFarmOrThrow).mockRejectedValue(new Error('foreign farm details'));
    const result = await refreshFieldNdvi(FIELD_ID);
    expect(result).toMatchObject({ success: false, error: { code: 'AUTH_REQUIRED' } });
    expect(mockFetchNdviStatisticsCached).not.toHaveBeenCalled();
  });

  it('never leaks a raw provider error message', async () => {
    mockFetchNdviStatisticsCached.mockRejectedValue(new Error('Copernicus source unavailable: upstream returned 503'));
    const result = await refreshFieldNdvi(FIELD_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(JSON.stringify(result.error)).not.toContain('upstream returned 503');
  });
});
