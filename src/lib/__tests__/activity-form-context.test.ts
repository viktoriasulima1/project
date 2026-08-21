import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    fieldSeason: { findMany: vi.fn() },
    inventoryItem: { findMany: vi.fn() },
    machine: { findMany: vi.fn() },
    employee: { findMany: vi.fn() },
    activity: { findFirst: vi.fn(), findMany: vi.fn() },
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('./db', () => ({ db: mockDb }));

const { mockFetchWeather } = vi.hoisted(() => ({ mockFetchWeather: vi.fn() }));
vi.mock('@/lib/weather', () => ({ fetchWeather: mockFetchWeather }));
vi.mock('../weather', () => ({ fetchWeather: mockFetchWeather }));

const { mockGetAmsterdamDateString } = vi.hoisted(() => ({
  mockGetAmsterdamDateString: vi.fn(() => '2026-07-12'),
}));
vi.mock('@/lib/spray-window', () => ({ getAmsterdamDateString: mockGetAmsterdamDateString }));
vi.mock('../spray-window', () => ({ getAmsterdamDateString: mockGetAmsterdamDateString }));

import { getActivityFormContext, getRecentActivityForRepeat } from '../activity-form-context';

const FARM_WITH_COORDS = {
  id: 'farm-1',
  latitude: '52.5000',
  longitude: '6.1000',
} as never;

const FARM_NO_COORDS = {
  id: 'farm-2',
  latitude: null,
  longitude: null,
} as never;

function setupDefaultMocks() {
  mockDb.fieldSeason.findMany.mockResolvedValue([]);
  mockDb.inventoryItem.findMany.mockResolvedValue([]);
  mockDb.machine.findMany.mockResolvedValue([]);
  mockDb.employee.findMany.mockResolvedValue([]);
  mockDb.activity.findFirst.mockResolvedValue(null);
  mockDb.activity.findMany.mockResolvedValue([]);
  mockFetchWeather.mockResolvedValue({
    hourly: [
      { time: '2026-07-12T12:00', temperature: 21, windSpeed: 12, windDirection: 180, relativeHumidity: 60 },
    ],
  });
}

describe('getActivityFormContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('maps field seasons, products, and machines from Decimal/db shape to plain option lists', async () => {
    const geometry = { type: 'Polygon', coordinates: [[[5, 52], [6, 52], [6, 53], [5, 53], [5, 52]]] };
    mockDb.fieldSeason.findMany.mockResolvedValue([
      { id: 'fs-1', crop: 'wheat', field: { name: 'Rijnkamp Noord', hectares: '12.50', coordinates: geometry } },
    ] as never);
    mockDb.inventoryItem.findMany.mockResolvedValue([
      { id: 'prod-1', name: 'Amistar Opti', unit: 'L', category: 'fungicide', currentStock: '500.000', minimumStock: '50.000', purchasePricePerUnit: '34.50' },
      { id: 'prod-2', name: 'Manual Entry', unit: 'kg', category: 'other', currentStock: '10.000', minimumStock: '0.000', purchasePricePerUnit: null },
    ] as never);
    mockDb.machine.findMany.mockResolvedValue([{ id: 'mach-1', name: 'Sprayer 1' }] as never);

    const result = await getActivityFormContext(FARM_WITH_COORDS);

    expect(result.fieldSeasons).toEqual([{ id: 'fs-1', fieldName: 'Rijnkamp Noord', crop: 'wheat', hectares: 12.5, geometry, recentOperatorName: null, recentMachineId: null }]);
    expect(result.products).toEqual([
      { id: 'prod-1', name: 'Amistar Opti', unit: 'L', category: 'fungicide', currentStock: 500, minimumStock: 50, unitCost: 34.5 },
      { id: 'prod-2', name: 'Manual Entry', unit: 'kg', category: 'other', currentStock: 10, minimumStock: 0, unitCost: null },
    ]);
    expect(result.machines).toEqual([{ id: 'mach-1', name: 'Sprayer 1' }]);
  });

  it('maps a field with no boundary drawn to null geometry, not an error', async () => {
    mockDb.fieldSeason.findMany.mockResolvedValue([
      { id: 'fs-1', crop: 'wheat', field: { name: 'Rijnkamp Noord', hectares: '12.50', coordinates: null } },
    ] as never);

    const result = await getActivityFormContext(FARM_WITH_COORDS);

    expect(result.fieldSeasons[0].geometry).toBeNull();
  });

  it('maps the active team roster for the operator autocomplete', async () => {
    mockDb.employee.findMany.mockResolvedValue([
      { id: 'emp-1', name: 'Jan de Vries', hasSpraying: true, certExpiry: new Date('2027-06-01') },
      { id: 'emp-2', name: 'Piet Bakker', hasSpraying: false, certExpiry: null },
    ] as never);

    const result = await getActivityFormContext(FARM_WITH_COORDS);

    expect(result.employees).toEqual([
      { id: 'emp-1', name: 'Jan de Vries', hasSpraying: true, certExpiry: '2027-06-01T00:00:00.000Z' },
      { id: 'emp-2', name: 'Piet Bakker', hasSpraying: false, certExpiry: null },
    ]);
  });

  it('only queries active team members for the operator autocomplete', async () => {
    await getActivityFormContext(FARM_WITH_COORDS);

    expect(mockDb.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { farmId: 'farm-1', isActive: true } }),
    );
  });

  it('gives each field its own most recent operator/machine, not the farm-wide one', async () => {
    mockDb.fieldSeason.findMany.mockResolvedValue([
      { id: 'fs-1', crop: 'wheat', field: { name: 'Field A', hectares: '10.00', coordinates: null } },
      { id: 'fs-2', crop: 'barley', field: { name: 'Field B', hectares: '8.00', coordinates: null } },
    ] as never);
    // Newest first, as the real query orders by createdAt desc — fs-1's
    // newest is 'Anna' even though a later (older) fs-1 row says 'Bram',
    // and fs-2 never appears at all (no prior activity on that field yet).
    mockDb.activity.findMany.mockResolvedValue([
      { fieldSeasonId: 'fs-1', operatorName: 'Anna', machineId: 'mach-a' },
      { fieldSeasonId: 'fs-1', operatorName: 'Bram', machineId: 'mach-b' },
    ] as never);

    const result = await getActivityFormContext(FARM_WITH_COORDS);

    const fieldA = result.fieldSeasons.find((fs) => fs.id === 'fs-1');
    const fieldB = result.fieldSeasons.find((fs) => fs.id === 'fs-2');
    expect(fieldA).toMatchObject({ recentOperatorName: 'Anna', recentMachineId: 'mach-a' });
    expect(fieldB).toMatchObject({ recentOperatorName: null, recentMachineId: null });
  });

  it('surfaces the most recent activity operator/machine as safe prefill suggestions', async () => {
    mockDb.activity.findFirst.mockResolvedValue({ operatorName: 'Jan de Boer', machineId: 'mach-1' } as never);

    const result = await getActivityFormContext(FARM_WITH_COORDS);

    expect(result.recentOperatorName).toBe('Jan de Boer');
    expect(result.recentMachineId).toBe('mach-1');
  });

  it('returns null recent operator/machine when the farm has no prior activity', async () => {
    mockDb.activity.findFirst.mockResolvedValue(null);

    const result = await getActivityFormContext(FARM_WITH_COORDS);

    expect(result.recentOperatorName).toBeNull();
    expect(result.recentMachineId).toBeNull();
  });

  it('builds a weather snapshot from the current hour when the farm has coordinates', async () => {
    const result = await getActivityFormContext(FARM_WITH_COORDS);

    expect(result.weather).toEqual({ tempC: 21, windKmh: 12, windDir: 'S', humidity: 60, fetchedAt: expect.any(String) });
    expect(mockFetchWeather).toHaveBeenCalledWith(52.5, 6.1);
  });

  it('does not call fetchWeather and returns null weather when the farm has no coordinates', async () => {
    const result = await getActivityFormContext(FARM_NO_COORDS);

    expect(result.weather).toBeNull();
    expect(mockFetchWeather).not.toHaveBeenCalled();
  });

  it('returns null weather (not throw) when the weather fetch fails', async () => {
    mockFetchWeather.mockRejectedValue(new Error('Open-Meteo down'));

    const result = await getActivityFormContext(FARM_WITH_COORDS);

    expect(result.weather).toBeNull();
  });

  it('returns null weather when the fetched data has no entry for the current hour', async () => {
    mockFetchWeather.mockResolvedValue({ hourly: [{ time: '2099-01-01T00:00', temperature: 1, windSpeed: 1, windDirection: 0, relativeHumidity: 1 }] });

    const result = await getActivityFormContext(FARM_WITH_COORDS);

    expect(result.weather).toBeNull();
  });
});

describe('getRecentActivityForRepeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only the safe-to-copy fields, never date/dose/area/weather', async () => {
    mockDb.activity.findFirst.mockResolvedValue({
      type: 'spray',
      operatorName: 'Jan de Boer',
      machineId: 'mach-1',
      productId: 'prod-1',
      fieldSeasonId: 'fs-1',
    } as never);

    const result = await getRecentActivityForRepeat(FARM_WITH_COORDS, 'activity-1');

    expect(result).toEqual({
      type: 'spray',
      fieldSeasonId: 'fs-1',
      operatorName: 'Jan de Boer',
      machineId: 'mach-1',
      productId: 'prod-1',
    });
    // Structural guarantee: the returned shape has no date/dose/area/weather keys at all.
    const forbidden = ['date', 'dosePerHa', 'areaHa', 'waterVolumePerHa', 'weather', 'bbch'];
    for (const key of forbidden) {
      expect(result).not.toHaveProperty(key);
    }
  });

  it('returns null when the activity does not belong to the given farm', async () => {
    mockDb.activity.findFirst.mockResolvedValue(null);

    const result = await getRecentActivityForRepeat(FARM_WITH_COORDS, 'foreign-activity');

    expect(result).toBeNull();
  });

  it('scopes the lookup to the farm via the fieldSeason.field.farmId filter', async () => {
    mockDb.activity.findFirst.mockResolvedValue(null);

    await getRecentActivityForRepeat(FARM_WITH_COORDS, 'activity-1');

    expect(mockDb.activity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'activity-1',
          fieldSeason: { field: { farmId: 'farm-1' } },
        }),
      }),
    );
  });
});
