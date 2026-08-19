import { db } from '@/lib/db';
import { getEffectiveComplianceRecords, type EffectiveComplianceRecord } from '@/lib/compliance-data';
import type { ExportRequestFilters, ExportContext } from './types';
import { FARMOS_VERSION } from './types';
import { randomUUID } from 'node:crypto';

/**
 * Sprint 19 Part 10/11/13 — the one place both export formats gather their
 * rows, reusing the exact same `getEffectiveComplianceRecords` the
 * Compliance page itself reads (Sprint 19's "shared resolver" rule) so an
 * export can never show different facts than the page it was generated
 * from.
 */
export async function gatherExportRecords(farmId: string, filters: ExportRequestFilters): Promise<EffectiveComplianceRecord[]> {
  const records = await getEffectiveComplianceRecords(farmId, {
    seasonId: filters.seasonId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    effectiveOnly: filters.effectiveOnly,
    includeReversed: filters.includeReversed,
    includeIncomplete: filters.includeIncomplete,
  });

  return records.filter((r) => {
    if (filters.fieldIds && filters.fieldIds.length > 0 && !filters.fieldIds.includes(r.fieldId)) return false;
    if (filters.crops && filters.crops.length > 0) {
      const crop = (r.data as { crop?: string }).crop;
      if (!crop || !filters.crops.includes(crop)) return false;
    }
    if (filters.productIds && filters.productIds.length > 0) {
      if (!r.productId || !filters.productIds.includes(r.productId)) return false;
    }
    return true;
  });
}

export async function buildExportContext(farmId: string, filters: ExportRequestFilters): Promise<ExportContext> {
  const farm = await db.farm.findUniqueOrThrow({ where: { id: farmId } });

  let seasonLabel = 'All seasons';
  if (filters.seasonId) {
    const season = await db.season.findUnique({ where: { id: filters.seasonId } });
    if (season) seasonLabel = `${season.year} season`;
  }

  const dateRangeLabel = filters.dateFrom || filters.dateTo
    ? `${filters.dateFrom ?? 'earliest'} to ${filters.dateTo ?? 'latest'}`
    : 'All dates';

  return {
    exportId: randomUUID(),
    farmName: farm.name,
    farmLegalName: farm.legalName,
    farmLocation: farm.location,
    seasonLabel,
    dateRangeLabel,
    generatedAt: new Date(),
    farmOsVersion: FARMOS_VERSION,
  };
}
