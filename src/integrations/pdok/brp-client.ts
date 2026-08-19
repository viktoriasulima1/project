import { PdokUnavailableError } from './errors';
import { mapBrpFeature } from './mapper';
import { isPdokMockEnabled, mockBrpFeatureCollection } from './mock-fixtures';
import type { PdokFeatureCollection, PdokParcelSearchResult, NormalizedBrpParcel } from './types';

// Confirmed live during this sprint's research — see
// docs/BRP_PDOK_Official_Data_Audit.md. No authentication, no documented
// rate limit, storage CRS EPSG:28992, default query CRS OGC:CRS84.
const BRP_COLLECTION_URL = 'https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections/brpgewas/items';
const FETCH_TIMEOUT_MS = 8000;
const MAX_RESULTS_PER_PAGE = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/geo+json' } });
    clearTimeout(timeout);
    if (!res.ok) throw new PdokUnavailableError(`upstream returned ${res.status}`);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof PdokUnavailableError) throw e;
    throw new PdokUnavailableError('network error or timeout', e);
  }
}

async function fetchWithOneRetry(url: string): Promise<Response> {
  try {
    return await fetchOnce(url);
  } catch (e) {
    await sleep(400);
    try {
      return await fetchOnce(url);
    } catch {
      throw e;
    }
  }
}

function safeReason(e: unknown): string {
  if (e instanceof PdokUnavailableError) return e.message;
  return 'PDOK source unavailable';
}

/**
 * A degree-based approximation of a metres radius around a point — same
 * accuracy class/assumptions as geometry.ts's area calculation (see that
 * file's header comment). Fine for a farm-coordinates-centered parcel
 * search; not for anything requiring survey-grade precision.
 */
export function bboxAroundPoint(lat: number, lon: number, radiusMetres: number): [number, number, number, number] {
  const latDelta = radiusMetres / 111320;
  const lonDelta = radiusMetres / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lon - lonDelta, lat - latDelta, lon + lonDelta, lat + latDelta];
}

/**
 * Searches BRP Gewaspercelen by bounding box. Never invents parcel data on
 * failure (Sprint 18 Part 15) — returns an explicit 'unavailable' state
 * with an empty list instead.
 */
function featureCentroid(feature: PdokFeatureCollection['features'][number]): [number, number] {
  const ring = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[0] : feature.geometry.coordinates[0][0];
  const lon = ring.reduce((s, [x]) => s + x, 0) / ring.length;
  const lat = ring.reduce((s, [, y]) => s + y, 0) / ring.length;
  return [lon, lat];
}

function bboxContainsPoint(bbox: [number, number, number, number], point: [number, number]): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const [lon, lat] = point;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

export async function searchBrpParcelsByBbox(
  bbox: [number, number, number, number],
  limit: number = MAX_RESULTS_PER_PAGE,
): Promise<PdokParcelSearchResult> {
  const url = `${BRP_COLLECTION_URL}?bbox=${bbox.join(',')}&limit=${Math.min(limit, MAX_RESULTS_PER_PAGE)}&f=json`;
  try {
    // E2E determinism (Sprint 18 Part 18) — bbox centered on [0, 0] ("null
    // island", not a real farm location) deterministically forces the
    // unavailable path even in mock mode, for the failure-flow test.
    if (isPdokMockEnabled() && bbox[0] < 0.5 && bbox[2] > -0.5 && bbox[1] < 0.5 && bbox[3] > -0.5) {
      throw new PdokUnavailableError('E2E-forced unavailable');
    }

    const raw: PdokFeatureCollection = isPdokMockEnabled()
      ? (() => {
          const fixture = mockBrpFeatureCollection();
          return { ...fixture, features: fixture.features.filter((f) => bboxContainsPoint(bbox, featureCentroid(f))) };
        })()
      : ((await (await fetchWithOneRetry(url)).json()) as PdokFeatureCollection);
    const fetchedAt = new Date();
    const parcels: NormalizedBrpParcel[] = [];
    for (const feature of raw.features ?? []) {
      try {
        parcels.push(mapBrpFeature(feature, url, fetchedAt));
      } catch {
        // A single malformed feature doesn't fail the whole search — skip
        // it, keep the rest (Part 16: validate all external geometry).
      }
    }
    const nextLink = raw.links?.find((l) => l.rel === 'next')?.href;
    const nextCursor = nextLink ? new URL(nextLink).searchParams.get('cursor') ?? undefined : undefined;

    return { state: 'ok', parcels, nextCursor };
  } catch (e) {
    return { state: 'unavailable', parcels: [], unavailableReason: safeReason(e) };
  }
}

/** Convenience wrapper for Part 10's "use farm coordinates" search mode. */
export async function searchBrpParcelsNearFarm(
  lat: number,
  lon: number,
  radiusMetres = 1500,
): Promise<PdokParcelSearchResult> {
  return searchBrpParcelsByBbox(bboxAroundPoint(lat, lon, radiusMetres));
}
