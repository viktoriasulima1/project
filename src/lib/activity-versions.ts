import type { Prisma, PrismaClient, Activity } from '@prisma/client';

type AnyClient = PrismaClient | Prisma.TransactionClient;

/** The id every member of a correction chain shares — the original record's
 * own id, whether or not it has ever been corrected. */
export function getRootId(activity: Pick<Activity, 'id' | 'rootActivityId'>): string {
  return activity.rootActivityId ?? activity.id;
}

/** Every version of one activity's correction chain (the original plus any
 * corrections/reversals), oldest first. A never-corrected activity's chain
 * is just itself. */
export async function getVersionChain(client: AnyClient, rootId: string): Promise<Activity[]> {
  return client.activity.findMany({
    where: { OR: [{ id: rootId }, { rootActivityId: rootId }] },
    orderBy: { createdAt: 'asc' },
  });
}

/** The chain member nothing else corrects — the record that should be
 * treated as authoritative today. Corrections are strictly append-only and
 * sequential (Sprint 19 Part 3), so "latest by createdAt" is unambiguous. */
export function getEffectiveVersion<T extends { createdAt: Date }>(chain: T[]): T {
  if (chain.length === 0) {
    throw new Error('getEffectiveVersion: chain must contain at least one version.');
  }
  return chain.reduce((latest, candidate) => (candidate.createdAt > latest.createdAt ? candidate : latest));
}

export function isEffectiveVersion(activity: { id: string; createdAt: Date }, chain: { id: string; createdAt: Date }[]): boolean {
  return getEffectiveVersion(chain).id === activity.id;
}

/** How many corrections (excluding the original itself) exist in the chain
 * — a reversal counts as a correction for this purpose (Part 8's
 * `correctionCount`). */
export function countCorrections(chain: { correctionOfId: string | null }[]): number {
  return chain.filter((a) => a.correctionOfId !== null).length;
}

export type ActivityVersionLabel = 'original' | 'corrected' | 'reversed' | 'current';

/** Labels required by Part 3's UI rule: "The UI must distinguish: Original,
 * Corrected, Reversed, Current effective record." A single record can carry
 * more than one label (e.g. a once-corrected original is both "Original"
 * and no longer current; the latest non-reversal correction is both
 * "Corrected" and "Current"). */
export function labelVersion(activity: Pick<Activity, 'id' | 'createdAt' | 'correctionOfId' | 'isReversal'>, chain: Activity[]): ActivityVersionLabel[] {
  const labels: ActivityVersionLabel[] = [];
  if (activity.correctionOfId === null) labels.push('original');
  else labels.push(activity.isReversal ? 'reversed' : 'corrected');
  if (isEffectiveVersion(activity, chain)) labels.push('current');
  return labels;
}
