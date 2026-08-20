import { getAccessToken } from './token';
import { CopernicusUnavailableError, CopernicusGeometryError } from './errors';
import { isCopernicusMockEnabled, mockStatisticalApiResponse } from './mock-fixtures';
import type { CopernicusGeometry, StatisticalApiResponse } from './types';

// Confirmed against official Copernicus Data Space Ecosystem documentation
// (documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html)
// this sprint — not independently tested live from this environment (see
// types.ts header comment for why).
const STATISTICS_URL = 'https://sh.dataspace.copernicus.eu/statistics/v1';
// Statistical aggregation over an area + time range is real satellite
// processing, not a lookup — a longer timeout than PDOK/CTGB's 8s is
// deliberate, not a copy-paste oversight.
const FETCH_TIMEOUT_MS = 15000;

// Standard, universally-defined NDVI formula (NIR−Red)/(NIR+Red) against
// Sentinel-2 L2A bands B08 (NIR) and B04 (Red) — unlike a disease-pressure
// model, there is no proprietary science or unverified threshold table here
// to get wrong; this evalscript has exactly one reasonable form.
const NDVI_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1 },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  return { ndvi: [ndvi], dataMask: [sample.dataMask] };
}`;

function isValidGeometry(geometry: CopernicusGeometry): boolean {
  if (!geometry || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return false;
  if (geometry.type === 'Polygon') return geometry.coordinates[0].length >= 4;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.every((polygon) => polygon[0]?.length >= 4);
  return false;
}

/**
 * Fetches NDVI statistics (mean, sample count, cloud-masked share) for a
 * field's geometry over a date range, aggregated into `intervalDays`-wide
 * buckets. Raw Statistical API response — callers use mapper.ts to get the
 * normalized FarmOS shape.
 */
export async function fetchNdviStatistics(
  geometry: CopernicusGeometry,
  fromISO: string,
  toISO: string,
  intervalDays = 10,
): Promise<StatisticalApiResponse> {
  if (isCopernicusMockEnabled()) return mockStatisticalApiResponse(fromISO, toISO);

  if (!isValidGeometry(geometry)) throw new CopernicusGeometryError('field has no recorded polygon geometry');

  let token: string;
  try {
    token = await getAccessToken();
  } catch (e) {
    throw new CopernicusUnavailableError('authentication failed', e);
  }

  const requestBody = {
    input: {
      bounds: {
        geometry,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{ type: 'sentinel-2-l2a' }],
    },
    aggregation: {
      timeRange: { from: fromISO, to: toISO },
      aggregationInterval: { of: `P${intervalDays}D` },
      evalscript: NDVI_EVALSCRIPT,
      resx: 10,
      resy: 10,
    },
    calculations: { default: {} },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(STATISTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (e) {
    throw new CopernicusUnavailableError('network error or timeout', e);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new CopernicusUnavailableError(`upstream returned ${res.status}`);

  return (await res.json()) as StatisticalApiResponse;
}
