import type { Farm } from '@prisma/client';
import { db } from './db';
import { fetchWeather } from './weather';
import { computeSprayWindows, getAmsterdamDateString, type SprayWindowSummary } from './spray-window';
import { getFinanceData } from './finance-data';
import { resolveEconomicsInsights } from './economics-insights';
import { resolveFieldHealthStatus, type FieldHealthResult } from './scouting/field-health';
import type { BudgetVarianceResult } from './economics';
import type { EconomicSignalActionCode, EconomicSignalCode, EconomicSignalEvidence, EconomicSignalMetadata } from './farm-economic-signals';
import { getEconomicSignalRoute } from './farm-economic-signals';

export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface InsightPriorityInputs {
  urgency: number;
  financialImpact: number;
  complianceImpact: number;
  agronomicRisk: number;
  timeSensitivity: number;
  confidence: number;
  actionability: number;
}

export interface InsightPriorityResult {
  severity: InsightSeverity;
  score: number;
  explanation: string;
}

const PRIORITY_WEIGHTS: Record<keyof InsightPriorityInputs, number> = {
  urgency: 0.22,
  complianceImpact: 0.2,
  financialImpact: 0.16,
  agronomicRisk: 0.16,
  timeSensitivity: 0.14,
  confidence: 0.06,
  actionability: 0.06,
};

/**
 * Centralized insight priority resolver (Sprint 16 Part 7). Every insight
 * source below scores itself on these seven 0–10 dimensions instead of
 * hand-assigning a severity label directly, so ranking stays consistent and
 * explainable across very different kinds of insight (a compliance gap and
 * a low-stock warning are not directly comparable except through a shared
 * model like this one).
 */
export function resolveInsightPriority(inputs: InsightPriorityInputs): InsightPriorityResult {
  const score = (Object.keys(PRIORITY_WEIGHTS) as (keyof InsightPriorityInputs)[])
    .reduce((sum, key) => sum + inputs[key] * PRIORITY_WEIGHTS[key], 0);

  let severity: InsightSeverity;
  if (score >= 7.5) severity = 'critical';
  else if (score >= 5.5) severity = 'high';
  else if (score >= 3.5) severity = 'medium';
  else severity = 'low';

  const drivers = (Object.entries(inputs) as [keyof InsightPriorityInputs, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase());

  return {
    severity,
    score: Math.round(score * 10) / 10,
    explanation: `${severity} priority (${score.toFixed(1)}/10) — driven mainly by ${drivers.join(' and ')}.`,
  };
}

export interface FarmInsight {
  id: string;
  title: string;
  explanation: string;
  whyItMatters: string;
  evidence: string;
  confidence: 'low' | 'medium' | 'high';
  relatedModule: string;
  actionLabel: string;
  actionHref: string;
  /** Always 'rule-based' today — there is no real AI/ML model behind any of
   * these. Never rename this to imply otherwise unless a real model is
   * actually wired in. */
  kind: 'rule-based';
  severity: InsightSeverity;
  priorityScore: number;
  priorityExplanation: string;
  budgetVariance?: BudgetVarianceResult;
  affectedCount?: number;
  affected?: string | null;
  signalCode?: EconomicSignalCode;
  actionCode?: EconomicSignalActionCode;
  fieldId?: string | null;
  signalMetadata?: EconomicSignalMetadata;
  signalEvidence?: EconomicSignalEvidence[];
  sprayWindow?: SprayWindowSummary;
}

export interface FarmInsightsResult {
  hasAnySourceData: boolean;
  insights: FarmInsight[];
  aboveTheFold: FarmInsight[];
  rest: FarmInsight[];
  lastCalculatedAt: string;
}

interface RawInsight {
  id: string;
  title: string;
  explanation: string;
  whyItMatters: string;
  evidence: string;
  confidence: 'low' | 'medium' | 'high';
  relatedModule: string;
  actionLabel: string;
  actionHref: string;
  priority: InsightPriorityInputs;
  budgetVariance?: BudgetVarianceResult;
  affectedCount?: number;
  affected?: string | null;
  signalCode?: EconomicSignalCode;
  actionCode?: EconomicSignalActionCode;
  fieldId?: string | null;
  signalMetadata?: EconomicSignalMetadata;
  signalEvidence?: EconomicSignalEvidence[];
  sprayWindow?: SprayWindowSummary;
}

const FALLBACK_LAT = parseFloat(process.env.NEXT_PUBLIC_FARM_LATITUDE ?? '51.9652');
const FALLBACK_LON = parseFloat(process.env.NEXT_PUBLIC_FARM_LONGITUDE ?? '5.9307');

// English grounding text for the AI-briefing / Insights list, derived from the
// canonical Field Health CODES + structured evidence (the resolver no longer
// emits prose — Stage 2B). The Insights surface is English for every insight type
// today; localizing it is separate, documented debt. These Field Health facts are
// now code-derived, not resolver prose, and make no diagnosis or treatment claim.
function fieldHealthInsightExplanation(h: FieldHealthResult): string {
  switch (h.reasonCode) {
    case 'NO_ACTIVE_CROP_SEASON': return 'No active crop season is available.';
    case 'RECENT_SEVERE_OBSERVATION': return `${h.metadata.severeObservationCount} severe unresolved observation(s) require review.`;
    case 'SCOUTING_OVERDUE': return 'A scouting inspection is overdue.';
    case 'WEATHER_RISK_INDICATOR': return 'Current measured conditions may favour crop-health risk; this does not confirm disease.';
    case 'MULTIPLE_OPEN_OBSERVATIONS':
    case 'UNRESOLVED_OBSERVATION': return 'Open evidence or moderate risk should be monitored.';
    case 'NO_SCOUTING_DATA': return 'Crop growth stage and recent scouting evidence are missing.';
    case 'LOW_CONFIDENCE_EVIDENCE': return 'The recorded crop stage is stale.';
    case 'NO_CURRENT_ISSUE': return 'No unresolved issue is present in the current recorded evidence.';
    default: { const _exhaustive: never = h.reasonCode; void _exhaustive; return ''; }
  }
}
function fieldHealthInsightEvidence(h: FieldHealthResult): string {
  return h.evidence.map((e) => {
    switch (e.type) {
      case 'no_active_season': return 'No active field season';
      case 'severe_observations': return `${e.count} severe unresolved observation(s)`;
      case 'overdue_scouting': return `${e.count} overdue scouting order(s)`;
      case 'weather_risk': return 'Explainable weather-risk signal';
      case 'open_observations': return `${e.count} unresolved observation(s)`;
      case 'stage_missing': return 'No current stage record';
      case 'stage_stale': return `Growth-stage record is ${e.daysSinceStage} days old`;
      case 'clean': return 'No unresolved observations';
      default: { const _exhaustive: never = e; void _exhaustive; return ''; }
    }
  }).join('; ');
}

/**
 * Real, deterministic, rule-based insights sourced only from data that
 * actually exists in the database (plus a live weather fetch) — never a
 * general AI chatbot, and never labeled "AI" anywhere in the UI that
 * consumes this. Every insight names its evidence so a farmer can verify it
 * against the underlying module directly.
 */
export async function getFarmInsights(farm: Farm): Promise<FarmInsightsResult> {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [tasks, inventoryItems, complianceItems, employees, activeSeason, unconfirmedRecords, weather, scoutingFields] = await Promise.all([
    db.task.findMany({ where: { farmId: farm.id }, orderBy: { dueDate: 'asc' } }),
    db.inventoryItem.findMany({ where: { farmId: farm.id } }),
    db.complianceItem.findMany({ where: { farmId: farm.id } }),
    db.employee.findMany({ where: { farmId: farm.id, isActive: true, hasSpraying: true } }),
    db.season.findFirst({ where: { farmId: farm.id, isActive: true } }),
    db.complianceRecord.findMany({
      where: { activity: { fieldSeason: { field: { farmId: farm.id } } }, confirmed: false },
      select: { id: true },
    }),
    farm.latitude != null && farm.longitude != null
      ? fetchWeather(Number(farm.latitude), Number(farm.longitude)).catch(() => null)
      : fetchWeather(FALLBACK_LAT, FALLBACK_LON).catch(() => null),
    db.fieldSeason.findMany({where:{field:{farmId:farm.id,deletedAt:null},season:{isActive:true}},include:{field:{select:{id:true,name:true}},cropStageRecords:{where:{isEffective:true},take:1},scoutingVisits:{orderBy:{visitDate:'desc'},take:20,include:{observations:{include:{suggestions:true,followUpWorkOrder:true}}}}}}),
  ]);

  const fieldSeasonsWithoutIssue = activeSeason
    ? await db.fieldSeason.findMany({ where: { seasonId: activeSeason.id }, select: { fieldId: true } })
    : [];
  const assignedFieldIds = new Set(fieldSeasonsWithoutIssue.map((fs) => fs.fieldId));
  const allFields = await db.field.findMany({ where: { farmId: farm.id, deletedAt: null }, select: { id: true, name: true } });
  const unassignedFields = activeSeason ? allFields.filter((f) => !assignedFieldIds.has(f.id)) : [];

  const hasAnySourceData =
    tasks.length > 0 || inventoryItems.length > 0 || complianceItems.length > 0 ||
    employees.length > 0 || allFields.length > 0 || unconfirmedRecords.length > 0;

  const raw: RawInsight[] = [];

  for(const fs of scoutingFields){const observations=fs.scoutingVisits.flatMap(v=>v.observations),health=resolveFieldHealthStatus({hasActiveSeason:true,observations,growthStageObservedAt:fs.cropStageRecords[0]?.observedAt,now}),severe=observations.filter(o=>['open','monitoring','action_planned'].includes(o.status)&&['high','critical'].includes(o.severity)),awaiting=observations.flatMap(o=>o.suggestions).filter(s=>s.status==='awaiting_review');if(health.status==='attention_required'||health.status==='inspect_soon'){raw.push({id:`scouting-health-${fs.id}`,title:`Inspect ${fs.field.name}: ${health.status.replaceAll('_',' ')}`,explanation:fieldHealthInsightExplanation(health),whyItMatters:'Timely inspection turns an unconfirmed symptom or risk signal into verifiable field evidence.',evidence:fieldHealthInsightEvidence(health),confidence:health.confidence,relatedModule:'scouting',actionLabel:'Open scouting',actionHref:`/scouting?field=${fs.field.id}`,priority:{urgency:severe.length?9:6,financialImpact:4,complianceImpact:2,agronomicRisk:severe.length?9:6,timeSensitivity:8,confidence:health.confidence==='high'?9:6,actionability:9}});}if(health.freshness!=='current'){raw.push({id:`stale-stage-${fs.id}`,title:`Update crop stage for ${fs.field.name}`,explanation:fieldHealthInsightExplanation(health),whyItMatters:'Current observed stage improves scouting timing and compliance context.',evidence:fieldHealthInsightEvidence(health),confidence:'high',relatedModule:'scouting',actionLabel:'Record BBCH',actionHref:`/scouting?field=${fs.field.id}`,priority:{urgency:4,financialImpact:2,complianceImpact:4,agronomicRisk:4,timeSensitivity:5,confidence:9,actionability:9}});}if(awaiting.length)raw.push({id:`photo-review-${fs.id}`,title:`${awaiting.length} photo suggestion(s) await review on ${fs.field.name}`,explanation:'Possible explanations remain unconfirmed until explicitly reviewed.',whyItMatters:'Unreviewed suggestions must never be mistaken for diagnosis or treatment authorization.',evidence:`${awaiting.length} PhotoSuggestion record(s) awaiting_review`,confidence:'high',relatedModule:'scouting',actionLabel:'Review evidence',actionHref:`/scouting?field=${fs.field.id}`,priority:{urgency:4,financialImpact:2,complianceImpact:3,agronomicRisk:5,timeSensitivity:4,confidence:9,actionability:8}});}

  // Sprint 25 Part 5 — economics insights, computed from the SAME FinanceData
  // resolver the Finance page and dashboard use, so no calculation is
  // duplicated. resolveEconomicsInsights returns [] when there is no active
  // season, so this is safe for a farm with no economics recorded yet.
  raw.push(...resolveEconomicsInsights(await getFinanceData(farm)).map((signal) => ({
    id: signal.id, title: '', explanation: '', whyItMatters: '', evidence: '', confidence: signal.confidence,
    relatedModule: signal.relatedModule, actionLabel: '', actionHref: getEconomicSignalRoute(signal), priority: signal.priority,
    budgetVariance: signal.budgetVariance, affectedCount: signal.metadata.affectedCount, affected: signal.metadata.affectedFieldNames[0] ?? null,
    signalCode: signal.signalCode, actionCode: signal.actionCode, fieldId: signal.fieldId, signalMetadata: signal.metadata, signalEvidence: signal.evidence,
  })));

  // 1. Overdue tasks
  const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.dueDate < today);
  if (overdueTasks.length > 0) {
    raw.push({
      id: 'overdue-tasks',
      title: `${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''}`,
      explanation: overdueTasks.slice(0, 3).map((t) => `"${t.title}"`).join(', ') + (overdueTasks.length > 3 ? ` +${overdueTasks.length - 3} more` : ''),
      whyItMatters: 'Overdue field work compounds — the longer a task sits open, the more likely the window for it closes.',
      evidence: `${overdueTasks.length} Task record(s) with dueDate before today and status not done`,
      confidence: 'high',
      relatedModule: 'dashboard',
      actionLabel: 'View tasks',
      actionHref: '/dashboard',
      priority: { urgency: 8, financialImpact: 3, complianceImpact: 2, agronomicRisk: 5, timeSensitivity: 8, confidence: 9, actionability: 8 },
    });
  }

  // 2. Upcoming (non-overdue) tasks due soon
  const upcomingTasks = tasks.filter((t) => t.status !== 'done' && t.dueDate >= today && t.dueDate <= in7Days);
  if (upcomingTasks.length > 0) {
    raw.push({
      id: 'upcoming-tasks',
      title: `${upcomingTasks.length} task${upcomingTasks.length !== 1 ? 's' : ''} due within 7 days`,
      explanation: upcomingTasks.slice(0, 3).map((t) => `"${t.title}"`).join(', ') + (upcomingTasks.length > 3 ? ` +${upcomingTasks.length - 3} more` : ''),
      whyItMatters: 'Planning ahead for tasks due this week avoids them becoming overdue.',
      evidence: `${upcomingTasks.length} Task record(s) with dueDate within the next 7 days`,
      confidence: 'high',
      relatedModule: 'dashboard',
      actionLabel: 'View tasks',
      actionHref: '/dashboard',
      priority: { urgency: 4, financialImpact: 2, complianceImpact: 1, agronomicRisk: 3, timeSensitivity: 5, confidence: 9, actionability: 6 },
    });
  }

  // 3. Low stock
  const lowStock = inventoryItems.filter((i) => Number(i.currentStock) < Number(i.minimumStock));
  if (lowStock.length > 0) {
    raw.push({
      id: 'low-stock',
      title: `${lowStock.length} product${lowStock.length !== 1 ? 's' : ''} below minimum stock`,
      explanation: lowStock.map((i) => i.name).join(', '),
      whyItMatters: 'Running out mid-application delays spraying or fertilising and may force an unplanned reorder.',
      evidence: `${lowStock.length} InventoryItem record(s) with currentStock below minimumStock`,
      confidence: 'high',
      relatedModule: 'inventory',
      actionLabel: 'View inventory',
      actionHref: '/inventory',
      priority: { urgency: 6, financialImpact: 5, complianceImpact: 1, agronomicRisk: 5, timeSensitivity: 6, confidence: 9, actionability: 7 },
    });
  }

  // 4. Expiring inventory
  const expiring = inventoryItems.filter((i) => i.expiryDate != null && i.expiryDate >= now && i.expiryDate <= in30Days);
  if (expiring.length > 0) {
    raw.push({
      id: 'expiring-inventory',
      title: `${expiring.length} product${expiring.length !== 1 ? 's' : ''} expiring within 30 days`,
      explanation: expiring.map((i) => `${i.name} (${i.expiryDate!.toLocaleDateString('nl-NL')})`).join(', '),
      whyItMatters: 'Expired crop protection product cannot legally be applied — use or plan disposal before the date passes.',
      evidence: `${expiring.length} InventoryItem record(s) with expiryDate within 30 days`,
      confidence: 'high',
      relatedModule: 'inventory',
      actionLabel: 'View inventory',
      actionHref: '/inventory',
      priority: { urgency: 5, financialImpact: 6, complianceImpact: 4, agronomicRisk: 3, timeSensitivity: 6, confidence: 9, actionability: 6 },
    });
  }

  // 5. Missing product purchase price
  const missingPrice = inventoryItems.filter((i) => i.purchasePricePerUnit == null);
  if (missingPrice.length > 0) {
    raw.push({
      id: 'missing-price',
      title: `${missingPrice.length} product${missingPrice.length !== 1 ? 's' : ''} missing a purchase price`,
      explanation: missingPrice.map((i) => i.name).join(', '),
      whyItMatters: 'Without a purchase price, activities using this product cannot be included in recorded cost totals on the Finance page.',
      evidence: `${missingPrice.length} InventoryItem record(s) with purchasePricePerUnit not set`,
      confidence: 'high',
      relatedModule: 'finance',
      actionLabel: 'View finance',
      actionHref: '/finance',
      priority: { urgency: 2, financialImpact: 6, complianceImpact: 0, agronomicRisk: 0, timeSensitivity: 2, confidence: 9, actionability: 5 },
    });
  }

  // 6. Compliance gaps
  const complianceIssues = complianceItems.filter((c) => c.status === 'missing' || c.status === 'expiring' || c.status === 'expired');
  if (complianceIssues.length > 0) {
    const worst = complianceIssues.find((c) => c.status === 'expired') ?? complianceIssues[0];
    raw.push({
      id: 'compliance-gaps',
      title: `${complianceIssues.length} compliance item${complianceIssues.length !== 1 ? 's' : ''} need attention`,
      explanation: `${worst.title}${worst.dueDate ? ` — due ${worst.dueDate.toLocaleDateString('nl-NL')}` : ''}`,
      whyItMatters: 'Missing or expired compliance records are what an NVWA inspection checks first.',
      evidence: `${complianceIssues.length} ComplianceItem record(s) with status missing/expiring/expired`,
      confidence: 'high',
      relatedModule: 'compliance',
      actionLabel: 'View compliance',
      actionHref: '/compliance',
      priority: {
        urgency: worst.status === 'expired' ? 9 : 6,
        financialImpact: 3,
        complianceImpact: 10,
        agronomicRisk: 1,
        timeSensitivity: worst.status === 'expired' ? 9 : 6,
        confidence: 9,
        actionability: 6,
      },
    });
  }

  // 7. Operator spray certificate expiring/expired
  const certIssues = employees.filter((e) => e.certExpiry != null && e.certExpiry <= in30Days);
  if (certIssues.length > 0) {
    const expired = certIssues.filter((e) => e.certExpiry! < now);
    raw.push({
      id: 'operator-cert-expiry',
      title: `${certIssues.length} operator spuitlicentie ${expired.length > 0 ? 'expired' : 'expiring soon'}`,
      explanation: certIssues.map((e) => `${e.name} (${e.certExpiry!.toLocaleDateString('nl-NL')})`).join(', '),
      whyItMatters: 'An expired spray certificate is a hard blocker in the spray suitability check and a real compliance risk.',
      evidence: `${certIssues.length} Employee record(s) with hasSpraying=true and certExpiry within 30 days`,
      confidence: 'high',
      relatedModule: 'compliance',
      actionLabel: 'View compliance',
      actionHref: '/compliance',
      priority: {
        urgency: expired.length > 0 ? 9 : 5,
        financialImpact: 2,
        complianceImpact: 9,
        agronomicRisk: 4,
        timeSensitivity: expired.length > 0 ? 9 : 5,
        confidence: 8,
        actionability: 5,
      },
    });
  }

  // 8. Fields with no crop assigned this season
  if (unassignedFields.length > 0) {
    raw.push({
      id: 'unassigned-fields',
      title: `${unassignedFields.length} field${unassignedFields.length !== 1 ? 's' : ''} without a crop this season`,
      explanation: unassignedFields.map((f) => f.name).join(', '),
      whyItMatters: 'A field with no crop assignment cannot receive a logged activity — nothing done there this season will be recorded.',
      evidence: `${unassignedFields.length} Field record(s) with no FieldSeason for the active season`,
      confidence: 'high',
      relatedModule: 'activities',
      actionLabel: 'Assign a crop',
      actionHref: '/activities',
      priority: { urgency: 4, financialImpact: 2, complianceImpact: 1, agronomicRisk: 3, timeSensitivity: 3, confidence: 9, actionability: 7 },
    });
  }

  // 9. Unconfirmed spray diary records
  if (unconfirmedRecords.length > 0) {
    raw.push({
      id: 'unconfirmed-compliance-records',
      title: `${unconfirmedRecords.length} spray diary record${unconfirmedRecords.length !== 1 ? 's' : ''} awaiting confirmation`,
      explanation: 'Auto-generated at the time of spraying — review and confirm for a complete audit trail.',
      whyItMatters: 'An unconfirmed record is still retained for compliance, but has not yet been reviewed by anyone on the farm.',
      evidence: `${unconfirmedRecords.length} ComplianceRecord row(s) with confirmed=false`,
      confidence: 'high',
      relatedModule: 'compliance',
      actionLabel: 'View compliance',
      actionHref: '/compliance',
      priority: { urgency: 2, financialImpact: 0, complianceImpact: 4, agronomicRisk: 0, timeSensitivity: 2, confidence: 9, actionability: 4 },
    });
  }

  // 10. Spray window (weather-derived, advisory — same engine, no product/operator context here since this is a farm-wide glance, not a specific planned application)
  if (weather) {
    const todayStr = getAmsterdamDateString();
    const summary = computeSprayWindows(weather.hourly, todayStr, { weatherFetchedAt: weather.fetchedAt });
    if (summary.status !== 'blocked' && summary.isOpenNow) {
      raw.push({
        id: 'spray-window-open',
        title: 'Spray window open now',
        explanation: '',
        whyItMatters: 'Conditions this good do not last — a pending spray task is best logged while the window is open.',
        evidence: 'Live Open-Meteo forecast evaluated by the spray-suitability engine (advisory mode)',
        confidence: summary.confidence,
        relatedModule: 'weather',
        actionLabel: 'View weather',
        actionHref: '/weather',
        sprayWindow: summary,
        priority: { urgency: 5, financialImpact: 2, complianceImpact: 0, agronomicRisk: 3, timeSensitivity: 7, confidence: summary.confidence === 'high' ? 9 : summary.confidence === 'medium' ? 6 : 3, actionability: 6 },
      });
    } else if (summary.status === 'blocked' && summary.hardBlockers.length > 0) {
      raw.push({
        id: 'spray-window-blocked',
        title: 'Spray conditions currently blocked',
        explanation: '',
        whyItMatters: 'Spraying now would violate a hard condition (wind, temperature, or rainfast window) — wait for the next suitable window.',
        evidence: 'Live Open-Meteo forecast evaluated by the spray-suitability engine (advisory mode)',
        confidence: summary.confidence,
        relatedModule: 'weather',
        actionLabel: 'View weather',
        actionHref: '/weather',
        sprayWindow: summary,
        priority: { urgency: 3, financialImpact: 1, complianceImpact: 1, agronomicRisk: 4, timeSensitivity: 4, confidence: summary.confidence === 'high' ? 9 : summary.confidence === 'medium' ? 6 : 3, actionability: 3 },
      });
    }
  }

  const insights: FarmInsight[] = raw.map((r) => {
    const priority = resolveInsightPriority(r.priority);
    return {
      id: r.id,
      title: r.title,
      explanation: r.explanation,
      whyItMatters: r.whyItMatters,
      evidence: r.evidence,
      confidence: r.confidence,
      relatedModule: r.relatedModule,
      actionLabel: r.actionLabel,
      actionHref: r.actionHref,
      kind: 'rule-based' as const,
      severity: priority.severity,
      priorityScore: priority.score,
      priorityExplanation: priority.explanation,
      budgetVariance: r.budgetVariance,
      affectedCount: r.affectedCount,
      affected: r.affected,
      signalCode: r.signalCode,
      actionCode: r.actionCode,
      fieldId: r.fieldId,
      signalMetadata: r.signalMetadata,
      signalEvidence: r.signalEvidence,
      sprayWindow: r.sprayWindow,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);

  // Part 7 — never more than 3 critical/high insights above the fold, to
  // avoid notification fatigue. Everything else (including lower-severity
  // items) goes in a secondary section.
  const topTier = insights.filter((i) => i.severity === 'critical' || i.severity === 'high');
  const aboveTheFold = topTier.slice(0, 3);
  const restIds = new Set(aboveTheFold.map((i) => i.id));
  const rest = insights.filter((i) => !restIds.has(i.id));

  return {
    hasAnySourceData,
    insights,
    aboveTheFold,
    rest,
    lastCalculatedAt: now.toISOString(),
  };
}
