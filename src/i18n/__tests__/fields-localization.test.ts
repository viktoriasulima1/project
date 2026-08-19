import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getNamespace } from '../catalog';
import { SUPPORTED_LOCALES } from '../locales';
import { createTranslator } from '../translator';
import { diffNamespace, type Tree } from '../validate-core';
import { getEnumLabel } from '../enum-labels';
import { buildFieldHealthDisplayModel, describeFieldHealthEvidence } from '../adapters/field-health';
import type { FieldHealthResult, FieldHealthReasonCode, FieldHealthActionCode } from '@/lib/scouting/field-health';

const fl = (locale: (typeof SUPPORTED_LOCALES)[number]) =>
  createTranslator(locale, { messages: getNamespace(locale, 'fields'), fallback: getNamespace('en-GB', 'fields') });

// 1/3/4 — fields namespace exists in all locales with matching structure
it('fields namespace matches en-GB across locales', () => {
  for (const locale of SUPPORTED_LOCALES) {
    expect(Object.keys(getNamespace(locale, 'fields')).length).toBeGreaterThan(0);
    if (locale === 'en-GB') continue;
    const diff = diffNamespace(getNamespace('en-GB', 'fields') as Tree, getNamespace(locale, 'fields') as Tree);
    expect({ locale, ...diff }).toEqual({ locale, missing: [], extra: [], empty: [], placeholderMismatch: [] });
  }
});

// 5 — real Dutch Fields list labels
it('5 — Dutch Fields list labels are translated', () => {
  expect(fl('nl-NL')('title')).toBe('Percelen');
  expect(fl('nl-NL')('summary.totalFields')).toBe('Totaal percelen');
  expect(fl('de-DE')('title')).toBe('Schläge');
  expect(fl('pl-PL')('dialog.create')).toBe('Utwórz pole');
});

// archiveConfirm interpolates {name} in every locale, keeping the farmer name literal
it('archiveConfirm keeps the farmer-entered {name} unchanged', () => {
  for (const locale of SUPPORTED_LOCALES) {
    expect(fl(locale)('archiveConfirm', { name: 'Keetje Noord' })).toContain('Keetje Noord');
  }
});

// 11/12 — canonical soil/status tokens unchanged; labels localize
it('11 — field status + soil labels localize while tokens stay canonical', () => {
  expect(getEnumLabel('nl-NL', 'fieldStatus', 'healthy')).toBe('Gezond');
  expect(getEnumLabel('de-DE', 'fieldStatus', 'critical')).toBe('Kritisch');
  expect(getEnumLabel('pl-PL', 'soilType', 'clay')).toBe('Ilasta');
  expect(getEnumLabel('en-GB', 'fieldStatus', 'not_a_status')).toBe('not_a_status'); // canonical fallback
});

// 13 — the field dialog soil select binds an explicit canonical value
it('13 — NewFieldDialog soil select binds value={canonical}', () => {
  const src = readFileSync(path.resolve(process.cwd(), 'src/components/fields/NewFieldDialog.tsx'), 'utf8');
  expect(src).toMatch(/SOIL_OPTIONS\.map\(\(s\) => <option key=\{s\} value=\{s\}>/);
  expect(src).not.toMatch(/<option value="clay">Clay<\/option>/); // old literal-label shape gone
});

// Field Detail (header/health/growth/scouting/actions) slice
describe('Field Detail slice localization', () => {
  it('detail keys are translated per locale', () => {
    expect(fl('nl-NL')('detail.cropHealth')).toBe('Gewasgezondheid');
    expect(fl('de-DE')('detail.currentGrowthStage')).toBe('Aktuelles Wachstumsstadium');
    expect(fl('pl-PL')('detail.recentScouting')).toBe('Ostatnie lustracje');
    expect(fl('en-GB')('detail.actions')).toBe('Actions');
  });
  it('interpolations preserve their placeholders in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(fl(locale)('detail.visitSummary', { observations: 3, open: 1, photos: 2 })).toMatch(/3.*1.*2/);
      expect(fl(locale)('detail.calculated', { date: '2026-07-24' })).toContain('2026-07-24');
    }
  });
});

// Field Health presentation adapter (Stage 2): resolver CODES → localized text
describe('Field Health adapter', () => {
  const REASONS: FieldHealthReasonCode[] = ['NO_ACTIVE_CROP_SEASON', 'RECENT_SEVERE_OBSERVATION', 'SCOUTING_OVERDUE', 'WEATHER_RISK_INDICATOR', 'MULTIPLE_OPEN_OBSERVATIONS', 'UNRESOLVED_OBSERVATION', 'NO_SCOUTING_DATA', 'LOW_CONFIDENCE_EVIDENCE', 'NO_CURRENT_ISSUE'];
  const ACTIONS: FieldHealthActionCode[] = ['PLAN_SEASON', 'INSPECT_FIELD', 'RECORD_STAGE_AND_VISIT', 'CONTINUE_MONITORING', 'CONTINUE_SCHEDULE'];
  const stub = (over: Partial<FieldHealthResult>): FieldHealthResult => ({
    status: 'monitoring', severity: 'moderate', reasonCode: 'UNRESOLVED_OBSERVATION', actionCode: 'CONTINUE_MONITORING',
    priority: 3, metadata: { openObservationCount: 1, severeObservationCount: 0, daysSinceStage: 2, weatherRisk: 'low' },
    evidence: [{ type: 'open_observations', count: 1 }], freshness: 'current', confidence: 'medium', ...over,
  });

  it('every reason and action code resolves to non-code text in all locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = fl(locale);
      for (const reasonCode of REASONS) {
        const m = buildFieldHealthDisplayModel(t, stub({ reasonCode }));
        expect(m.reason).toBeTruthy(); expect(m.reason).not.toBe(reasonCode); expect(m.reason).not.toContain('[missing');
      }
      for (const actionCode of ACTIONS) {
        const m = buildFieldHealthDisplayModel(t, stub({ actionCode }));
        expect(m.actionLabel).toBeTruthy(); expect(m.actionLabel).not.toBe(actionCode);
      }
    }
  });

  it('interpolates the observation count into counting reasons', () => {
    const m = buildFieldHealthDisplayModel(fl('en-GB'), stub({ reasonCode: 'RECENT_SEVERE_OBSERVATION', metadata: { openObservationCount: 3, severeObservationCount: 2, daysSinceStage: 1, weatherRisk: 'high' } }));
    expect(m.reason).toContain('2');
  });

  it('localizes the status label', () => {
    expect(buildFieldHealthDisplayModel(fl('nl-NL'), stub({ status: 'attention_required' })).statusLabel).toBe('Aandacht nodig');
    expect(buildFieldHealthDisplayModel(fl('de-DE'), stub({ status: 'inspect_soon' })).statusLabel).toBe('Bald prüfen');
  });

  it('an unknown runtime code degrades to a safe label, never the raw code', () => {
    const m = buildFieldHealthDisplayModel(fl('en-GB'), stub({ reasonCode: 'BOGUS_CODE' as FieldHealthReasonCode, actionCode: 'BOGUS_ACTION' as FieldHealthActionCode }));
    expect(m.reason).not.toContain('BOGUS'); expect(m.reason).toBe(m.statusLabel); expect(m.actionLabel).toBe('');
  });

  it('localizes structured evidence into non-empty descriptions in all locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const out = describeFieldHealthEvidence(fl(locale), [{ type: 'severe_observations', count: 2 }, { type: 'stage_stale', daysSinceStage: 30 }]);
      expect(out).toHaveLength(2);
      expect(out[0]).toContain('2');
      expect(out.every((s) => s.length > 0)).toBe(true);
    }
  });
});
