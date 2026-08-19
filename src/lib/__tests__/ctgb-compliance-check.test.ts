import { describe, it, expect } from 'vitest';
import { checkCtgbCompliance } from '../ctgb-compliance-check';
import type { NormalizedCtgbProduct } from '@/integrations/ctgb/types';

function product(overrides: Partial<NormalizedCtgbProduct> = {}): NormalizedCtgbProduct {
  return {
    sourceProductId: 'ctgb-1',
    authorisationNumber: 'NL-12345',
    officialName: 'Amistar Opti',
    authorisationStatus: 'authorised',
    authorisationStart: null,
    authorisationEnd: null,
    holder: 'Syngenta',
    activeSubstances: null,
    uses: [
      {
        cropOrUseTarget: 'Tarwe',
        purpose: 'Roest',
        dosePerHaMin: 1,
        dosePerHaMax: 2,
        doseUnit: 'L',
        maxApplicationsPerSeason: 2,
        applicationIntervalDays: 14,
        bbchMin: 30,
        bbchMax: 69,
        phiDays: 35,
        bufferZoneMetres: 5,
        otherRestrictions: null,
        sourceDocumentRef: null,
      },
    ],
    isIncomplete: false,
    sourceUrl: 'https://example.test',
    fetchedAt: new Date().toISOString(),
    sourceVersion: null,
    rawChecksum: 'abc',
    ...overrides,
  };
}

describe('checkCtgbCompliance', () => {
  // Test 5: Manual product marked unverified
  it('marks a manually-entered product as manual_unverified, never invents a status', () => {
    const result = checkCtgbCompliance({ isManualEntry: true, product: null });
    expect(result.status).toBe('manual_unverified');
    expect(result.blockers).toEqual([]);
    expect(result.warnings[0]).toContain('not been validated');
  });

  it('returns "expired" when the Ctgb authorisation status is not "authorised"', () => {
    const result = checkCtgbCompliance({ isManualEntry: false, product: product({ authorisationStatus: 'withdrawn' }) });
    expect(result.status).toBe('expired');
    expect(result.blockers[0]).toContain('withdrawn');
  });

  // Test 9: Crop/use mismatch
  it('returns "use_not_found" when the crop does not match any official use', () => {
    const result = checkCtgbCompliance({ isManualEntry: false, product: product(), cropName: 'Aardappelen' });
    expect(result.status).toBe('use_not_found');
    expect(result.matchedUse).toBeNull();
    expect(result.availableUses).toHaveLength(1);
  });

  it('matches a use by crop name (case-insensitive substring)', () => {
    const result = checkCtgbCompliance({ isManualEntry: false, product: product(), cropName: 'Tarwe', dosePerHa: 1.5 });
    expect(result.status).toBe('verified');
    expect(result.matchedUse?.cropOrUseTarget).toBe('Tarwe');
  });

  it('respects an explicit use-index selection over automatic crop matching', () => {
    const twoUseProduct = product({
      uses: [
        { cropOrUseTarget: 'Tarwe', purpose: null, dosePerHaMin: 1, dosePerHaMax: 2, doseUnit: 'L', maxApplicationsPerSeason: null, applicationIntervalDays: null, bbchMin: null, bbchMax: null, phiDays: null, bufferZoneMetres: null, otherRestrictions: null, sourceDocumentRef: null },
        { cropOrUseTarget: 'Gerst', purpose: null, dosePerHaMin: 3, dosePerHaMax: 4, doseUnit: 'L', maxApplicationsPerSeason: null, applicationIntervalDays: null, bbchMin: null, bbchMax: null, phiDays: null, bufferZoneMetres: null, otherRestrictions: null, sourceDocumentRef: null },
      ],
    });
    const result = checkCtgbCompliance({ isManualEntry: false, product: twoUseProduct, cropName: 'Tarwe', selectedUseIndex: 1 });
    expect(result.matchedUse?.cropOrUseTarget).toBe('Gerst');
  });

  it('flags a dose below the official minimum as a blocker', () => {
    const result = checkCtgbCompliance({ isManualEntry: false, product: product(), cropName: 'Tarwe', dosePerHa: 0.5 });
    expect(result.blockers.some((b) => b.includes('below the official minimum'))).toBe(true);
  });

  it('flags a dose above the official maximum as a blocker', () => {
    const result = checkCtgbCompliance({ isManualEntry: false, product: product(), cropName: 'Tarwe', dosePerHa: 5 });
    expect(result.blockers.some((b) => b.includes('exceeds the official maximum'))).toBe(true);
  });

  it('flags a BBCH stage outside the official range as a blocker', () => {
    const result = checkCtgbCompliance({ isManualEntry: false, product: product(), cropName: 'Tarwe', dosePerHa: 1.5, bbchStage: 10 });
    expect(result.blockers.some((b) => b.includes('BBCH stage 10 is below'))).toBe(true);
  });

  it('explicitly disclaims legal approval and guaranteed compliance, rather than staying silent about it', () => {
    const result = checkCtgbCompliance({ isManualEntry: false, product: product(), cropName: 'Tarwe' });
    expect(result.disclaimer.toLowerCase()).toContain('never states that spraying is legally approved');
    expect(result.disclaimer.toLowerCase()).toContain('not a substitute for reading the actual product label');
  });
});
