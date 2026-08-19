import { describe, it, expect } from 'vitest';
import { computeExportChecksum } from '../checksum';
import type { EffectiveComplianceRecord } from '@/lib/compliance-data';

function makeRecord(overrides: Partial<EffectiveComplianceRecord> = {}): EffectiveComplianceRecord {
  return {
    activityId: 'act-1', rootActivityId: 'act-1', version: 1, isReversal: false, correctionOfId: null,
    correctionReason: null, correctionCount: 0, complianceRecordId: 'cr-1', framework: 'EU_SPRAY_DIARY_2009_128_EC',
    data: { fieldName: 'Rijnkamp Noord', areaHa: 10 },
    completeness: { status: 'complete', missingFields: [], warnings: [], sourceStatus: 'verified', effectiveVersion: 1, correctionCount: 0 },
    fieldId: 'field-1', seasonId: 'season-1', activityType: 'spray', date: new Date('2026-06-01T10:00:00.000Z'),
    productId: 'prod-1', machineId: 'machine-1',
    originalCreatedAt: new Date('2026-06-01T10:00:00.000Z'), versionCreatedAt: new Date('2026-06-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('computeExportChecksum (Part 17 test 32)', () => {
  it('is deterministic for identical underlying records, computed at two different times', () => {
    const a = computeExportChecksum([makeRecord()]);
    const b = computeExportChecksum([makeRecord()]);
    expect(a).toBe(b);
  });

  it('is order-independent — the same set of records checksums the same regardless of array order', () => {
    const r1 = makeRecord({ activityId: 'act-1' });
    const r2 = makeRecord({ activityId: 'act-2' });
    expect(computeExportChecksum([r1, r2])).toBe(computeExportChecksum([r2, r1]));
  });

  it('changes when a record\'s data actually changes', () => {
    const a = computeExportChecksum([makeRecord()]);
    const b = computeExportChecksum([makeRecord({ data: { fieldName: 'Rijnkamp Noord', areaHa: 12 } })]);
    expect(a).not.toBe(b);
  });

  it('changes when the record set itself changes', () => {
    const a = computeExportChecksum([makeRecord()]);
    const b = computeExportChecksum([makeRecord(), makeRecord({ activityId: 'act-2' })]);
    expect(a).not.toBe(b);
  });

  it('produces a hex-encoded SHA-256 (64 hex characters)', () => {
    const checksum = computeExportChecksum([makeRecord()]);
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});
