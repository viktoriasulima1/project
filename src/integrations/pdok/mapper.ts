import { createHash } from 'node:crypto';
import { validateGeometry, computePolygonAreaHa } from './geometry';
import type { PdokRawFeature, NormalizedBrpParcel } from './types';

export function checksumGeometry(geometry: unknown): string {
  return createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
}

/**
 * Maps one raw PDOK feature into FarmOS's normalized parcel model. This is
 * the ONLY place raw PDOK/Dutch field names (`gewas`, `gewascode`, `jaar`)
 * are read — everything downstream sees only `NormalizedBrpParcel`
 * (Sprint 18 Part 9's architectural requirement, mirroring the Ctgb
 * connector).
 */
export function mapBrpFeature(feature: PdokRawFeature, sourceUrl: string, fetchedAt: Date): NormalizedBrpParcel {
  const geometry = validateGeometry(feature.geometry);
  const areaHa = computePolygonAreaHa(geometry);

  return {
    externalParcelId: null,
    category: feature.properties.category ?? 'unknown',
    cropLabel: feature.properties.gewas ?? 'Unknown',
    cropCode: feature.properties.gewascode ?? null,
    datasetYear: feature.properties.jaar ?? new Date().getFullYear(),
    status: feature.properties.status ?? 'unknown',
    geometry,
    areaHa,
    sourceUrl,
    fetchedAt: fetchedAt.toISOString(),
  };
}
