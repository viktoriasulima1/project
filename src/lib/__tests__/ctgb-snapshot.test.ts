import { describe, it, expect } from 'vitest';
import { buildCtgbSnapshotExtra, type CtgbProductReferenceRowForSnapshot } from '../ctgb-snapshot';

const CTGB_ROW: CtgbProductReferenceRowForSnapshot = {
  id: 'ref-1',
  sourceProductId: 'src-1',
  authorisationNumber: 'NL-12345',
  officialName: 'Amistar Opti',
  authorisationStatus: 'authorised',
  authorisationStart: new Date('2020-01-01'),
  authorisationEnd: new Date('2030-01-01'),
  holder: 'Syngenta',
  activeSubstances: null,
  sourceUrl: 'https://public.mst.ctgb.nl/public-api/1.0/authorisations/1',
  fetchedAt: new Date('2026-06-01T00:00:00.000Z'),
  sourceVersion: 'v1',
  rawChecksum: 'abc123',
  uses: [
    { cropOrUseTarget: 'Tarwe', purpose: 'Roest', dosePerHaMin: 1, dosePerHaMax: 3, doseUnit: 'L', maxApplicationsPerSeason: 2, applicationIntervalDays: 14, bbchMin: 30, bbchMax: 69, phiDays: 35, bufferZoneMetres: 5, otherRestrictions: null, sourceDocumentRef: null },
  ],
};

describe('buildCtgbSnapshotExtra', () => {
  it('is honestly manual_unverified with no selected use when there is no linked Ctgb product', () => {
    const result = buildCtgbSnapshotExtra(null, 'wheat', 2, 'L');
    expect(result.ctgbComplianceStatus).toBe('manual_unverified');
    expect(result.ctgbSelectedUse).toBeNull();
    expect(result.ctgbSourceProductId).toBeNull();
  });

  // Test 20 (historical snapshot remains unchanged): a pure function called
  // twice with the identical inputs must produce identical output — nothing
  // here reads or depends on mutable global state that could make the SAME
  // historical inputs produce a different snapshot later.
  it('is pure — identical inputs always produce an identical snapshot', () => {
    const a = buildCtgbSnapshotExtra(CTGB_ROW, 'Tarwe', 2, 'L');
    const b = buildCtgbSnapshotExtra(CTGB_ROW, 'Tarwe', 2, 'L');
    expect(a).toEqual(b);
  });

  it('matches the official use by crop name and reports the dose/BBCH constraints checked', () => {
    const result = buildCtgbSnapshotExtra(CTGB_ROW, 'Tarwe', 2, 'L');
    expect(result.ctgbComplianceStatus).toBe('verified');
    expect(result.ctgbSelectedUse).toEqual(
      expect.objectContaining({ cropOrUseTarget: 'Tarwe', dosePerHaMin: 1, dosePerHaMax: 3, bbchMin: 30, bbchMax: 69 }),
    );
    expect(result.ctgbSourceProductId).toBe('src-1');
    expect(result.ctgbSourceVersion).toBe('v1');
    expect(result.ctgbRawChecksum).toBe('abc123');
  });

  // Test 21: given a DIFFERENT product reference (as a correction would
  // supply when the product itself was wrong), the snapshot reflects that
  // new product, never the old one — proven simply by passing a different
  // row and observing the output changes accordingly.
  it('reflects whichever product reference is passed in, not a cached prior one', () => {
    const otherProduct: CtgbProductReferenceRowForSnapshot = { ...CTGB_ROW, sourceProductId: 'src-2', officialName: 'Different Product', uses: [] };
    const result = buildCtgbSnapshotExtra(otherProduct, 'Tarwe', 2, 'L');
    expect(result.ctgbSourceProductId).toBe('src-2');
    expect(result.ctgbSelectedUse).toBeNull(); // no uses at all on this product, so none can match
    expect(result.ctgbComplianceStatus).toBe('use_not_found');
  });

  it('does not match an unrelated crop name, and honestly reports use_not_found', () => {
    const result = buildCtgbSnapshotExtra(CTGB_ROW, 'potato', 2, 'L');
    expect(result.ctgbComplianceStatus).toBe('use_not_found');
    expect(result.ctgbSelectedUse).toBeNull();
  });
});
