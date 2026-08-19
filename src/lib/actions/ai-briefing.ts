'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { getOrGenerateDailyBriefing } from '@/lib/ai/daily-briefing-service';

export async function refreshDailyBriefing() {
  const farm = await getActiveFarmOrThrow();
  const result = await getOrGenerateDailyBriefing(farm, { force: true });
  revalidatePath('/dashboard'); revalidatePath('/ai');
  return { success: true, id: result.id };
}

const feedbackSchema = z.object({
  briefingId: z.string().uuid(), itemId: z.string().min(1).max(160),
  feedbackType: z.enum(['helpful', 'not_useful', 'incorrect', 'already_knew']),
  reason: z.enum(['wrong_priority', 'wrong_explanation', 'stale_data', 'wrong_field', 'missing_context', 'other']).optional(),
  comment: z.string().trim().max(500).optional(),
});

export async function submitBriefingFeedback(input: z.input<typeof feedbackSchema>) {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid feedback.' };
  const farm = await getActiveFarmOrThrow(); const actor = await getClerkUserId() ?? farm.clerkUserId;
  const briefing = await db.aiBriefing.findFirst({ where: { id: parsed.data.briefingId, farmId: farm.id } });
  if (!briefing) return { error: 'Briefing not found.' };
  const itemIds = [...(briefing.topItemsSnapshot as Array<{ factId?: string }>), ...(briefing.secondaryItemsSnapshot as Array<{ factId?: string }>)].map((item) => item.factId);
  if (!itemIds.includes(parsed.data.itemId)) return { error: 'Briefing item not found.' };
  await db.aiBriefingFeedback.upsert({
    where: { briefingId_itemId_actorUserId: { briefingId: briefing.id, itemId: parsed.data.itemId, actorUserId: actor } },
    create: { farmId: farm.id, briefingId: briefing.id, itemId: parsed.data.itemId, feedbackType: parsed.data.feedbackType, reason: parsed.data.feedbackType === 'incorrect' ? parsed.data.reason : undefined, comment: parsed.data.comment, actorUserId: actor, contextChecksum: briefing.contextChecksum, promptVersion: briefing.promptVersion, model: briefing.model },
    update: { feedbackType: parsed.data.feedbackType, reason: parsed.data.feedbackType === 'incorrect' ? parsed.data.reason : null, comment: parsed.data.comment },
  });
  revalidatePath('/ai'); return { success: true };
}
