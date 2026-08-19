import type { StatisticalApiResponse } from './types';

/** Same opt-in pattern as pdok/ctgb mock fixtures (isPdokMockEnabled,
 * isCtgbMockEnabled) — real client by default, mock only when a test
 * explicitly asks for it. */
export function isCopernicusMockEnabled(): boolean {
  return process.env.E2E_MOCK_COPERNICUS === 'true';
}

export function mockStatisticalApiResponse(fromISO: string, toISO: string): StatisticalApiResponse {
  return {
    data: [
      {
        interval: { from: fromISO, to: toISO },
        outputs: {
          ndvi: {
            bands: {
              B0: { stats: { min: 0.2, max: 0.85, mean: 0.62, stDev: 0.08, sampleCount: 900, noDataCount: 100 } },
            },
          },
        },
      },
    ],
  };
}
