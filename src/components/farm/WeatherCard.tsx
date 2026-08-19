import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { WeatherForecast, WeatherDay, WeatherCondition, SprayWindowStatus } from '@/types/farm';
import styles from './WeatherCard.module.css';

const CONDITION_SYMBOL: Record<WeatherCondition, string> = {
  sunny: '☀',
  partly_cloudy: '⛅',
  cloudy: '☁',
  rain: '🌧',
  storm: '⛈',
  frost: '❄',
  fog: '🌫',
};

const SPRAY_LABEL: Record<SprayWindowStatus, string> = {
  open: 'Suitable',
  marginal: 'Marginal',
  closed: 'Avoid',
};

const SPRAY_VARIANT: Record<SprayWindowStatus, 'green' | 'amber' | 'red'> = {
  open: 'green',
  marginal: 'amber',
  closed: 'red',
};

function formatDay(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'short' });
}

interface WeatherCardProps {
  forecast: WeatherForecast;
}

export function WeatherCard({ forecast }: WeatherCardProps) {
  const today = forecast.days[0];

  return (
    <Card>
      <CardHeader icon="◌" title="Weather" subtitle={forecast.location} />
      <CardBody padding="sm">
        {/* Current conditions */}
        {today && (
          <div className={styles.current}>
            <span className={styles.currentSymbol}>
              {CONDITION_SYMBOL[today.condition]}
            </span>
            <div className={styles.currentInfo}>
              <span className={styles.currentTemp}>{forecast.currentTempCelsius}°C</span>
              <span className={styles.currentWind}>
                {today.windSpeedKmh} km/h {today.windDirection}
                {today.rainMm > 0 ? ` · ${today.rainMm} mm` : ''}
              </span>
            </div>
            <div className={styles.sprayNow}>
              <span className={styles.sprayLabel} title="Indicative weather suitability only — verify product label and legal requirements">
                Spray (indicative)
              </span>
              <Badge variant={SPRAY_VARIANT[today.sprayWindow]}>
                {SPRAY_LABEL[today.sprayWindow]}
              </Badge>
            </div>
          </div>
        )}

        {/* 5-day strip */}
        <div className={styles.forecast}>
          {forecast.days.map((day, i) => (
            <ForecastDay key={day.date} day={day} index={i} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function ForecastDay({ day, index }: { day: WeatherDay; index: number }) {
  return (
    <div className={styles.forecastDay}>
      <span className={styles.dayLabel}>{formatDay(day.date, index)}</span>
      <span className={styles.daySymbol}>{CONDITION_SYMBOL[day.condition]}</span>
      <span className={styles.dayTemp}>{day.tempMaxCelsius}°</span>
      <span className={styles.dayRain}>
        {day.rainMm > 0 ? `${day.rainMm}mm` : '—'}
      </span>
      <Badge variant={SPRAY_VARIANT[day.sprayWindow]} size="sm">
        {SPRAY_LABEL[day.sprayWindow]}
      </Badge>
    </div>
  );
}
