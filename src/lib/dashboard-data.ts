import type { Farm } from '@prisma/client';
import { db } from './db';
import { fetchWeather } from './weather';
import { getAmsterdamDateString } from './spray-window';
import type {
  DashboardData,
  Field,
  Task,
  InventoryItem,
  ComplianceItem,
  FinancialSnapshot,
  WeatherForecast,
  WeatherDay,
  WeatherCondition,
  SprayWindowStatus,
  InventoryCategory,
  CropName,
} from '@/types/farm';

// ─── Type mappers ─────────────────────────────────────────────────────────────

const PRISMA_CATEGORY_MAP: Record<string, InventoryCategory> = {
  herbicide: 'herbicide',
  fungicide: 'fungicide',
  insecticide: 'insecticide',
  fertiliser: 'fertilizer',
  seed: 'seed',
  fuel: 'fuel',
  other: 'other',
};

const PRISMA_CROP_MAP: Partial<Record<string, CropName>> = {
  wheat: 'wheat',
  potato: 'potato',
  onion: 'onion',
  sugar_beet: 'sugar_beet',
  barley: 'barley',
  oilseed_rape: 'rapeseed',
};

function deriveCondition(
  precipProb: number,
  precipSum: number,
  windMax: number,
): WeatherCondition {
  if (windMax > 50 || precipProb > 80) return 'storm';
  if (precipSum > 2 || precipProb > 60) return 'rain';
  if (precipProb > 30) return 'partly_cloudy';
  if (precipProb > 10) return 'partly_cloudy';
  return 'sunny';
}

function deriveSprayWindow(
  windMax: number,
  precipProbMax: number,
  tempMax: number,
  tempMin: number,
): SprayWindowStatus {
  const blocked =
    windMax > 15 || precipProbMax > 20 || tempMax > 28 || tempMin < 5;
  const marginal =
    windMax > 10 || precipProbMax > 10 || tempMax > 25 || tempMin < 8;
  if (blocked) return 'closed';
  if (marginal) return 'marginal';
  return 'open';
}

export async function buildWeatherForecast(
  farmLocation: string,
  latitude: number | null,
  longitude: number | null,
): Promise<WeatherForecast | null> {
  // No fallback to a default location — the caller already has a generic
  // "weather unavailable" placeholder for a null return (getRealDashboardData
  // below), which is the honest thing to show a farm with no coordinates on
  // file, not a specific-looking forecast that's actually for somewhere else
  // while the location label still reads as this farm's own.
  if (latitude == null || longitude == null) return null;
  try {
    const data = await fetchWeather(latitude, longitude);

    const days: WeatherDay[] = data.daily.map((d) => ({
      date: d.date,
      tempMaxCelsius: d.temperatureMax,
      tempMinCelsius: d.temperatureMin,
      rainMm: d.precipitationSum,
      windSpeedKmh: Math.round(d.windSpeedMax),
      windDirection: 'NE',
      condition: deriveCondition(d.precipitationProbabilityMax, d.precipitationSum, d.windSpeedMax),
      sprayWindow: deriveSprayWindow(d.windSpeedMax, d.precipitationProbabilityMax, d.temperatureMax, d.temperatureMin),
    }));

    const today = getAmsterdamDateString();
    const currentHour = data.hourly.find((h) => h.time.startsWith(today));

    return {
      location: farmLocation,
      currentTempCelsius: currentHour?.temperature ?? (days[0]?.tempMaxCelsius ?? 15),
      currentCondition: days[0]?.condition ?? 'partly_cloudy',
      days,
    };
  } catch {
    return null;
  }
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export async function getRealDashboardData(farm: Farm): Promise<DashboardData> {
  const farmLocation = `${farm.location}`;

  const [
    prismaFields,
    prismaFieldSeasons,
    prismaTasks,
    prismaInventoryAlerts,
    prismaCompliance,
    prismaFinancialSnapshot,
    weather,
  ] = await Promise.all([
    // Fields (non-deleted)
    db.field.findMany({
      where: { farmId: farm.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    // Active field seasons (to get current crop per field)
    db.fieldSeason.findMany({
      where: {
        field: { farmId: farm.id, deletedAt: null },
        season: { farmId: farm.id, isActive: true },
      },
      select: { fieldId: true, crop: true },
    }),
    // Open tasks
    db.task.findMany({
      where: { farmId: farm.id, status: { not: 'done' } },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      take: 20,
    }),
    // All inventory items — filter low stock / expiring in memory (field-to-field compare not supported in Prisma ORM)
    db.inventoryItem.findMany({
      where: { farmId: farm.id },
      orderBy: { name: 'asc' },
    }),
    // Compliance items
    db.complianceItem.findMany({
      where: { farmId: farm.id },
      orderBy: { dueDate: 'asc' },
      take: 20,
    }),
    // Latest financial snapshot for active season
    db.financialSnapshot.findFirst({
      where: { season: { farmId: farm.id, isActive: true } },
      orderBy: { createdAt: 'desc' },
      include: { cropFinancials: true, season: true },
    }),
    // Weather (non-blocking — null on error). Falls back to the default
    // location constants when the farm has no coordinates set yet.
    buildWeatherForecast(
      farmLocation,
      farm.latitude != null ? Number(farm.latitude) : null,
      farm.longitude != null ? Number(farm.longitude) : null,
    ),
  ]);

  // Build crop lookup map: fieldId → CropName
  const cropByFieldId = new Map<string, CropName>();
  for (const fs of prismaFieldSeasons) {
    const mapped = PRISMA_CROP_MAP[fs.crop as string];
    if (mapped) cropByFieldId.set(fs.fieldId, mapped);
  }

  // Map fields
  const fields: Field[] = prismaFields.map((f) => ({
    id: f.id,
    farmId: f.farmId,
    name: f.name,
    hectares: Number(f.hectares),
    soilType: f.soilType as Field['soilType'],
    status: f.status as Field['status'],
    ndviScore: f.ndviScore ?? undefined,
    currentCrop: cropByFieldId.get(f.id),
  }));

  // Map tasks
  const tasks: Task[] = prismaTasks.map((t) => ({
    id: t.id,
    farmId: t.farmId ?? farm.id,
    title: t.title,
    description: t.description ?? undefined,
    type: (t.type === 'fertilise' ? 'fertilize' : t.type) as Task['type'],
    priority: t.priority as Task['priority'],
    status: t.status as Task['status'],
    dueDate: t.dueDate.toISOString(),
    assignedTo: t.assignedTo ?? undefined,
    relatedModule: 'dashboard' as Task['relatedModule'],
  }));

  // Filter alerts in memory: low stock OR expiring within 30 days
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const alertItems = prismaInventoryAlerts.filter((i) => {
    const lowStock = Number(i.currentStock) < Number(i.minimumStock);
    const expiringSoon = i.expiryDate != null && i.expiryDate <= in30Days && i.expiryDate >= new Date();
    return lowStock || expiringSoon;
  });

  // Map inventory alerts
  const inventoryAlerts: InventoryItem[] = alertItems.map((i) => ({
    id: i.id,
    farmId: i.farmId,
    name: i.name,
    category: PRISMA_CATEGORY_MAP[i.category as string] ?? 'other',
    activeIngredient: i.activeIngredient ?? undefined,
    unit: i.unit as InventoryItem['unit'],
    currentStock: Number(i.currentStock),
    minimumStock: Number(i.minimumStock),
    purchasePricePerUnit: Number(i.purchasePricePerUnit ?? 0),
    expiryDate: i.expiryDate ? i.expiryDate.toISOString() : undefined,
    supplierName: i.supplierName ?? undefined,
    registrationNumber: i.registrationNumber ?? undefined,
  }));

  // Map compliance items
  const compliance: ComplianceItem[] = prismaCompliance.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    status: c.status as ComplianceItem['status'],
    dueDate: c.dueDate ? c.dueDate.toISOString() : undefined,
    module: c.module as ComplianceItem['module'],
  }));

  // Map finance
  const finance: FinancialSnapshot = prismaFinancialSnapshot
    ? {
        seasonId: String(prismaFinancialSnapshot.season.year),
        costPerHectareEur: Number(prismaFinancialSnapshot.costPerHectareEur),
        totalExpensesEur: Number(prismaFinancialSnapshot.totalExpensesEur),
        totalRevenueEur: Number(prismaFinancialSnapshot.totalRevenueEur),
        estimatedMarginEur: Number(prismaFinancialSnapshot.estimatedMarginEur),
        estimatedMarginPerHaEur: Number(prismaFinancialSnapshot.estimatedMarginPerHaEur),
        budgetVarianceEur: Number(prismaFinancialSnapshot.budgetVarianceEur),
        cropBreakdown: prismaFinancialSnapshot.cropFinancials.map((cf) => ({
          crop: (PRISMA_CROP_MAP[cf.crop as string] ?? 'wheat') as CropName,
          hectares: Number(cf.hectares),
          revenueEur: Number(cf.revenueEur),
          costEur: Number(cf.costEur),
          marginEur: Number(cf.marginEur),
          marginPerHaEur: Number(cf.marginPerHaEur),
        })),
      }
    : {
        seasonId: 'N/A',
        costPerHectareEur: 0,
        totalExpensesEur: 0,
        totalRevenueEur: 0,
        estimatedMarginEur: 0,
        estimatedMarginPerHaEur: 0,
        budgetVarianceEur: 0,
        cropBreakdown: [],
      };

  // Weather fallback
  const weatherForecast: WeatherForecast = weather ?? {
    location: farmLocation,
    currentTempCelsius: 15,
    currentCondition: 'partly_cloudy',
    days: [],
  };

  return {
    farm: {
      id: farm.id,
      name: farm.name,
      location: farm.location,
      country: (farm.country as 'NL' | 'DE' | 'BE' | 'FR' | 'UK') ?? 'NL',
      totalHectares: Number(farm.totalHectares),
      brpNumber: farm.brpNumber ?? undefined,
      vatNumber: farm.vatNumber ?? undefined,
    },
    briefing: [],
    weather: weatherForecast,
    tasks,
    fields,
    inventoryAlerts,
    finance,
    compliance,
  };
}
