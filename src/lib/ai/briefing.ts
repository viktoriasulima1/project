import { createHash } from 'node:crypto';
import type { BriefingOutput, DailyFarmContext, GroundedFact } from './contracts';
import { briefingOutputSchema } from './contracts';
import { AIProviderUnavailableError, briefingRequest, type AIProvider } from './provider';
import { createTranslator } from '@/i18n/translator';
import { getNamespace } from '@/i18n/catalog';
import { buildEconomicSignalDisplayModel } from '@/i18n/adapters/economic-signals';
import type { RawEconomicSignal } from '@/lib/farm-economic-signals';

const ALLOWED_ROUTES = new Set(['/dashboard', '/fields', '/activities', '/inventory', '/finance', '/weather', '/compliance', '/ai', '/work-orders', '/planning', '/reports']);
const UNSAFE_TEXT = /<\/?[a-z][^>]*>|javascript:|\b(?:diagnose|prescribe|legally approved)\b/i;

export function contextChecksum(context: DailyFarmContext): string {
  return createHash('sha256').update(JSON.stringify({ ...context, generatedAt: undefined, previousChecksum: undefined })).digest('hex');
}

function itemFromFact(fact: GroundedFact, locale: NonNullable<DailyFarmContext['requestedLocale']>) {
  const canonical = fact.economicSignal;
  const t = createTranslator(locale, { messages: getNamespace(locale, 'fields'), fallback: getNamespace('en-GB', 'fields') });
  const display = canonical ? buildEconomicSignalDisplayModel(t, locale, {
    id: fact.id, signalCode: canonical.signalCode as RawEconomicSignal['signalCode'], actionCode: canonical.actionCode as RawEconomicSignal['actionCode'],
    fieldId: canonical.fieldId, metadata: canonical.metadata as RawEconomicSignal['metadata'], evidence: canonical.evidence as RawEconomicSignal['evidence'],
    confidence: fact.confidence === 'authoritative' ? 'high' : fact.confidence, relatedModule: 'finance', role: 'alert', priority: {} as RawEconomicSignal['priority'],
  }) : null;
  return {
    factId: fact.id,
    title: display?.title ?? String(fact.value),
    recommendedAction: display?.actionLabel ?? (fact.hardBlocker ? 'Review and resolve this blocker before continuing.' : 'Review the related farm record.'),
    // fact.source is an internal tag (e.g. "OperationalPriority:<evidence
    // text>") meant for the "Why / evidence" detail disclosure, not a primary
    // sentence — interpolating it here used to leak raw internal strings
    // straight into the dashboard ("OperationalPriority:No current stage
    // record identified this from recorded farm data.").
    whyItMatters: display?.explanation ?? 'Based on your recorded farm data.',
    affectedEntity: fact.relatedEntityId,
    deadline: null,
    requiredResources: [],
    blockerStatus: fact.hardBlocker ? 'blocked' as const : fact.deterministicPriority >= 60 ? 'warning' as const : 'none' as const,
    financialContext: display?.evidence ?? (fact.type.includes('economic') || fact.type.includes('budget') ? String(fact.value) : null),
    evidence: [display?.evidence ?? `${fact.source} · ${fact.timestamp}`],
    confidence: fact.confidence,
    dataFreshness: fact.freshness,
    sourceLinks: [fact.route],
    nextActionRoute: fact.route,
  };
}

export function deterministicBriefing(context: DailyFarmContext): BriefingOutput {
  const eligible = context.facts.filter((fact) => fact.freshness !== 'unavailable').sort((a, b) => {
    if (a.hardBlocker !== b.hardBlocker) return a.hardBlocker ? -1 : 1;
    return b.deterministicPriority - a.deterministicPriority;
  });
  const locale = context.requestedLocale ?? 'en-GB';
  const primary = eligible.slice(0, 3).map((fact) => itemFromFact(fact, locale));
  const secondary = eligible.slice(3, 5).map((fact) => itemFromFact(fact, locale));
  if (!primary.length) primary.push({
    factId: 'no-urgent-action', title: 'Nothing critical is due today', recommendedAction: 'Review ready Work Orders for this week.',
    whyItMatters: 'No current deterministic rule identified an urgent blocker.', affectedEntity: null, deadline: null, requiredResources: [],
    blockerStatus: 'none', financialContext: null, evidence: ['Current farm snapshot contains no urgent facts'], confidence: 'authoritative',
    dataFreshness: 'fresh', sourceLinks: ['/work-orders'], nextActionRoute: '/work-orders',
  });
  return { primary, secondary, seasonEconomicsNote: null };
}

export function validateAndGroundBriefing(model: BriefingOutput, context: DailyFarmContext): BriefingOutput {
  const fallback = deterministicBriefing(context);
  const facts = new Map(context.facts.map((fact) => [fact.id, fact]));
  const groundItem = (item: BriefingOutput['primary'][number], fallbackItem: BriefingOutput['primary'][number] | undefined) => {
    const fact = facts.get(item.factId);
    if (!fact || !fallbackItem || item.factId !== fallbackItem.factId) return fallbackItem ?? null;
    const unsafe = [item.title, item.recommendedAction, item.whyItMatters, item.financialContext ?? '', ...item.evidence].some((text) => UNSAFE_TEXT.test(text));
    const routeAllowed = ALLOWED_ROUTES.has(item.nextActionRoute) && item.sourceLinks.every((route) => ALLOWED_ROUTES.has(route));
    const blocker: BriefingOutput['primary'][number]['blockerStatus'] = fact.hardBlocker ? 'blocked' : fact.deterministicPriority >= 60 ? 'warning' : 'none';
    const unsupportedFinance = item.financialContext != null && !(fact.type.includes('economic') || fact.type.includes('budget'));
    if (unsafe || !routeAllowed || item.blockerStatus !== blocker || unsupportedFinance) return fallbackItem;
    return { ...item, affectedEntity: fact.relatedEntityId, confidence: fact.confidence, dataFreshness: fact.freshness, sourceLinks: [fact.route], nextActionRoute: fact.route, blockerStatus: blocker };
  };
  const primary = fallback.primary.map((expected, index) => groundItem(model.primary[index], expected) ?? expected);
  const secondary = fallback.secondary.map((expected, index) => groundItem(model.secondary[index], expected) ?? expected);
  return { primary, secondary, seasonEconomicsNote: model.seasonEconomicsNote && !UNSAFE_TEXT.test(model.seasonEconomicsNote) ? model.seasonEconomicsNote : fallback.seasonEconomicsNote };
}

function preservesPriority(model: BriefingOutput, context: DailyFarmContext): boolean {
  const expected = deterministicBriefing(context).primary.map((item) => item.factId);
  const actual = model.primary.map((item) => item.factId);
  return expected.every((id, index) => actual[index] === id) && [...model.primary, ...model.secondary].every((item) => context.facts.some((fact) => fact.id === item.factId));
}

export async function generateGroundedBriefing(context: DailyFarmContext, provider: AIProvider): Promise<{ output: BriefingOutput; mode: 'grounded_ai' | 'rule_based'; fallbackReason?: string }> {
  try {
    const response = await provider.generate(briefingRequest(context));
    const parsed = briefingOutputSchema.parse(response.output);
    if (!preservesPriority(parsed, context)) throw new Error('Model changed deterministic priority or cited an unknown fact.');
    const output = validateAndGroundBriefing(parsed, context);
    return { output, mode: 'grounded_ai' };
  } catch (error) {
    const reason = error instanceof AIProviderUnavailableError ? 'provider_unavailable' : error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'invalid_output';
    return { output: deterministicBriefing(context), mode: 'rule_based', fallbackReason: reason };
  }
}

export function compareBriefingFacts(previous: GroundedFact[], current: GroundedFact[]) {
  const before = new Map(previous.map((fact) => [fact.id, fact]));
  const after = new Map(current.map((fact) => [fact.id, fact]));
  return {
    added: current.filter((fact) => !before.has(fact.id)).map((fact) => fact.id),
    resolved: previous.filter((fact) => !after.has(fact.id)).map((fact) => fact.id),
    changed: current.filter((fact) => before.has(fact.id) && JSON.stringify(before.get(fact.id)?.value) !== JSON.stringify(fact.value)).map((fact) => fact.id),
  };
}
