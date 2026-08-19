import { PdokGeometryError } from './errors';
import type { PdokGeometry } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CRS / area-calculation assumptions (Sprint 18 Part 12 requires these be
// documented explicitly, not left implicit):
//
// - Geometries are requested from PDOK in OGC:CRS84 (lon/lat, WGS84) — the
//   API's default output CRS, confirmed live (also supports EPSG:28992,
//   3857, 4258 — see docs/BRP_PDOK_Official_Data_Audit.md).
// - Area is computed via an equirectangular approximation centered on each
//   ring's own mean latitude, NOT a full geodesic (ellipsoidal) calculation.
//   For Dutch-scale agricultural parcels (single-digit to low-hundreds of
//   hectares, all within ~50-54°N) this approximation's error versus a true
//   geodesic area is a small fraction of a percent — acceptable for
//   comparing against a farmer's own manually-entered hectares, not
//   acceptable for cadastral/legal surveying.
// - No geospatial library dependency was added for this — the approximation
//   is simple enough to implement directly and avoids a new dependency for
//   a single, well-scoped calculation (Part 12: "use a well-supported
//   geospatial library only if needed").
// ─────────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6371000;
const MAX_RING_POINTS = 5000;
const MAX_RINGS_PER_POLYGON = 50;
const MAX_POLYGONS = 50;

function validateRing(ring: unknown): [number, number][] {
  if (!Array.isArray(ring) || ring.length < 4 || ring.length > MAX_RING_POINTS) {
    throw new PdokGeometryError(`ring has an invalid number of points (${Array.isArray(ring) ? ring.length : 'not an array'})`);
  }
  return ring.map((pt) => {
    if (!Array.isArray(pt) || pt.length < 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') {
      throw new PdokGeometryError('coordinate pair is not a valid [lon, lat] number tuple');
    }
    const [lon, lat] = pt;
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      throw new PdokGeometryError(`coordinate out of range: [${lon}, ${lat}]`);
    }
    return [lon, lat] as [number, number];
  });
}

/** Throws PdokGeometryError for anything structurally implausible — an
 * oversized or malformed payload never silently passes through to area
 * calculation or storage (Sprint 18 Part 16). */
export function validateGeometry(geometry: unknown): PdokGeometry {
  if (!geometry || typeof geometry !== 'object' || !('type' in geometry) || !('coordinates' in geometry)) {
    throw new PdokGeometryError('missing type/coordinates');
  }
  const g = geometry as { type: unknown; coordinates: unknown };

  if (g.type === 'Polygon') {
    if (!Array.isArray(g.coordinates) || g.coordinates.length > MAX_RINGS_PER_POLYGON) {
      throw new PdokGeometryError('polygon has too many rings');
    }
    g.coordinates.forEach(validateRing);
    return { type: 'Polygon', coordinates: g.coordinates as number[][][] };
  }

  if (g.type === 'MultiPolygon') {
    if (!Array.isArray(g.coordinates) || g.coordinates.length > MAX_POLYGONS) {
      throw new PdokGeometryError('multipolygon has too many polygons');
    }
    for (const poly of g.coordinates) {
      if (!Array.isArray(poly) || poly.length > MAX_RINGS_PER_POLYGON) {
        throw new PdokGeometryError('polygon within multipolygon has too many rings');
      }
      poly.forEach(validateRing);
    }
    return { type: 'MultiPolygon', coordinates: g.coordinates as number[][][][] };
  }

  throw new PdokGeometryError(`unsupported geometry type "${String(g.type)}"`);
}

function ringAreaM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const meanLatRad = (ring.reduce((s, [, lat]) => s + lat, 0) / ring.length) * (Math.PI / 180);
  const mPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const mPerDegLon = mPerDegLat * Math.cos(meanLatRad);

  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % ring.length];
    const x1 = lon1 * mPerDegLon;
    const y1 = lat1 * mPerDegLat;
    const x2 = lon2 * mPerDegLon;
    const y2 = lat2 * mPerDegLat;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Area in hectares — see the module-level comment for the approximation
 * used and its accuracy bounds. Holes (rings after the first in a polygon)
 * are subtracted. */
export function computePolygonAreaHa(geometry: PdokGeometry): number {
  const polygons: number[][][][] = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let totalM2 = 0;
  for (const rings of polygons) {
    const [outerRing, ...holeRings] = rings as unknown as [number, number][][];
    const outer = ringAreaM2(outerRing);
    const holes = holeRings.reduce((s, r) => s + ringAreaM2(r), 0);
    totalM2 += outer - holes;
  }
  return Math.round((totalM2 / 10000) * 100) / 100;
}

/** Documented threshold for Sprint 18 Part 12's "require confirmation when
 * discrepancy exceeds a documented threshold." 10% is a deliberately
 * conservative default — real parcel boundaries rarely align exactly with
 * a farmer's own rough hectare estimate, and BRP's calculated-from-geometry
 * area can legitimately differ slightly from a farm's own record. */
export const AREA_DISCREPANCY_WARNING_THRESHOLD_PCT = 10;

export function areaDiscrepancyPct(importedAreaHa: number, manualHectares: number): number {
  if (manualHectares <= 0) return 0;
  return Math.round((Math.abs(importedAreaHa - manualHectares) / manualHectares) * 1000) / 10;
}
