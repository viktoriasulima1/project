import { describe, it, expect } from 'vitest';
import { mapNdviStatistics } from '../mapper';
import type { StatisticalApiResponse } from '../types';

describe('mapNdviStatistics', () => {
  it('maps a normal interval to a rounded mean NDVI and cloud coverage percentage', () => {
    const raw: StatisticalApiResponse = {
      data: [
        {
          interval: { from: '2026-08-01', to: '2026-08-10' },
          outputs: { ndvi: { bands: { B0: { stats: { min: 0.2, max: 0.85, mean: 0.6234, stDev: 0.08, sampleCount: 900, noDataCount: 100 } } } } },
        },
      ],
    };
    const result = mapNdviStatistics(raw, '2026-08-19T12:00:00Z');
    expect(result).toEqual([
      { periodFrom: '2026-08-01', periodTo: '2026-08-10', meanNdvi: 0.623, sampleCount: 900, cloudCoveragePct: 10, fetchedAt: '2026-08-19T12:00:00Z' },
    ]);
  });

  it('reports null meanNdvi, not a fabricated zero, when a period is fully cloud-masked', () => {
    const raw: StatisticalApiResponse = {
      data: [
        {
          interval: { from: '2026-08-01', to: '2026-08-10' },
          outputs: { ndvi: { bands: { B0: { stats: { min: 0, max: 0, mean: 0, stDev: 0, sampleCount: 0, noDataCount: 1000 } } } } },
        },
      ],
    };
    const result = mapNdviStatistics(raw, '2026-08-19T12:00:00Z');
    expect(result[0].meanNdvi).toBeNull();
    expect(result[0].cloudCoveragePct).toBe(100);
  });

  it('reports null cloudCoveragePct when the ndvi output is missing entirely', () => {
    const raw: StatisticalApiResponse = { data: [{ interval: { from: '2026-08-01', to: '2026-08-10' }, outputs: {} }] };
    const result = mapNdviStatistics(raw, '2026-08-19T12:00:00Z');
    expect(result[0]).toMatchObject({ meanNdvi: null, sampleCount: 0, cloudCoveragePct: null });
  });

  it('maps every interval in a multi-interval response', () => {
    const raw: StatisticalApiResponse = {
      data: [
        { interval: { from: '2026-08-01', to: '2026-08-10' }, outputs: { ndvi: { bands: { B0: { stats: { min: 0.1, max: 0.5, mean: 0.3, stDev: 0.02, sampleCount: 500, noDataCount: 0 } } } } } },
        { interval: { from: '2026-08-11', to: '2026-08-20' }, outputs: { ndvi: { bands: { B0: { stats: { min: 0.4, max: 0.8, mean: 0.6, stDev: 0.05, sampleCount: 700, noDataCount: 0 } } } } } },
      ],
    };
    const result = mapNdviStatistics(raw, '2026-08-19T12:00:00Z');
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.meanNdvi)).toEqual([0.3, 0.6]);
  });
});
