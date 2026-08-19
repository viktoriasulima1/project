import type { PdokFeatureCollection } from './types';

/**
 * Deterministic fixtures for E2E testing (Sprint 18 Part 18). Unlike the
 * Ctgb mock (necessary because the real API returns 403), PDOK's real API
 * works live — this mock exists purely for the brief's own determinism
 * requirement ("do not make the normal test suite dependent on live
 * government services"), gated behind `E2E_MOCK_PDOK=true`.
 */
export function mockBrpFeatureCollection(): PdokFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [5.9300, 51.9600],
            [5.9400, 51.9600],
            [5.9400, 51.9650],
            [5.9300, 51.9650],
            [5.9300, 51.9600],
          ]],
        },
        properties: { category: 'Bouwland', gewas: 'Tarwe (E2E fixture)', gewascode: 233, jaar: 2025, status: 'Definitief' },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [5.9450, 51.9620],
            [5.9520, 51.9620],
            [5.9520, 51.9660],
            [5.9450, 51.9660],
            [5.9450, 51.9620],
          ]],
        },
        properties: { category: 'Bouwland', gewas: 'Aardappelen (E2E fixture)', gewascode: 2015, jaar: 2025, status: 'Definitief' },
      },
    ],
    numberReturned: 2,
    links: [{ rel: 'self', href: 'https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections/brpgewas/items?f=json' }],
  };
}

export function isPdokMockEnabled(): boolean {
  return process.env.E2E_MOCK_PDOK === 'true';
}
