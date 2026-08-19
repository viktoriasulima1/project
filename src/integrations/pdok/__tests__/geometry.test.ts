import { describe, it, expect } from 'vitest';
import { validateGeometry, computePolygonAreaHa, areaDiscrepancyPct, AREA_DISCREPANCY_WARNING_THRESHOLD_PCT } from '../geometry';
import { PdokGeometryError } from '../errors';

// A roughly 1km x 1km square near Arnhem, NL (~52°N) — used to sanity-check
// the area approximation against a known, hand-computed expectation.
const SQUARE_POLYGON = {
  type: 'Polygon' as const,
  coordinates: [[
    [5.900, 52.000],
    [5.9146, 52.000],
    [5.9146, 52.009],
    [5.900, 52.009],
    [5.900, 52.000],
  ]],
};

describe('validateGeometry', () => {
  // Test 13: Polygon and multipolygon validation
  it('accepts a well-formed Polygon', () => {
    expect(() => validateGeometry(SQUARE_POLYGON)).not.toThrow();
  });

  it('accepts a well-formed MultiPolygon', () => {
    const multi = { type: 'MultiPolygon', coordinates: [SQUARE_POLYGON.coordinates, SQUARE_POLYGON.coordinates] };
    expect(() => validateGeometry(multi)).not.toThrow();
  });

  // Test 23: Oversized/invalid GeoJSON rejected
  it('rejects a ring with too few points', () => {
    const bad = { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] };
    expect(() => validateGeometry(bad)).toThrow(PdokGeometryError);
  });

  it('rejects an out-of-range coordinate', () => {
    const bad = { type: 'Polygon', coordinates: [[[999, 999], [1, 1], [2, 2], [999, 999]]] };
    expect(() => validateGeometry(bad)).toThrow(PdokGeometryError);
  });

  it('rejects a ring with an oversized number of points (protects against oversized payloads)', () => {
    const hugeRing = Array.from({ length: 6000 }, (_, i) => [i * 0.0001, i * 0.0001]);
    const bad = { type: 'Polygon', coordinates: [hugeRing] };
    expect(() => validateGeometry(bad)).toThrow(PdokGeometryError);
  });

  it('rejects an unsupported geometry type', () => {
    expect(() => validateGeometry({ type: 'Point', coordinates: [0, 0] })).toThrow(PdokGeometryError);
  });

  it('rejects a payload missing type/coordinates entirely', () => {
    expect(() => validateGeometry({})).toThrow(PdokGeometryError);
    expect(() => validateGeometry(null)).toThrow(PdokGeometryError);
  });
});

describe('computePolygonAreaHa', () => {
  // Test 14: Area calculation
  it('computes a plausible area (hectares) for a roughly 1km x 1km square', () => {
    const areaHa = computePolygonAreaHa(SQUARE_POLYGON);
    // ~100ha expected; allow a wide tolerance since this uses a documented
    // equirectangular approximation, not an exact geodesic calculation.
    expect(areaHa).toBeGreaterThan(90);
    expect(areaHa).toBeLessThan(110);
  });

  it('subtracts hole rings from a polygon with an interior ring', () => {
    const withHole = {
      type: 'Polygon' as const,
      coordinates: [
        SQUARE_POLYGON.coordinates[0],
        [
          [5.902, 52.002],
          [5.912, 52.002],
          [5.912, 52.007],
          [5.902, 52.007],
          [5.902, 52.002],
        ],
      ],
    };
    const withoutHole = computePolygonAreaHa(SQUARE_POLYGON);
    const with_ = computePolygonAreaHa(withHole);
    expect(with_).toBeLessThan(withoutHole);
  });
});

describe('areaDiscrepancyPct / AREA_DISCREPANCY_WARNING_THRESHOLD_PCT', () => {
  // Test 15: Area discrepancy warning
  it('flags a discrepancy above the documented threshold', () => {
    const pct = areaDiscrepancyPct(15, 10); // 50% off
    expect(pct).toBeGreaterThan(AREA_DISCREPANCY_WARNING_THRESHOLD_PCT);
  });

  it('does not flag a small, expected discrepancy', () => {
    const pct = areaDiscrepancyPct(10.2, 10); // 2% off
    expect(pct).toBeLessThan(AREA_DISCREPANCY_WARNING_THRESHOLD_PCT);
  });
});
