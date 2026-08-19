'use client';

import type { WeatherData } from '@/lib/weather';
import type { SprayWindowSummary, SprayEngineStatus } from '@/lib/spray-window';
import { getAmsterdamDateString } from '@/lib/spray-window';
import { useLocale, useTranslations } from '@/i18n/LocaleProvider';
import { buildSprayWindowDisplayModel, describeSprayWindowSignal } from '@/i18n/adapters/spray-window';
import styles from './WeatherPage.module.css';

interface Props {
  weather: WeatherData;
  todayWindow: SprayWindowSummary;
}

const STATUS_CLASS: Record<SprayEngineStatus, string> = {
  blocked: 'statusBlocked',
  poor: 'statusPoor',
  marginal: 'statusMarginal',
  good: 'statusGood',
  excellent: 'statusExcellent',
};

function weatherIcon(precip: number, maxTemp: number, minTemp: number): string {
  if (precip > 5) return '🌧';
  if (precip > 1) return '🌦';
  if (maxTemp > 25) return '☀️';
  if (minTemp < 2) return '❄️';
  return '⛅';
}

function formatHour(isoString: string): string {
  return isoString.slice(11, 16);
}

// Compares against Amsterdam wall-clock time, not the browser's local timezone,
// so results are correct even if a user views this app from outside NL.
function isCurrentHourInAmsterdam(isoString: string): boolean {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const nowHourString = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}`;
  return isoString.slice(0, 13) === nowHourString;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WeatherPageClient({ weather, todayWindow }: Props) {
  const locale = useLocale();
  const t = useTranslations('fields');
  const display = buildSprayWindowDisplayModel(t, locale, todayWindow);
  const today = getAmsterdamDateString();

  // Show today's hours 05:00–22:00
  const displayHours = todayWindow.hours.filter((h) => {
    const hour = parseInt(h.time.slice(11, 13), 10);
    return hour >= 5 && hour <= 22;
  });

  const nowHour = todayWindow.hours.find((h) => isCurrentHourInAmsterdam(h.time));

  return (
    <div className={styles.container}>
      {/* ── Today's spray window ── */}
      <div className={styles.sprayCard}>
        <div className={styles.sprayHeader}>
          <div>
            <div className={styles.sprayTitle}>Indicative spray window — today</div>
            <div className={styles.spraySubtitle}>
              {todayWindow.windowOpenMinutes / 60}h open ·
              longest block {Math.round(todayWindow.longestContinuousWindowMinutes / 60 * 10) / 10}h ·
              confidence {todayWindow.confidence}
              {todayWindow.weatherDataAge >= 0 ? ` · forecast ${todayWindow.weatherDataAge}min old` : ''}
            </div>
          </div>
          <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[todayWindow.status]]}`}>
            <span className={`${styles.dot} ${todayWindow.status !== 'blocked' ? styles.openDot : ''}`} />
            {display.statusLabel}
          </span>
        </div>

        <div className={styles.sprayBody}>
          <div className={styles.timelineWrap}>
            <div className={styles.timeline}>
              {displayHours.map((h) => (
                <div key={h.time} className={styles.timeSlot}>
                  <span className={styles.timeLabel}>{formatHour(h.time)}</span>
                  <div
                    className={`${styles.timeBar} ${h.status !== 'blocked' ? styles.timeBarOpen : styles.timeBarClosed}${isCurrentHourInAmsterdam(h.time) ? ` ${styles.timeBarNow}` : ''}`}
                    title={
                      h.status !== 'blocked'
                        ? `${t(`sprayWindow.status.${h.status}`)} · ${h.score}/100 · ${h.windSpeed.toFixed(0)} km/h ${h.windDirectionLabel}`
                        : h.hardBlockers.map((item) => describeSprayWindowSignal(t, locale, item)).join(' · ')
                    }
                  >
                    {h.status === 'blocked' ? '✕' : h.score}
                  </div>
                  <span className={styles.timeWindDir}>{h.windDirectionLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {nowHour && nowHour.hardBlockers.length > 0 && (
            <div className={styles.blockersSection}>
              <div className={styles.blockersTitle}>Blocking conditions detected — now</div>
              {nowHour.hardBlockers.map((b, i) => (
                <div key={i} className={styles.blockerItem}>
                  <span className={styles.blockerIcon}>✕</span>
                  {describeSprayWindowSignal(t, locale, b)}
                </div>
              ))}
            </div>
          )}

          {(todayWindow.positiveFactors.length > 0 || todayWindow.warnings.length > 0) && (
            <div className={styles.factorsGrid}>
              {todayWindow.positiveFactors.length > 0 && (
                <div>
                  {todayWindow.positiveFactors.map((f, i) => (
                    <div key={i} className={styles.factorItem}>
                      <span className={styles.factorIconGood}>✓</span>
                      {describeSprayWindowSignal(t, locale, f)}
                    </div>
                  ))}
                </div>
              )}
              {todayWindow.warnings.length > 0 && (
                <div>
                  {todayWindow.warnings.map((w, i) => (
                    <div key={i} className={styles.factorItem}>
                      <span className={styles.factorIconWarn}>!</span>
                      {describeSprayWindowSignal(t, locale, w)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.explanation}>{display.explanation}</div>

          <div className={styles.metaRow}>
            <span>Profile: {display.profileName}</span>
          </div>
        </div>
      </div>

      <div className={styles.disclaimer}>
        <span>ⓘ</span>
        <span>{display.disclaimer}</span>
      </div>

      {/* ── 7-day forecast ── */}
      <div>
        <div className={styles.sectionTitle} style={{ marginBottom: 'var(--space-3)' }}>
          7-day forecast
        </div>
        <div className={styles.forecastGrid}>
          {weather.daily.map((day) => {
            const date = new Date(day.date + 'T12:00:00');
            const isToday = day.date === today;
            return (
              <div key={day.date} className={`${styles.dayCard}${isToday ? ` ${styles.isToday}` : ''}`}>
                <div className={styles.dayName}>
                  {isToday ? 'Today' : DAYS[date.getDay()]}
                </div>
                <div className={styles.dayIcon}>
                  {weatherIcon(day.precipitationSum, day.temperatureMax, day.temperatureMin)}
                </div>
                <div className={styles.dayTemp}>{Math.round(day.temperatureMax)}°</div>
                <div className={styles.dayTempMin}>{Math.round(day.temperatureMin)}°</div>
                {day.precipitationSum > 0.1 && (
                  <div className={styles.dayRain}>{day.precipitationSum.toFixed(1)} mm</div>
                )}
                <div className={styles.dayWind}>{Math.round(day.windSpeedMax)} km/h</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
