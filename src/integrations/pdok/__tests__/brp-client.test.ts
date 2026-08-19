import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchBrpParcelsByBbox, bboxAroundPoint } from '../brp-client';

const FEATURE_COLLECTION_WITH_NEXT = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[5.9, 52.0], [5.91, 52.0], [5.91, 52.01], [5.9, 52.01], [5.9, 52.0]]] },
      properties: { category: 'Bouwland', gewas: 'Tarwe', gewascode: 233, jaar: 2025, status: 'Definitief' },
    },
  ],
  numberReturned: 1,
  links: [
    { rel: 'self', href: 'https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections/brpgewas/items?f=json' },
    { rel: 'next', href: 'https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections/brpgewas/items?f=json&cursor=Ag%7CNAynHA' },
  ],
};

describe('searchBrpParcelsByBbox', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Test 12: Pagination/cursor handling
  it('surfaces the next-page cursor from the response links, without eagerly following it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => FEATURE_COLLECTION_WITH_NEXT }));
    const result = await searchBrpParcelsByBbox([5.9, 52.0, 5.92, 52.02]);
    expect(result.state).toBe('ok');
    expect(result.nextCursor).toBe('Ag|NAynHA');
  });

  it('has no nextCursor when the response includes no next link', async () => {
    const noNext = { ...FEATURE_COLLECTION_WITH_NEXT, links: [FEATURE_COLLECTION_WITH_NEXT.links[0]] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => noNext }));
    const result = await searchBrpParcelsByBbox([5.9, 52.0, 5.92, 52.02]);
    expect(result.nextCursor).toBeUndefined();
  });

  // Test 22 (client layer): PDOK unavailable
  it('returns state "unavailable" with an empty parcel list on a network failure, never inventing parcels', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.pdok.nl')));
    const result = await searchBrpParcelsByBbox([5.9, 52.0, 5.92, 52.02]);
    expect(result.state).toBe('unavailable');
    expect(result.parcels).toEqual([]);
    expect(result.unavailableReason).not.toContain('ENOTFOUND');
  });

  it('skips a single malformed feature rather than failing the whole search', async () => {
    const withBadFeature = {
      ...FEATURE_COLLECTION_WITH_NEXT,
      features: [
        ...FEATURE_COLLECTION_WITH_NEXT.features,
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] }, properties: {} },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => withBadFeature }));
    const result = await searchBrpParcelsByBbox([5.9, 52.0, 5.92, 52.02]);
    expect(result.state).toBe('ok');
    expect(result.parcels).toHaveLength(1);
  });
});

describe('bboxAroundPoint', () => {
  it('produces a bbox centered on the given point', () => {
    const [minLon, minLat, maxLon, maxLat] = bboxAroundPoint(52.0, 5.9, 1000);
    expect(minLon).toBeLessThan(5.9);
    expect(maxLon).toBeGreaterThan(5.9);
    expect(minLat).toBeLessThan(52.0);
    expect(maxLat).toBeGreaterThan(52.0);
  });
});
