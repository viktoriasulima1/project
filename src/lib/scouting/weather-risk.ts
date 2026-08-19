export interface WeatherRiskInput {
  crop: string;
  stageCode?: string | null;
  temperatureC?: number | null;
  humidityPercent?: number | null;
  rainMm?: number | null;
  observedAt?: Date | null;
  now?: Date;
}

export type WeatherRiskStatus = 'low' | 'moderate' | 'high' | 'unavailable';
export type WeatherRiskReasonCode =
  | 'BELOW_RISK_THRESHOLDS'
  | 'SOME_FAVOURABLE_CONDITIONS'
  | 'FAVOURABLE_WARM_HUMID_WET_CONDITIONS'
  | 'INSUFFICIENT_MEASURED_INPUTS';
export type WeatherRiskActionCode = 'CONTINUE_NORMAL_SCOUTING' | 'INSPECT_FIELD' | 'SCOUT_MANUALLY';
export type WeatherRiskConfidence = 'medium' | 'low';
export type WeatherRiskFreshness = 'current' | 'unavailable';
export type WeatherRiskMissingInput = 'growth_stage' | 'temperature_c' | 'humidity_percent' | 'rain_mm';

export type WeatherRiskEvidence =
  | { type: 'crop_stage'; crop: string; stageCode: string }
  | { type: 'measured_temperature'; valueC: number }
  | { type: 'measured_humidity'; valuePercent: number }
  | { type: 'measured_rain'; valueMm: number }
  | { type: 'missing_inputs'; inputs: WeatherRiskMissingInput[] };

export interface WeatherRiskMetadata {
  crop: string;
  stageCode: string | null;
  temperatureC: number | null;
  humidityPercent: number | null;
  rainMm: number | null;
  missingInputs: WeatherRiskMissingInput[];
}

export interface WeatherRiskResult {
  status: WeatherRiskStatus;
  /** Compatibility alias for the pre-Stage-9 canonical level. */
  level: WeatherRiskStatus;
  reasonCode: WeatherRiskReasonCode;
  actionCode: WeatherRiskActionCode;
  priority: 1 | 2 | 3 | 4;
  confidence: WeatherRiskConfidence;
  freshness: WeatherRiskFreshness;
  metadata: WeatherRiskMetadata;
  evidence: WeatherRiskEvidence[];
  modelVersion: 'scouting-weather-v1';
  diagnostic: false;
  requiresFieldConfirmation: true;
}

const REQUIRED_INPUTS: ReadonlyArray<[WeatherRiskMissingInput, keyof WeatherRiskInput]> = [
  ['growth_stage', 'stageCode'],
  ['temperature_c', 'temperatureC'],
  ['humidity_percent', 'humidityPercent'],
  ['rain_mm', 'rainMm'],
];

/**
 * Deterministic weather-risk indicator. Thresholds and precedence are frozen
 * from scouting-weather-v1. This is not a diagnosis and cannot authorize a
 * treatment. observedAt/now remain accepted but do not affect this v1 model.
 */
export function resolveWeatherRisk(input: WeatherRiskInput): WeatherRiskResult {
  const missingInputs = REQUIRED_INPUTS
    .filter(([, key]) => input[key] == null)
    .map(([code]) => code);
  const metadata: WeatherRiskMetadata = {
    crop: input.crop,
    stageCode: input.stageCode ?? null,
    temperatureC: input.temperatureC ?? null,
    humidityPercent: input.humidityPercent ?? null,
    rainMm: input.rainMm ?? null,
    missingInputs,
  };

  if (missingInputs.length) {
    return buildResult('unavailable', 'INSUFFICIENT_MEASURED_INPUTS', 'SCOUT_MANUALLY', 4, 'low', 'unavailable', metadata, [
      { type: 'missing_inputs', inputs: missingInputs },
    ]);
  }

  const temperatureC = Number(input.temperatureC);
  const humidityPercent = Number(input.humidityPercent);
  const rainMm = Number(input.rainMm);
  const evidence: WeatherRiskEvidence[] = [
    { type: 'crop_stage', crop: input.crop, stageCode: String(input.stageCode) },
    { type: 'measured_temperature', valueC: temperatureC },
    { type: 'measured_humidity', valuePercent: humidityPercent },
    { type: 'measured_rain', valueMm: rainMm },
  ];
  const favourable = temperatureC >= 10 && temperatureC <= 24 && humidityPercent >= 85 && rainMm >= 1;
  const moderate = humidityPercent >= 75 || rainMm >= 0.5;

  if (favourable) return buildResult('high', 'FAVOURABLE_WARM_HUMID_WET_CONDITIONS', 'INSPECT_FIELD', 1, 'medium', 'current', metadata, evidence);
  if (moderate) return buildResult('moderate', 'SOME_FAVOURABLE_CONDITIONS', 'CONTINUE_NORMAL_SCOUTING', 2, 'medium', 'current', metadata, evidence);
  return buildResult('low', 'BELOW_RISK_THRESHOLDS', 'CONTINUE_NORMAL_SCOUTING', 3, 'medium', 'current', metadata, evidence);
}

function buildResult(
  status: WeatherRiskStatus,
  reasonCode: WeatherRiskReasonCode,
  actionCode: WeatherRiskActionCode,
  priority: WeatherRiskResult['priority'],
  confidence: WeatherRiskConfidence,
  freshness: WeatherRiskFreshness,
  metadata: WeatherRiskMetadata,
  evidence: WeatherRiskEvidence[],
): WeatherRiskResult {
  return { status, level: status, reasonCode, actionCode, priority, confidence, freshness, metadata, evidence, modelVersion: 'scouting-weather-v1', diagnostic: false, requiresFieldConfirmation: true };
}
