import type { Locale } from '../locales';
import type { Translate } from '../translator';
import { formatNumber } from '../format';
import type { SprayEngineStatus, SprayWindowSignal, SprayWindowSummary } from '@/lib/spray-window';

export interface SprayWindowDisplayModel {
  statusLabel: string;
  explanation: string;
  blockers: string[];
  warnings: string[];
  positiveFactors: string[];
  confidenceLabel: string;
  disclaimer: string;
  profileName: string;
}

export function describeSprayWindowSignal(t: Translate, locale: Locale, item: SprayWindowSignal): string {
  const vars = Object.fromEntries(Object.entries(item.metadata).map(([key, value]) => [key, typeof value === 'number' ? formatNumber(value, locale, { maximumFractionDigits: 2 }) : String(value ?? '')]));
  const known = [
    'WIND_SPEED_EXCEEDS_LIMIT','WIND_GUST_EXCEEDS_LIMIT','WIND_GUST_UNAVAILABLE','TEMPERATURE_BELOW_MINIMUM','TEMPERATURE_ABOVE_MAXIMUM','HUMIDITY_EXCEEDS_PRODUCT_LIMIT','RAINFAST_HORIZON_INCOMPLETE','RAINFAST_PRECIPITATION_EXCEEDS_LIMIT','PRODUCT_NOT_SELECTED','GENERIC_PROFILE_USED','PRODUCT_REGISTRATION_INVALID','OPERATOR_CERTIFICATION_INVALID','OPERATOR_CONTEXT_MISSING','OPERATOR_UNVERIFIED','INSUFFICIENT_STOCK','INVENTORY_CONTEXT_MISSING','INVENTORY_UNVERIFIED','CROP_INELIGIBLE','BBCH_OUTSIDE_RANGE','CROP_BBCH_CONTEXT_MISSING','CROP_BBCH_UNVERIFIED','DRIFT_REDUCTION_NOZZLE_REQUIRED','DRIFT_CONTEXT_MISSING','DRIFT_REQUIREMENT_UNVERIFIED','LOW_WIND','WIND_APPROACHING_LIMIT','NO_RAIN_FORECAST_THIS_HOUR','LOW_HUMIDITY','HUMIDITY_ELEVATED','WIDE_DEW_POINT_MARGIN','NARROW_DEW_POINT_MARGIN','LEAF_WETNESS_ELEVATED',
  ];
  return known.includes(item.code) ? t(`sprayWindow.signals.${item.code}`, vars) : t('sprayWindow.unknown');
}

export function buildSprayWindowDisplayModel(t: Translate, locale: Locale, result: SprayWindowSummary): SprayWindowDisplayModel {
  const status: SprayEngineStatus = ['blocked','poor','marginal','good','excellent'].includes(result.status) ? result.status : 'blocked';
  const blockers = result.hardBlockers.map((item) => describeSprayWindowSignal(t, locale, item));
  const warnings = result.warnings.map((item) => describeSprayWindowSignal(t, locale, item));
  const positiveFactors = result.positiveFactors.map((item) => describeSprayWindowSignal(t, locale, item));
  const primary = blockers[0] ?? positiveFactors[0] ?? warnings[0] ?? '';
  return {
    statusLabel: t(`sprayWindow.status.${status}`),
    explanation: t(`sprayWindow.summary.${result.summaryCode}`, { primary, count: Math.max(0, blockers.length - 1), start: result.bestWindowStart?.slice(11,16) ?? '', end: result.bestWindowEnd?.slice(11,16) ?? '' }),
    blockers,
    warnings,
    positiveFactors,
    confidenceLabel: t(`sprayWindow.confidence.${result.confidence}`),
    disclaimer: t('sprayWindow.disclaimer.INDICATIVE_ONLY'),
    profileName: result.productProfile.isMockDefault ? t('sprayWindow.genericProfile') : result.productProfile.name,
  };
}
