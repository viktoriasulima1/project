export interface HourlyWeather {
  time: string;
  temperature: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  precipitation: number;
  precipitationProbability: number;
  relativeHumidity: number;
  leafWetness: number;
  isDay: number;
}

export interface DailyWeather {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  windSpeedMax: number;
  precipitationProbabilityMax: number;
  uvIndex: number;
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: HourlyWeather[];
  daily: DailyWeather[];
  /** When this payload was actually retrieved from Open-Meteo — see caching note below. */
  fetchedAt: string;
}

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const CACHE_REVALIDATE_SECONDS = 1800; // 30 minutes

async function fetchWeatherUncached(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: [
      'temperature_2m',
      'wind_speed_10m',
      'wind_gusts_10m',
      'wind_direction_10m',
      'precipitation',
      'precipitation_probability',
      'relative_humidity_2m',
      'leaf_wetness_probability',
      'is_day',
    ].join(','),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'wind_speed_10m_max',
      'precipitation_probability_max',
      'uv_index_max',
    ].join(','),
    timezone: 'Europe/Amsterdam',
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  });

  // cache: 'no-store' — caching is handled one level up by `unstable_cache`,
  // which caches this whole function's *return value* (including fetchedAt).
  // Relying on fetch()'s own Data Cache here would be wrong: fetch() only
  // memoizes the HTTP call, but this wrapper's `new Date()` below still runs
  // on every invocation regardless of whether the fetch was a cache hit —
  // meaning fetchedAt would read as "now" even for cached data.
  const res = await fetch(`${BASE_URL}?${params}`, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status}`);
  }

  const raw = await res.json();

  const hourly: HourlyWeather[] = raw.hourly.time.map(
    (time: string, i: number) => ({
      time,
      temperature: raw.hourly.temperature_2m[i] ?? 0,
      windSpeed: raw.hourly.wind_speed_10m[i] ?? 0,
      windGust: raw.hourly.wind_gusts_10m?.[i] ?? 0,
      windDirection: raw.hourly.wind_direction_10m[i] ?? 0,
      precipitation: raw.hourly.precipitation[i] ?? 0,
      precipitationProbability: raw.hourly.precipitation_probability[i] ?? 0,
      relativeHumidity: raw.hourly.relative_humidity_2m[i] ?? 0,
      // Open-Meteo's real parameter is 'leaf_wetness_probability' (a 0-100%
      // reading) — the previous 'leaf_wetness_index' name doesn't exist in
      // their API at all, and caused the ENTIRE request to fail with a 400
      // every single time (not just this field) — see
      // docs/Sprint_16_Close_The_Loops_Report.md.
      leafWetness: raw.hourly.leaf_wetness_probability[i] ?? 0,
      isDay: raw.hourly.is_day[i] ?? 1,
    })
  );

  const daily: DailyWeather[] = raw.daily.time.map(
    (date: string, i: number) => ({
      date,
      temperatureMax: raw.daily.temperature_2m_max[i] ?? 0,
      temperatureMin: raw.daily.temperature_2m_min[i] ?? 0,
      precipitationSum: raw.daily.precipitation_sum[i] ?? 0,
      windSpeedMax: raw.daily.wind_speed_10m_max[i] ?? 0,
      precipitationProbabilityMax:
        raw.daily.precipitation_probability_max[i] ?? 0,
      uvIndex: raw.daily.uv_index_max[i] ?? 0,
    })
  );

  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    timezone: raw.timezone,
    hourly,
    daily,
    fetchedAt: new Date().toISOString(),
  };
}

type CachedFetcher = (latitude: number, longitude: number) => Promise<WeatherData>;
let _cachedFetcher: CachedFetcher | null = null;
let _cachedFetcherInitFailed = false;

/**
 * Fetches (and caches) the Open-Meteo forecast. Wrapped once in
 * `unstable_cache` so `fetchedAt` reflects when data was actually retrieved,
 * not when this function was last called — see the comment in
 * `fetchWeatherUncached`. Falls back to an uncached call outside the
 * Next.js runtime (e.g. tests, scripts).
 */
export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  if (!_cachedFetcher && !_cachedFetcherInitFailed) {
    try {
      const { unstable_cache } = await import('next/cache');
      _cachedFetcher = unstable_cache(fetchWeatherUncached, ['open-meteo-weather'], {
        revalidate: CACHE_REVALIDATE_SECONDS,
      });
    } catch {
      _cachedFetcherInitFailed = true;
    }
  }
  return _cachedFetcher
    ? _cachedFetcher(latitude, longitude)
    : fetchWeatherUncached(latitude, longitude);
}

export function windDirectionLabel(degrees: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(degrees / 22.5) % 16];
}
