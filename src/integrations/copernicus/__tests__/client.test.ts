import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../token', () => ({ getAccessToken: vi.fn().mockResolvedValue('test-token') }));

import { fetchNdviStatistics } from '../client';
import { CopernicusGeometryError, CopernicusUnavailableError } from '../errors';
import { getAccessToken } from '../token';

const VALID_POLYGON = { type: 'Polygon' as const, coordinates: [[[5.9, 51.9], [5.91, 51.9], [5.91, 51.91], [5.9, 51.91], [5.9, 51.9]]] };

const ORIGINAL_ENV = { ...process.env };

describe('fetchNdviStatistics', () => {
  beforeEach(() => {
    delete process.env.E2E_MOCK_COPERNICUS;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it('posts to the real Sentinel Hub Statistical API with a bearer token and the field geometry', async () => {
    const raw = { data: [{ interval: { from: '2026-08-01', to: '2026-08-10' }, outputs: {} }] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => raw });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchNdviStatistics(VALID_POLYGON, '2026-08-01', '2026-08-10');
    expect(result).toEqual(raw);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://sh.dataspace.copernicus.eu/statistics/v1',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.input.bounds.geometry).toEqual(VALID_POLYGON);
    expect(body.input.data).toEqual([{ type: 'sentinel-2-l2a' }]);
    expect(body.aggregation.timeRange).toEqual({ from: '2026-08-01', to: '2026-08-10' });
  });

  it('rejects a field with no polygon geometry before making any network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchNdviStatistics({ type: 'Polygon', coordinates: [] }, '2026-08-01', '2026-08-10')).rejects.toThrow(CopernicusGeometryError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it('wraps a non-ok upstream response in CopernicusUnavailableError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchNdviStatistics(VALID_POLYGON, '2026-08-01', '2026-08-10')).rejects.toThrow(CopernicusUnavailableError);
  });

  it('wraps a network failure in CopernicusUnavailableError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(fetchNdviStatistics(VALID_POLYGON, '2026-08-01', '2026-08-10')).rejects.toThrow(CopernicusUnavailableError);
  });

  it('returns mock data and never touches the network when E2E_MOCK_COPERNICUS is set', async () => {
    process.env.E2E_MOCK_COPERNICUS = 'true';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchNdviStatistics(VALID_POLYGON, '2026-08-01', '2026-08-10');
    expect(result.data).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
