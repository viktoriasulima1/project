import { db } from '@/lib/db';
import type { NormalizedCtgbProduct, NormalizedCtgbUse, CtgbAuthorisationStatus } from './types';

/**
 * How long a cached product is considered fresh enough to skip a re-fetch
 * on an on-demand lookup. Ctgb's own help page claims the live database is
 * "refreshed every minute," but there is no documented reason a single
 * farmer's spray-suitability check needs minute-level freshness — a
 * conservative 24h window balances real staleness risk against not
 * hammering an upstream service with no documented rate limit (see
 * docs/Ctgb_Official_Data_Audit.md). Background sync (Part 8) can refresh
 * more proactively for products actually in use on a farm.
 */
export const CTGB_CACHE_FRESH_HOURS = 24;

export interface CachedCtgbProduct {
  product: NormalizedCtgbProduct;
  ageMinutes: number;
  isStale: boolean;
}

export function normalizeProductRow(row: {
  sourceProductId: string;
  authorisationNumber: string;
  officialName: string;
  authorisationStatus: string;
  authorisationStart: Date | null;
  authorisationEnd: Date | null;
  holder: string | null;
  activeSubstances: unknown;
  sourceUrl: string;
  fetchedAt: Date;
  sourceVersion: string | null;
  rawChecksum: string;
  uses: {
    cropOrUseTarget: string;
    purpose: string | null;
    dosePerHaMin: unknown;
    dosePerHaMax: unknown;
    doseUnit: string | null;
    maxApplicationsPerSeason: number | null;
    applicationIntervalDays: number | null;
    bbchMin: number | null;
    bbchMax: number | null;
    phiDays: number | null;
    bufferZoneMetres: unknown;
    otherRestrictions: string | null;
    sourceDocumentRef: string | null;
  }[];
}): NormalizedCtgbProduct {
  const uses: NormalizedCtgbUse[] = row.uses.map((u) => ({
    cropOrUseTarget: u.cropOrUseTarget,
    purpose: u.purpose,
    dosePerHaMin: u.dosePerHaMin != null ? Number(u.dosePerHaMin) : null,
    dosePerHaMax: u.dosePerHaMax != null ? Number(u.dosePerHaMax) : null,
    doseUnit: u.doseUnit,
    maxApplicationsPerSeason: u.maxApplicationsPerSeason,
    applicationIntervalDays: u.applicationIntervalDays,
    bbchMin: u.bbchMin,
    bbchMax: u.bbchMax,
    phiDays: u.phiDays,
    bufferZoneMetres: u.bufferZoneMetres != null ? Number(u.bufferZoneMetres) : null,
    otherRestrictions: u.otherRestrictions,
    sourceDocumentRef: u.sourceDocumentRef,
  }));

  return {
    sourceProductId: row.sourceProductId,
    authorisationNumber: row.authorisationNumber,
    officialName: row.officialName,
    authorisationStatus: row.authorisationStatus as CtgbAuthorisationStatus,
    authorisationStart: row.authorisationStart ? row.authorisationStart.toISOString() : null,
    authorisationEnd: row.authorisationEnd ? row.authorisationEnd.toISOString() : null,
    holder: row.holder,
    activeSubstances: (row.activeSubstances as { id: string; name: string }[] | null) ?? null,
    uses,
    isIncomplete: uses.length === 0,
    sourceUrl: row.sourceUrl,
    fetchedAt: row.fetchedAt.toISOString(),
    sourceVersion: row.sourceVersion,
    rawChecksum: row.rawChecksum,
  };
}

export async function getCachedProduct(sourceProductId: string, now: Date = new Date()): Promise<CachedCtgbProduct | null> {
  const row = await db.ctgbProductReference.findUnique({
    where: { sourceProductId },
    include: { uses: true },
  });
  if (!row) return null;

  const ageMinutes = Math.round((now.getTime() - row.fetchedAt.getTime()) / 60000);
  return {
    product: normalizeProductRow(row),
    ageMinutes,
    isStale: ageMinutes > CTGB_CACHE_FRESH_HOURS * 60,
  };
}

/** Same as `getCachedProduct`, but keyed by FarmOS's own local id (what
 * `InventoryItem.ctgbProductReferenceId` actually stores) rather than
 * Ctgb's source id. Used by the spray-flow integration (Part 7), which
 * only ever has the local id available via the InventoryItem relation. */
export async function getCachedProductByLocalId(localId: string, now: Date = new Date()): Promise<CachedCtgbProduct | null> {
  const row = await db.ctgbProductReference.findUnique({
    where: { id: localId },
    include: { uses: true },
  });
  if (!row) return null;

  const ageMinutes = Math.round((now.getTime() - row.fetchedAt.getTime()) / 60000);
  return {
    product: normalizeProductRow(row),
    ageMinutes,
    isStale: ageMinutes > CTGB_CACHE_FRESH_HOURS * 60,
  };
}

/** Search cached products by a case-insensitive substring of the official
 * name — used to serve Part 6's product search from cache first. */
export async function searchCachedProducts(query: string, limit = 20): Promise<NormalizedCtgbProduct[]> {
  const rows = await db.ctgbProductReference.findMany({
    where: { officialName: { contains: query, mode: 'insensitive' } },
    include: { uses: true },
    take: limit,
    orderBy: { officialName: 'asc' },
  });
  return rows.map(normalizeProductRow);
}

/** Upserts a freshly-fetched product into the cache. Replaces its use-list
 * wholesale (small lists, simplest correct approach — see Part 8). Does
 * NOT touch any Activity/ComplianceRecord snapshot that already denormalized
 * a previous version of this product — see Part 5. */
export async function upsertCachedProduct(product: NormalizedCtgbProduct): Promise<string> {
  const result = await db.$transaction(async (tx) => {
    const upserted = await tx.ctgbProductReference.upsert({
      where: { sourceProductId: product.sourceProductId },
      create: {
        sourceProductId: product.sourceProductId,
        authorisationNumber: product.authorisationNumber,
        officialName: product.officialName,
        authorisationStatus: product.authorisationStatus,
        authorisationStart: product.authorisationStart ? new Date(product.authorisationStart) : null,
        authorisationEnd: product.authorisationEnd ? new Date(product.authorisationEnd) : null,
        holder: product.holder,
        activeSubstances: product.activeSubstances ?? undefined,
        sourceUrl: product.sourceUrl,
        fetchedAt: new Date(product.fetchedAt),
        sourceVersion: product.sourceVersion,
        rawChecksum: product.rawChecksum,
      },
      update: {
        authorisationNumber: product.authorisationNumber,
        officialName: product.officialName,
        authorisationStatus: product.authorisationStatus,
        authorisationStart: product.authorisationStart ? new Date(product.authorisationStart) : null,
        authorisationEnd: product.authorisationEnd ? new Date(product.authorisationEnd) : null,
        holder: product.holder,
        activeSubstances: product.activeSubstances ?? undefined,
        sourceUrl: product.sourceUrl,
        fetchedAt: new Date(product.fetchedAt),
        sourceVersion: product.sourceVersion,
        rawChecksum: product.rawChecksum,
      },
    });

    await tx.ctgbUseAuthorisation.deleteMany({ where: { productReferenceId: upserted.id } });
    if (product.uses.length > 0) {
      await tx.ctgbUseAuthorisation.createMany({
        data: product.uses.map((u) => ({
          productReferenceId: upserted.id,
          cropOrUseTarget: u.cropOrUseTarget,
          purpose: u.purpose,
          dosePerHaMin: u.dosePerHaMin,
          dosePerHaMax: u.dosePerHaMax,
          doseUnit: u.doseUnit,
          maxApplicationsPerSeason: u.maxApplicationsPerSeason,
          applicationIntervalDays: u.applicationIntervalDays,
          bbchMin: u.bbchMin,
          bbchMax: u.bbchMax,
          phiDays: u.phiDays,
          bufferZoneMetres: u.bufferZoneMetres,
          otherRestrictions: u.otherRestrictions,
          sourceDocumentRef: u.sourceDocumentRef,
        })),
      });
    }

    return upserted.id;
  });

  return result;
}
