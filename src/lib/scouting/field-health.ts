export type FieldHealthStatus = 'attention_required' | 'inspect_soon' | 'monitoring' | 'no_current_issue' | 'insufficient_data';
export type HealthSeverity = 'critical' | 'high' | 'moderate' | 'low' | 'none' | 'unknown';

// Stage 2B: the pure resolver is now CODE-ONLY. It emits stable status/reason/
// action codes, canonical metadata and structured (language-independent)
// evidence — never farmer-facing English. All wording is produced by the
// presentation adapter (src/i18n/adapters/field-health.ts) at the UI boundary,
// or, for the AI-briefing grounding path, by the consumer that owns that English
// (src/lib/farm-insights.ts). Decisions/thresholds/priority are unchanged.
export type FieldHealthReasonCode =
  | 'NO_ACTIVE_CROP_SEASON'
  | 'RECENT_SEVERE_OBSERVATION'
  | 'SCOUTING_OVERDUE'
  | 'WEATHER_RISK_INDICATOR'
  | 'MULTIPLE_OPEN_OBSERVATIONS'
  | 'UNRESOLVED_OBSERVATION'
  | 'NO_SCOUTING_DATA'
  | 'LOW_CONFIDENCE_EVIDENCE'
  | 'NO_CURRENT_ISSUE';

export type FieldHealthActionCode =
  | 'PLAN_SEASON'
  | 'INSPECT_FIELD'
  | 'RECORD_STAGE_AND_VISIT'
  | 'CONTINUE_MONITORING'
  | 'CONTINUE_SCHEDULE';

export interface FieldHealthReasonMetadata {
  openObservationCount: number;
  severeObservationCount: number;
  daysSinceStage: number | null;
  weatherRisk: 'low' | 'moderate' | 'high' | 'unavailable';
}

/**
 * Structured, language-independent evidence (Part 8), replacing the former array
 * of English evidence phrases. Consumers render these into localized descriptions
 * at the presentation boundary; no farmer-facing sentence is stored here, and no
 * private note or raw photo content is included.
 */
export type FieldHealthEvidence =
  | { type: 'no_active_season' }
  | { type: 'severe_observations'; count: number }
  | { type: 'overdue_scouting'; count: number }
  | { type: 'weather_risk'; level: 'moderate' | 'high' }
  | { type: 'open_observations'; count: number }
  | { type: 'stage_missing' }
  | { type: 'stage_stale'; daysSinceStage: number }
  | { type: 'clean' };

/** Stable ordering (lower = more urgent). Derived from status; not persisted. */
const STATUS_PRIORITY: Record<FieldHealthStatus, number> = {
  attention_required: 1, inspect_soon: 2, monitoring: 3, insufficient_data: 4, no_current_issue: 5,
};

export interface FieldHealthInput {
  observations: Array<{ status: string; severity: string; createdAt: Date | string }>;
  growthStageObservedAt?: Date | string | null;
  weatherRisk?: 'low' | 'moderate' | 'high' | 'unavailable';
  overdueScoutingOrders?: number;
  hasActiveSeason: boolean;
  now?: Date;
}

export interface FieldHealthResult {
  status: FieldHealthStatus;
  severity: HealthSeverity;
  reasonCode: FieldHealthReasonCode;
  actionCode: FieldHealthActionCode;
  priority: number;
  metadata: FieldHealthReasonMetadata;
  evidence: FieldHealthEvidence[];
  freshness: 'current' | 'stale' | 'missing';
  confidence: 'high' | 'medium' | 'low';
}

const OPEN = new Set(['open', 'monitoring', 'action_planned']);

export function resolveFieldHealthStatus(input: FieldHealthInput): FieldHealthResult {
  const now = input.now ?? new Date();
  const unresolved = input.observations.filter((o) => OPEN.has(o.status));
  const severe = unresolved.filter((o) => ['critical', 'high'].includes(o.severity));
  const stageAgeDays = input.growthStageObservedAt == null ? null : Math.floor((now.getTime() - new Date(input.growthStageObservedAt).getTime()) / 86_400_000);
  const freshness = stageAgeDays == null ? 'missing' : stageAgeDays > 21 ? 'stale' : 'current';
  const metadata: FieldHealthReasonMetadata = {
    openObservationCount: unresolved.length,
    severeObservationCount: severe.length,
    daysSinceStage: stageAgeDays,
    weatherRisk: input.weatherRisk ?? 'unavailable',
  };

  // Decisions below are IDENTICAL to the pre-refactor resolver — only the return
  // payload changed from prose to codes + structured evidence.
  if (!input.hasActiveSeason) {
    return result('insufficient_data', 'unknown', 'missing', 'low', 'NO_ACTIVE_CROP_SEASON', 'PLAN_SEASON', { ...metadata, daysSinceStage: null }, [{ type: 'no_active_season' }]);
  }

  if (severe.length) {
    return result('attention_required', severe.some((o) => o.severity === 'critical') ? 'critical' : 'high', freshness, 'high', 'RECENT_SEVERE_OBSERVATION', 'INSPECT_FIELD', metadata, [{ type: 'severe_observations', count: severe.length }]);
  }

  if ((input.overdueScoutingOrders ?? 0) > 0 || input.weatherRisk === 'high') {
    const weatherHigh = input.weatherRisk === 'high';
    return result('inspect_soon', 'high', freshness, 'medium', weatherHigh ? 'WEATHER_RISK_INDICATOR' : 'SCOUTING_OVERDUE', 'INSPECT_FIELD', metadata, [weatherHigh ? { type: 'weather_risk', level: 'high' } : { type: 'overdue_scouting', count: input.overdueScoutingOrders ?? 0 }]);
  }

  if (unresolved.length || input.weatherRisk === 'moderate') {
    const reasonCode: FieldHealthReasonCode = unresolved.length > 1 ? 'MULTIPLE_OPEN_OBSERVATIONS' : unresolved.length === 1 ? 'UNRESOLVED_OBSERVATION' : 'WEATHER_RISK_INDICATOR';
    const evidence: FieldHealthEvidence[] = unresolved.length ? [{ type: 'open_observations', count: unresolved.length }] : [{ type: 'weather_risk', level: 'moderate' }];
    return result('monitoring', 'moderate', freshness, 'medium', reasonCode, 'CONTINUE_MONITORING', metadata, evidence);
  }

  if (!input.observations.length || freshness !== 'current') {
    const missing = freshness === 'missing';
    return result('insufficient_data', 'unknown', freshness, 'low', missing ? 'NO_SCOUTING_DATA' : 'LOW_CONFIDENCE_EVIDENCE', 'RECORD_STAGE_AND_VISIT', metadata, [missing ? { type: 'stage_missing' } : { type: 'stage_stale', daysSinceStage: stageAgeDays ?? 0 }]);
  }

  return result('no_current_issue', 'none', freshness, 'high', 'NO_CURRENT_ISSUE', 'CONTINUE_SCHEDULE', metadata, [{ type: 'clean' }]);
}

function result(status: FieldHealthStatus, severity: HealthSeverity, freshness: FieldHealthResult['freshness'], confidence: FieldHealthResult['confidence'], reasonCode: FieldHealthReasonCode, actionCode: FieldHealthActionCode, metadata: FieldHealthReasonMetadata, evidence: FieldHealthEvidence[]): FieldHealthResult {
  return { status, severity, reasonCode, actionCode, priority: STATUS_PRIORITY[status], metadata, evidence, freshness, confidence };
}
