import 'server-only';
import type { Farm } from '@prisma/client';
import { db } from '@/lib/db';
import { getFarmInsights } from '@/lib/farm-insights';
import type { DailyFarmContext, GroundedFact } from './contracts';
import { getServerLocale } from '@/i18n/server';

function freshness(timestamp: Date, now: Date): GroundedFact['freshness'] {
  const hours = (now.getTime() - timestamp.getTime()) / 3_600_000;
  return hours <= 6 ? 'fresh' : hours <= 24 ? 'aging' : 'stale';
}

/** Builds a bounded, farm-scoped fact snapshot; never returns full DB rows. */
export async function buildDailyFarmContext(farm: Farm, now = new Date()): Promise<DailyFarmContext> {
  const [season, insights, recentActivities, requestedLocale] = await Promise.all([
    db.season.findFirst({ where: { farmId: farm.id, isActive: true }, select: { id: true, name: true } }),
    getFarmInsights(farm),
    db.activity.findMany({
      where: { fieldSeason: { field: { farmId: farm.id } }, status: 'completed', deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, type: true, createdAt: true, fieldSeason: { select: { field: { select: { name: true } } } } },
    }),
    getServerLocale(),
  ]);
  const insightFacts: GroundedFact[] = insights.insights.slice(0, 40).map((insight) => ({
    id: `insight:${insight.id}`, type: insight.signalCode ? 'economic_signal' : insight.relatedModule, value: insight.signalCode ?? insight.title,
    source: insight.signalCode ? 'EconomicSignal' : `OperationalPriority:${insight.evidence}`, relatedEntityId: insight.fieldId ?? null, timestamp: insights.lastCalculatedAt,
    freshness: insight.confidence === 'low' ? 'aging' : 'fresh',
    confidence: insight.confidence === 'high' ? 'high' : insight.confidence === 'medium' ? 'medium' : 'low',
    route: insight.actionHref, hardBlocker: insight.severity === 'critical', deterministicPriority: insight.priorityScore,
    economicSignal: insight.signalCode && insight.actionCode && insight.signalMetadata && insight.signalEvidence ? {
      signalCode: insight.signalCode, actionCode: insight.actionCode, severity: insight.severity, fieldId: insight.fieldId ?? null,
      metadata: insight.signalMetadata, evidence: insight.signalEvidence,
    } : undefined,
  }));
  const activityFacts: GroundedFact[] = recentActivities.map((activity) => ({
    id: `activity:${activity.id}`, type: 'recent_completed_activity', value: `${activity.type} completed on ${activity.fieldSeason.field.name}`,
    source: 'Activity', relatedEntityId: activity.id, timestamp: activity.createdAt.toISOString(), freshness: freshness(activity.createdAt, now),
    confidence: 'authoritative', route: '/activities', hardBlocker: false, deterministicPriority: 5,
  }));
  return { schemaVersion: '1', farmId: farm.id, timezone: farm.timezone || 'Europe/Amsterdam', generatedAt: now.toISOString(), activeSeason: season ? { id: season.id, name: season.name ?? 'Unnamed season' } : null, facts: [...insightFacts, ...activityFacts].slice(0, 60), previousChecksum: null, requestedLocale };
}
