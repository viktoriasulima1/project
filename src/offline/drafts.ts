import { offlineRepository } from './db';
import { LOCAL_DRAFT_SCHEMA_VERSION, offlineNamespace, type LocalActivityDraft, type OfflineActivityType, type OfflineRepository } from './types';

export interface DraftIdentity { userRef: string; farmId: string }

export function createLocalDraft(
  identity: DraftIdentity,
  activityType: OfflineActivityType,
  formData: Record<string, string>,
  existing?: LocalActivityDraft,
): LocalActivityDraft {
  const now = new Date().toISOString();
  return {
    localDraftId: existing?.localDraftId ?? crypto.randomUUID(),
    idempotencyKey: existing?.idempotencyKey ?? crypto.randomUUID(),
    schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION,
    namespace: offlineNamespace(identity.userRef, identity.farmId),
    farmId: identity.farmId,
    userRef: identity.userRef,
    activityType,
    status: existing?.status === 'ready_to_sync' ? 'ready_to_sync' : 'draft',
    formData,
    validationErrors: existing?.validationErrors,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    syncAttemptCount: existing?.syncAttemptCount ?? 0,
  };
}

export function createFinanceDraft(identity: DraftIdentity, recordType: 'expense'|'purchase'|'harvest'|'revenue', formData: Record<string,string>, existing?: LocalActivityDraft): LocalActivityDraft {
  return { ...createLocalDraft(identity, 'other', formData, existing), recordType };
}

export function createSplitActivityDrafts(identity: DraftIdentity, candidates: Array<{ activityType: OfflineActivityType; originalTextSpan: string; formData?: Record<string, string> }>): LocalActivityDraft[] {
  const bounded = candidates.slice(0, 5); const groupId = crypto.randomUUID();
  return bounded.map((candidate, index) => ({ ...createLocalDraft(identity, candidate.activityType, candidate.formData ?? {}), aiOriginalText: candidate.originalTextSpan, splitGroupId: groupId, splitIndex: index, splitCount: bounded.length, aiReviewState: 'unreviewed' }));
}

export async function saveLocalDraft(draft: LocalActivityDraft, repository: OfflineRepository = offlineRepository): Promise<void> {
  await repository.putDraft(draft);
}

export function formDataToRecord(form: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === 'string' && value !== '') result[key] = value;
  return result;
}

export function applyDraftToForm(draft: LocalActivityDraft, form: HTMLFormElement): void {
  for (const [name, value] of Object.entries(draft.formData)) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

export function draftAge(updatedAt: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(updatedAt).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
