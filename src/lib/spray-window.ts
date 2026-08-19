import type { HourlyWeather } from './weather';
import type { CropName } from '@/types/farm';

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY NOTICE
//
// This module produces an INDICATIVE weather-suitability estimate only.
// It is not a legal, agronomic, or regulatory approval of any spray
// application. Every result carries `disclaimer` — surface it wherever
// a score or status from this module is shown to a user.
// ─────────────────────────────────────────────────────────────────────────────

export const SPRAY_SUITABILITY_DISCLAIMER_CODE = 'INDICATIVE_ONLY' as const;

export type SprayEngineStatus = 'blocked' | 'poor' | 'marginal' | 'good' | 'excellent';
export type SprayConfidence = 'low' | 'medium' | 'high';
export type SprayEvaluationMode = 'advisory' | 'planned-application';

// ─── Product-specific constraint profile ─────────────────────────────────────
// Real profiles should be sourced from the product's authorised label / Ctgb
// (College voor de toelating van gewasbeschermingsmiddelen en biociden)
// registration. Nothing in this file invents a real legal value — the
// built-in MOCK_DEFAULT_PRODUCT_PROFILE is clearly labelled indicative-only
// and must never be presented as a specific product's approved conditions.

export interface SprayProductProfile {
  id: string;
  name: string;
  /** True only for the generic built-in placeholder — never for a real product. */
  isMockDefault: boolean;
  /** Explicitly false when a real profile's registration has lapsed or was withdrawn. */
  registrationValid?: boolean;
  maxWindSpeedKmh: number;
  maxWindGustKmh?: number;
  minTemperatureC: number;
  maxTemperatureC: number;
  /** Soft-scoring humidity ceiling (quality signal, not a legal limit). */
  maxHumidityPct?: number;
  /** Set only when the label states a genuine hard humidity limit. */
  hardMaxHumidityPct?: number;
  /** Hours after application during which qualifying rainfall invalidates the application. */
  rainfastHours: number;
  /** Rainfall (mm) within the rainfast window that counts as a violation. */
  maxPrecipitationDuringRainfastMm: number;
  bufferZoneMetres?: number;
  /** Undefined = crop restriction unknown/not modelled, not "any crop allowed". */
  eligibleCrops?: CropName[];
  eligibleBbchRange?: [number, number];
  driftReductionRequired?: boolean;
  maxApplicationsPerSeason?: number;
}

/** Generic, illustrative-only default. Never a substitute for a real product label. */
export const MOCK_DEFAULT_PRODUCT_PROFILE: SprayProductProfile = {
  id: 'mock-default',
  name: 'mock-default',
  isMockDefault: true,
  maxWindSpeedKmh: 15,
  maxWindGustKmh: 28,
  minTemperatureC: 5,
  maxTemperatureC: 28,
  maxHumidityPct: 90,
  rainfastHours: 2,
  maxPrecipitationDuringRainfastMm: 1,
  driftReductionRequired: false,
};

// ─── Optional evaluation context ──────────────────────────────────────────────
// All sub-contexts are optional. In 'advisory' mode (default — used for a
// general weather-page glance) missing context produces a warning, not a
// hard blocker. In 'planned-application' mode (a specific logged/planned
// activity) missing required context becomes a hard blocker — fail closed,
// not fail open.

export interface OperatorContext {
  hasCertification: boolean;
  certNumber?: string | null;
  /** ISO date string. */
  certExpiry?: string | null;
}

export interface InventoryContext {
  requiredQuantity: number;
  availableStock: number;
  unit: string;
}

export interface MachineContext {
  nozzleType?: string | null;
  isDriftReductionNozzle?: boolean;
}

export interface FieldCropContext {
  crop?: CropName;
  bbchStage?: number;
}

export interface SprayWindowOptions {
  productProfile?: SprayProductProfile;
  operator?: OperatorContext;
  inventory?: InventoryContext;
  machine?: MachineContext;
  fieldCrop?: FieldCropContext;
  mode?: SprayEvaluationMode;
  /** ISO UTC timestamp of when the weather payload was fetched (`WeatherData.fetchedAt`). */
  weatherFetchedAt?: string;
  /** Injectable clock for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
}

// ─── Per-hour result ───────────────────────────────────────────────────────────

export interface SprayWindowHour {
  time: string;
  status: SprayEngineStatus;
  /** 0–100 soft-quality score. Present even when blocked, for diagnostics — never treat a blocked hour as usable because of this number. */
  score: number;
  hardBlockers: SprayWindowSignal[];
  warnings: SprayWindowSignal[];
  positiveFactors: SprayWindowSignal[];
  temperature: number;
  windSpeed: number;
  windGust: number;
  windDirectionLabel: string;
  precipitationProbability: number;
  precipitationMm: number;
  relativeHumidity: number;
}

// ─── Day summary ───────────────────────────────────────────────────────────────

export interface SprayWindowSummary {
  date: string;
  /** Status of the representative moment: "now" if within the fetched data, else the best window. */
  status: SprayEngineStatus;
  score: number;
  hardBlockers: SprayWindowSignal[];
  warnings: SprayWindowSignal[];
  positiveFactors: SprayWindowSignal[];
  summaryCode: SprayWindowSummaryCode;
  bestWindowStart: string | null;
  bestWindowEnd: string | null;
  confidence: SprayConfidence;
  /** Minutes since the weather payload was fetched. -1 if unknown. */
  weatherDataAge: number;
  disclaimerCode: typeof SPRAY_SUITABILITY_DISCLAIMER_CODE;
  productProfile: { id: string; name: string; isMockDefault: boolean };

  // Day-level informational rollups (never the sole basis for a decision)
  isOpenNow: boolean;
  windowOpenMinutes: number;
  longestContinuousWindowMinutes: number;
  nextWindowStart: string | null;
  nextWindowEnd: string | null;
  /** Flat mean of per-hour scores. Informational only — averaging can hide a single blocked hour; use `hours[]` for the real picture. */
  averageScore: number;

  hours: SprayWindowHour[];
}

export type SprayWindowSignalCode =
  | 'WIND_SPEED_EXCEEDS_LIMIT' | 'WIND_GUST_EXCEEDS_LIMIT' | 'WIND_GUST_UNAVAILABLE'
  | 'TEMPERATURE_BELOW_MINIMUM' | 'TEMPERATURE_ABOVE_MAXIMUM' | 'HUMIDITY_EXCEEDS_PRODUCT_LIMIT'
  | 'RAINFAST_HORIZON_INCOMPLETE' | 'RAINFAST_PRECIPITATION_EXCEEDS_LIMIT'
  | 'PRODUCT_NOT_SELECTED' | 'GENERIC_PROFILE_USED' | 'PRODUCT_REGISTRATION_INVALID'
  | 'OPERATOR_CERTIFICATION_INVALID' | 'OPERATOR_CONTEXT_MISSING' | 'OPERATOR_UNVERIFIED'
  | 'INSUFFICIENT_STOCK' | 'INVENTORY_CONTEXT_MISSING' | 'INVENTORY_UNVERIFIED'
  | 'CROP_INELIGIBLE' | 'BBCH_OUTSIDE_RANGE' | 'CROP_BBCH_CONTEXT_MISSING' | 'CROP_BBCH_UNVERIFIED'
  | 'DRIFT_REDUCTION_NOZZLE_REQUIRED' | 'DRIFT_CONTEXT_MISSING' | 'DRIFT_REQUIREMENT_UNVERIFIED'
  | 'LOW_WIND' | 'WIND_APPROACHING_LIMIT' | 'NO_RAIN_FORECAST_THIS_HOUR' | 'LOW_HUMIDITY'
  | 'HUMIDITY_ELEVATED' | 'WIDE_DEW_POINT_MARGIN' | 'NARROW_DEW_POINT_MARGIN' | 'LEAF_WETNESS_ELEVATED';

export type SprayWindowSummaryCode = 'BLOCKED' | 'CONDITIONS' | 'NO_FORECAST_DATA';
export interface SprayWindowSignal {
  code: SprayWindowSignalCode;
  metadata: Record<string, string | number | boolean | null>;
}

function signal(code: SprayWindowSignalCode, metadata: SprayWindowSignal['metadata'] = {}): SprayWindowSignal {
  return { code, metadata };
}

// ─── Wind direction labelling ─────────────────────────────────────────────────

const WIND_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                   'S','SSW','SW','WSW','W','WNW','NW','NNW'];

function degreesToLabel(deg: number): string {
  return WIND_DIRS[Math.round(deg / 22.5) % 16];
}

// ─── Timezone-safe "now" ───────────────────────────────────────────────────────
// Open-Meteo returns hourly timestamps as local Europe/Amsterdam wall-clock
// strings ("2026-07-06T14:00") with no UTC offset. Parsing that string with
// `new Date(...)` interprets it in the SERVER's local timezone, which silently
// produces wrong comparisons if the server does not run in Europe/Amsterdam.
// We instead render "now" as an Amsterdam wall-clock string in the same
// format, so point-in-time comparisons can use plain string comparison
// (lexicographic order matches chronological order for zero-padded ISO-like
// strings) and are correct regardless of server timezone or DST.

function nowInAmsterdam(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Today's date (YYYY-MM-DD) in Europe/Amsterdam wall-clock time.
 * Do not use `new Date().toISOString().slice(0, 10)` for this — that is the
 * UTC date, which can be a day off from the Amsterdam date near midnight
 * (e.g. 23:30 UTC is already the next day in Amsterdam during summer DST).
 */
export function getAmsterdamDateString(now: Date = new Date()): string {
  return nowInAmsterdam(now).slice(0, 10);
}

// Pure wall-clock arithmetic: parses/formats the "YYYY-MM-DDTHH:mm" convention
// via Date.UTC so results never depend on the executing server's own
// timezone or DST rules. Never compare these epoch values against a real
// UTC instant — they only have meaning relative to each other.
function parseWallClock(iso: string): number {
  const [datePart, timePart] = iso.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi);
}

function formatWallClock(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function addHourToTimeString(iso: string): string {
  return formatWallClock(parseWallClock(iso) + 3_600_000);
}

// ─── Soft-scoring factors ──────────────────────────────────────────────────────
// These are graded quality signals, not legal limits. A high soft score can
// NEVER override a hard blocker — see `evaluateHour`.

function windSoftScore(kmh: number, maxWind: number): number {
  const idealCeiling = maxWind / 3;
  if (kmh <= idealCeiling) return 100;
  if (kmh >= maxWind) return 0;
  return Math.round(100 - ((kmh - idealCeiling) / (maxWind - idealCeiling)) * 100);
}

function tempSoftScore(c: number, minC: number, maxC: number): number {
  const idealLow = minC + (maxC - minC) * 0.25;
  const idealHigh = minC + (maxC - minC) * 0.65;
  if (c >= idealLow && c <= idealHigh) return 100;
  if (c <= minC || c >= maxC) return 0;
  if (c < idealLow) return Math.round(((c - minC) / (idealLow - minC)) * 100);
  return Math.round(((maxC - c) / (maxC - idealHigh)) * 100);
}

function precipProbSoftScore(prob: number): number {
  const softCap = 50;
  if (prob <= 0) return 100;
  if (prob >= softCap) return 0;
  return Math.round(100 - (prob / softCap) * 100);
}

function humiditySoftScore(pct: number, softMax: number): number {
  if (pct <= softMax * 0.65) return 100;
  if (pct >= softMax) return 0;
  return Math.round(100 - ((pct - softMax * 0.65) / (softMax * 0.35)) * 100);
}

/** Simplified dew-point-margin approximation (Magnus-formula-free). Order-of-magnitude only. */
function dewPointMargin(tempC: number, humidity: number): number {
  const approxDewPoint = tempC - (100 - humidity) / 5;
  return tempC - approxDewPoint;
}

function dewPointSoftScore(margin: number): number {
  if (margin >= 5) return 100;
  if (margin <= 0) return 0;
  return Math.round((margin / 5) * 100);
}

function statusFromScore(score: number): SprayEngineStatus {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'marginal';
  return 'poor';
}

// ─── Per-hour hard blocker + soft score evaluation ────────────────────────────

interface HourEvaluation {
  status: SprayEngineStatus;
  score: number;
  hardBlockers: SprayWindowSignal[];
  warnings: SprayWindowSignal[];
  positiveFactors: SprayWindowSignal[];
}

function evaluateHour(
  hour: HourlyWeather,
  hourIndex: number,
  allHours: HourlyWeather[],
  profile: SprayProductProfile,
  options: SprayWindowOptions,
  now: Date,
): HourEvaluation {
  const hardBlockers: SprayWindowSignal[] = [];
  const warnings: SprayWindowSignal[] = [];
  const positiveFactors: SprayWindowSignal[] = [];
  const mode: SprayEvaluationMode = options.mode ?? 'advisory';

  // ── Hard blockers: weather ──
  if (hour.windSpeed > profile.maxWindSpeedKmh) {
    hardBlockers.push(signal('WIND_SPEED_EXCEEDS_LIMIT', { observedKmh: Math.round(hour.windSpeed), limitKmh: profile.maxWindSpeedKmh }));
  }
  if (profile.maxWindGustKmh != null) {
    if (hour.windGust > 0) {
      if (hour.windGust > profile.maxWindGustKmh) {
        hardBlockers.push(signal('WIND_GUST_EXCEEDS_LIMIT', { observedKmh: Math.round(hour.windGust), limitKmh: profile.maxWindGustKmh }));
      }
    } else {
      warnings.push(signal('WIND_GUST_UNAVAILABLE'));
    }
  }
  if (hour.temperature < profile.minTemperatureC) {
    hardBlockers.push(signal('TEMPERATURE_BELOW_MINIMUM', { observedC: hour.temperature, limitC: profile.minTemperatureC }));
  }
  if (hour.temperature > profile.maxTemperatureC) {
    hardBlockers.push(signal('TEMPERATURE_ABOVE_MAXIMUM', { observedC: hour.temperature, limitC: profile.maxTemperatureC }));
  }
  if (profile.hardMaxHumidityPct != null && hour.relativeHumidity > profile.hardMaxHumidityPct) {
    hardBlockers.push(signal('HUMIDITY_EXCEEDS_PRODUCT_LIMIT', { observedPercent: hour.relativeHumidity, limitPercent: profile.hardMaxHumidityPct }));
  }

  // ── Hard blocker: rainfast window (actual forecast rainfall, not probability) ──
  const rainfastHoursNeeded = Math.max(1, Math.ceil(profile.rainfastHours));
  const windowEnd = Math.min(allHours.length, hourIndex + rainfastHoursNeeded);
  const windowHours = allHours.slice(hourIndex, windowEnd);
  const rainInWindow = windowHours.reduce((sum, h) => sum + h.precipitation, 0);
  if (windowHours.length < rainfastHoursNeeded) {
    warnings.push(signal('RAINFAST_HORIZON_INCOMPLETE', { requiredHours: rainfastHoursNeeded, availableHours: windowHours.length }));
  }
  if (rainInWindow > profile.maxPrecipitationDuringRainfastMm) {
    hardBlockers.push(signal('RAINFAST_PRECIPITATION_EXCEEDS_LIMIT', { observedMm: Number(rainInWindow.toFixed(1)), periodHours: profile.rainfastHours, limitMm: profile.maxPrecipitationDuringRainfastMm }));
  }

  // ── Hard/soft blockers depending on evaluation mode ──
  if (profile.isMockDefault) {
    if (mode === 'planned-application') {
      hardBlockers.push(signal('PRODUCT_NOT_SELECTED'));
    } else {
      warnings.push(signal('GENERIC_PROFILE_USED'));
    }
  } else if (profile.registrationValid === false) {
    hardBlockers.push(signal('PRODUCT_REGISTRATION_INVALID', { productName: profile.name }));
  }

  if (options.operator) {
    const expired =
      !options.operator.hasCertification ||
      (options.operator.certExpiry != null && new Date(options.operator.certExpiry).getTime() < now.getTime());
    if (expired) {
      hardBlockers.push(signal('OPERATOR_CERTIFICATION_INVALID'));
    }
  } else if (mode === 'planned-application') {
    hardBlockers.push(signal('OPERATOR_CONTEXT_MISSING'));
  } else {
    warnings.push(signal('OPERATOR_UNVERIFIED'));
  }

  if (options.inventory) {
    if (options.inventory.availableStock < options.inventory.requiredQuantity) {
      hardBlockers.push(signal('INSUFFICIENT_STOCK', { requiredQuantity: options.inventory.requiredQuantity, availableStock: options.inventory.availableStock, unit: options.inventory.unit }));
    }
  } else if (mode === 'planned-application') {
    hardBlockers.push(signal('INVENTORY_CONTEXT_MISSING'));
  } else {
    warnings.push(signal('INVENTORY_UNVERIFIED'));
  }

  if (options.fieldCrop) {
    if (profile.eligibleCrops && options.fieldCrop.crop && !profile.eligibleCrops.includes(options.fieldCrop.crop)) {
      hardBlockers.push(signal('CROP_INELIGIBLE', { crop: options.fieldCrop.crop }));
    }
    if (profile.eligibleBbchRange && options.fieldCrop.bbchStage != null) {
      const [min, max] = profile.eligibleBbchRange;
      if (options.fieldCrop.bbchStage < min || options.fieldCrop.bbchStage > max) {
        hardBlockers.push(signal('BBCH_OUTSIDE_RANGE', { stage: options.fieldCrop.bbchStage, min, max }));
      }
    }
  } else if (profile.eligibleCrops || profile.eligibleBbchRange) {
    if (mode === 'planned-application') {
      hardBlockers.push(signal('CROP_BBCH_CONTEXT_MISSING'));
    } else {
      warnings.push(signal('CROP_BBCH_UNVERIFIED'));
    }
  }

  if (profile.driftReductionRequired) {
    if (options.machine) {
      if (!options.machine.isDriftReductionNozzle) {
        hardBlockers.push(signal('DRIFT_REDUCTION_NOZZLE_REQUIRED'));
      }
    } else if (mode === 'planned-application') {
      hardBlockers.push(signal('DRIFT_CONTEXT_MISSING'));
    } else {
      warnings.push(signal('DRIFT_REQUIREMENT_UNVERIFIED'));
    }
  }

  // ── Soft quality score (never overrides hard blockers) ──
  const windSoft = windSoftScore(hour.windSpeed, profile.maxWindSpeedKmh);
  const tempSoft = tempSoftScore(hour.temperature, profile.minTemperatureC, profile.maxTemperatureC);
  const precipSoft = precipProbSoftScore(hour.precipitationProbability);
  const humiditySoft = humiditySoftScore(hour.relativeHumidity, profile.maxHumidityPct ?? 90);
  const margin = dewPointMargin(hour.temperature, hour.relativeHumidity);
  const dewPointSoft = dewPointSoftScore(margin);

  const score = Math.round(
    windSoft * 0.35 + tempSoft * 0.2 + precipSoft * 0.2 + humiditySoft * 0.15 + dewPointSoft * 0.1,
  );

  // ── Warnings / positive factors from soft factors ──
  const idealWindCeiling = profile.maxWindSpeedKmh / 3;
  if (hour.windSpeed <= idealWindCeiling) {
    positiveFactors.push(signal('LOW_WIND', { observedKmh: Math.round(hour.windSpeed) }));
  } else if (hour.windSpeed <= profile.maxWindSpeedKmh) {
    warnings.push(signal('WIND_APPROACHING_LIMIT', { observedKmh: Math.round(hour.windSpeed), limitKmh: profile.maxWindSpeedKmh }));
  }
  if (hour.precipitationProbability === 0) {
    positiveFactors.push(signal('NO_RAIN_FORECAST_THIS_HOUR'));
  }
  if (hour.relativeHumidity <= 60) {
    positiveFactors.push(signal('LOW_HUMIDITY', { observedPercent: hour.relativeHumidity }));
  } else if (profile.maxHumidityPct != null && hour.relativeHumidity < profile.maxHumidityPct) {
    warnings.push(signal('HUMIDITY_ELEVATED', { observedPercent: hour.relativeHumidity }));
  }
  if (margin >= 5) {
    positiveFactors.push(signal('WIDE_DEW_POINT_MARGIN', { marginC: margin }));
  } else if (margin > 0) {
    warnings.push(signal('NARROW_DEW_POINT_MARGIN', { marginC: margin }));
  }
  if (hour.leafWetness > 0) {
    warnings.push(signal('LEAF_WETNESS_ELEVATED', { leafWetness: hour.leafWetness }));
  }

  const status: SprayEngineStatus = hardBlockers.length > 0 ? 'blocked' : statusFromScore(score);

  return { status, score, hardBlockers, warnings, positiveFactors };
}

// ─── Confidence ────────────────────────────────────────────────────────────────

function computeConfidence(weatherDataAgeMinutes: number, hoursAhead: number): SprayConfidence {
  if (weatherDataAgeMinutes < 0) return hoursAhead <= 24 ? 'medium' : 'low';
  if (weatherDataAgeMinutes > 60) return 'low';
  if (hoursAhead <= 24) return weatherDataAgeMinutes <= 35 ? 'high' : 'medium';
  if (hoursAhead <= 72) return 'medium';
  return 'low';
}

// ─── Main entry point ──────────────────────────────────────────────────────────

export function computeSprayWindows(
  hours: HourlyWeather[],
  targetDate: string,
  options: SprayWindowOptions = {},
): SprayWindowSummary {
  const profile = options.productProfile ?? MOCK_DEFAULT_PRODUCT_PROFILE;
  const now = options.now ?? new Date();
  const nowStr = nowInAmsterdam(now);

  const dayHours = hours.filter((h) => h.time.startsWith(targetDate));

  const evaluated = dayHours.map((hour) => {
    // Index within the FULL hours array (needed for rainfast look-ahead beyond day boundary)
    const fullIndex = hours.indexOf(hour);
    const evalResult = evaluateHour(hour, fullIndex, hours, profile, options, now);
    return { hour, ...evalResult };
  });

  let windowOpenMinutes = 0;
  let longestContinuous = 0;
  let currentStreak = 0;
  let nextWindowStart: string | null = null;
  let nextWindowEnd: string | null = null;
  let isOpenNow = false;
  let lastWasOpen = false;
  let totalScore = 0;

  const processed: SprayWindowHour[] = evaluated.map(({ hour, status, score, hardBlockers, warnings, positiveFactors }) => {
    totalScore += score;
    const open = status !== 'blocked';

    if (open) {
      windowOpenMinutes += 60;
      currentStreak = lastWasOpen ? currentStreak + 60 : 60;
      longestContinuous = Math.max(longestContinuous, currentStreak);

      if (hour.time <= nowStr && nowStr < addHourToTimeString(hour.time)) {
        isOpenNow = true;
      }
      if (!lastWasOpen && hour.time > nowStr) {
        nextWindowStart = nextWindowStart ?? hour.time;
      }
      if (lastWasOpen && open) {
        nextWindowEnd = hour.time;
      }
    } else {
      currentStreak = 0;
    }

    lastWasOpen = open;

    return {
      time: hour.time,
      status,
      score,
      hardBlockers,
      warnings,
      positiveFactors,
      temperature: hour.temperature,
      windSpeed: hour.windSpeed,
      windGust: hour.windGust,
      windDirectionLabel: degreesToLabel(hour.windDirection),
      precipitationProbability: hour.precipitationProbability,
      precipitationMm: hour.precipitation,
      relativeHumidity: hour.relativeHumidity,
    };
  });

  // ── Find the single best contiguous non-blocked window (longest, then highest avg score) ──
  let runStart = -1;
  const candidates: { startIdx: number; endIdx: number; length: number; avgScore: number }[] = [];
  for (let i = 0; i <= processed.length; i++) {
    const isOpenHour = i < processed.length && processed[i].status !== 'blocked';
    if (isOpenHour) {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      const runHours = processed.slice(runStart, i);
      const avgScore = runHours.reduce((s, h) => s + h.score, 0) / runHours.length;
      candidates.push({ startIdx: runStart, endIdx: i - 1, length: runHours.length, avgScore });
      runStart = -1;
    }
  }
  candidates.sort((a, b) => (b.length - a.length) || (b.avgScore - a.avgScore));
  const bestWindowStart = candidates[0] ? processed[candidates[0].startIdx].time : null;
  const bestWindowEnd = candidates[0] ? processed[candidates[0].endIdx].time : null;

  const averageScore = processed.length > 0 ? Math.round(totalScore / processed.length) : 0;

  // ── Representative hour: "now" if within fetched data, else best window start, else first hour ──
  const nowHour = processed.find((h) => h.time <= nowStr && nowStr < addHourToTimeString(h.time));
  const bestWindowHour = bestWindowStart ? processed.find((h) => h.time === bestWindowStart) : undefined;
  const representative = nowHour ?? bestWindowHour ?? processed[0];

  const weatherDataAge = options.weatherFetchedAt
    ? Math.round((now.getTime() - new Date(options.weatherFetchedAt).getTime()) / 60000)
    : -1;

  const targetDateStartEpoch = parseWallClock(`${targetDate}T00:00`);
  const nowWallClockEpoch = parseWallClock(nowStr);
  const hoursAhead = Math.max(0, Math.round((targetDateStartEpoch - nowWallClockEpoch) / 3600000));
  const confidence = computeConfidence(weatherDataAge, hoursAhead);

  const summaryCode: SprayWindowSummaryCode = !representative
    ? 'NO_FORECAST_DATA'
    : representative.status === 'blocked'
      ? 'BLOCKED'
      : 'CONDITIONS';

  return {
    date: targetDate,
    status: representative?.status ?? 'blocked',
    score: representative?.score ?? 0,
    hardBlockers: representative?.hardBlockers ?? [],
    warnings: representative?.warnings ?? [],
    positiveFactors: representative?.positiveFactors ?? [],
    summaryCode,
    bestWindowStart,
    bestWindowEnd,
    confidence,
    weatherDataAge,
    disclaimerCode: SPRAY_SUITABILITY_DISCLAIMER_CODE,
    productProfile: { id: profile.id, name: profile.name, isMockDefault: profile.isMockDefault },

    isOpenNow,
    windowOpenMinutes,
    longestContinuousWindowMinutes: longestContinuous,
    nextWindowStart,
    nextWindowEnd,
    averageScore,

    hours: processed,
  };
}
