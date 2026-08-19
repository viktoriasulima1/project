import type { Locale } from '../locales';
import type { Translate } from '../translator';
import { formatNumber } from '../format';
import type { WeatherRiskEvidence, WeatherRiskResult } from '@/lib/scouting/weather-risk';

export interface WeatherRiskDisplayModel {
  statusLabel: string;
  reason: string;
  actionLabel: string;
  confidenceLabel: string;
  freshnessLabel: string;
  evidence: string[];
  disclaimer: string;
}

export function buildWeatherRiskDisplayModel({ t, locale, result }: { t: Translate; locale: Locale; result: WeatherRiskResult }): WeatherRiskDisplayModel {
  const safeStatus = ['low', 'moderate', 'high', 'unavailable'].includes(result.status) ? result.status : 'unavailable';
  return {
    statusLabel: t(`weatherRisk.status.${safeStatus}`),
    reason: localizeReason(t, result),
    actionLabel: localizeAction(t, result),
    confidenceLabel: t(`weatherRisk.confidence.${result.confidence === 'medium' ? 'medium' : 'low'}`),
    freshnessLabel: t(`weatherRisk.freshness.${result.freshness === 'current' ? 'current' : 'unavailable'}`),
    evidence: result.evidence.map((item) => describeEvidence(t, locale, item)).filter(Boolean),
    disclaimer: t('weatherRisk.disclaimer'),
  };
}

function localizeReason(t: Translate, result: WeatherRiskResult): string {
  switch (result.reasonCode) {
    case 'BELOW_RISK_THRESHOLDS':
    case 'SOME_FAVOURABLE_CONDITIONS':
    case 'FAVOURABLE_WARM_HUMID_WET_CONDITIONS':
      return t(`weatherRisk.reasons.${result.reasonCode}`);
    case 'INSUFFICIENT_MEASURED_INPUTS':
      return t(`weatherRisk.reasons.${result.reasonCode}`, { count: result.metadata.missingInputs.length });
    default: return t('weatherRisk.reasons.UNKNOWN');
  }
}

function localizeAction(t: Translate, result: WeatherRiskResult): string {
  switch (result.actionCode) {
    case 'CONTINUE_NORMAL_SCOUTING':
    case 'INSPECT_FIELD':
    case 'SCOUT_MANUALLY':
      return t(`weatherRisk.actions.${result.actionCode}`);
    default: return '';
  }
}

function describeEvidence(t: Translate, locale: Locale, item: WeatherRiskEvidence): string {
  switch (item.type) {
    case 'crop_stage': return t('weatherRisk.evidence.cropStage', { crop: item.crop, stage: item.stageCode });
    case 'measured_temperature': return t('weatherRisk.evidence.temperature', { value: formatNumber(item.valueC, locale, { maximumFractionDigits: 2 }) });
    case 'measured_humidity': return t('weatherRisk.evidence.humidity', { value: formatNumber(item.valuePercent, locale, { maximumFractionDigits: 2 }) });
    case 'measured_rain': return t('weatherRisk.evidence.rain', { value: formatNumber(item.valueMm, locale, { maximumFractionDigits: 2 }) });
    case 'missing_inputs': return t('weatherRisk.evidence.missing', { count: item.inputs.length });
    default: return '';
  }
}
