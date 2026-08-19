import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    ctgbProductReference: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    ctgbUseAuthorisation: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('../../../lib/db', () => ({ db: mockDb }));

import { searchCtgbProducts, getCtgbProductById } from '../client';

const VALID_COLLECTION_RESPONSE = {
  data: [
    {
      type: 'authorisations',
      id: 'ctgb-1',
      attributes: {
        toelatingsnummer: 'NL-1',
        middelnaam: 'Amistar Opti',
        status: 'Toegelaten',
        gebruiken: [{ gewas: 'Tarwe', doseringMin: 1, doseringMax: 2, doseringEenheid: 'L' }],
      },
    },
  ],
};

describe('searchCtgbProducts / getCtgbProductById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(async (cb: (tx: typeof mockDb) => unknown) => cb(mockDb));
    mockDb.ctgbProductReference.upsert.mockResolvedValue({ id: 'local-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Test 7: Source unavailable (with nothing cached)
  it('returns state "unavailable" with an empty list when the live call fails and nothing is cached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    mockDb.ctgbProductReference.findMany.mockResolvedValue([]);

    const result = await searchCtgbProducts('Amistar');
    expect(result.state).toBe('unavailable');
    expect(result.products).toEqual([]);
    expect(result.unavailableReason).not.toContain('ECONNREFUSED');
  });

  // Test 6: Cached stale product
  it('falls back to a stale cached product (marked degraded) when the live single-product call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const staleFetchedAt = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h old, well past the 24h fresh window
    mockDb.ctgbProductReference.findUnique.mockResolvedValue({
      sourceProductId: 'ctgb-1',
      authorisationNumber: 'NL-1',
      officialName: 'Amistar Opti',
      authorisationStatus: 'authorised',
      authorisationStart: null,
      authorisationEnd: null,
      holder: null,
      activeSubstances: null,
      sourceUrl: 'https://example.test',
      fetchedAt: staleFetchedAt,
      sourceVersion: null,
      rawChecksum: 'abc',
      uses: [],
    });

    const result = await getCtgbProductById('ctgb-1');
    expect(result.state).toBe('degraded');
    expect(result.products).toHaveLength(1);
    expect(result.unavailableReason).toContain('cached');
  });

  it('reports "unavailable" with no products when getCtgbProductById fails and nothing was ever cached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    mockDb.ctgbProductReference.findUnique.mockResolvedValue(null);

    const result = await getCtgbProductById('ctgb-unknown');
    expect(result.state).toBe('unavailable');
    expect(result.products).toEqual([]);
  });

  it('returns real, mapped products and caches them on a successful live search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => VALID_COLLECTION_RESPONSE }),
    );

    const result = await searchCtgbProducts('Amistar');
    expect(result.state).toBe('ok');
    expect(result.products[0].officialName).toBe('Amistar Opti');
    expect(mockDb.ctgbProductReference.upsert).toHaveBeenCalled();
  });

  it('never leaks a raw network error message in the unavailable reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND public.mst.ctgb.nl')));
    mockDb.ctgbProductReference.findMany.mockResolvedValue([]);

    const result = await searchCtgbProducts('Amistar');
    expect(result.unavailableReason).not.toContain('ENOTFOUND');
    expect(result.unavailableReason).not.toContain('public.mst.ctgb.nl');
  });
});
