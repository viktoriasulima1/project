// ─────────────────────────────────────────────────────────────────────────────
// Raw PDOK OGC API Features shapes — confirmed against a real, live request
// during this sprint's research (see docs/BRP_PDOK_Official_Data_Audit.md).
// Unlike the Ctgb integration, this schema IS independently verified, not
// reconstructed from an unreachable reference.
// ─────────────────────────────────────────────────────────────────────────────

export type PdokGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface PdokRawFeatureProperties {
  category?: string;
  gewas?: string;
  gewascode?: number;
  jaar?: number;
  status?: string;
}

export interface PdokRawFeature {
  type: 'Feature';
  geometry: PdokGeometry;
  properties: PdokRawFeatureProperties;
}

export interface PdokRawLink {
  rel: string;
  href: string;
  type?: string;
  title?: string;
}

export interface PdokFeatureCollection {
  type: 'FeatureCollection';
  features: PdokRawFeature[];
  timeStamp?: string;
  numberReturned?: number;
  links?: PdokRawLink[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalized FarmOS domain model.
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedBrpParcel {
  /** BRP Gewaspercelen does not expose a stable per-parcel identifier in
   * the fields actually returned (confirmed live) — always null today.
   * Kept nullable rather than invented, per Sprint 18 Part 4's own
   * principle applied here too. */
  externalParcelId: string | null;
  category: string;
  cropLabel: string;
  cropCode: number | null;
  datasetYear: number;
  status: string;
  geometry: PdokGeometry;
  areaHa: number;
  sourceUrl: string;
  fetchedAt: string;
}

export type PdokSourceState = 'ok' | 'unavailable';

export interface PdokParcelSearchResult {
  state: PdokSourceState;
  parcels: NormalizedBrpParcel[];
  unavailableReason?: string;
  /** Present when the OGC API's own response included a cursor-based
   * "next" link (Sprint 18 Part 9: "handle pagination/cursors") — a bbox
   * search is spatially bounded, so this integration surfaces whether more
   * results exist rather than eagerly following every page. */
  nextCursor?: string;
}
