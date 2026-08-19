import { describe, expect, it } from 'vitest';
import { resolveWeatherRisk } from '../weather-risk';

const complete = {
  crop: 'potato',
  stageCode: '35',
  temperatureC: 18,
  humidityPercent: 70,
  rainMm: 0,
};

describe('resolveWeatherRisk characterization before Stage 9 contract refactor', () => {
  it.each([
    ['stageCode', { stageCode: null }],
    ['temperatureC', { temperatureC: null }],
    ['humidityPercent', { humidityPercent: null }],
    ['rainMm', { rainMm: null }],
  ])('requires %s and returns unavailable/low confidence', (_name, missing) => {
    const result = resolveWeatherRisk({ ...complete, ...missing });
    expect(result.level).toBe('unavailable');
    expect(result.confidence).toBe('low');
  });

  it.each([
    [10, 85, 1],
    [24, 85, 1],
  ])('high includes temperature endpoints (%s C)', (temperatureC, humidityPercent, rainMm) => {
    expect(resolveWeatherRisk({ ...complete, temperatureC, humidityPercent, rainMm }).level).toBe('high');
  });

  it.each([
    [9.99, 90, 2],
    [24.01, 90, 2],
    [18, 84.99, 2],
    [18, 90, 0.99],
  ])('high requires all three thresholds; otherwise current moderate rule wins', (temperatureC, humidityPercent, rainMm) => {
    expect(resolveWeatherRisk({ ...complete, temperatureC, humidityPercent, rainMm }).level).toBe('moderate');
  });

  it.each([
    [75, 0],
    [70, 0.5],
  ])('moderate uses humidity OR rain (%s%%, %s mm)', (humidityPercent, rainMm) => {
    expect(resolveWeatherRisk({ ...complete, humidityPercent, rainMm }).level).toBe('moderate');
  });

  it('low is returned below both moderate thresholds', () => {
    expect(resolveWeatherRisk({ ...complete, humidityPercent: 74.99, rainMm: 0.49 }).level).toBe('low');
  });

  it('complete results retain medium confidence at every supported risk level', () => {
    const levels = [
      resolveWeatherRisk({ ...complete, humidityPercent: 50 }).confidence,
      resolveWeatherRisk({ ...complete, humidityPercent: 75 }).confidence,
      resolveWeatherRisk({ ...complete, humidityPercent: 90, rainMm: 2 }).confidence,
    ];
    expect(levels).toEqual(['medium', 'medium', 'medium']);
  });

  it('observedAt and now currently do not change the decision', () => {
    const old = resolveWeatherRisk({ ...complete, observedAt: new Date('2020-01-01'), now: new Date('2026-07-31') });
    const current = resolveWeatherRisk({ ...complete, observedAt: new Date('2026-07-31'), now: new Date('2026-07-31') });
    expect(old.level).toBe(current.level);
    expect(old.confidence).toBe(current.confidence);
  });
});
