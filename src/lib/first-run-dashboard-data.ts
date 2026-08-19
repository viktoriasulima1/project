import type { Farm } from '@prisma/client';
import { db } from './db';
import { buildWeatherForecast } from './dashboard-data';
import type { WeatherForecast } from '@/types/farm';

export interface FirstRunDashboardData {
  farmName: string;
  seasonYear: number | null;
  firstField: { name: string; hectares: number; crop: string | null } | null;
  weather: WeatherForecast | null;
  hasCoordinates: boolean;
}

/**
 * Deliberately lean — first_run dashboards must not show finance,
 * compliance, inventory alerts, or AI briefing widgets built from zero
 * real data. This fetcher only pulls what a first-run farm can honestly
 * have: farm identity, its one season, its one field/crop, and weather
 * (which is real regardless of activity history).
 */
export async function getFirstRunDashboardData(farm: Farm): Promise<FirstRunDashboardData> {
  const [activeSeason, firstFieldSeason, weather] = await Promise.all([
    db.season.findFirst({
      where: { farmId: farm.id, isActive: true },
      orderBy: { year: 'desc' },
    }),
    db.fieldSeason.findFirst({
      where: {
        field: { farmId: farm.id, deletedAt: null },
        season: { farmId: farm.id, isActive: true },
      },
      include: { field: { select: { name: true, hectares: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    buildWeatherForecast(
      farm.location,
      farm.latitude != null ? Number(farm.latitude) : null,
      farm.longitude != null ? Number(farm.longitude) : null,
    ),
  ]);

  return {
    farmName: farm.name,
    seasonYear: activeSeason?.year ?? null,
    firstField: firstFieldSeason
      ? {
          name: firstFieldSeason.field.name,
          hectares: Number(firstFieldSeason.field.hectares),
          crop: firstFieldSeason.crop,
        }
      : null,
    weather,
    hasCoordinates: farm.latitude != null && farm.longitude != null,
  };
}
