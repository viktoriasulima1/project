import { describe, it, expect, vi, afterEach } from 'vitest';

// Outside a real Next.js server request, unstable_cache's actual
// implementation throws ("incrementalCache missing") rather than falling
// back gracefully — mock it as a passthrough so these tests exercise
// fetchWeather's own logic, not Next's caching internals.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

import { fetchWeather } from '../weather';

function mockOpenMeteoResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      latitude: 51.97,
      longitude: 5.94,
      timezone: 'Europe/Amsterdam',
      hourly: {
        time: ['2026-07-13T00:00'],
        temperature_2m: [18],
        wind_speed_10m: [5],
        wind_gusts_10m: [8],
        wind_direction_10m: [180],
        precipitation: [0],
        precipitation_probability: [0],
        relative_humidity_2m: [50],
        leaf_wetness_probability: [12],
        is_day: [1],
      },
      daily: {
        time: ['2026-07-13'],
        temperature_2m_max: [20],
        temperature_2m_min: [12],
        precipitation_sum: [0],
        wind_speed_10m_max: [10],
        precipitation_probability_max: [5],
        uv_index_max: [4],
      },
    }),
  };
}

describe('fetchWeather', () => {
  afterEach(() => vi.restoreAllMocks());

  // Regression test: the real Open-Meteo API rejects the ENTIRE request
  // with a 400 if any unknown hourly parameter is included — this caught a
  // pre-existing bug where 'leaf_wetness_index' (not a real Open-Meteo
  // parameter; the real one is 'leaf_wetness_probability') silently broke
  // every real weather fetch in production. See
  // docs/Sprint_16_Close_The_Loops_Report.md.
  it('requests the real Open-Meteo parameter name for leaf wetness, not the invalid legacy one', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockOpenMeteoResponse() as never);
    await fetchWeather(51.9652, 5.9307);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('leaf_wetness_probability');
    expect(calledUrl).not.toContain('leaf_wetness_index');
  });

  it('maps the real leaf_wetness_probability field onto HourlyWeather.leafWetness', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(mockOpenMeteoResponse() as never);
    const result = await fetchWeather(51.9652, 5.9307);
    expect(result.hourly[0].leafWetness).toBe(12);
  });

  it('throws a plain, safe error (no leaked internals) when Open-Meteo returns a non-ok status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 400 } as never);
    await expect(fetchWeather(51.9652, 5.9307)).rejects.toThrow('Open-Meteo API error: 400');
  });
});
