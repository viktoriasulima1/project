import type { CtgbJsonApiCollection, CtgbJsonApiSingle, CtgbRawAuthorisationAttributes } from './types';

/**
 * Deterministic fixtures for E2E testing (Sprint 18 Part 18). The real
 * Ctgb API returned HTTP 403 during this sprint's own research (see
 * docs/Ctgb_Official_Data_Audit.md) — meaning a real E2E run against it
 * could ONLY ever exercise the unavailable/degraded path, never a genuine
 * success path. These fixtures let the full search → select → spray-flow
 * loop be tested deterministically, gated behind `E2E_MOCK_CTGB=true`
 * (set only in the Playwright webServer env — never in dev/prod).
 */
export const MOCK_CTGB_PRODUCT: CtgbJsonApiCollection<CtgbRawAuthorisationAttributes>['data'][number] = {
  type: 'authorisations',
  id: 'e2e-mock-1',
  attributes: {
    toelatingsnummer: 'NL-E2E-0001',
    middelnaam: 'Amistar Opti (E2E fixture)',
    status: 'Toegelaten',
    toelatingGeldigVan: '2020-01-01',
    toelatingGeldigTot: '2030-01-01',
    toelatinghouder: 'Syngenta (fixture)',
    werkzameStoffen: [{ id: 'as-1', naam: 'Azoxystrobin' }],
    gebruiken: [
      {
        gewas: 'Tarwe',
        toepassing: 'Roest',
        doseringMin: 1,
        doseringMax: 3,
        doseringEenheid: 'L',
        maxToepassingenPerSeizoen: 2,
        toepassingsintervalDagen: 14,
        bbchVan: 30,
        bbchTot: 69,
        wachttijdDagen: 35,
        driftbeperkingMeters: 5,
      },
    ],
  },
};

export function mockCtgbSearchResponse(): CtgbJsonApiCollection<CtgbRawAuthorisationAttributes> {
  return { data: [MOCK_CTGB_PRODUCT] };
}

export function mockCtgbSingleResponse(): CtgbJsonApiSingle<CtgbRawAuthorisationAttributes> {
  return { data: MOCK_CTGB_PRODUCT };
}

export function isCtgbMockEnabled(): boolean {
  return process.env.E2E_MOCK_CTGB === 'true';
}
