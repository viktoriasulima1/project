import { describe, expect, it } from 'vitest';
import { compareBriefingFacts, contextChecksum, deterministicBriefing, generateGroundedBriefing, validateAndGroundBriefing } from '../briefing';
import { doseConflict, parseActivityTextDeterministically, resolveEntity } from '../activity-parser';
import { UnavailableAIProvider, type AIProvider } from '../provider';
import type { DailyFarmContext } from '../contracts';

const context: DailyFarmContext = {
  schemaVersion: '1', farmId: 'farm-a', timezone: 'Europe/Amsterdam', generatedAt: '2026-07-17T06:00:00.000Z', activeSeason: null, previousChecksum: null,
  facts: [
    { id: 'ready', type: 'work_order', value: 'Work order ready', source: 'WorkOrderReadiness', relatedEntityId: 'wo-1', timestamp: '2026-07-17T05:00:00.000Z', freshness: 'fresh', confidence: 'authoritative', route: '/work-orders', hardBlocker: false, deterministicPriority: 70 },
    { id: 'blocked', type: 'certificate', value: 'Operator certificate expired', source: 'ComplianceCompleteness', relatedEntityId: 'employee-1', timestamp: '2026-07-17T05:00:00.000Z', freshness: 'fresh', confidence: 'authoritative', route: '/compliance', hardBlocker: true, deterministicPriority: 65 },
  ],
};

describe('grounded AI core', () => {
  it('always ranks a hard blocker first', () => expect(deterministicBriefing(context).primary[0].factId).toBe('blocked'));
  it('limits primary recommendations to three', () => expect(deterministicBriefing(context).primary.length).toBeLessThanOrEqual(3));
  it('has a stable checksum when only generation time changes', () => expect(contextChecksum(context)).toBe(contextChecksum({ ...context, generatedAt: '2026-07-18T06:00:00.000Z' })));
  it('falls back when provider is unavailable', async () => expect((await generateGroundedBriefing(context, new UnavailableAIProvider())).mode).toBe('rule_based'));
  it('rejects output that reorders deterministic priority', async () => {
    const provider: AIProvider = { name: 'bad-test', async generate(request) { return { output: request.validate({ ...deterministicBriefing(context), primary: [...deterministicBriefing(context).primary].reverse() }) }; } };
    expect((await generateGroundedBriefing(context, provider)).mode).toBe('rule_based');
  });
  it('compares only persisted snapshot facts', () => expect(compareBriefingFacts(context.facts, context.facts.slice(1))).toEqual({ added: [], resolved: ['ready'], changed: [] }));
  it('replaces an invalid route with the authoritative route', () => {
    const output = deterministicBriefing(context); output.primary[0].nextActionRoute = '/evil'; output.primary[0].sourceLinks = ['/evil'];
    expect(validateAndGroundBriefing(output, context).primary[0].nextActionRoute).toBe('/compliance');
  });
  it('does not render provider HTML or scripts', () => {
    const output = deterministicBriefing(context); output.primary[0].whyItMatters = '<script>alert(1)</script>';
    expect(validateAndGroundBriefing(output, context).primary[0].whyItMatters).not.toContain('<script>');
  });
  it('rejects unsupported financial values', () => {
    const output = deterministicBriefing(context); output.primary[0].financialContext = 'You will lose €3,000';
    expect(validateAndGroundBriefing(output, context).primary[0].financialContext).toBeNull();
  });
  it('reattaches the authoritative related entity', () => {
    const output = deterministicBriefing(context); output.primary[0].affectedEntity = 'foreign-id';
    expect(validateAndGroundBriefing(output, context).primary[0].affectedEntity).toBe('employee-1');
  });
});

describe('activity language candidates', () => {
  it('parses decimal dose and hectares', () => {
    const parsed = parseActivityTextDeterministically('Sprayed field North with Amistar Opti at 2,5 litres per hectare over 10 hectares this morning using Sprayer 1.');
    expect(parsed).toMatchObject({ activityType: 'spray', fieldText: 'North', productText: 'Amistar Opti', dose: 2.5, areaHa: 10, intent: 'completed' });
  });
  it('returns ambiguity instead of inventing an id', () => expect(resolveEntity('North', [{ id: '1', name: 'North 1' }, { id: '2', name: 'North 2' }])).toMatchObject({ confidence: 'ambiguous', id: null }));
  it('cannot resolve a foreign or unknown entity absent from farm options', () => expect(resolveEntity('Foreign field', [{ id: '1', name: 'Home' }]).id).toBeNull());
  it('keeps official maximum authoritative', () => expect(doseConflict({ parsedDose: 4, officialMaximum: 3 })).toContain('allows up to 3'));
  it('marks multiple activities for manual splitting', () => expect(parseActivityTextDeterministically('Sprayed North and then harvested South').multipleActivities).toBe(true));
  it('marks unsupported requests', () => expect(parseActivityTextDeterministically('Please predict next year prices').unsupportedRequest).toBe(true));
});
