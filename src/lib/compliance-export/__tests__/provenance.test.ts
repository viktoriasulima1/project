import { describe, it, expect, vi } from 'vitest';
import { recordComplianceExportProvenance } from '../provenance';
import { DEFAULT_EXPORT_FILTERS } from '../types';

function makeTx() {
  return {
    complianceExport: { create: vi.fn().mockResolvedValue({ id: 'export-row-1' }) },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
}

describe('recordComplianceExportProvenance (Part 17 test 31)', () => {
  it('creates a ComplianceExport row and an `exported` audit event referencing it', async () => {
    const tx = makeTx();
    const result = await recordComplianceExportProvenance(tx as never, {
      farmId: 'farm-1', actorUserId: 'user-1', format: 'pdf', filters: DEFAULT_EXPORT_FILTERS, recordCount: 5, checksum: 'abc123',
    });

    expect(tx.complianceExport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ farmId: 'farm-1', format: 'pdf', recordCount: 5, checksum: 'abc123', storageReference: null }) }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ farmId: 'farm-1', entityType: 'ComplianceExport', entityId: 'export-row-1', action: 'exported' }) }),
    );
    expect(result.exportId).toBe('export-row-1');
  });

  it('never stores a storage reference (files are not persisted this sprint)', async () => {
    const tx = makeTx();
    await recordComplianceExportProvenance(tx as never, {
      farmId: 'farm-1', actorUserId: null, format: 'csv', filters: DEFAULT_EXPORT_FILTERS, recordCount: 0, checksum: 'x',
    });
    expect(tx.complianceExport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ storageReference: null, expiresAt: null }) }),
    );
  });
});
