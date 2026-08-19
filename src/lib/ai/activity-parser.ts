import type { ParsedActivityCandidate } from './contracts';

export type MatchConfidence = 'exact_match' | 'high_confidence' | 'ambiguous' | 'unresolved';
export interface EntityOption { id: string; name: string; aliases?: string[] }
export interface ResolvedEntity { confidence: MatchConfidence; id: string | null; options: EntityOption[]; input: string | null }

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const normalizedNumber = (value: string) => Number(value.replace(',', '.'));

/** Deterministic test/fallback parser. It extracts candidates only and never IDs. */
export function parseActivityTextDeterministically(text: string): ParsedActivityCandidate {
  // Preserve `text` as notes, but remove bidi/control characters from the
  // interpretation surface so invisible instructions cannot alter matching.
  const clean = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, ' ').trim();
  const lower = clean.toLocaleLowerCase('nl-NL');
  const dose = new RegExp(String.raw`${NUMBER}\s*(?:l|litres?|liters?)\s*(?:\/|per)\s*(?:ha|hectares?)`, 'i').exec(clean);
  const area = new RegExp(String.raw`${NUMBER}\s*(?:ha|hectares?)`, 'i').exec(clean);
  const water = new RegExp(String.raw`${NUMBER}\s*(?:l|litres?|liters?)\s*(?:water|water volume)?\s*(?:\/|per)\s*(?:ha|hectares?)`, 'i').exec(clean);
  const sprayed = /\b(?:sprayed|spray|gespoten|spoot)\b/i.test(clean);
  const harvested = /\b(?:harvested|harvest|geoogst|oogstte)\b/i.test(clean);
  const fertilised = /\b(?:fertilised|fertilized|bemest)\b/i.test(clean);
  const fieldMatch = /(?:field|perceel)\s+([\p{L}\d][\p{L}\d _-]*?)(?=\s+(?:with|met|at|op|using|vanmorgen|this|gisteren|yesterday)|[,.]|$)/iu.exec(clean);
  const productMatch = /(?:with|met)\s+([\p{L}\d][\p{L}\d _-]*?)(?=\s+at\s+\d|\s+met\s+\d|\s+using|[,.]|$)/iu.exec(clean);
  const machineMatch = /(?:using|met)\s+([\p{L}][\p{L}\d _-]*?)(?=[,.]|$)/iu.exec(clean);
  const multipleActivities = /(?:\band then\b|\bthen\b|\bdaarna\b|;)/i.test(clean);
  return {
    activityType: sprayed ? 'spray' : harvested ? 'harvest' : fertilised ? 'fertilise' : null,
    fieldText: fieldMatch?.[1]?.trim() ?? null,
    cropText: null,
    productText: productMatch?.[1]?.trim() ?? null,
    dose: dose ? normalizedNumber(dose[1]) : null,
    doseUnit: dose ? 'L/ha' : null,
    areaHa: area ? normalizedNumber(area[1]) : null,
    occurredAt: /\b(?:this morning|vanmorgen)\b/i.test(clean) ? 'this_morning' : /\b(?:yesterday|gisteren)\b/i.test(clean) ? 'yesterday' : null,
    operatorText: null,
    machineText: machineMatch?.[1]?.trim() ?? null,
    waterVolumeLHa: water ? normalizedNumber(water[1]) : null,
    notes: text.trim() || null,
    intent: /\b(?:sprayed|harvested|fertilised|fertilized|gespoten|geoogst|bemest)\b/i.test(lower) ? 'completed' : /\b(?:plan|planned|planning|van plan)\b/i.test(lower) ? 'planned' : 'unknown',
    multipleActivities,
    unsupportedRequest: !sprayed && !harvested && !fertilised,
  };
}

function normalize(value: string) {
  return value.toLocaleLowerCase('nl-NL').normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
}

/** Resolution is farm-scoped because callers supply only active-farm options. */
export function resolveEntity(input: string | null, options: EntityOption[]): ResolvedEntity {
  if (!input) return { confidence: 'unresolved', id: null, options: [], input };
  const needle = normalize(input);
  const exact = options.filter((option) => [option.name, ...(option.aliases ?? [])].some((name) => normalize(name) === needle));
  if (exact.length === 1) return { confidence: 'exact_match', id: exact[0].id, options: exact, input };
  if (exact.length > 1) return { confidence: 'ambiguous', id: null, options: exact, input };
  const partial = options.filter((option) => [option.name, ...(option.aliases ?? [])].some((name) => normalize(name).includes(needle) || needle.includes(normalize(name))));
  if (partial.length === 1) return { confidence: 'high_confidence', id: partial[0].id, options: partial, input };
  if (partial.length > 1) return { confidence: 'ambiguous', id: null, options: partial, input };
  return { confidence: 'unresolved', id: null, options: [], input };
}

export function doseConflict(input: { parsedDose: number | null; officialMaximum: number | null }) {
  if (input.parsedDose == null || input.officialMaximum == null || input.parsedDose <= input.officialMaximum) return null;
  return `You said ${input.parsedDose} L/ha. The selected official use allows up to ${input.officialMaximum} L/ha. Review the dose before continuing.`;
}
