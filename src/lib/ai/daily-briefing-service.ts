import 'server-only';
import { Prisma, type Farm } from '@prisma/client';
import { db } from '@/lib/db';
import { getClerkUserId } from '@/lib/farm';
import { buildDailyFarmContext } from './daily-context';
import { compareBriefingFacts, contextChecksum, generateGroundedBriefing } from './briefing';
import { briefingOutputSchema, groundedFactSchema, type BriefingOutput, type GroundedFact } from './contracts';
import { configuredAIProvider } from './configured-provider';

const CACHE_MS = 2 * 60 * 60 * 1000;
const COOLDOWN_MS = 2 * 60 * 1000;
const inFlight = new Map<string, Promise<DailyBriefingResult>>();

export interface DailyBriefingResult {
  id: string;
  generatedAt: string;
  mode: 'grounded_ai' | 'rule_based_fallback';
  status: 'current' | 'historical' | 'stale';
  output: BriefingOutput;
  facts: GroundedFact[];
  whatChanged: { added: string[]; resolved: string[]; changed: string[] };
  contextChecksum: string;
  provider: string;
  model: string;
  weatherFreshness: string;
  fallbackReason: string | null;
  reused: boolean;
}

function dateOnly(now: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function fromRecord(record: { id: string; generatedAt: Date; mode: 'grounded_ai' | 'rule_based_fallback'; status: 'current' | 'historical' | 'stale'; topItemsSnapshot: Prisma.JsonValue; secondaryItemsSnapshot: Prisma.JsonValue; factsSnapshot: Prisma.JsonValue; whatChangedSnapshot: Prisma.JsonValue; contextChecksum: string; provider: string; model: string; weatherFreshness: string; fallbackReason: string | null }, reused: boolean): DailyBriefingResult {
  const output = briefingOutputSchema.parse({ primary: record.topItemsSnapshot, secondary: record.secondaryItemsSnapshot, seasonEconomicsNote: null });
  return { id: record.id, generatedAt: record.generatedAt.toISOString(), mode: record.mode, status: record.status, output, facts: Array.isArray(record.factsSnapshot) ? record.factsSnapshot.map((fact) => groundedFactSchema.parse(fact)) : [], whatChanged: record.whatChangedSnapshot as DailyBriefingResult['whatChanged'], contextChecksum: record.contextChecksum, provider: record.provider, model: record.model, weatherFreshness: record.weatherFreshness, fallbackReason: record.fallbackReason, reused };
}

export async function getOrGenerateDailyBriefing(farm: Farm, options: { force?: boolean; now?: Date } = {}): Promise<DailyBriefingResult> {
  const now = options.now ?? new Date();
  const context = await buildDailyFarmContext(farm, now);
  const checksum = contextChecksum(context);
  const key = `${farm.id}:${dateOnly(now, farm.timezone)}:${checksum}:${options.force ? 'force' : 'cache'}`;
  const existingPromise = inFlight.get(key);
  if (existingPromise) return existingPromise;
  const promise = generateAndPersist(farm, context, checksum, now, Boolean(options.force)).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function generateAndPersist(farm: Farm, context: Awaited<ReturnType<typeof buildDailyFarmContext>>, checksum: string, now: Date, force: boolean): Promise<DailyBriefingResult> {
  const generatedForDate = new Date(`${dateOnly(now, farm.timezone)}T00:00:00.000Z`);
  const existing = await db.aiBriefing.findUnique({ where: { farmId_generatedForDate_contextChecksum: { farmId: farm.id, generatedForDate, contextChecksum: checksum } } });
  if (existing && !force && now.getTime() - existing.generatedAt.getTime() <= CACHE_MS) return fromRecord(existing, true);

  const latest = await db.aiBriefing.findFirst({ where: { farmId: farm.id }, orderBy: { generatedAt: 'desc' } });
  if (force && latest && now.getTime() - latest.generatedAt.getTime() < COOLDOWN_MS) return fromRecord(latest, true);
  const dayStart = new Date(generatedForDate); const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [dailyCalls, monthlyCost, recentFailures] = await Promise.all([
    db.aiRequestMetadata.count({ where: { farmId: farm.id, requestType: 'daily_briefing', createdAt: { gte: dayStart, lt: dayEnd }, result: 'success' } }),
    db.aiRequestMetadata.aggregate({ where: { farmId: farm.id, createdAt: { gte: monthStart } }, _sum: { estimatedCostEur: true } }),
    db.aiRequestMetadata.count({ where: { farmId: farm.id, createdAt: { gte: new Date(now.getTime() - 5 * 60_000) }, result: { in: ['timeout', 'provider_unavailable', 'validation_failed'] } } }),
  ]);
  const providerAllowed = dailyCalls < Math.min(Number(process.env.AI_DAILY_BRIEFING_LIMIT ?? 5), 20)
    && Number(monthlyCost._sum.estimatedCostEur ?? 0) < Number(process.env.AI_MONTHLY_COST_LIMIT_EUR ?? 10)
    && recentFailures < 3;
  const provider = providerAllowed ? configuredAIProvider() : { name: 'cost-or-circuit-fallback', async generate(): Promise<never> { throw new Error('Provider policy limit.'); } };
  const started = Date.now();
  const generated = await generateGroundedBriefing(context, provider);
  const durationMs = Date.now() - started;
  const mode = generated.mode === 'grounded_ai' ? 'grounded_ai' : 'rule_based_fallback';
  const priorFacts = latest && Array.isArray(latest.factsSnapshot) ? latest.factsSnapshot.map((fact) => groundedFactSchema.parse(fact)) : [];
  const changes = compareBriefingFacts(priorFacts, context.facts);
  const actor = await getClerkUserId();
  const fallbackReason = providerAllowed ? generated.fallbackReason : dailyCalls >= Number(process.env.AI_DAILY_BRIEFING_LIMIT ?? 5) ? 'daily_limit' : recentFailures >= 3 ? 'circuit_open' : 'monthly_cost_limit';
  try {
    const created = await db.$transaction(async (tx) => {
      await tx.aiBriefing.updateMany({ where: { farmId: farm.id, status: 'current' }, data: { status: 'historical' } });
      const briefing = await tx.aiBriefing.create({ data: {
        farmId: farm.id, generatedForDate, generatedAt: now, mode, contextChecksum: checksum, contextVersion: context.schemaVersion,
        promptVersion: 'daily-briefing-v1', schemaVersion: 'briefing-v1', provider: provider.name, model: process.env.AI_MODEL ?? provider.name,
        sourceDataTimestamp: new Date(context.generatedAt), weatherFreshness: context.facts.some((fact) => fact.type === 'weather' && fact.freshness === 'stale') ? 'stale' : 'current',
        topItemsSnapshot: generated.output.primary as Prisma.InputJsonValue, secondaryItemsSnapshot: generated.output.secondary as Prisma.InputJsonValue,
        whatChangedSnapshot: changes as Prisma.InputJsonValue, factsSnapshot: context.facts as Prisma.InputJsonValue, durationMs, fallbackReason,
      } });
      await tx.aiRequestMetadata.create({ data: {
        farmId: farm.id, briefingId: briefing.id, userReference: actor, requestType: 'daily_briefing', provider: provider.name,
        model: process.env.AI_MODEL ?? provider.name, contextChecksum: checksum, promptVersion: 'daily-briefing-v1', schemaVersion: 'briefing-v1',
        startedAt: new Date(started), completedAt: new Date(), durationMs, result: mode === 'grounded_ai' ? 'success' : fallbackReason === 'provider_unavailable' ? 'provider_unavailable' : 'fallback',
      } });
      return briefing;
    });
    return fromRecord(created, false);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await db.aiBriefing.findUniqueOrThrow({ where: { farmId_generatedForDate_contextChecksum: { farmId: farm.id, generatedForDate, contextChecksum: checksum } } });
      return fromRecord(winner, true);
    }
    throw error;
  }
}

export async function getBriefingHistory(farmId: string, page = 1, pageSize = 10) {
  return db.aiBriefing.findMany({ where: { farmId }, orderBy: { generatedAt: 'desc' }, skip: Math.max(0, page - 1) * pageSize, take: Math.min(pageSize, 25), include: { feedback: true } });
}
