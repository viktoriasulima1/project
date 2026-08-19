import { describe, it, expect } from 'vitest';
import { buildComplianceCsv, escapeCsvValue, CSV_COLUMNS } from '../csv';
import type { EffectiveComplianceRecord } from '@/lib/compliance-data';
import type { ExportContext } from '../types';

function makeRecord(overrides: Partial<EffectiveComplianceRecord> = {}): EffectiveComplianceRecord {
  return {
    activityId: 'act-1', rootActivityId: 'act-1', version: 1, isReversal: false, correctionOfId: null,
    correctionReason: null, correctionCount: 0, complianceRecordId: 'cr-1', framework: 'EU_SPRAY_DIARY_2009_128_EC',
    data: {
      fieldName: 'Rijnkamp Noord', crop: 'wheat', fieldHectares: '24.30', areaHa: 10.5,
      productName: 'Amistar Opti', productRegistrationNumber: 'NL-12345', ctgbComplianceStatus: 'verified',
      ctgbSelectedUse: { cropOrUseTarget: 'Tarwe' }, dosePerHa: 2.25, doseUnit: 'L', waterVolumePerHa: 200,
      operatorName: 'Jan de Vries', machineName: 'Sprayer 1', nozzleType: 'flat_fan', bbchStage: 32,
      weatherTempC: 18.5, weatherWindKmh: 10, weatherHumidity: 60,
    },
    completeness: { status: 'complete', missingFields: [], warnings: [], sourceStatus: 'verified', effectiveVersion: 1, correctionCount: 0 },
    fieldId: 'field-1', seasonId: 'season-1', activityType: 'spray', date: new Date('2026-06-01T10:00:00.000Z'),
    productId: 'prod-1', machineId: 'machine-1',
    originalCreatedAt: new Date('2026-06-01T10:00:00.000Z'), versionCreatedAt: new Date('2026-06-01T10:00:00.000Z'),
    ...overrides,
  };
}

const CTX: ExportContext = {
  exportId: 'export-abc-123', farmName: 'Test Farm', farmLegalName: null, farmLocation: 'Nagele',
  seasonLabel: '2026 season', dateRangeLabel: 'All dates', generatedAt: new Date('2026-07-14T12:00:00.000Z'), farmOsVersion: '0.2.0',
};

describe('escapeCsvValue (Part 11/17 test 28 — formula injection)', () => {
  it('prefixes values starting with =, +, -, or @ with a single quote', () => {
    expect(escapeCsvValue('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(escapeCsvValue('+1234')).toBe("'+1234");
    expect(escapeCsvValue('-1234')).toBe("'-1234");
    expect(escapeCsvValue('@cmd')).toBe("'@cmd");
  });

  it('does not alter an ordinary value', () => {
    expect(escapeCsvValue('Jan de Vries')).toBe('Jan de Vries');
    expect(escapeCsvValue(10.5)).toBe('10.5');
  });

  it('quotes a value containing a comma or double quote', () => {
    expect(escapeCsvValue('Field, North')).toBe('"Field, North"');
    expect(escapeCsvValue('12" spray boom')).toBe('"12"" spray boom"');
  });

  it('renders null/undefined as an empty string', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });
});

describe('buildComplianceCsv', () => {
  // Test 26
  it('has stable, exact column names in the header row', () => {
    const csv = buildComplianceCsv([], CTX);
    const headerLine = csv.replace(/^﻿/, '').split('\r\n')[0];
    expect(headerLine.split(',')).toEqual([...CSV_COLUMNS]);
  });

  it('starts with a UTF-8 BOM for Dutch Excel compatibility', () => {
    const csv = buildComplianceCsv([], CTX);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  // Test 27
  it('renders decimals with a "." separator, never a locale-dependent ","', () => {
    const csv = buildComplianceCsv([makeRecord()], CTX);
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('10.5'); // treated area
    expect(dataLine).toContain('2.25'); // dose
    expect(dataLine).not.toMatch(/10,5|2,25/);
  });

  it('escapes a formula-like farmer-entered operator name', () => {
    const csv = buildComplianceCsv([makeRecord({ data: { ...makeRecord().data, operatorName: '=cmd|/c calc' } })], CTX);
    expect(csv).toContain("'=cmd|/c calc");
  });

  it('includes one row per record, with export/record/correction identifiers', () => {
    const csv = buildComplianceCsv([makeRecord(), makeRecord({ activityId: 'act-2', rootActivityId: 'act-2' })], CTX);
    const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toContain('export-abc-123');
    expect(lines[1]).toContain('act-1');
  });

  it('leaves corrected_at empty for an uncorrected original, and populated for a correction', () => {
    const original = makeRecord();
    const corrected = makeRecord({ correctionCount: 1, versionCreatedAt: new Date('2026-06-05T00:00:00.000Z') });
    const csv = buildComplianceCsv([original, corrected], CTX);
    const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
    const originalCorrectedAtCol = lines[1].split(',')[CSV_COLUMNS.indexOf('corrected_at')];
    const correctedCorrectedAtCol = lines[2].split(',')[CSV_COLUMNS.indexOf('corrected_at')];
    expect(originalCorrectedAtCol).toBe('');
    expect(correctedCorrectedAtCol).toContain('2026-06-05');
  });

  it('does not include a certificate number column at all (no cert number in CSV by design)', () => {
    expect(CSV_COLUMNS as readonly string[]).not.toContain('certificate_number');
  });
});
