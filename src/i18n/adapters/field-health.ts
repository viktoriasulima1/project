import type { Translate } from '../translator';
import type {
  FieldHealthResult, FieldHealthStatus, FieldHealthReasonCode, FieldHealthActionCode, FieldHealthEvidence,
} from '@/lib/scouting/field-health';

/**
 * Presentation adapter (Parts 9/11): maps Field Health CODES to localized display
 * text. Kept OUT of the pure resolver (which imports no i18n). `t` must be bound
 * to the `fields` namespace.
 *
 * Exhaustiveness is compile-time enforced: each switch's `default` assigns the
 * code to `never`, so adding a reason/action code fails the build until it is
 * handled here (and, via the diffNamespace + adapter tests, translated in all four
 * locales). A genuinely unknown *runtime* code (corrupted data) degrades to a safe
 * label — never a raw code.
 */
const STATUSES: readonly FieldHealthStatus[] = ['attention_required', 'inspect_soon', 'monitoring', 'no_current_issue', 'insufficient_data'];

export interface FieldHealthDisplayModel {
  statusLabel: string;
  reason: string;
  actionLabel: string;
}

function localizeReason(t: Translate, result: FieldHealthResult, safeFallback: string): string {
  const code = result.reasonCode;
  switch (code) {
    case 'NO_ACTIVE_CROP_SEASON':
    case 'SCOUTING_OVERDUE':
    case 'WEATHER_RISK_INDICATOR':
    case 'UNRESOLVED_OBSERVATION':
    case 'NO_SCOUTING_DATA':
    case 'LOW_CONFIDENCE_EVIDENCE':
    case 'NO_CURRENT_ISSUE':
      return t(`health.reasons.${code}`);
    case 'RECENT_SEVERE_OBSERVATION':
      return t(`health.reasons.${code}`, { count: result.metadata.severeObservationCount });
    case 'MULTIPLE_OPEN_OBSERVATIONS':
      return t(`health.reasons.${code}`, { count: result.metadata.openObservationCount });
    default: {
      const _exhaustive: never = code; void _exhaustive;
      return safeFallback; // corrupted runtime code → safe label, never the raw code
    }
  }
}

function localizeAction(t: Translate, code: FieldHealthActionCode): string {
  switch (code) {
    case 'PLAN_SEASON':
    case 'INSPECT_FIELD':
    case 'RECORD_STAGE_AND_VISIT':
    case 'CONTINUE_MONITORING':
    case 'CONTINUE_SCHEDULE':
      return t(`health.actions.${code}`);
    default: {
      const _exhaustive: never = code; void _exhaustive;
      return '';
    }
  }
}

export function buildFieldHealthDisplayModel(t: Translate, result: FieldHealthResult): FieldHealthDisplayModel {
  const status: FieldHealthStatus = STATUSES.includes(result.status) ? result.status : 'insufficient_data';
  const statusLabel = t(`health.status.${status}`);
  return {
    statusLabel,
    reason: localizeReason(t, result, statusLabel),
    actionLabel: localizeAction(t, result.actionCode),
  };
}

/**
 * Localizes structured evidence (Part 8) into short descriptions at the
 * presentation boundary. Language-independent input → localized output; unknown
 * runtime evidence types are skipped rather than rendered raw.
 */
export function describeFieldHealthEvidence(t: Translate, evidence: readonly FieldHealthEvidence[]): string[] {
  return evidence.map((e) => {
    switch (e.type) {
      case 'no_active_season': return t('health.evidence.noActiveSeason');
      case 'severe_observations': return t('health.evidence.severeObservations', { count: e.count });
      case 'overdue_scouting': return t('health.evidence.overdueScouting', { count: e.count });
      case 'weather_risk': return t('health.evidence.weatherRisk');
      case 'open_observations': return t('health.evidence.openObservations', { count: e.count });
      case 'stage_missing': return t('health.evidence.stageMissing');
      case 'stage_stale': return t('health.evidence.stageStale', { count: e.daysSinceStage });
      case 'clean': return t('health.evidence.clean');
      default: { const _exhaustive: never = e; void _exhaustive; return ''; }
    }
  }).filter(Boolean);
}
