import type { Prisma } from '@prisma/client';
import { recordAuditEvent, newCorrelationId } from '@/lib/audit';
import type { ExportRequestFilters } from './types';

type TxClient = Prisma.TransactionClient;

export interface RecordExportProvenanceInput {
  farmId: string;
  actorUserId: string | null;
  format: 'pdf' | 'csv';
  filters: ExportRequestFilters;
  recordCount: number;
  checksum: string;
}

/**
 * Sprint 19 Part 13 — writes the ComplianceExport provenance row and its
 * `exported` audit event, inside the caller's transaction. Extracted from
 * the export route handler so it can be unit tested directly (Part 17 test
 * 31) without needing to construct a full HTTP Request/Response cycle.
 */
export async function recordComplianceExportProvenance(tx: TxClient, input: RecordExportProvenanceInput): Promise<{ exportId: string }> {
  const exportRow = await tx.complianceExport.create({
    data: {
      farmId: input.farmId,
      requestedByUserId: input.actorUserId,
      format: input.format,
      filtersJson: input.filters as unknown as Prisma.InputJsonValue,
      recordCount: input.recordCount,
      checksum: input.checksum,
      storageReference: null,
      expiresAt: null,
    },
  });

  await recordAuditEvent(tx, {
    farmId: input.farmId,
    actorUserId: input.actorUserId,
    entityType: 'ComplianceExport',
    entityId: exportRow.id,
    action: 'exported',
    source: 'web',
    correlationId: newCorrelationId(),
    metadata: { format: input.format, recordCount: input.recordCount },
  });

  return { exportId: exportRow.id };
}
