import { z } from 'zod';
import { CtgbValidationError } from './errors';

// Deliberately permissive — every field optional/nullable, since the raw
// shape itself is provisional (see types.ts). The point of this schema is
// NOT to enforce a known-correct shape (we don't have one yet) but to
// guard against a response that isn't even a plausible JSON:API document —
// oversized strings, wrong types, unexpected nesting — before it reaches
// the mapper. See Sprint 18 Part 16 ("validate all geometry and external
// JSON").

const rawUseSchema = z.object({
  gewas: z.string().max(200).nullish(),
  toepassing: z.string().max(500).nullish(),
  doseringMin: z.number().finite().nullish(),
  doseringMax: z.number().finite().nullish(),
  doseringEenheid: z.string().max(20).nullish(),
  maxToepassingenPerSeizoen: z.number().int().nonnegative().nullish(),
  toepassingsintervalDagen: z.number().int().nonnegative().nullish(),
  bbchVan: z.number().int().min(0).max(99).nullish(),
  bbchTot: z.number().int().min(0).max(99).nullish(),
  wachttijdDagen: z.number().int().nonnegative().nullish(),
  driftbeperkingMeters: z.number().finite().nullish(),
  overigeBeperkingen: z.string().max(2000).nullish(),
  brondocument: z.string().max(500).nullish(),
}).partial();

const rawAuthorisationAttributesSchema = z.object({
  toelatingsnummer: z.string().max(50).nullish(),
  middelnaam: z.string().max(300).nullish(),
  status: z.string().max(50).nullish(),
  toelatingGeldigVan: z.string().max(30).nullish(),
  toelatingGeldigTot: z.string().max(30).nullish(),
  toelatinghouder: z.string().max(300).nullish(),
  werkzameStoffen: z.array(z.object({ id: z.string().max(50).nullish(), naam: z.string().max(200).nullish() })).max(50).nullish(),
  lastModifiedDate: z.string().max(30).nullish(),
  gebruiken: z.array(rawUseSchema).max(500).nullish(),
}).partial();

const rawAuthorisationResourceSchema = z.object({
  type: z.string().max(100),
  id: z.string().max(100),
  attributes: rawAuthorisationAttributesSchema,
});

export const rawAuthorisationSingleSchema = z.object({
  data: rawAuthorisationResourceSchema,
});

export const rawAuthorisationCollectionSchema = z.object({
  data: z.array(rawAuthorisationResourceSchema).max(1000),
  links: z.object({ self: z.string().max(2000).nullish(), next: z.string().max(2000).nullish(), prev: z.string().max(2000).nullish() }).partial().nullish(),
  meta: z.object({ total: z.number().int().nonnegative().nullish() }).partial().nullish(),
});

export function validateRawAuthorisationCollection(raw: unknown) {
  const result = rawAuthorisationCollectionSchema.safeParse(raw);
  if (!result.success) {
    throw new CtgbValidationError(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}

export function validateRawAuthorisationSingle(raw: unknown) {
  const result = rawAuthorisationSingleSchema.safeParse(raw);
  if (!result.success) {
    throw new CtgbValidationError(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}
