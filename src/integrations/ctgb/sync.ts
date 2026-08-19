import { db } from '@/lib/db';
import { getCtgbProductById } from './client';
import type { CtgbSourceState } from './types';

export interface CtgbSyncReportEntry {
  sourceProductId: string;
  officialName: string;
  previousChecksum: string;
  newChecksum: string | null;
  changed: boolean;
  authorisationStatusChanged: boolean;
  previousStatus: string;
  newStatus: string | null;
  /** Count of historical ComplianceRecord rows that denormalized this
   * product at the time of use — a nonzero count alongside
   * `authorisationStatusChanged` is exactly the "explicit review
   * mechanism" Sprint 18 Part 5 requires: those records are NEVER
   * rewritten by this sync, but a human should look at them. */
  referencedByComplianceRecords: number;
  state: CtgbSourceState;
}

export interface CtgbSyncReport {
  runAt: string;
  productsChecked: number;
  productsChanged: number;
  productsUnavailable: number;
  entries: CtgbSyncReportEntry[];
}

/**
 * Refreshes only products actually referenced by at least one farm's
 * inventory — deliberately not a full-database bulk copy (Sprint 18 Part
 * 8: "no full-database bulk copy unless official terms permit it," and no
 * such permission has been confirmed — see docs/Ctgb_API_Questions.md).
 */
export async function syncProductsInUse(): Promise<CtgbSyncReport> {
  const referenced = await db.ctgbProductReference.findMany({
    where: { inventoryItems: { some: {} } },
    select: { sourceProductId: true, officialName: true, authorisationStatus: true, rawChecksum: true },
  });

  const entries: CtgbSyncReportEntry[] = [];
  for (const ref of referenced) {
    const result = await getCtgbProductById(ref.sourceProductId);
    const fresh = result.products[0];

    if (!fresh) {
      entries.push({
        sourceProductId: ref.sourceProductId,
        officialName: ref.officialName,
        previousChecksum: ref.rawChecksum,
        newChecksum: null,
        changed: false,
        authorisationStatusChanged: false,
        previousStatus: ref.authorisationStatus,
        newStatus: null,
        referencedByComplianceRecords: 0,
        state: result.state,
      });
      continue;
    }

    const changed = fresh.rawChecksum !== ref.rawChecksum;
    const authorisationStatusChanged = fresh.authorisationStatus !== ref.authorisationStatus;

    let referencedByComplianceRecords = 0;
    if (authorisationStatusChanged) {
      referencedByComplianceRecords = await db.complianceRecord.count({
        where: {
          data: { path: ['productRegistrationNumber'], equals: fresh.authorisationNumber },
        },
      });
    }

    entries.push({
      sourceProductId: ref.sourceProductId,
      officialName: fresh.officialName,
      previousChecksum: ref.rawChecksum,
      newChecksum: fresh.rawChecksum,
      changed,
      authorisationStatusChanged,
      previousStatus: ref.authorisationStatus,
      newStatus: fresh.authorisationStatus,
      referencedByComplianceRecords,
      state: result.state,
    });
  }

  return {
    runAt: new Date().toISOString(),
    productsChecked: referenced.length,
    productsChanged: entries.filter((e) => e.changed).length,
    productsUnavailable: entries.filter((e) => e.state === 'unavailable').length,
    entries,
  };
}
