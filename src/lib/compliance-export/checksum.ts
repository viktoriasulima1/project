import { createHash } from 'node:crypto';
import type { EffectiveComplianceRecord } from '@/lib/compliance-data';

/**
 * Sprint 19 Part 13/17 — deterministic for identical underlying DATA, not
 * for identical output bytes. The rendered PDF/CSV always embeds a fresh
 * export id and generation timestamp (by design — Part 10 requires both),
 * so hashing the final file would make the checksum different on every
 * export even when nothing about the farm's records changed. Hashing a
 * canonical, sorted view of the records themselves is what actually answers
 * "did the underlying compliance data change between these two exports."
 */
export function computeExportChecksum(records: EffectiveComplianceRecord[]): string {
  const canonical = records
    .map((r) => ({
      activityId: r.activityId,
      rootActivityId: r.rootActivityId,
      version: r.version,
      isReversal: r.isReversal,
      correctionCount: r.correctionCount,
      date: r.date.toISOString(),
      data: r.data,
    }))
    .sort((a, b) => a.activityId.localeCompare(b.activityId));

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
