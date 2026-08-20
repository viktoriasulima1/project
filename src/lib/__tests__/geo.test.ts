import { describe, it, expect } from 'vitest';
import { isPointInFieldGeometry, findFieldContainingPoint } from '../geo';

// A simple 1°×1° square: lon 5–6, lat 52–53 (roughly Gelderland-scale for
// the test's own sanity, though the math doesn't care about real geography).
const SQUARE_POLYGON = {
  type: 'Polygon' as const,
  coordinates: [[[5, 52], [6, 52], [6, 53], [5, 53], [5, 52]]],
};

// Same outer square with a smaller square hole cut out of its middle.
const POLYGON_WITH_HOLE = {
  type: 'Polygon' as const,
  coordinates: [
    [[5, 52], [6, 52], [6, 53], [5, 53], [5, 52]],
    [[5.4, 52.4], [5.6, 52.4], [5.6, 52.6], [5.4, 52.6], [5.4, 52.4]],
  ],
};

// Two disjoint squares — lon 5-6/lat 52-53 and lon 8-9/lat 52-53.
const MULTI_POLYGON = {
  type: 'MultiPolygon' as const,
  coordinates: [
    [[[5, 52], [6, 52], [6, 53], [5, 53], [5, 52]]],
    [[[8, 52], [9, 52], [9, 53], [8, 53], [8, 52]]],
  ],
};

describe('isPointInFieldGeometry', () => {
  it('finds a point inside a simple polygon', () => {
    expect(isPointInFieldGeometry(5.5, 52.5, SQUARE_POLYGON)).toBe(true);
  });

  it('rejects a point outside the polygon', () => {
    expect(isPointInFieldGeometry(7, 52.5, SQUARE_POLYGON)).toBe(false);
  });

  it('rejects a point inside a hole', () => {
    expect(isPointInFieldGeometry(5.5, 52.5, POLYGON_WITH_HOLE)).toBe(false);
  });

  it('accepts a point inside the ring but outside the hole', () => {
    expect(isPointInFieldGeometry(5.1, 52.1, POLYGON_WITH_HOLE)).toBe(true);
  });

  it('checks every ring of a MultiPolygon', () => {
    expect(isPointInFieldGeometry(5.5, 52.5, MULTI_POLYGON)).toBe(true);
    expect(isPointInFieldGeometry(8.5, 52.5, MULTI_POLYGON)).toBe(true);
    expect(isPointInFieldGeometry(7, 52.5, MULTI_POLYGON)).toBe(false);
  });

  it('treats missing geometry as no match, not an error', () => {
    expect(isPointInFieldGeometry(5.5, 52.5, null)).toBe(false);
    expect(isPointInFieldGeometry(5.5, 52.5, undefined)).toBe(false);
  });

  it('treats malformed geometry as no match, not a throw', () => {
    expect(isPointInFieldGeometry(5.5, 52.5, { type: 'Point', coordinates: [5.5, 52.5] })).toBe(false);
    expect(isPointInFieldGeometry(5.5, 52.5, 'not geometry')).toBe(false);
    expect(isPointInFieldGeometry(5.5, 52.5, {})).toBe(false);
  });
});

describe('findFieldContainingPoint', () => {
  const fields = [
    { id: 'no-geometry', geometry: null },
    { id: 'square', geometry: SQUARE_POLYGON },
    { id: 'multi', geometry: MULTI_POLYGON },
  ];

  it('returns the field whose geometry contains the point', () => {
    expect(findFieldContainingPoint(5.5, 52.5, fields)?.id).toBe('square');
  });

  it('returns null when no field matches', () => {
    expect(findFieldContainingPoint(20, 20, fields)).toBeNull();
  });

  it('returns null when every field lacks geometry', () => {
    expect(findFieldContainingPoint(5.5, 52.5, [{ id: 'a', geometry: null }])).toBeNull();
  });
});
