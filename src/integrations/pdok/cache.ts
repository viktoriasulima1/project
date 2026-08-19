import { searchBrpParcelsByBbox } from './brp-client';
import type { PdokParcelSearchResult } from './types';

// BRP Gewaspercelen is republished annually (15 May peildatum) — there is
// no real freshness benefit to re-fetching the same bbox within a session,
// so this uses the same `unstable_cache` pattern as src/lib/weather.ts,
// with a much longer window given the dataset's own update cadence.
const CACHE_REVALIDATE_SECONDS = 6 * 60 * 60;

type CachedSearchFn = (bbox: [number, number, number, number]) => Promise<PdokParcelSearchResult>;
let _cachedSearch: CachedSearchFn | null = null;
let _cachedSearchInitFailed = false;

export async function searchBrpParcelsByBboxCached(bbox: [number, number, number, number]): Promise<PdokParcelSearchResult> {
  if (!_cachedSearch && !_cachedSearchInitFailed) {
    try {
      const { unstable_cache } = await import('next/cache');
      _cachedSearch = unstable_cache(
        (b: [number, number, number, number]) => searchBrpParcelsByBbox(b),
        ['pdok-brp-search'],
        { revalidate: CACHE_REVALIDATE_SECONDS },
      );
    } catch {
      _cachedSearchInitFailed = true;
    }
  }
  return _cachedSearch ? _cachedSearch(bbox) : searchBrpParcelsByBbox(bbox);
}
