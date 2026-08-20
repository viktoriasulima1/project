// ─────────────────────────────────────────────────────────────────────────────
// Raw Copernicus Data Space Ecosystem (Sentinel Hub) Statistical API shapes —
// built from the official documentation (documentation.dataspace.copernicus.eu),
// NOT independently confirmed against a live request: this sandbox's network
// policy blocks identity.dataspace.copernicus.eu and sh.dataspace.copernicus.eu
// (same as it blocks rvo.nl and CTGB's public API). Same honest framing as the
// Ctgb integration — the client below calls the real, documented endpoint, it
// is not a stub, but it has not yet been exercised against a live response.
// ─────────────────────────────────────────────────────────────────────────────

/** Matches PdokGeometry's shape — a Field's `coordinates` column can be
 * either, depending on whether the parcel came in as a single ring or a
 * multi-part BRP geometry. */
export type CopernicusGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface StatisticalApiRequestBody {
  input: {
    bounds: {
      geometry: CopernicusGeometry;
      properties: { crs: string };
    };
    data: Array<{ type: string }>;
  };
  aggregation: {
    timeRange: { from: string; to: string };
    aggregationInterval: { of: string };
    evalscript: string;
    resx: number;
    resy: number;
  };
  calculations: { default: Record<string, never> };
}

export interface StatisticalApiBandStats {
  min: number;
  max: number;
  mean: number;
  stDev: number;
  sampleCount: number;
  noDataCount: number;
}

export interface StatisticalApiInterval {
  interval: { from: string; to: string };
  outputs: {
    ndvi?: { bands: { B0: { stats: StatisticalApiBandStats } } };
  };
}

export interface StatisticalApiResponse {
  data: StatisticalApiInterval[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalized FarmOS domain model.
// ─────────────────────────────────────────────────────────────────────────────

export interface NdviReading {
  periodFrom: string;
  periodTo: string;
  /** Null when the period had no usable (non-cloud-masked) pixels — never
   * a fabricated 0, since 0 is itself a meaningful NDVI value (bare soil). */
  meanNdvi: number | null;
  sampleCount: number;
  /** Share of the area masked out (cloud/no-data) this period, 0–100. Null
   * when it can't be computed (sampleCount and noDataCount both zero). */
  cloudCoveragePct: number | null;
  fetchedAt: string;
}

export type CopernicusSourceState = 'ok' | 'unavailable';

export interface NdviTimeSeriesResult {
  state: CopernicusSourceState;
  readings: NdviReading[];
  unavailableReason?: string;
}
