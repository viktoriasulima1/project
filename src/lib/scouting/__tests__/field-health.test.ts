import { describe, expect, it } from 'vitest';
import { resolveFieldHealthStatus } from '../field-health';
import { resolveWeatherRisk } from '../weather-risk';

const now = new Date('2026-07-18T12:00:00Z');
describe('resolveFieldHealthStatus', () => {
  it('prioritises severe unresolved evidence', () => { const r=resolveFieldHealthStatus({hasActiveSeason:true,now,growthStageObservedAt:'2026-07-17',observations:[{status:'open',severity:'high',createdAt:'2026-07-18'}]}); expect(r.status).toBe('attention_required'); expect(r.reasonCode).toBe('RECENT_SEVERE_OBSERVATION'); });
  it('requires inspection for overdue work', () => expect(resolveFieldHealthStatus({hasActiveSeason:true,now,overdueScoutingOrders:1,growthStageObservedAt:'2026-07-17',observations:[]}).status).toBe('inspect_soon'));
  it('requires inspection for explainable high weather risk', () => expect(resolveFieldHealthStatus({hasActiveSeason:true,now,weatherRisk:'high',growthStageObservedAt:'2026-07-17',observations:[]}).status).toBe('inspect_soon'));
  it('monitors unresolved moderate observations', () => expect(resolveFieldHealthStatus({hasActiveSeason:true,now,growthStageObservedAt:'2026-07-17',observations:[{status:'monitoring',severity:'moderate',createdAt:'2026-07-18'}]}).status).toBe('monitoring'));
  it('reports no current issue only with fresh evidence', () => expect(resolveFieldHealthStatus({hasActiveSeason:true,now,growthStageObservedAt:'2026-07-17',observations:[{status:'resolved',severity:'high',createdAt:'2026-07-18'}]}).status).toBe('no_current_issue'));
  it('warns when stage is stale', () => { const r=resolveFieldHealthStatus({hasActiveSeason:true,now,growthStageObservedAt:'2026-06-01',observations:[]}); expect(r.status).toBe('insufficient_data'); expect(r.freshness).toBe('stale'); });
  it('does not infer health without an active season', () => expect(resolveFieldHealthStatus({hasActiveSeason:false,now,observations:[]}).confidence).toBe('low'));
});

// Resolver Localization Stage 2: characterize the stable code/metadata/priority
// contract per branch, so a future prose removal can rely on it. These lock the
// decision → code mapping; they must NOT change when wording changes.
describe('resolveFieldHealthStatus code contract', () => {
  const base = { hasActiveSeason: true, now, growthStageObservedAt: '2026-07-17' as const };
  it('no active season → NO_ACTIVE_CROP_SEASON / PLAN_SEASON, priority 4, no stage age', () => {
    const r = resolveFieldHealthStatus({ hasActiveSeason: false, now, observations: [] });
    expect(r.reasonCode).toBe('NO_ACTIVE_CROP_SEASON'); expect(r.actionCode).toBe('PLAN_SEASON');
    expect(r.priority).toBe(4); expect(r.metadata.daysSinceStage).toBeNull();
  });
  it('severe evidence → RECENT_SEVERE_OBSERVATION / INSPECT_FIELD, priority 1, counts', () => {
    const r = resolveFieldHealthStatus({ ...base, observations: [{ status: 'open', severity: 'critical', createdAt: '2026-07-18' }, { status: 'open', severity: 'high', createdAt: '2026-07-18' }] });
    expect(r.reasonCode).toBe('RECENT_SEVERE_OBSERVATION'); expect(r.actionCode).toBe('INSPECT_FIELD');
    expect(r.priority).toBe(1); expect(r.metadata.severeObservationCount).toBe(2); expect(r.metadata.openObservationCount).toBe(2);
  });
  it('high weather risk → WEATHER_RISK_INDICATOR / INSPECT_FIELD, priority 2', () => {
    const r = resolveFieldHealthStatus({ ...base, weatherRisk: 'high', observations: [] });
    expect(r.reasonCode).toBe('WEATHER_RISK_INDICATOR'); expect(r.actionCode).toBe('INSPECT_FIELD'); expect(r.priority).toBe(2);
  });
  it('overdue scouting (no weather) → SCOUTING_OVERDUE / INSPECT_FIELD', () => {
    const r = resolveFieldHealthStatus({ ...base, overdueScoutingOrders: 2, observations: [] });
    expect(r.reasonCode).toBe('SCOUTING_OVERDUE'); expect(r.actionCode).toBe('INSPECT_FIELD');
  });
  it('multiple open observations → MULTIPLE_OPEN_OBSERVATIONS / CONTINUE_MONITORING, priority 3', () => {
    const r = resolveFieldHealthStatus({ ...base, observations: [{ status: 'monitoring', severity: 'moderate', createdAt: '2026-07-18' }, { status: 'open', severity: 'low', createdAt: '2026-07-18' }] });
    expect(r.reasonCode).toBe('MULTIPLE_OPEN_OBSERVATIONS'); expect(r.actionCode).toBe('CONTINUE_MONITORING');
    expect(r.priority).toBe(3); expect(r.metadata.openObservationCount).toBe(2);
  });
  it('single open observation → UNRESOLVED_OBSERVATION', () => {
    const r = resolveFieldHealthStatus({ ...base, observations: [{ status: 'monitoring', severity: 'moderate', createdAt: '2026-07-18' }] });
    expect(r.reasonCode).toBe('UNRESOLVED_OBSERVATION'); expect(r.metadata.openObservationCount).toBe(1);
  });
  it('moderate weather only → WEATHER_RISK_INDICATOR / CONTINUE_MONITORING', () => {
    const r = resolveFieldHealthStatus({ ...base, weatherRisk: 'moderate', observations: [] });
    expect(r.reasonCode).toBe('WEATHER_RISK_INDICATOR'); expect(r.actionCode).toBe('CONTINUE_MONITORING');
  });
  it('no observations at all → NO_SCOUTING_DATA / RECORD_STAGE_AND_VISIT (missing stage)', () => {
    const r = resolveFieldHealthStatus({ hasActiveSeason: true, now, observations: [] });
    expect(r.reasonCode).toBe('NO_SCOUTING_DATA'); expect(r.actionCode).toBe('RECORD_STAGE_AND_VISIT'); expect(r.freshness).toBe('missing');
  });
  it('stale stage → LOW_CONFIDENCE_EVIDENCE / RECORD_STAGE_AND_VISIT', () => {
    const r = resolveFieldHealthStatus({ hasActiveSeason: true, now, growthStageObservedAt: '2026-06-01', observations: [] });
    expect(r.reasonCode).toBe('LOW_CONFIDENCE_EVIDENCE'); expect(r.actionCode).toBe('RECORD_STAGE_AND_VISIT'); expect(r.metadata.daysSinceStage).toBeGreaterThan(21);
  });
  it('clean fresh evidence → NO_CURRENT_ISSUE / CONTINUE_SCHEDULE, priority 5', () => {
    const r = resolveFieldHealthStatus({ ...base, observations: [{ status: 'resolved', severity: 'high', createdAt: '2026-07-18' }] });
    expect(r.reasonCode).toBe('NO_CURRENT_ISSUE'); expect(r.actionCode).toBe('CONTINUE_SCHEDULE'); expect(r.priority).toBe(5);
  });
});

// Stage 2B: evidence is structured + language-independent; the resolver emits no
// farmer-facing English (Part 8, Part 13-test-9/13).
describe('resolveFieldHealthStatus structured evidence', () => {
  const base = { hasActiveSeason: true, now, growthStageObservedAt: '2026-07-17' as const };
  it('severe branch carries a typed severe_observations evidence with the count', () => {
    const r = resolveFieldHealthStatus({ ...base, observations: [{ status: 'open', severity: 'critical', createdAt: '2026-07-18' }] });
    expect(r.evidence).toEqual([{ type: 'severe_observations', count: 1 }]);
  });
  it('no-data field yields stage_missing evidence, not a healthy signal', () => {
    const r = resolveFieldHealthStatus({ hasActiveSeason: true, now, observations: [] });
    expect(r.status).toBe('insufficient_data'); // Unknown, never healthy
    expect(r.evidence).toEqual([{ type: 'stage_missing' }]);
  });
  it('evidence is JSON-only (no English sentences)', () => {
    const r = resolveFieldHealthStatus({ ...base, weatherRisk: 'moderate', observations: [] });
    for (const e of r.evidence) {
      expect(typeof e.type).toBe('string');
      expect(Object.values(e).every((v) => typeof v !== 'string' || /^[a-z_]+$/.test(v))).toBe(true);
    }
  });
  it('the result object exposes no prose keys', () => {
    const r = resolveFieldHealthStatus({ ...base, observations: [] }) as unknown as Record<string, unknown>;
    expect(r.explanation).toBeUndefined();
    expect(r.primaryEvidence).toBeUndefined();
    expect(r.recommendedAction).toBeUndefined();
  });

  // Part 5/Flow D: every surface (Field Detail, Dashboard, Insights, Map, Scouting)
  // resolves health through this one pure function, so identical input yields an
  // identical canonical result — there is no surface-specific health logic.
  it('is deterministic: same input → identical canonical status/reason/priority', () => {
    const input = { ...base, observations: [{ status: 'open', severity: 'critical', createdAt: '2026-07-18' }] };
    const a = resolveFieldHealthStatus(input); const b = resolveFieldHealthStatus({ ...input });
    expect({ s: a.status, r: a.reasonCode, p: a.priority, act: a.actionCode }).toEqual({ s: b.status, r: b.reasonCode, p: b.priority, act: b.actionCode });
  });
});

describe('resolveWeatherRisk', () => {
  it('returns unavailable with coded missing inputs', () => { const r=resolveWeatherRisk({crop:'potato'}); expect(r.level).toBe('unavailable'); expect(r.metadata.missingInputs).toContain('growth_stage'); });
  it('labels favourable conditions as risk rather than diagnosis', () => { const r=resolveWeatherRisk({crop:'potato',stageCode:'35',temperatureC:18,humidityPercent:92,rainMm:4}); expect(r.level).toBe('high'); expect(r.reasonCode).toBe('FAVOURABLE_WARM_HUMID_WET_CONDITIONS'); expect(r.diagnostic).toBe(false); });
  it('returns deterministic low risk for dry measured inputs', () => expect(resolveWeatherRisk({crop:'potato',stageCode:'35',temperatureC:25,humidityPercent:50,rainMm:0}).level).toBe('low'));
});
