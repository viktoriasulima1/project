import type { Farm } from '@prisma/client';
import { db } from './db';
import { fetchWeather } from './weather';
import { getAmsterdamDateString } from './spray-window';

export interface FieldSeasonOption {
  id: string;
  fieldName: string;
  crop: string;
  hectares: number;
  // Same GeoJSON the field map already renders (Field.coordinates) — null
  // for a field with no boundary drawn or imported yet. Powers GPS
  // auto-select in the activity form; never required.
  geometry: unknown | null;
}

export interface ProductOption {
  id: string;
  name: string;
  unit: string;
  category: string;
  currentStock: number;
  minimumStock: number;
}

export interface MachineOption {
  id: string;
  name: string;
}

export interface WeatherSnapshot {
  tempC: number;
  windKmh: number;
  windDir: string;
  humidity: number;
  fetchedAt: string;
}

export interface RecentActivityContext {
  type: string;
  fieldSeasonId: string;
  operatorName: string | null;
  machineId: string | null;
  productId: string | null;
}

export interface ActivityFormContext {
  fieldSeasons: FieldSeasonOption[];
  products: ProductOption[];
  machines: MachineOption[];
  recentOperatorName: string | null;
  recentMachineId: string | null;
  weather: WeatherSnapshot | null;
}

const WIND_DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
function degreesToLabel(deg: number): string {
  return WIND_DIRS[Math.round(deg / 22.5) % 16];
}

/**
 * Everything the activity form (full dialog or Quick Log — same component,
 * see Sprint 11) needs to render with safe prefills. Centralized so both
 * entry points fetch it identically, rather than each re-deriving their
 * own version of "recent operator" or "current weather."
 */
export async function getActivityFormContext(farm: Farm): Promise<ActivityFormContext> {
  const [fieldSeasons, products, machines, mostRecentActivity, weatherData] = await Promise.all([
    db.fieldSeason.findMany({
      where: {
        field: { farmId: farm.id, deletedAt: null },
        season: { farmId: farm.id, isActive: true },
      },
      include: { field: { select: { name: true, hectares: true, coordinates: true } } },
      orderBy: { field: { name: 'asc' } },
    }),
    db.inventoryItem.findMany({
      where: { farmId: farm.id },
      orderBy: { name: 'asc' },
    }),
    db.machine.findMany({
      where: { farmId: farm.id },
      orderBy: { name: 'asc' },
    }),
    db.activity.findFirst({
      where: { fieldSeason: { field: { farmId: farm.id } }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { operatorName: true, machineId: true },
    }),
    farm.latitude != null && farm.longitude != null
      ? fetchWeather(Number(farm.latitude), Number(farm.longitude)).catch(() => null)
      : Promise.resolve(null),
  ]);

  let weather: WeatherSnapshot | null = null;
  if (weatherData) {
    const today = getAmsterdamDateString();
    const currentHour = weatherData.hourly.find((h) => h.time.startsWith(today));
    if (currentHour) {
      weather = {
        tempC: currentHour.temperature,
        windKmh: Math.round(currentHour.windSpeed),
        windDir: degreesToLabel(currentHour.windDirection),
        humidity: Math.round(currentHour.relativeHumidity),
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  return {
    fieldSeasons: fieldSeasons.map((fs) => ({
      id: fs.id,
      fieldName: fs.field.name,
      crop: fs.crop,
      hectares: Number(fs.field.hectares),
      geometry: fs.field.coordinates,
    })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      category: p.category,
      currentStock: Number(p.currentStock),
      minimumStock: Number(p.minimumStock),
    })),
    machines: machines.map((m) => ({ id: m.id, name: m.name })),
    recentOperatorName: mostRecentActivity?.operatorName || null,
    recentMachineId: mostRecentActivity?.machineId ?? null,
    weather,
  };
}

/** For "Repeat similar activity" — only ever returns fields that are safe
 * to carry over (type/field suggestion/operator/machine/product). Never
 * includes date, dose, area, water volume, or weather — those must always
 * be re-entered or re-fetched fresh, never silently copied. */
export async function getRecentActivityForRepeat(
  farm: Farm,
  activityId: string,
): Promise<RecentActivityContext | null> {
  const activity = await db.activity.findFirst({
    where: { id: activityId, fieldSeason: { field: { farmId: farm.id } }, deletedAt: null },
    select: {
      type: true,
      operatorName: true,
      machineId: true,
      productId: true,
      fieldSeasonId: true,
    },
  });
  if (!activity) return null;
  return {
    type: activity.type,
    fieldSeasonId: activity.fieldSeasonId,
    operatorName: activity.operatorName || null,
    machineId: activity.machineId,
    productId: activity.productId,
  };
}
