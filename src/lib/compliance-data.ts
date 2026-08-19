import { db } from '@/lib/db';
import { getEffectiveVersion, countCorrections } from '@/lib/activity-versions';
import { resolveComplianceCompleteness, type ComplianceCompletenessResult } from '@/lib/compliance-completeness';
import type { Prisma } from '@prisma/client';

/**
 * Sprint 19 — the single shared query behind the Compliance page and both
 * export formats (Part 9/10/11), so they can never independently disagree
 * about which version of a record is "effective" or what counts as
 * complete. Mirrors this project's existing "shared resolver" pattern from
 * Sprint 16 (dashboard-shared-resolvers.test.ts).
 *
 * Scale assumption, stated plainly: this groups and filters entire
 * correction chains in application code rather than a windowed SQL query.
 * That is deliberate — a single farm's lifetime spray-activity count is
 * expected to be in the hundreds, not millions, so an in-memory group-by
 * is simpler and no less correct than a recursive/windowed query. Revisit
 * if a farm's activity volume ever makes this a real cost.
 */

export interface ComplianceFilters {
  seasonId?: string;
  dateFrom?: string;
  dateTo?: string;
  fieldId?: string;
  crop?: string;
  productId?: string;
  operatorName?: string;
  /** Default true — only the current effective version of each chain.
   * Setting this to false returns every version (used by the audit-history
   * / correction-chain detail view, and by "include correction history" on
   * export). */
  effectiveOnly?: boolean;
  /** Default false — reversed chains are excluded from totals/exports
   * unless explicitly requested (Part 6, Part 12). */
  includeReversed?: boolean;
  /** Default true — incomplete records are shown/exported but visibly
   * marked, never silently hidden (Part 12's stated default). */
  includeIncomplete?: boolean;
}

export interface EffectiveComplianceRecord {
  activityId: string;
  rootActivityId: string;
  version: number;
  isReversal: boolean;
  correctionOfId: string | null;
  correctionReason: string | null;
  correctionCount: number;
  complianceRecordId: string | null;
  framework: string | null;
  data: Record<string, unknown>;
  completeness: ComplianceCompletenessResult;
  fieldId: string;
  seasonId: string;
  activityType: string;
  date: Date;
  productId: string | null;
  machineId: string | null;
  /** The ORIGINAL (root) record's own createdAt — immutable regardless of
   * how many corrections follow. */
  originalCreatedAt: Date;
  /** This specific version's own createdAt — equal to originalCreatedAt
   * for an uncorrected original; the moment of correction/reversal
   * otherwise. */
  versionCreatedAt: Date;
}

type ActivityWithJoins = Prisma.ActivityGetPayload<{
  include: {
    fieldSeason: { include: { field: true; season: true } };
    complianceRecords: true;
  };
}>;

function toComplianceData(record: ActivityWithJoins): Record<string, unknown> {
  const latest = record.complianceRecords[record.complianceRecords.length - 1];
  return (latest?.data as Record<string, unknown>) ?? {};
}

/** Every spray activity for the farm across every correction chain, with
 * enough joined data to compute completeness and apply filters. Not
 * exported — internal to this module; callers use
 * `getEffectiveComplianceRecords`. */
async function loadAllChainMembers(farmId: string): Promise<ActivityWithJoins[]> {
  return db.activity.findMany({
    where: {
      type: 'spray',
      deletedAt: null,
      fieldSeason: { field: { farmId } },
    },
    include: {
      fieldSeason: { include: { field: true, season: true } },
      complianceRecords: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getEffectiveComplianceRecords(farmId: string, filters: ComplianceFilters = {}): Promise<EffectiveComplianceRecord[]> {
  const all = await loadAllChainMembers(farmId);

  const chains = new Map<string, ActivityWithJoins[]>();
  for (const activity of all) {
    const rootId = activity.rootActivityId ?? activity.id;
    const group = chains.get(rootId) ?? [];
    group.push(activity);
    chains.set(rootId, group);
  }

  const effectiveOnly = filters.effectiveOnly ?? true;
  const includeReversed = filters.includeReversed ?? false;
  const includeIncomplete = filters.includeIncomplete ?? true;

  const results: EffectiveComplianceRecord[] = [];

  for (const [rootId, chain] of chains) {
    const sortedChain = [...chain].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const versionsToEmit = effectiveOnly ? [getEffectiveVersion(sortedChain)] : sortedChain;
    const correctionCount = countCorrections(sortedChain);

    for (const version of versionsToEmit) {
      if (version.isReversal && !includeReversed) continue;

      const data = toComplianceData(version);
      const completeness = resolveComplianceCompleteness({
        activityType: version.type,
        isReversal: version.isReversal,
        correctionCount,
        effectiveVersion: version.version,
        data: {
          fieldName: data.fieldName as string | null,
          crop: data.crop as string | null,
          date: data.date as string | null,
          areaHa: data.areaHa as number | null,
          operatorName: data.operatorName as string | null,
          certificateNumber: data.certificateNumber as string | null,
          machineName: data.machineName as string | null,
          nozzleType: data.nozzleType as string | null,
          waterVolumePerHa: data.waterVolumePerHa as number | null,
          productName: data.productName as string | null,
          productRegistrationNumber: data.productRegistrationNumber as string | null,
          dosePerHa: data.dosePerHa as number | null,
          doseUnit: data.doseUnit as string | null,
          bbchStage: data.bbchStage as number | null,
          weatherTempC: data.weatherTempC as number | null,
          weatherWindKmh: data.weatherWindKmh as number | null,
          weatherHumidity: data.weatherHumidity as number | null,
          ctgbComplianceStatus: data.ctgbComplianceStatus as string | null,
        },
      });

      if (completeness.status === 'incomplete' && !includeIncomplete) continue;

      if (filters.fieldId && version.fieldSeason.fieldId !== filters.fieldId) continue;
      if (filters.seasonId && version.fieldSeason.seasonId !== filters.seasonId) continue;
      if (filters.crop && version.fieldSeason.crop !== filters.crop) continue;
      if (filters.productId && version.productId !== filters.productId) continue;
      if (filters.operatorName && version.operatorName !== filters.operatorName) continue;
      if (filters.dateFrom && version.date < new Date(filters.dateFrom)) continue;
      if (filters.dateTo && version.date > new Date(filters.dateTo)) continue;

      const latestRecord = version.complianceRecords[version.complianceRecords.length - 1];
      results.push({
        activityId: version.id,
        rootActivityId: rootId,
        version: version.version,
        isReversal: version.isReversal,
        correctionOfId: version.correctionOfId,
        correctionReason: version.correctionReason,
        correctionCount,
        complianceRecordId: latestRecord?.id ?? null,
        framework: latestRecord?.framework ?? null,
        data,
        completeness,
        fieldId: version.fieldSeason.fieldId,
        seasonId: version.fieldSeason.seasonId,
        activityType: version.type,
        date: version.date,
        productId: version.productId,
        machineId: version.machineId,
        originalCreatedAt: sortedChain[0].createdAt,
        versionCreatedAt: version.createdAt,
      });
    }
  }

  return results.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** The full version chain for one root activity id, oldest first — used by
 * the Compliance page's per-record "audit history / correction chain"
 * detail view. */
export async function getChainForRoot(farmId: string, rootActivityId: string): Promise<ActivityWithJoins[]> {
  const all = await loadAllChainMembers(farmId);
  return all
    .filter((a) => (a.rootActivityId ?? a.id) === rootActivityId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
