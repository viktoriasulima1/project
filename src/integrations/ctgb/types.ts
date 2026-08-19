// ─────────────────────────────────────────────────────────────────────────────
// Raw Ctgb API shapes.
//
// IMPORTANT PROVENANCE NOTE: a live, unauthenticated request to the
// documented base URL (https://public.mst.ctgb.nl/public-api/1.0/) returned
// HTTP 403 during this integration's research (see
// docs/Ctgb_Official_Data_Audit.md). These raw shapes are therefore
// reconstructed from the one official document that was reachable — the
// 2017 "Voorbeelden MST Public API" instruction PDF, which names the
// resource paths and filter parameters but not a field-by-field response
// schema (the fuller Apiary reference it points to is itself unreachable).
// Treat every field below as PROVISIONAL until a real response has been
// seen — see docs/Ctgb_API_Questions.md. Every raw field is optional here
// on purpose: nothing about this shape is confirmed.
// ─────────────────────────────────────────────────────────────────────────────

export interface CtgbJsonApiResource<TAttrs> {
  type: string;
  id: string;
  attributes: TAttrs;
}

export interface CtgbJsonApiCollection<TAttrs> {
  data: CtgbJsonApiResource<TAttrs>[];
  links?: { self?: string; next?: string; prev?: string };
  meta?: { total?: number };
}

export interface CtgbJsonApiSingle<TAttrs> {
  data: CtgbJsonApiResource<TAttrs>;
}

/**
 * Provisional — field names are best-effort Dutch domain terms, not a
 * confirmed live schema (see the provenance note above).
 *
 * Every field is `| null | undefined`, not just optional: a real JSON:API
 * response is free to return an explicit `null` for a field it knows about
 * but has no value for (this is normal JSON:API/JSON behavior, distinct
 * from omitting the key entirely). The Zod schemas in validation.ts use
 * `.nullish()` for exactly this reason — these raw types must honestly
 * match what `.nullish()` actually permits, or the validated output can't
 * be passed to the mapper without an unsafe cast. Never narrow this back
 * to `undefined`-only as a shortcut.
 */
export interface CtgbRawAuthorisationAttributes {
  toelatingsnummer?: string | null;
  middelnaam?: string | null;
  status?: string | null;
  toelatingGeldigVan?: string | null;
  toelatingGeldigTot?: string | null;
  toelatinghouder?: string | null;
  werkzameStoffen?: { id?: string | null; naam?: string | null }[] | null;
  lastModifiedDate?: string | null;
  gebruiken?: CtgbRawUseAttributes[] | null;
}

/** Provisional — same caveat as above; also `| null` on every field for
 * the same reason. */
export interface CtgbRawUseAttributes {
  gewas?: string | null;
  toepassing?: string | null;
  doseringMin?: number | null;
  doseringMax?: number | null;
  doseringEenheid?: string | null;
  maxToepassingenPerSeizoen?: number | null;
  toepassingsintervalDagen?: number | null;
  bbchVan?: number | null;
  bbchTot?: number | null;
  wachttijdDagen?: number | null;
  driftbeperkingMeters?: number | null;
  overigeBeperkingen?: string | null;
  brondocument?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalized FarmOS domain model — this is what the rest of the app is
// allowed to depend on. No Ctgb-specific field name ever leaks past
// mapper.ts (Sprint 18 Part 3's architectural requirement).
// ─────────────────────────────────────────────────────────────────────────────

export type CtgbAuthorisationStatus = 'authorised' | 'expired' | 'withdrawn' | 'suspended' | 'unknown';

export interface NormalizedCtgbUse {
  cropOrUseTarget: string;
  purpose: string | null;
  dosePerHaMin: number | null;
  dosePerHaMax: number | null;
  doseUnit: string | null;
  maxApplicationsPerSeason: number | null;
  applicationIntervalDays: number | null;
  bbchMin: number | null;
  bbchMax: number | null;
  phiDays: number | null;
  bufferZoneMetres: number | null;
  otherRestrictions: string | null;
  sourceDocumentRef: string | null;
}

export interface NormalizedCtgbProduct {
  sourceProductId: string;
  authorisationNumber: string;
  officialName: string;
  authorisationStatus: CtgbAuthorisationStatus;
  authorisationStart: string | null;
  authorisationEnd: string | null;
  holder: string | null;
  activeSubstances: { id: string; name: string }[] | null;
  uses: NormalizedCtgbUse[];
  /** True when the raw record was missing fields this type has room for —
   * surfaced to the UI as "Official data incomplete" (Part 7 vocabulary),
   * never silently treated as "this product has no restrictions." */
  isIncomplete: boolean;
  sourceUrl: string;
  fetchedAt: string;
  sourceVersion: string | null;
  rawChecksum: string;
}

export type CtgbSourceState = 'ok' | 'degraded' | 'unavailable';

export interface CtgbLookupResult {
  state: CtgbSourceState;
  products: NormalizedCtgbProduct[];
  /** Present only when state !== 'ok' — a safe, user-facing summary, never
   * a raw upstream error body. */
  unavailableReason?: string;
}
