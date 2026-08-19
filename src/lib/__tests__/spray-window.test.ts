import { describe, it, expect } from 'vitest';
import {
  computeSprayWindows,
  getAmsterdamDateString,
  MOCK_DEFAULT_PRODUCT_PROFILE,
  type SprayProductProfile,
} from '../spray-window';
import type { HourlyWeather } from '../weather';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const DATE = '2026-07-06';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Builds an ideal-conditions hour for the given hour-of-day (0-23) on DATE, overridable. */
function makeHour(hour: number, overrides: Partial<HourlyWeather> = {}, date = DATE): HourlyWeather {
  return {
    time: `${date}T${pad(hour)}:00`,
    temperature: 15,
    windSpeed: 4,
    windGust: 7,
    windDirection: 200,
    precipitation: 0,
    precipitationProbability: 0,
    relativeHumidity: 50,
    leafWetness: 0,
    isDay: 1,
    ...overrides,
  };
}

/** A full day (00:00–23:00) of ideal-conditions hours, individually overridable by hour index. */
function makeDay(overridesByHour: Record<number, Partial<HourlyWeather>> = {}, date = DATE): HourlyWeather[] {
  return Array.from({ length: 24 }, (_, h) => makeHour(h, overridesByHour[h] ?? {}, date));
}

const NOON_LOCAL = new Date('2026-07-06T10:00:00Z'); // 12:00 Europe/Amsterdam (summer, UTC+2)

// ─── Hard blocker overrides soft score ───────────────────────────────────────

describe('hard blockers override the soft score', () => {
  it('marks a status "blocked" even when other factors would score well', () => {
    const hours = makeDay({ 12: { windSpeed: 25 } }); // exceeds 15 km/h hard limit, everything else ideal
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.status).toBe('blocked');
    expect(hour12.hardBlockers.some((b) => b.code === 'WIND_SPEED_EXCEEDS_LIMIT')).toBe(true);
  });

  it('never reports an "excellent" or "good" status for a blocked hour, regardless of score', () => {
    const hours = makeDay({ 12: { windSpeed: 25 } });
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(['good', 'excellent']).not.toContain(hour12.status);
  });

  it('blocks on wind gusts exceeding the profile gust limit even when sustained wind is fine', () => {
    const hours = makeDay({ 12: { windSpeed: 6, windGust: 40 } });
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.status).toBe('blocked');
    expect(hour12.hardBlockers.some((b) => b.code === 'WIND_GUST_EXCEEDS_LIMIT')).toBe(true);
  });
});

// ─── Rainfast violation ───────────────────────────────────────────────────────

describe('rainfast window violation', () => {
  it('returns blocked for an hour with otherwise-excellent conditions when rain is forecast within the rainfast period', () => {
    // Hour 12 itself has zero rain probability/amount (would score ~excellent),
    // but hour 13 (within the 2h default rainfast window) brings heavy rain.
    const hours = makeDay({
      12: { precipitation: 0, precipitationProbability: 0 },
      13: { precipitation: 5 },
    });
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;

    expect(hour12.status).toBe('blocked');
    expect(hour12.hardBlockers.some((b) => b.code === 'RAINFAST_PRECIPITATION_EXCEEDS_LIMIT')).toBe(true);
    // The underlying soft score is still high — proving the block is NOT because the score was low.
    expect(hour12.score).toBeGreaterThanOrEqual(70);
  });

  it('does not block when rain within the rainfast window is below the profile threshold', () => {
    const hours = makeDay({
      12: { precipitation: 0, precipitationProbability: 0 },
      13: { precipitation: 0.2 }, // under the 1mm default threshold
    });
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.status).not.toBe('blocked');
  });
});

// ─── Confidence / weather staleness ───────────────────────────────────────────

describe('weather data staleness and confidence', () => {
  const now = new Date('2026-07-06T10:00:00Z');

  it('reports low confidence when the weather payload is stale', () => {
    const hours = makeDay();
    const staleFetchedAt = new Date(now.getTime() - 90 * 60 * 1000).toISOString(); // 90 min old
    const result = computeSprayWindows(hours, DATE, { now, weatherFetchedAt: staleFetchedAt });
    expect(result.confidence).toBe('low');
    expect(result.weatherDataAge).toBe(90);
  });

  it('reports high confidence for a fresh same-day forecast', () => {
    const hours = makeDay();
    const freshFetchedAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // 5 min old
    const result = computeSprayWindows(hours, DATE, { now, weatherFetchedAt: freshFetchedAt });
    expect(result.confidence).toBe('high');
  });

  it('reports unknown age (-1) and does not crash when weatherFetchedAt is omitted', () => {
    const hours = makeDay();
    const result = computeSprayWindows(hours, DATE, { now });
    expect(result.weatherDataAge).toBe(-1);
  });
});

// ─── No suitable window ───────────────────────────────────────────────────────

describe('no suitable window', () => {
  it('returns null best window and a blocked overall status when every hour is blocked', () => {
    const hours = makeDay(
      Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, { windSpeed: 30 }])),
    );
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });

    expect(result.bestWindowStart).toBeNull();
    expect(result.bestWindowEnd).toBeNull();
    expect(result.status).toBe('blocked');
    expect(result.summaryCode).toBe('BLOCKED');
  });
});

// ─── Marginal wind ─────────────────────────────────────────────────────────────

describe('marginal wind', () => {
  it('is not blocked but produces a wind warning when wind is close to the limit', () => {
    const hours = makeDay({ 12: { windSpeed: 13 } }); // under the 15 km/h limit, above the ideal ceiling
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;

    expect(hour12.status).not.toBe('blocked');
    expect(hour12.hardBlockers).toHaveLength(0);
    expect(hour12.warnings.some((w) => w.code === 'WIND_APPROACHING_LIMIT')).toBe(true);
  });
});

// ─── Temperature outside configured range ─────────────────────────────────────

describe('temperature outside configured product limits', () => {
  it('blocks when below the minimum', () => {
    const hours = makeDay({ 12: { temperature: 2 } });
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.status).toBe('blocked');
    expect(hour12.hardBlockers.some((b) => b.code === 'TEMPERATURE_BELOW_MINIMUM')).toBe(true);
  });

  it('blocks when above the maximum', () => {
    const hours = makeDay({ 12: { temperature: 32 } });
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.status).toBe('blocked');
    expect(hour12.hardBlockers.some((b) => b.code === 'TEMPERATURE_ABOVE_MAXIMUM')).toBe(true);
  });

  it('respects a custom product profile with tighter bounds', () => {
    const tightProfile: SprayProductProfile = {
      ...MOCK_DEFAULT_PRODUCT_PROFILE,
      id: 'custom-1',
      name: 'Custom test product',
      isMockDefault: false,
      minTemperatureC: 12,
      maxTemperatureC: 20,
    };
    const hours = makeDay({ 12: { temperature: 22 } });
    const result = computeSprayWindows(hours, DATE, {
      now: new Date('2026-07-06T10:00:00Z'),
      productProfile: tightProfile,
    });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.status).toBe('blocked');
  });
});

// ─── Missing product profile ──────────────────────────────────────────────────

describe('missing product profile', () => {
  it('in advisory mode, defaults to the mock profile and only warns', () => {
    const hours = makeDay();
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    expect(result.productProfile.isMockDefault).toBe(true);
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.warnings.some((w) => w.code === 'GENERIC_PROFILE_USED')).toBe(true);
    expect(hour12.status).not.toBe('blocked');
  });

  it('in planned-application mode, no selected product is a hard blocker', () => {
    const hours = makeDay();
    const result = computeSprayWindows(hours, DATE, {
      now: new Date('2026-07-06T10:00:00Z'),
      mode: 'planned-application',
    });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.status).toBe('blocked');
    expect(hour12.hardBlockers.some((b) => b.code === 'PRODUCT_NOT_SELECTED')).toBe(true);
  });
});

// ─── Planned-application mode: other missing context ──────────────────────────

describe('planned-application mode treats missing compliance context as a hard blocker', () => {
  const now = new Date('2026-07-06T10:00:00Z');
  const realProfile: SprayProductProfile = {
    ...MOCK_DEFAULT_PRODUCT_PROFILE,
    id: 'real-1',
    name: 'Real product',
    isMockDefault: false,
  };

  it('blocks when operator context is missing', () => {
    const result = computeSprayWindows(makeDay(), DATE, {
      now,
      mode: 'planned-application',
      productProfile: realProfile,
    });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.hardBlockers.some((b) => b.code === 'OPERATOR_CONTEXT_MISSING')).toBe(true);
  });

  it('blocks when the operator certificate is expired', () => {
    const result = computeSprayWindows(makeDay(), DATE, {
      now,
      mode: 'planned-application',
      productProfile: realProfile,
      operator: { hasCertification: true, certExpiry: '2020-01-01' },
      inventory: { requiredQuantity: 5, availableStock: 100, unit: 'L' },
    });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.hardBlockers.some((b) => b.code === 'OPERATOR_CERTIFICATION_INVALID')).toBe(true);
  });

  it('blocks when inventory is insufficient', () => {
    const result = computeSprayWindows(makeDay(), DATE, {
      now,
      mode: 'planned-application',
      productProfile: realProfile,
      operator: { hasCertification: true, certExpiry: '2030-01-01' },
      inventory: { requiredQuantity: 50, availableStock: 10, unit: 'L' },
    });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.hardBlockers.some((b) => b.code === 'INSUFFICIENT_STOCK')).toBe(true);
  });

  it('passes cleanly when all compliance context is satisfied', () => {
    const result = computeSprayWindows(makeDay(), DATE, {
      now,
      mode: 'planned-application',
      productProfile: realProfile,
      operator: { hasCertification: true, certExpiry: '2030-01-01' },
      inventory: { requiredQuantity: 5, availableStock: 100, unit: 'L' },
    });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.hardBlockers).toHaveLength(0);
  });
});

// ─── Dew point risk ────────────────────────────────────────────────────────────

describe('dew point risk', () => {
  it('warns on a narrow dew point margin', () => {
    const hours = makeDay({ 12: { temperature: 18, relativeHumidity: 97 } });
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.warnings.some((w) => w.code === 'NARROW_DEW_POINT_MARGIN')).toBe(true);
  });

  it('lists a positive factor for a wide dew point margin', () => {
    const hours = makeDay({ 12: { temperature: 20, relativeHumidity: 40 } });
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.positiveFactors.some((p) => p.code === 'WIDE_DEW_POINT_MARGIN')).toBe(true);
  });
});

// ─── Best window selection ─────────────────────────────────────────────────────

describe('best window selection', () => {
  it('picks the longest contiguous non-blocked run', () => {
    const blockedHours = [0, 1, 2, 3, 4, 5, 11, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const overrides = Object.fromEntries(blockedHours.map((h) => [h, { windSpeed: 30 }]));
    // Open runs: 6-10 (5 hours), 12-14 (3 hours)
    const hours = makeDay(overrides);
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });

    expect(result.bestWindowStart).toBe(`${DATE}T06:00`);
    expect(result.bestWindowEnd).toBe(`${DATE}T10:00`);
  });

  it('breaks ties between equal-length runs by average score', () => {
    // Open runs: 7-8 (2h, marginal wind → lower score) and 12-13 (2h, ideal wind → higher score).
    const blockedHours = [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const overrides: Record<number, Partial<HourlyWeather>> = Object.fromEntries(
      blockedHours.map((h) => [h, { windSpeed: 30 }]),
    );
    overrides[7] = { windSpeed: 12 }; // marginal wind → lower score
    overrides[8] = { windSpeed: 12 };
    overrides[12] = { windSpeed: 2 }; // ideal wind → higher score
    overrides[13] = { windSpeed: 2 };
    const hours = makeDay(overrides);
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });

    // Both runs are 2 hours long; the higher-scoring run (12-13) should win the tie-break.
    expect(result.bestWindowStart).toBe(`${DATE}T12:00`);
    expect(result.bestWindowEnd).toBe(`${DATE}T13:00`);
  });
});

// ─── Deterministic output ───────────────────────────────────────────────────────

describe('deterministic output', () => {
  it('produces identical results for identical inputs', () => {
    const hours = makeDay({ 9: { windSpeed: 11 }, 15: { temperature: 27 } });
    const options = { now: new Date('2026-07-06T10:00:00Z'), weatherFetchedAt: '2026-07-06T09:45:00.000Z' };

    const result1 = computeSprayWindows(hours, DATE, options);
    const result2 = computeSprayWindows(hours, DATE, options);

    expect(result1).toEqual(result2);
  });
});

// ─── Invalid or incomplete weather data ───────────────────────────────────────

describe('invalid or incomplete weather data', () => {
  it('returns a safe, non-throwing empty result for a date with no forecast data', () => {
    const hours = makeDay(); // all on DATE
    const result = computeSprayWindows(hours, '2099-01-01', { now: new Date('2026-07-06T10:00:00Z') });

    expect(result.hours).toHaveLength(0);
    expect(result.bestWindowStart).toBeNull();
    expect(result.status).toBe('blocked');
    expect(result.summaryCode).toBe('NO_FORECAST_DATA');
  });

  it('does not throw and surfaces a warning when wind gust data is unavailable (0 fallback)', () => {
    const hours = makeDay({ 12: { windGust: 0 } });
    expect(() =>
      computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') }),
    ).not.toThrow();
    const result = computeSprayWindows(hours, DATE, { now: new Date('2026-07-06T10:00:00Z') });
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.warnings.some((w) => w.code === 'WIND_GUST_UNAVAILABLE')).toBe(true);
  });

  it('handles an empty hours array without throwing', () => {
    expect(() => computeSprayWindows([], DATE, { now: new Date('2026-07-06T10:00:00Z') })).not.toThrow();
  });
});

// ─── Timezone / DST handling for Europe/Amsterdam ─────────────────────────────

describe('Europe/Amsterdam timezone and DST handling', () => {
  it('rolls the Amsterdam date to the next day near midnight in summer (DST, UTC+2)', () => {
    // 22:30 UTC on 2026-07-06 is 00:30 local on 2026-07-07 in Amsterdam summer time.
    const dateStr = getAmsterdamDateString(new Date('2026-07-06T22:30:00Z'));
    expect(dateStr).toBe('2026-07-07');
  });

  it('rolls the Amsterdam date to the next day near midnight in winter (no DST, UTC+1)', () => {
    // 23:30 UTC on 2026-01-06 is 00:30 local on 2026-01-07 in Amsterdam winter time.
    const dateStr = getAmsterdamDateString(new Date('2026-01-06T23:30:00Z'));
    expect(dateStr).toBe('2026-01-07');
  });

  it('locates "now" at the correct local hour regardless of the server/test-runner timezone', () => {
    // 10:00 UTC = 12:00 Europe/Amsterdam in summer.
    const hours = makeDay({ 12: { windSpeed: 3 } }); // ideal hour at the local "now" slot
    const result = computeSprayWindows(hours, DATE, { now: NOON_LOCAL });
    expect(result.isOpenNow).toBe(true);
    const hour12 = result.hours.find((h) => h.time.endsWith('T12:00'))!;
    expect(hour12.status).not.toBe('blocked');
  });
});
