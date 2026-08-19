// Remove force-dynamic: Next.js ISR with revalidate handles caching correctly.
// The underlying Open-Meteo fetch is deduped via unstable_cache (see
// src/lib/weather.ts) regardless of this page's own render mode, so gating
// on a per-user farm/coordinates check here does not reintroduce
// per-request Open-Meteo calls.
export const revalidate = 1800; // 30 minutes

import { Topbar } from '@/components/layout/Topbar';
import { StubPage } from '@/components/layout/StubPage';
import { WeatherPageClient } from '@/components/weather/WeatherPageClient';
import { fetchWeather } from '@/lib/weather';
import { computeSprayWindows, getAmsterdamDateString } from '@/lib/spray-window';
import { requireFarm } from '@/lib/require-farm';

export const metadata = { title: 'Weather — FarmOS' };

const FALLBACK_MESSAGE =
  'Weather data temporarily unavailable. Check back in a few minutes.';

export default async function WeatherPage() {
  const farm = await requireFarm();

  if (farm.latitude == null || farm.longitude == null) {
    return (
      <>
        <Topbar title="Weather" subtitle="Local forecast and indicative spray window analysis" farmName={farm.name} />
        <StubPage
          icon="◌"
          title="No local weather yet"
          description="Add farm coordinates to receive local forecasts and indicative spray conditions."
          action={{ label: 'Add coordinates', href: '/onboarding?step=farm' }}
        />
      </>
    );
  }

  const lat = Number(farm.latitude);
  const lon = Number(farm.longitude);

  let error: string | null = null;
  let weather = null;
  let todayWindow = null;

  // Retry once on failure before showing error
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      weather = await fetchWeather(lat, lon);
      const today = getAmsterdamDateString();
      todayWindow = computeSprayWindows(weather.hourly, today, {
        weatherFetchedAt: weather.fetchedAt,
      });
      break;
    } catch (e) {
      if (attempt === 1) {
        error = e instanceof Error ? e.message : FALLBACK_MESSAGE;
      }
    }
  }

  const sprayHoursOpen = todayWindow
    ? Math.round(todayWindow.windowOpenMinutes / 60)
    : 0;

  return (
    <>
      <Topbar
        title="Weather"
        subtitle={
          todayWindow
            ? `${sprayHoursOpen}h indicative spray window today · ${todayWindow.status === 'blocked' ? 'Blocked now' : `${todayWindow.status} now`} · confidence ${todayWindow.confidence}`
            : '10-day forecast and indicative spray window analysis'
        }
        farmName={farm.name}
      />

      {error ? (
        <div style={{
          margin: 'var(--space-5)',
          padding: 'var(--space-4)',
          background: 'var(--color-red-subtle)',
          border: '1px solid var(--color-red-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-red)',
          fontSize: 'var(--font-sm)',
        }}>
          {FALLBACK_MESSAGE}
        </div>
      ) : weather && todayWindow ? (
        <WeatherPageClient weather={weather} todayWindow={todayWindow} />
      ) : null}
    </>
  );
}
