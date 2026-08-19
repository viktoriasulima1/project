import { createHash } from 'node:crypto';
import type {
  CtgbJsonApiResource,
  CtgbRawAuthorisationAttributes,
  CtgbAuthorisationStatus,
  NormalizedCtgbProduct,
  NormalizedCtgbUse,
} from './types';

const STATUS_MAP: Record<string, CtgbAuthorisationStatus> = {
  toegelaten: 'authorised',
  vervallen: 'expired',
  ingetrokken: 'withdrawn',
  geschorst: 'suspended',
};

function mapStatus(raw: string | null | undefined): CtgbAuthorisationStatus {
  if (!raw) return 'unknown';
  return STATUS_MAP[raw.trim().toLowerCase()] ?? 'unknown';
}

export function checksumRaw(raw: unknown): string {
  return createHash('sha256').update(JSON.stringify(raw)).digest('hex');
}

function mapUse(raw: NonNullable<CtgbRawAuthorisationAttributes['gebruiken']>[number]): NormalizedCtgbUse {
  return {
    cropOrUseTarget: raw.gewas ?? 'Unknown',
    purpose: raw.toepassing ?? null,
    dosePerHaMin: raw.doseringMin ?? null,
    dosePerHaMax: raw.doseringMax ?? null,
    doseUnit: raw.doseringEenheid ?? null,
    maxApplicationsPerSeason: raw.maxToepassingenPerSeizoen ?? null,
    applicationIntervalDays: raw.toepassingsintervalDagen ?? null,
    bbchMin: raw.bbchVan ?? null,
    bbchMax: raw.bbchTot ?? null,
    phiDays: raw.wachttijdDagen ?? null,
    bufferZoneMetres: raw.driftbeperkingMeters ?? null,
    otherRestrictions: raw.overigeBeperkingen ?? null,
    sourceDocumentRef: raw.brondocument ?? null,
  };
}

/**
 * Maps one raw Ctgb JSON:API resource into FarmOS's normalized product
 * model. This is the ONLY place raw Ctgb field names are read — everything
 * downstream (domain code, UI) sees only `NormalizedCtgbProduct`.
 *
 * `isIncomplete` is set whenever a field FarmOS actually cares about is
 * missing from the raw record — never silently defaulted to "no
 * restriction." See Sprint 18 Part 4.
 */
export function mapCtgbAuthorisation(
  resource: CtgbJsonApiResource<CtgbRawAuthorisationAttributes>,
  sourceUrl: string,
  fetchedAt: Date,
  sourceVersion: string | null,
): NormalizedCtgbProduct {
  const a = resource.attributes;
  const uses = (a.gebruiken ?? []).map(mapUse);

  const isIncomplete =
    !a.toelatingsnummer ||
    !a.middelnaam ||
    !a.status ||
    uses.length === 0;

  return {
    sourceProductId: resource.id,
    authorisationNumber: a.toelatingsnummer ?? 'unknown',
    officialName: a.middelnaam ?? 'Unknown product',
    authorisationStatus: mapStatus(a.status),
    authorisationStart: a.toelatingGeldigVan ?? null,
    authorisationEnd: a.toelatingGeldigTot ?? null,
    holder: a.toelatinghouder ?? null,
    activeSubstances: a.werkzameStoffen
      ? a.werkzameStoffen
          .filter((s): s is { id: string; naam: string } => !!s.id && !!s.naam)
          .map((s) => ({ id: s.id, name: s.naam }))
      : null,
    uses,
    isIncomplete,
    sourceUrl,
    fetchedAt: fetchedAt.toISOString(),
    sourceVersion,
    rawChecksum: checksumRaw(resource),
  };
}
