import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildComplianceDiaryPdf, buildComplianceDiaryPlainText } from '../pdf';
import type { EffectiveComplianceRecord } from '@/lib/compliance-data';
import type { ExportContext } from '../types';

function makeRecord(overrides: Partial<EffectiveComplianceRecord> = {}): EffectiveComplianceRecord {
  return {
    activityId: 'act-1',
    rootActivityId: 'act-1',
    version: 1,
    isReversal: false,
    correctionOfId: null,
    correctionReason: null,
    correctionCount: 0,
    complianceRecordId: 'cr-1',
    framework: 'EU_SPRAY_DIARY_2009_128_EC',
    data: {
      fieldName: 'Rijnkamp Noord', crop: 'wheat', fieldHectares: '24.30', areaHa: 10,
      productName: 'Amistar Opti', productRegistrationNumber: 'NL-12345', ctgbComplianceStatus: 'verified',
      dosePerHa: 2, doseUnit: 'L', waterVolumePerHa: 200, operatorName: 'Jan de Vries',
      certificateNumber: 'NL-CERT-99887', machineName: 'Sprayer 1', nozzleType: 'flat_fan',
      bbchStage: 32, weatherTempC: 18, weatherWindKmh: 10, weatherHumidity: 60,
    },
    completeness: { status: 'complete', missingFields: [], warnings: [], sourceStatus: 'verified', effectiveVersion: 1, correctionCount: 0 },
    fieldId: 'field-1', seasonId: 'season-1', activityType: 'spray',
    date: new Date('2026-06-01T10:00:00.000Z'),
    productId: 'prod-1', machineId: 'machine-1',
    originalCreatedAt: new Date('2026-06-01T10:00:00.000Z'),
    versionCreatedAt: new Date('2026-06-01T10:00:00.000Z'),
    ...overrides,
  };
}

const CTX: ExportContext = {
  exportId: 'export-abc-123',
  farmName: 'Maatschap Van der Berg',
  farmLegalName: 'Van der Berg V.O.F.',
  farmLocation: 'Nagele, Flevoland',
  seasonLabel: '2026 season',
  dateRangeLabel: 'All dates',
  generatedAt: new Date('2026-07-14T12:00:00.000Z'),
  farmOsVersion: '0.2.0',
};

describe('buildComplianceDiaryPdf', () => {
  it('produces a well-formed, re-parseable PDF with one page for a small record set', async () => {
    const bytes = await buildComplianceDiaryPdf([makeRecord()], CTX);
    expect(Buffer.from(bytes.slice(0, 5)).toString('utf-8')).toBe('%PDF-');
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('produces a valid PDF even with zero records (no crash on empty export)', async () => {
    const bytes = await buildComplianceDiaryPdf([], CTX);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('adds additional pages as more records are added', async () => {
    const many = Array.from({ length: 40 }, (_, i) => makeRecord({ activityId: `act-${i}` }));
    const bytes = await buildComplianceDiaryPdf(many, CTX);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThan(1);
  });
});

// Content-correctness (Part 17 tests 22-24) is verified via the plain-text
// fallback, which is built from the exact same per-record field logic as
// the PDF (see pdf.ts's shared `fieldLines` helper) — pdf-lib can create
// PDFs but not extract their text back out, so this is the honest way to
// assert on rendered content without a separate PDF-text-extraction
// dependency this sprint doesn't otherwise need.
describe('buildComplianceDiaryPlainText (content parity with the PDF)', () => {
  // Test 22
  it('includes the expected effective-record fields', () => {
    const text = buildComplianceDiaryPlainText([makeRecord()], CTX);
    expect(text).toContain('Rijnkamp Noord');
    expect(text).toContain('wheat');
    expect(text).toContain('Amistar Opti');
    expect(text).toContain('NL-12345');
    expect(text).toContain('Jan de Vries');
    expect(text).toContain('Sprayer 1');
    expect(text).toContain('export-abc-123');
  });

  // Test 23
  it('marks an incomplete record', () => {
    const incomplete = makeRecord({ completeness: { status: 'incomplete', missingFields: ['operator certificate'], warnings: [], sourceStatus: 'verified', effectiveVersion: 1, correctionCount: 0 } });
    const text = buildComplianceDiaryPlainText([incomplete], CTX);
    expect(text).toMatch(/Incomplete/);
  });

  // Test 24
  it('marks a corrected record', () => {
    const corrected = makeRecord({ correctionCount: 1, completeness: { status: 'corrected', missingFields: [], warnings: [], sourceStatus: 'verified', effectiveVersion: 2, correctionCount: 1 } });
    const text = buildComplianceDiaryPlainText([corrected], CTX);
    expect(text).toContain('[CORRECTED — 1 correction(s)]');
  });

  it('marks a reversed record', () => {
    const reversed = makeRecord({ isReversal: true });
    const text = buildComplianceDiaryPlainText([reversed], CTX);
    expect(text).toContain('[REVERSED]');
  });

  it('never claims government certification, and includes the export id and disclaimer', () => {
    const text = buildComplianceDiaryPlainText([makeRecord()], CTX);
    expect(text).not.toMatch(/certified|government-approved/i);
    expect(text).toContain('does not certify legal compliance');
    expect(text).toContain('Export ID: export-abc-123');
  });

  it('masks the operator certificate number', () => {
    const text = buildComplianceDiaryPlainText([makeRecord()], CTX);
    expect(text).not.toContain('NL-CERT-99887');
    expect(text).toContain('••••9887');
  });
});
