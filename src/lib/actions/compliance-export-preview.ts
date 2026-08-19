'use server';

import { getActiveFarmOrThrow } from '@/lib/farm';
import { gatherExportRecords } from '@/lib/compliance-export/data';
import type { ExportRequestFilters } from '@/lib/compliance-export/types';

/** Part 12 — "Show record count before export." Read-only, no
 * ComplianceExport row and no audit event — only an actual export request
 * (the route handler) counts as an export. */
export async function previewExportCount(filters: ExportRequestFilters): Promise<{ count: number; error?: string }> {
  let farm;
  try {
    farm = await getActiveFarmOrThrow();
  } catch {
    return { count: 0, error: 'Farm not found.' };
  }
  const records = await gatherExportRecords(farm.id, filters);
  return { count: records.length };
}
