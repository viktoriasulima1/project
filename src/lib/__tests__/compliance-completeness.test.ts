import { describe, it, expect } from 'vitest';
import { resolveComplianceCompleteness } from '../compliance-completeness';

const COMPLETE_SPRAY = {
  activityType: 'spray',
  isReversal: false,
  correctionCount: 0,
  effectiveVersion: 1,
  data: {
    fieldName: 'Rijnkamp Noord',
    crop: 'wheat',
    date: '2026-06-01',
    areaHa: 10,
    operatorName: 'Jan de Vries',
    certificateNumber: 'NL-CERT-1',
    machineName: 'Sprayer 1',
    nozzleType: 'flat_fan',
    waterVolumePerHa: 200,
    productName: 'Amistar Opti',
    productRegistrationNumber: 'NL-12345',
    dosePerHa: 2,
    doseUnit: 'L',
    weatherTempC: 18,
    weatherWindKmh: 10,
    weatherHumidity: 60,
    ctgbComplianceStatus: 'verified',
  },
};

describe('resolveComplianceCompleteness', () => {
  // Test 17
  it('finds every missing field for a bare-minimum spray record', () => {
    const result = resolveComplianceCompleteness({
      activityType: 'spray',
      isReversal: false,
      correctionCount: 0,
      effectiveVersion: 1,
      data: { fieldName: 'Rijnkamp Noord', crop: 'wheat', date: '2026-06-01', areaHa: 10 },
    });
    expect(result.status).toBe('incomplete');
    expect(result.missingFields).toEqual(expect.arrayContaining([
      'product', 'dose', 'dose unit', 'operator', 'operator certificate', 'machine', 'nozzle', 'water volume', 'authorisation number', 'weather snapshot',
    ]));
  });

  it('is complete when every field is present and Ctgb-verified', () => {
    const result = resolveComplianceCompleteness(COMPLETE_SPRAY);
    expect(result.status).toBe('complete');
    expect(result.missingFields).toEqual([]);
  });

  // Test 18
  it('reports "corrected" when the chain has at least one correction, even if all fields are present', () => {
    const result = resolveComplianceCompleteness({ ...COMPLETE_SPRAY, correctionCount: 1, effectiveVersion: 2 });
    expect(result.status).toBe('corrected');
    expect(result.correctionCount).toBe(1);
    expect(result.effectiveVersion).toBe(2);
  });

  // Test 19
  it('reports "reversed" and excludes missing-field noise when the record is a reversal', () => {
    const result = resolveComplianceCompleteness({ ...COMPLETE_SPRAY, isReversal: true, data: {} });
    expect(result.status).toBe('reversed');
    expect(result.missingFields).toEqual([]);
    expect(result.warnings[0]).toMatch(/reversed/i);
  });

  it('reports "verification_unavailable" when Ctgb verification could not be checked', () => {
    const result = resolveComplianceCompleteness({ ...COMPLETE_SPRAY, data: { ...COMPLETE_SPRAY.data, ctgbComplianceStatus: 'unavailable' } });
    expect(result.status).toBe('verification_unavailable');
  });

  it('never claims "complete" merely because a manual (unverified) product is attached', () => {
    const result = resolveComplianceCompleteness({ ...COMPLETE_SPRAY, data: { ...COMPLETE_SPRAY.data, ctgbComplianceStatus: 'manual_unverified' } });
    // All fields present, but manual/unverified is still surfaced as a warning — not silently upgraded to "complete" without qualification.
    expect(result.warnings.some((w) => /manually|not verified/i.test(w))).toBe(true);
  });

  it('does not require operator/machine/nozzle for a non-spray activity type', () => {
    const result = resolveComplianceCompleteness({
      activityType: 'harvest',
      isReversal: false,
      correctionCount: 0,
      effectiveVersion: 1,
      data: { fieldName: 'Rijnkamp Noord', crop: 'wheat', date: '2026-09-01', areaHa: 10, weatherTempC: 15 },
    });
    expect(result.missingFields).not.toContain('operator');
    expect(result.missingFields).not.toContain('machine');
    expect(result.missingFields).not.toContain('nozzle');
  });
});
