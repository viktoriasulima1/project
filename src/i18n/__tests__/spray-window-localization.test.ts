import { describe, expect, it } from 'vitest';
import { buildSprayWindowDisplayModel, describeSprayWindowSignal } from '../adapters/spray-window';
import { getNamespace } from '../catalog';
import { createTranslator } from '../translator';
import type { Locale } from '../locales';
import { computeSprayWindows, type SprayWindowSignalCode } from '@/lib/spray-window';

const locales: Locale[] = ['nl-NL','en-GB','pl-PL','de-DE'];
const codes: SprayWindowSignalCode[] = ['WIND_SPEED_EXCEEDS_LIMIT','WIND_GUST_EXCEEDS_LIMIT','WIND_GUST_UNAVAILABLE','TEMPERATURE_BELOW_MINIMUM','TEMPERATURE_ABOVE_MAXIMUM','HUMIDITY_EXCEEDS_PRODUCT_LIMIT','RAINFAST_HORIZON_INCOMPLETE','RAINFAST_PRECIPITATION_EXCEEDS_LIMIT','PRODUCT_NOT_SELECTED','GENERIC_PROFILE_USED','PRODUCT_REGISTRATION_INVALID','OPERATOR_CERTIFICATION_INVALID','OPERATOR_CONTEXT_MISSING','OPERATOR_UNVERIFIED','INSUFFICIENT_STOCK','INVENTORY_CONTEXT_MISSING','INVENTORY_UNVERIFIED','CROP_INELIGIBLE','BBCH_OUTSIDE_RANGE','CROP_BBCH_CONTEXT_MISSING','CROP_BBCH_UNVERIFIED','DRIFT_REDUCTION_NOZZLE_REQUIRED','DRIFT_CONTEXT_MISSING','DRIFT_REQUIREMENT_UNVERIFIED','LOW_WIND','WIND_APPROACHING_LIMIT','NO_RAIN_FORECAST_THIS_HOUR','LOW_HUMIDITY','HUMIDITY_ELEVATED','WIDE_DEW_POINT_MARGIN','NARROW_DEW_POINT_MARGIN','LEAF_WETNESS_ELEVATED'];
const vars = { observedKmh:12,limitKmh:15,observedC:10,limitC:5,observedPercent:90,limitPercent:85,availableHours:1,requiredHours:2,observedMm:2,limitMm:1,periodHours:2,productName:'Product',requiredQuantity:5,availableStock:2,unit:'L',crop:'potato',stage:35,min:20,max:30,marginC:3,leafWetness:1 };
const tFor = (locale: Locale) => createTranslator(locale, { messages:getNamespace(locale,'fields'), fallback:getNamespace('en-GB','fields') });

describe('Spray Window localization', () => {
  it.each(locales)('%s translates every real signal code without exposing it', (locale) => {
    const t=tFor(locale);
    for(const code of codes){const text=describeSprayWindowSignal(t,locale,{code,metadata:vars});expect(text).not.toContain(code);expect(text).not.toMatch(/missing:/);}
  });
  it.each(locales)('%s renders the canonical empty/unavailable result safely', (locale) => {
    const result=computeSprayWindows([], '2026-07-06');
    const display=buildSprayWindowDisplayModel(tFor(locale),locale,result);
    expect(display.statusLabel).not.toMatch(/missing:/); expect(display.explanation).not.toContain('NO_FORECAST_DATA'); expect(display.disclaimer.length).toBeGreaterThan(20);
  });
  it('unknown runtime signal is localized safely and never treated as suitable',()=>{
    const text=describeSprayWindowSignal(tFor('en-GB'),'en-GB',{code:'ALIEN' as SprayWindowSignalCode,metadata:{}});
    expect(text).toBe('Condition unavailable'); expect(text).not.toContain('ALIEN');
  });
});
