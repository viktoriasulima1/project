import { describe, it, expect } from 'vitest';
import { mapBrpFeature, checksumGeometry } from '../mapper';
import type { PdokRawFeature } from '../types';

const SQUARE_FEATURE: PdokRawFeature = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [5.900, 52.000],
      [5.9146, 52.000],
      [5.9146, 52.009],
      [5.900, 52.009],
      [5.900, 52.000],
    ]],
  },
  properties: {
    category: 'Grasland, blijvend',
    gewas: 'Tarwe',
    gewascode: 233,
    jaar: 2025,
    status: 'Definitief',
  },
};

describe('mapBrpFeature', () => {
  // Test 11: OGC API response mapping
  it('maps a real live-shaped feature into the normalized parcel model', () => {
    const result = mapBrpFeature(SQUARE_FEATURE, 'https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections/brpgewas/items', new Date('2026-07-13T10:00:00Z'));
    expect(result.cropLabel).toBe('Tarwe');
    expect(result.cropCode).toBe(233);
    expect(result.category).toBe('Grasland, blijvend');
    expect(result.status).toBe('Definitief');
    expect(result.areaHa).toBeGreaterThan(0);
    expect(result.externalParcelId).toBeNull();
    expect(result.fetchedAt).toBe('2026-07-13T10:00:00.000Z');
  });

  // Test 19: Dataset year preserved
  it('preserves the dataset year exactly as returned, never substituting the current year silently', () => {
    const result = mapBrpFeature(SQUARE_FEATURE, 'https://example.test', new Date());
    expect(result.datasetYear).toBe(2025);
  });

  it('falls back to the current year only when jaar is genuinely absent, and this is the one documented exception', () => {
    const noYear: PdokRawFeature = { ...SQUARE_FEATURE, properties: { ...SQUARE_FEATURE.properties, jaar: undefined } };
    const result = mapBrpFeature(noYear, 'https://example.test', new Date('2026-01-01T00:00:00Z'));
    expect(result.datasetYear).toBe(2026);
  });

  it('produces a stable checksum for identical geometry and a different one for a changed geometry', () => {
    const a = checksumGeometry(SQUARE_FEATURE.geometry);
    const b = checksumGeometry(SQUARE_FEATURE.geometry);
    const c = checksumGeometry({ ...SQUARE_FEATURE.geometry, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
