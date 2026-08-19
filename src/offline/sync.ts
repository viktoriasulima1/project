import { markConflict, requiresReview } from './conflict';
import { offlineRepository } from './db';
import { classifySyncResponse, OfflineSyncError } from './errors';
import { logOfflineEvent } from './observability';
import { canAttempt, scheduleRetry } from './queue';
import type { LocalActivityDraft, OfflineRepository } from './types';
import { userError, type UserFacingError } from '@/lib/user-error';

export interface SyncIdentity { userRef: string; farmId: string; namespace: string }

export async function synchronizeDraft(
  draft: LocalActivityDraft,
  identity: SyncIdentity,
  repository: OfflineRepository = offlineRepository,
  fetcher: typeof fetch = fetch,
): Promise<LocalActivityDraft> {
  if (draft.userRef !== identity.userRef || draft.farmId !== identity.farmId || draft.namespace !== identity.namespace) {
    const conflict = markConflict(draft, 'authorization', userError('NOT_FOUND'));
    await repository.putDraft(conflict);
    return conflict;
  }

  const started = Date.now();
  const syncing = { ...draft, status: 'syncing' as const, lastSyncAttemptAt: new Date().toISOString() };
  await repository.putDraft(syncing);
  logOfflineEvent({ event: 'sync_started', farmId: draft.farmId, userRef: draft.userRef, localDraftId: draft.localDraftId, activityType: draft.activityType, attemptCount: draft.syncAttemptCount + 1 });

  try {
    const financeDraft = draft.recordType && draft.recordType !== 'activity';
    const response = await fetcher(financeDraft ? '/api/offline/finance-sync' : '/api/offline/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recordType: draft.recordType,
        formData: {
          ...draft.formData,
          localDraftId: draft.localDraftId,
          idempotencyKey: draft.idempotencyKey,
        },
      }),
    });
    const body = await response.json().catch(() => ({})) as { success?: boolean; activityId?: string; recordId?: string; error?: unknown; category?: LocalActivityDraft['safeErrorCategory'] };
    const serverId = body.activityId ?? body.recordId;
    if (!response.ok || !body.success || !serverId) throw classifySyncResponse(response.status, body);

    const syncedAt = new Date().toISOString();
    const synced: LocalActivityDraft = {
      ...draft,
      status: 'synced',
      formData: {}, // detailed business payload is removed immediately after confirmation
      serverActivityId: financeDraft ? undefined : serverId,
      serverRecordId: financeDraft ? serverId : undefined,
      syncedAt,
      updatedAt: syncedAt,
      syncAttemptCount: draft.syncAttemptCount + 1,
      safeErrorCategory: undefined,
      safeErrorMessage: undefined,
      safeError: undefined,
    };
    await repository.putReceipt({ localDraftId: draft.localDraftId, namespace: draft.namespace, serverActivityId: serverId, syncedAt, idempotencyKey: draft.idempotencyKey });
    await repository.putDraft(synced);
    logOfflineEvent({ event: 'sync_succeeded', farmId: draft.farmId, userRef: draft.userRef, localDraftId: draft.localDraftId, activityType: draft.activityType, attemptCount: synced.syncAttemptCount, durationMs: Date.now() - started });
    return synced;
  } catch (error) {
    const syncError = error instanceof OfflineSyncError ? error : new OfflineSyncError('Offline synchronization failed.', 'network', true, userError('GENERIC'));
    const failed = requiresReview(syncError.category)
      ? markConflict(draft, syncError.category, syncError.safeError)
      : { ...scheduleRetry(draft), safeErrorCategory: syncError.category, safeErrorMessage: undefined, safeError: syncError.safeError };
    await repository.putDraft(failed);
    logOfflineEvent({ event: failed.status === 'conflict' ? 'sync_conflict' : 'sync_failed', farmId: draft.farmId, userRef: draft.userRef, localDraftId: draft.localDraftId, activityType: draft.activityType, attemptCount: failed.syncAttemptCount, errorCategory: syncError.category, durationMs: Date.now() - started });
    return failed;
  }
}

export async function processQueue(identity: SyncIdentity, repository: OfflineRepository = offlineRepository, fetcher: typeof fetch = fetch): Promise<LocalActivityDraft[]> {
  const drafts = await repository.listDrafts(identity.namespace);
  const results: LocalActivityDraft[] = [];
  for (const draft of drafts.filter((item) => canAttempt(item))) {
    const result = await synchronizeDraft(draft, identity, repository, fetcher);
    results.push(result);
    if (result.status === 'ready_to_sync' || result.status === 'failed') break; // connection/server failure: wait for backoff
  }
  return results;
}
