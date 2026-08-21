import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/farm', () => ({ getActiveFarmOrThrow: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: {
    fieldSeason: { findFirst: vi.fn() },
    inventoryItem: { findFirst: vi.fn() },
    machine: { findFirst: vi.fn() },
    employee: { findMany: vi.fn() },
  },
}));
vi.mock('@/lib/weather', () => ({ fetchWeather: vi.fn() }));

// The real spray-window engine is deliberately NOT mocked — these tests
// prove the new action is a genuine integration with it, not a stub that
// merely calls through.
import { evaluateSpraySuitability } from '../spray-suitability';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { db } from '@/lib/db';
import { fetchWeather } from '@/lib/weather';

const FARM = { id: 'farm-1', latitude: '52.0000', longitude: '5.9000' } as never;

function idealHour() {
  return {
    time: '2026-07-07T12:00',
    temperature: 18,
    windSpeed: 5,
    windGust: 8,
    windDirection: 180,
    precipitation: 0,
    precipitationProbability: 0,
    relativeHumidity: 50,
    leafWetness: 0,
    isDay: 1,
  };
}

describe('evaluateSpraySuitability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue(FARM);
    vi.mocked(db.fieldSeason.findFirst).mockResolvedValue({ crop: 'wheat', bbchStage: 30 } as never);
    vi.mocked(db.inventoryItem.findFirst).mockResolvedValue({ currentStock: '100.000', unit: 'L', farmId: 'farm-1' } as never);
    vi.mocked(db.machine.findFirst).mockResolvedValue({ farmId: 'farm-1' } as never);
    vi.mocked(db.employee.findMany).mockResolvedValue([]);
    vi.mocked(fetchWeather).mockResolvedValue({
      latitude: 52,
      longitude: 5.9,
      timezone: 'Europe/Amsterdam',
      hourly: [idealHour()],
      daily: [],
      fetchedAt: '2026-07-07T11:00:00.000Z',
    } as never);
  });

  // Test 1: Spray engine is called from real spray flow
  it('runs the real spray-window engine in planned-application mode with real field/product/operator context', async () => {
    const result = await evaluateSpraySuitability({
      fieldSeasonId: 'fs-1',
      productId: 'prod-1',
      machineId: 'mach-1',
      nozzleType: 'flat_fan',
      operatorName: 'Jan de Vries',
      areaHa: 10,
      dosePerHa: 2,
      doseUnit: 'L',
      date: '2026-07-07',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.summary.disclaimerCode).toBe('INDICATIVE_ONLY');
      expect(typeof result.summary.score).toBe('number');
    }
  });

  // Test 2: Hard blocker prevents positive recommendation
  it('a hard blocker overrides the score even with otherwise-ideal weather', async () => {
    // idealHour() is low-wind, mild-temperature, dry — a high soft score on
    // its own. No matching Employee record exists, so in planned-application
    // mode this must still come back 'blocked', never a high score.
    const result = await evaluateSpraySuitability({
      fieldSeasonId: 'fs-1',
      productId: 'prod-1',
      machineId: 'mach-1',
      nozzleType: 'flat_fan',
      operatorName: 'Someone Not On File',
      areaHa: 10,
      dosePerHa: 2,
      doseUnit: 'L',
      date: '2026-07-07',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.summary.status).toBe('blocked');
      expect(result.summary.hardBlockers.length).toBeGreaterThan(0);
    }
  });

  // Test 3: Missing product profile is visible
  it('states plainly that no verified product registration was used', async () => {
    const result = await evaluateSpraySuitability({ fieldSeasonId: 'fs-1', date: '2026-07-07' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.summary.productProfile.isMockDefault).toBe(true);
      expect(result.summary.hardBlockers.some((b) => b.code === 'PRODUCT_NOT_SELECTED')).toBe(true);
    }
  });

  it('rejects a product id belonging to another farm', async () => {
    vi.mocked(db.inventoryItem.findFirst).mockResolvedValue({ currentStock: '100.000', unit: 'L', farmId: 'OTHER-FARM' } as never);
    const result = await evaluateSpraySuitability({ fieldSeasonId: 'fs-1', productId: 'prod-1', date: '2026-07-07' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('does not belong to this farm');
  });

  it('rejects a machine id belonging to another farm', async () => {
    vi.mocked(db.machine.findFirst).mockResolvedValue({ farmId: 'OTHER-FARM' } as never);
    const result = await evaluateSpraySuitability({ fieldSeasonId: 'fs-1', machineId: 'mach-1', date: '2026-07-07' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('does not belong to this farm');
  });

  it('returns a safe error when the field does not belong to this farm', async () => {
    vi.mocked(db.fieldSeason.findFirst).mockResolvedValue(null);
    const result = await evaluateSpraySuitability({ fieldSeasonId: 'fs-1', date: '2026-07-07' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('Field not found');
  });

  it('fails closed with an honest error, never a fallback-location forecast, when the farm has no coordinates', async () => {
    // A suitability check without the farm's real location must never
    // silently substitute an unrelated coordinate — a farmer could read
    // "conditions are safe" or "blocked" based on weather that was never
    // actually theirs. Missing context is a hard blocker here by design.
    vi.mocked(getActiveFarmOrThrow).mockResolvedValue({ id: 'farm-1', latitude: null, longitude: null } as never);
    const result = await evaluateSpraySuitability({ fieldSeasonId: 'fs-1', date: '2026-07-07' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('location');
    expect(fetchWeather).not.toHaveBeenCalled();
  });

  // Test 17: Raw internal errors do not reach UI
  it('never leaks a raw internal error message when the weather fetch fails', async () => {
    vi.mocked(fetchWeather).mockRejectedValue(new Error('ECONNREFUSED 10.0.0.5:443 — internal socket detail'));
    const result = await evaluateSpraySuitability({ fieldSeasonId: 'fs-1', date: '2026-07-07' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toContain('ECONNREFUSED');
      expect(result.error).not.toContain('10.0.0.5');
    }
  });
});
