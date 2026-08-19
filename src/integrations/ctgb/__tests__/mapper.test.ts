import { describe, it, expect } from 'vitest';
import { mapCtgbAuthorisation, checksumRaw } from '../mapper';
import type { CtgbJsonApiResource, CtgbRawAuthorisationAttributes } from '../types';

function resource(attrs: Partial<CtgbRawAuthorisationAttributes>): CtgbJsonApiResource<CtgbRawAuthorisationAttributes> {
  return { type: 'authorisations', id: 'ctgb-1', attributes: attrs };
}

const FULL_ATTRS: CtgbRawAuthorisationAttributes = {
  toelatingsnummer: 'NL-12345',
  middelnaam: 'Amistar Opti',
  status: 'Toegelaten',
  toelatingGeldigVan: '2020-01-01',
  toelatingGeldigTot: '2030-01-01',
  toelatinghouder: 'Syngenta',
  werkzameStoffen: [{ id: 'as-1', naam: 'Azoxystrobin' }],
  gebruiken: [
    {
      gewas: 'Tarwe',
      toepassing: 'Roest',
      doseringMin: 1,
      doseringMax: 2,
      doseringEenheid: 'L',
      bbchVan: 30,
      bbchTot: 69,
      wachttijdDagen: 35,
    },
  ],
};

describe('mapCtgbAuthorisation', () => {
  // Test 1: Official product response mapping
  it('maps a full, well-formed raw response into the normalized shape', () => {
    const result = mapCtgbAuthorisation(resource(FULL_ATTRS), 'https://example.test', new Date('2026-07-13T10:00:00Z'), null);
    expect(result.sourceProductId).toBe('ctgb-1');
    expect(result.authorisationNumber).toBe('NL-12345');
    expect(result.officialName).toBe('Amistar Opti');
    expect(result.authorisationStatus).toBe('authorised');
    expect(result.holder).toBe('Syngenta');
    expect(result.activeSubstances).toEqual([{ id: 'as-1', name: 'Azoxystrobin' }]);
    expect(result.uses).toHaveLength(1);
    expect(result.uses[0].cropOrUseTarget).toBe('Tarwe');
    expect(result.isIncomplete).toBe(false);
  });

  // Test 2: Missing optional fields
  it('handles missing optional fields without throwing, marking the result incomplete', () => {
    const result = mapCtgbAuthorisation(resource({ middelnaam: 'Bare Product' }), 'https://example.test', new Date(), null);
    expect(result.officialName).toBe('Bare Product');
    expect(result.authorisationNumber).toBe('unknown');
    expect(result.authorisationStatus).toBe('unknown');
    expect(result.holder).toBeNull();
    expect(result.activeSubstances).toBeNull();
    expect(result.uses).toEqual([]);
    expect(result.isIncomplete).toBe(true);
  });

  // Test 3: Expired authorisation
  it('maps a Dutch "Vervallen" status to the normalized "expired" status', () => {
    const result = mapCtgbAuthorisation(
      resource({ ...FULL_ATTRS, status: 'Vervallen' }),
      'https://example.test',
      new Date(),
      null,
    );
    expect(result.authorisationStatus).toBe('expired');
  });

  it('maps an unrecognized status string to "unknown", never inventing a guess', () => {
    const result = mapCtgbAuthorisation(
      resource({ ...FULL_ATTRS, status: 'SomeNewStatusCtgbInventedLater' }),
      'https://example.test',
      new Date(),
      null,
    );
    expect(result.authorisationStatus).toBe('unknown');
  });

  // Test 4: Incomplete use data
  it('marks the product incomplete when it has authorisation fields but no uses', () => {
    const result = mapCtgbAuthorisation(
      resource({ ...FULL_ATTRS, gebruiken: [] }),
      'https://example.test',
      new Date(),
      null,
    );
    expect(result.isIncomplete).toBe(true);
    expect(result.uses).toEqual([]);
  });

  it('produces a stable checksum for identical raw input', () => {
    const a = resource(FULL_ATTRS);
    const b = resource(FULL_ATTRS);
    expect(checksumRaw(a)).toBe(checksumRaw(b));
  });

  it('produces a different checksum when the raw input changes', () => {
    const a = resource(FULL_ATTRS);
    const b = resource({ ...FULL_ATTRS, status: 'Vervallen' });
    expect(checksumRaw(a)).not.toBe(checksumRaw(b));
  });

  // Sprint 18 validation-fix regression tests — a real JSON:API response is
  // free to return an explicit `null` for a known field, not just omit it
  // (the raw types and Zod schemas were widened to `| null` to allow this
  // honestly; these tests confirm the mapper actually copes with it rather
  // than just type-checking).

  it('does not crash on an explicit null toelatingsnummer, and marks the result incomplete', () => {
    const result = mapCtgbAuthorisation(
      resource({ ...FULL_ATTRS, toelatingsnummer: null }),
      'https://example.test',
      new Date(),
      null,
    );
    expect(result.authorisationNumber).toBe('unknown');
    expect(result.isIncomplete).toBe(true);
  });

  it('does not crash on an explicit null middelnaam, and marks the result incomplete', () => {
    const result = mapCtgbAuthorisation(
      resource({ ...FULL_ATTRS, middelnaam: null }),
      'https://example.test',
      new Date(),
      null,
    );
    expect(result.officialName).toBe('Unknown product');
    expect(result.isIncomplete).toBe(true);
  });

  it('does not crash on an explicit null status, maps it to "unknown", and marks the result incomplete', () => {
    const result = mapCtgbAuthorisation(
      resource({ ...FULL_ATTRS, status: null }),
      'https://example.test',
      new Date(),
      null,
    );
    expect(result.authorisationStatus).toBe('unknown');
    expect(result.isIncomplete).toBe(true);
  });

  it('does not crash on explicit null authorisation start/end dates', () => {
    const result = mapCtgbAuthorisation(
      resource({ ...FULL_ATTRS, toelatingGeldigVan: null, toelatingGeldigTot: null }),
      'https://example.test',
      new Date(),
      null,
    );
    expect(result.authorisationStart).toBeNull();
    expect(result.authorisationEnd).toBeNull();
    // Dates alone don't drive completeness — a fully-populated authorisation
    // with genuinely no start/end date on record is still complete.
    expect(result.isIncomplete).toBe(false);
  });

  it('does not crash when werkzameStoffen entries have null id/naam, and excludes only the incomplete entries', () => {
    const result = mapCtgbAuthorisation(
      resource({
        ...FULL_ATTRS,
        werkzameStoffen: [{ id: 'as-1', naam: 'Azoxystrobin' }, { id: null, naam: null }, { id: 'as-2', naam: null }],
      }),
      'https://example.test',
      new Date(),
      null,
    );
    expect(result.activeSubstances).toEqual([{ id: 'as-1', name: 'Azoxystrobin' }]);
  });

  it('does not crash when gebruiken itself is explicitly null', () => {
    const result = mapCtgbAuthorisation(
      resource({ ...FULL_ATTRS, gebruiken: null }),
      'https://example.test',
      new Date(),
      null,
    );
    expect(result.uses).toEqual([]);
    expect(result.isIncomplete).toBe(true);
  });

  it('never marks an incomplete product as verified-complete', () => {
    const result = mapCtgbAuthorisation(
      resource({ toelatingsnummer: null, middelnaam: 'Partial Product', status: null, gebruiken: null }),
      'https://example.test',
      new Date(),
      null,
    );
    expect(result.isIncomplete).toBe(true);
  });
});
