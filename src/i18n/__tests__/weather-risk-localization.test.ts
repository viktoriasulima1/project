import { describe, expect, it } from 'vitest';
import { buildWeatherRiskDisplayModel } from '../adapters/weather-risk';
import { getNamespace } from '../catalog';
import { createTranslator } from '../translator';
import type { Locale } from '../locales';
import { resolveWeatherRisk, type WeatherRiskActionCode, type WeatherRiskReasonCode, type WeatherRiskStatus } from '@/lib/scouting/weather-risk';

const locales: Locale[] = ['nl-NL', 'en-GB', 'pl-PL', 'de-DE'];
const reasons: WeatherRiskReasonCode[] = ['BELOW_RISK_THRESHOLDS', 'SOME_FAVOURABLE_CONDITIONS', 'FAVOURABLE_WARM_HUMID_WET_CONDITIONS', 'INSUFFICIENT_MEASURED_INPUTS'];
const actions: WeatherRiskActionCode[] = ['CONTINUE_NORMAL_SCOUTING', 'INSPECT_FIELD', 'SCOUT_MANUALLY'];
const statuses: WeatherRiskStatus[] = ['low', 'moderate', 'high', 'unavailable'];

function translator(locale: Locale) {
  return createTranslator(locale, { messages: getNamespace(locale, 'fields'), fallback: getNamespace('en-GB', 'fields') });
}

describe('Weather Risk localization contract', () => {
  it.each(locales)('%s has every status, reason, action, confidence and freshness key', (locale) => {
    const t = translator(locale);
    for (const status of statuses) expect(t(`weatherRisk.status.${status}`)).not.toMatch(/missing:/);
    for (const reason of reasons) expect(t(`weatherRisk.reasons.${reason}`, { count: 4 })).not.toMatch(/missing:/);
    for (const action of actions) expect(t(`weatherRisk.actions.${action}`)).not.toMatch(/missing:/);
    for (const confidence of ['medium', 'low']) expect(t(`weatherRisk.confidence.${confidence}`)).not.toMatch(/missing:/);
    for (const freshness of ['current', 'unavailable']) expect(t(`weatherRisk.freshness.${freshness}`)).not.toMatch(/missing:/);
  });

  it.each(locales)('%s renders structured evidence without raw codes', (locale) => {
    const result = resolveWeatherRisk({ crop: 'potato', stageCode: '35', temperatureC: 18, humidityPercent: 92, rainMm: 4 });
    const display = buildWeatherRiskDisplayModel({ t: translator(locale), locale, result });
    const visible = JSON.stringify(display);
    expect(display.evidence).toHaveLength(4);
    expect(visible).not.toContain(result.reasonCode);
    expect(visible).not.toContain(result.actionCode);
    expect(display.disclaimer.length).toBeGreaterThan(20);
  });

  it('uses locale-aware decimal formatting', () => {
    const result = resolveWeatherRisk({ crop: 'potato', stageCode: '35', temperatureC: 18.5, humidityPercent: 92.5, rainMm: 1.5 });
    const nl = buildWeatherRiskDisplayModel({ t: translator('nl-NL'), locale: 'nl-NL', result });
    const en = buildWeatherRiskDisplayModel({ t: translator('en-GB'), locale: 'en-GB', result });
    expect(nl.evidence.join(' ')).toContain('18,5');
    expect(en.evidence.join(' ')).toContain('18.5');
  });

  it('unknown runtime status/reason degrades safely without the raw value', () => {
    const result = resolveWeatherRisk({ crop: 'potato' });
    const corrupted = { ...result, status: 'ALIEN_RISK', reasonCode: 'ALIEN_REASON' } as unknown as typeof result;
    const display = buildWeatherRiskDisplayModel({ t: translator('en-GB'), locale: 'en-GB', result: corrupted });
    expect(JSON.stringify(display)).not.toContain('ALIEN');
    expect(display.statusLabel).toBe('Weather risk unavailable');
  });
});
