import { offlineRepository } from './db';
import { backoffDelay } from './network';
import type { LocalActivityDraft, OfflineRepository } from './types';

export const MAX_SYNC_ATTEMPTS = 6;

export async function enqueueDraft(draft: LocalActivityDraft, repository: OfflineRepository = offlineRepository): Promise<LocalActivityDraft> {
  const queued = { ...draft, status: 'ready_to_sync' as const, updatedAt: new Date().toISOString(), safeErrorCategory: undefined, safeErrorMessage: undefined, safeError: undefined };
  await repository.putDraft(queued);
  return queued;
}

export function canAttempt(draft: LocalActivityDraft, now = Date.now()): boolean {
  if (draft.status !== 'ready_to_sync' && draft.status !== 'failed') return false;
  if (draft.syncAttemptCount >= MAX_SYNC_ATTEMPTS) return false;
  return !draft.nextSyncAttemptAt || new Date(draft.nextSyncAttemptAt).getTime() <= now;
}

export function scheduleRetry(draft: LocalActivityDraft, now = Date.now()): LocalActivityDraft {
  const attempts = draft.syncAttemptCount + 1;
  return {
    ...draft,
    status: attempts >= MAX_SYNC_ATTEMPTS ? 'failed' : 'ready_to_sync',
    syncAttemptCount: attempts,
    lastSyncAttemptAt: new Date(now).toISOString(),
    nextSyncAttemptAt: new Date(now + backoffDelay(attempts)).toISOString(),
  };
}
