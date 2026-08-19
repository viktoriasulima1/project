import type { StatisticalApiResponse, NdviReading } from './types';

export function mapNdviStatistics(raw: StatisticalApiResponse, fetchedAt: string): NdviReading[] {
  return raw.data.map((interval) => {
    const stats = interval.outputs.ndvi?.bands.B0.stats;
    const totalPixels = (stats?.sampleCount ?? 0) + (stats?.noDataCount ?? 0);
    return {
      periodFrom: interval.interval.from,
      periodTo: interval.interval.to,
      meanNdvi: stats && stats.sampleCount > 0 ? Math.round(stats.mean * 1000) / 1000 : null,
      sampleCount: stats?.sampleCount ?? 0,
      cloudCoveragePct: totalPixels > 0 ? Math.round(((stats?.noDataCount ?? 0) / totalPixels) * 1000) / 10 : null,
      fetchedAt,
    };
  });
}
