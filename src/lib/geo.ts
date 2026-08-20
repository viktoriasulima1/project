// Pure, dependency-free point-in-polygon test for the GeoJSON stored on
// Field.coordinates (Polygon or MultiPolygon, [lon, lat] tuples — the same
// shape produced by both BRP import and manual field drawing, and already
// consumed as-is by FieldOperationsMap's `L.geoJSON(field.geometry, ...)`).
// No geospatial library added — same reasoning as
// integrations/pdok/geometry.ts: standard ray-casting is accurate enough at
// field scale and avoids a new dependency for one well-scoped check.

export type FieldGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

function isFieldGeometry(value: unknown): value is FieldGeometry {
  return (
    value !== null && typeof value === 'object' && 'type' in value && 'coordinates' in value &&
    ((value as { type: unknown }).type === 'Polygon' || (value as { type: unknown }).type === 'MultiPolygon')
  );
}

// Standard even-odd ray-casting test, cast along the latitude axis.
function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// rings[0] is the outer boundary; rings[1..] are holes, subtracted via the
// same even-odd rule (a point inside any hole is outside the polygon).
function pointInPolygonRings(lon: number, lat: number, rings: number[][][]): boolean {
  if (rings.length === 0 || !pointInRing(lon, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lon, lat, rings[i])) return false;
  }
  return true;
}

/** True if [lon, lat] falls inside the given field geometry. Malformed or
 * missing geometry (a field with no boundary drawn/imported yet) is never
 * a match, not an error — GPS auto-select simply has nothing to offer for
 * that field, the same way the map already keeps such fields in an
 * accessible list rather than failing. */
export function isPointInFieldGeometry(lon: number, lat: number, geometry: unknown): boolean {
  if (!isFieldGeometry(geometry)) return false;
  if (geometry.type === 'Polygon') return pointInPolygonRings(lon, lat, geometry.coordinates);
  return geometry.coordinates.some((polygon) => pointInPolygonRings(lon, lat, polygon));
}

/** Finds the first of the given fields whose geometry contains [lon, lat],
 * or null if none does (including when no field has geometry at all). */
export function findFieldContainingPoint<T extends { geometry: unknown }>(
  lon: number,
  lat: number,
  fields: readonly T[],
): T | null {
  return fields.find((f) => isPointInFieldGeometry(lon, lat, f.geometry)) ?? null;
}
