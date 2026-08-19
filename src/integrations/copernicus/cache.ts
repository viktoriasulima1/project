import { fetchNdviStatistics } from './client';
import { mapNdviStatistics } from './mapper';
import type { CopernicusGeoJsonPolygon, NdviReading } from './types';

// Sentinel-2's revisit time is ~5 days and cloud-free coverage is often
// sparser than that — there is no benefit re-fetching the same field/period
// within a day, so this uses the same unstable_cache pattern as
// pdok/cache.ts, just with a shorter window (satellite data is far more
// time-sensitive than BRP's annual republish).
const CACHE_REVALIDATE_SECONDS = 24 * 60 * 60;

type CachedFn = (geometry: CopernicusGeoJsonPolygon, from: string, to: string) => Promise<NdviReading[]>;
let _cached: CachedFn | null = null;
let _cachedInitFailed = false;

async function fetchAndMap(geometry: CopernicusGeoJsonPolygon, from: string, to: string): Promise<NdviReading[]> {
  const raw = await fetchNdviStatistics(geometry, from, to);
  return mapNdviStatistics(raw, new Date().toISOString());
}

export async function fetchNdviStatisticsCached(
  geometry: CopernicusGeoJsonPolygon,
  from: string,
  to: string,
): Promise<NdviReading[]> {
  if (!_cached && !_cachedInitFailed) {
    try {
      const { unstable_cache } = await import('next/cache');
      _cached = unstable_cache(fetchAndMap, ['copernicus-ndvi'], { revalidate: CACHE_REVALIDATE_SECONDS });
    } catch {
      _cachedInitFailed = true;
    }
  }
  return _cached ? _cached(geometry, from, to) : fetchAndMap(geometry, from, to);
}
