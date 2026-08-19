import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    field: { findMany: vi.fn() },
    fieldSeason: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
    inventoryItem: { findMany: vi.fn() },
    complianceItem: { findMany: vi.fn() },
    financialSnapshot: { findFirst: vi.fn() },
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('./db', () => ({ db: mockDb }));

const { mockFetchWeather } = vi.hoisted(() => ({ mockFetchWeather: vi.fn() }));
vi.mock('@/lib/weather', () => ({ fetchWeather: mockFetchWeather }));
vi.mock('../weather', () => ({ fetchWeather: mockFetchWeather }));

const { mockGetAmsterdamDateString } = vi.hoisted(() => ({
  mockGetAmsterdamDateString: vi.fn(() => '2026-07-06'),
}));
vi.mock('@/lib/spray-window', () => ({ getAmsterdamDateString: mockGetAmsterdamDateString }));
vi.mock('../spray-window', () => ({ getAmsterdamDateString: mockGetAmsterdamDateString }));

import { getRealDashboardData } from '../dashboard-data';

const FARM = {
  id: 'farm-1',
  clerkUserId: 'user-1',
  name: 'Dev Farm Gelderland',
  location: 'Westervoort, Gelderland',
  country: 'NL',
  totalHectares: '145.50',
  brpNumber: '12345678',
  vatNumber: null,
  latitude: '52.5000',
  longitude: '6.1000',
} as never;

function setupDefaultMocks() {
  mockDb.field.findMany.mockResolvedValue([]);
  mockDb.fieldSeason.findMany.mockResolvedValue([]);
  mockDb.task.findMany.mockResolvedValue([]);
  mockDb.inventoryItem.findMany.mockResolvedValue([]);
  mockDb.complianceItem.findMany.mockResolvedValue([]);
  mockDb.financialSnapshot.findFirst.mockResolvedValue(null);
  mockFetchWeather.mockResolvedValue({
    latitude: 51.9652,
    longitude: 5.9307,
    timezone: 'Europe/Amsterdam',
    hourly: [{ time: '2026-07-06T12:00', temperature: 18, windSpeed: 5, windGust: 8, windDirection: 200, precipitation: 0, precipitationProbability: 0, relativeHumidity: 50, leafWetness: 0, isDay: 1 }],
    daily: [{ date: '2026-07-06', temperatureMax: 20, temperatureMin: 12, precipitationSum: 0, windSpeedMax: 10, precipitationProbabilityMax: 5, uvIndex: 4 }],
    fetchedAt: '2026-07-06T10:00:00.000Z',
  });
}

describe('getRealDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('maps farm Decimal fields to plain numbers', async () => {
    const result = await getRealDashboardData(FARM);
    expect(result.farm.totalHectares).toBe(145.5);
    expect(typeof result.farm.totalHectares).toBe('number');
  });

  it('maps field hectares from Decimal to number and attaches the active-season crop', async () => {
    mockDb.field.findMany.mockResolvedValue([
      { id: 'field-1', farmId: 'farm-1', name: 'Keetje Noord', hectares: '24.30', soilType: 'clay', status: 'healthy', ndviScore: 72 },
    ] as never);
    mockDb.fieldSeason.findMany.mockResolvedValue([
      { fieldId: 'field-1', crop: 'wheat' },
    ] as never);

    const result = await getRealDashboardData(FARM);

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].hectares).toBe(24.3);
    expect(typeof result.fields[0].hectares).toBe('number');
    expect(result.fields[0].currentCrop).toBe('wheat');
  });

  it('leaves currentCrop undefined for a field with no active-season assignment', async () => {
    mockDb.field.findMany.mockResolvedValue([
      { id: 'field-1', farmId: 'farm-1', name: 'Fallow field', hectares: '10.00', soilType: 'loam', status: 'fallow', ndviScore: null },
    ] as never);

    const result = await getRealDashboardData(FARM);

    expect(result.fields[0].currentCrop).toBeUndefined();
  });

  it('flags an inventory item as an alert when stock is below minimum', async () => {
    mockDb.inventoryItem.findMany.mockResolvedValue([
      { id: 'item-1', farmId: 'farm-1', name: 'KAS 27% N', category: 'fertiliser', activeIngredient: null, unit: 'kg', currentStock: '100.000', minimumStock: '500.000', purchasePricePerUnit: null, expiryDate: null, supplierName: null, registrationNumber: null },
    ] as never);

    const result = await getRealDashboardData(FARM);

    expect(result.inventoryAlerts).toHaveLength(1);
    expect(result.inventoryAlerts[0].name).toBe('KAS 27% N');
    expect(result.inventoryAlerts[0].category).toBe('fertilizer'); // fertiliser -> fertilizer mapping
  });

  it('does not flag an inventory item with sufficient stock and no near expiry', async () => {
    mockDb.inventoryItem.findMany.mockResolvedValue([
      { id: 'item-1', farmId: 'farm-1', name: 'Plenty of stock', category: 'seed', activeIngredient: null, unit: 'bag', currentStock: '500.000', minimumStock: '10.000', purchasePricePerUnit: null, expiryDate: null, supplierName: null, registrationNumber: null },
    ] as never);

    const result = await getRealDashboardData(FARM);

    expect(result.inventoryAlerts).toHaveLength(0);
  });

  it('flags an inventory item expiring within 30 days even with sufficient stock', async () => {
    const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    mockDb.inventoryItem.findMany.mockResolvedValue([
      { id: 'item-1', farmId: 'farm-1', name: 'Expiring soon', category: 'herbicide', activeIngredient: null, unit: 'L', currentStock: '100.000', minimumStock: '10.000', purchasePricePerUnit: null, expiryDate: in10Days, supplierName: null, registrationNumber: null },
    ] as never);

    const result = await getRealDashboardData(FARM);

    expect(result.inventoryAlerts).toHaveLength(1);
  });

  it('returns a zeroed-out finance snapshot with seasonId "N/A" when no financial snapshot exists', async () => {
    const result = await getRealDashboardData(FARM);

    expect(result.finance.seasonId).toBe('N/A');
    expect(result.finance.totalRevenueEur).toBe(0);
    expect(result.finance.cropBreakdown).toEqual([]);
  });

  it('maps a real financial snapshot, converting Decimals and using the season year as seasonId', async () => {
    mockDb.financialSnapshot.findFirst.mockResolvedValue({
      seasonId: 'season-1',
      costPerHectareEur: '850.00',
      totalExpensesEur: '10000.00',
      totalRevenueEur: '15000.00',
      estimatedMarginEur: '5000.00',
      estimatedMarginPerHaEur: '250.00',
      budgetVarianceEur: '-500.00',
      season: { year: 2026 },
      cropFinancials: [
        { crop: 'wheat', hectares: '20.00', revenueEur: '8000.00', costEur: '6000.00', marginEur: '2000.00', marginPerHaEur: '100.00' },
      ],
    } as never);

    const result = await getRealDashboardData(FARM);

    expect(result.finance.seasonId).toBe('2026');
    expect(result.finance.totalRevenueEur).toBe(15000);
    expect(result.finance.cropBreakdown).toHaveLength(1);
    expect(result.finance.cropBreakdown[0].hectares).toBe(20);
  });

  it('falls back to default weather when the weather fetch fails, without throwing', async () => {
    mockFetchWeather.mockRejectedValue(new Error('Open-Meteo down'));

    const result = await getRealDashboardData(FARM);

    expect(result.weather.currentTempCelsius).toBe(15);
    expect(result.weather.days).toEqual([]);
  });

  it('passes the farm\'s own coordinates to the weather fetch, not the hardcoded fallback', async () => {
    await getRealDashboardData(FARM);
    expect(mockFetchWeather).toHaveBeenCalledWith(52.5, 6.1);
  });

  it('uses the fallback coordinates when the farm has none set', async () => {
    const farmNoCoords = {
      id: 'farm-2',
      clerkUserId: 'user-2',
      name: 'No Coords Farm',
      location: 'Somewhere, NL',
      country: 'NL',
      totalHectares: '10.00',
      brpNumber: null,
      vatNumber: null,
      latitude: null,
      longitude: null,
    } as never;
    await getRealDashboardData(farmNoCoords);
    // Fallback constants default to 51.9652 / 5.9307 per dashboard-data.ts
    expect(mockFetchWeather).toHaveBeenCalledWith(51.9652, 5.9307);
  });
});
