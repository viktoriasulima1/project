import { z } from 'zod';

export const factFreshnessSchema = z.enum(['fresh', 'aging', 'stale', 'unavailable']);
export const factConfidenceSchema = z.enum(['authoritative', 'high', 'medium', 'low']);

export const groundedFactSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  source: z.string().min(1),
  relatedEntityId: z.string().nullable(),
  timestamp: z.string().datetime(),
  freshness: factFreshnessSchema,
  confidence: factConfidenceSchema,
  route: z.string().startsWith('/'),
  hardBlocker: z.boolean().default(false),
  deterministicPriority: z.number().min(0).max(100),
  economicSignal: z.object({
    signalCode: z.string().min(1), actionCode: z.string().min(1), severity: z.enum(['critical', 'high', 'medium', 'low']),
    fieldId: z.string().nullable(), metadata: z.unknown(), evidence: z.array(z.unknown()),
  }).optional(),
});

export type GroundedFact = z.infer<typeof groundedFactSchema>;

export const dailyFarmContextSchema = z.object({
  schemaVersion: z.literal('1'),
  farmId: z.string().min(1),
  timezone: z.string().min(1),
  generatedAt: z.string().datetime(),
  activeSeason: z.object({ id: z.string(), name: z.string() }).nullable(),
  facts: z.array(groundedFactSchema).max(60),
  previousChecksum: z.string().nullable(),
  requestedLocale: z.enum(['nl-NL', 'en-GB', 'pl-PL', 'de-DE']).optional(),
});

export type DailyFarmContext = z.infer<typeof dailyFarmContextSchema>;

export const briefingItemSchema = z.object({
  factId: z.string().min(1),
  title: z.string().min(1).max(140),
  recommendedAction: z.string().min(1).max(240),
  whyItMatters: z.string().min(1).max(500),
  affectedEntity: z.string().nullable(),
  deadline: z.string().nullable(),
  requiredResources: z.array(z.string()).max(8),
  blockerStatus: z.enum(['blocked', 'warning', 'ready', 'none']),
  financialContext: z.string().nullable(),
  evidence: z.array(z.string()).min(1).max(5),
  confidence: factConfidenceSchema,
  dataFreshness: factFreshnessSchema,
  sourceLinks: z.array(z.string().startsWith('/')).min(1).max(5),
  nextActionRoute: z.string().startsWith('/'),
});

export const briefingOutputSchema = z.object({
  primary: z.array(briefingItemSchema).max(3),
  secondary: z.array(briefingItemSchema).max(2),
  seasonEconomicsNote: z.string().max(240).nullable(),
});

export type BriefingOutput = z.infer<typeof briefingOutputSchema>;
export type BriefingMode = 'grounded_ai' | 'rule_based';

export const parsedActivityCandidateSchema = z.object({
  activityType: z.string().nullable(),
  fieldText: z.string().nullable(),
  cropText: z.string().nullable(),
  productText: z.string().nullable(),
  dose: z.number().positive().nullable(),
  doseUnit: z.string().nullable(),
  areaHa: z.number().positive().nullable(),
  occurredAt: z.string().nullable(),
  operatorText: z.string().nullable(),
  machineText: z.string().nullable(),
  waterVolumeLHa: z.number().positive().nullable(),
  notes: z.string().nullable(),
  intent: z.enum(['planned', 'completed', 'unknown']),
  multipleActivities: z.boolean(),
  unsupportedRequest: z.boolean(),
});

export type ParsedActivityCandidate = z.infer<typeof parsedActivityCandidateSchema>;
