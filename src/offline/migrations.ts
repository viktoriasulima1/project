import { LOCAL_DRAFT_SCHEMA_VERSION, type LocalActivityDraft } from './types';
import { userError } from '@/lib/user-error';

export function migrateDraft(value: unknown): LocalActivityDraft {
  if (!value || typeof value !== 'object') throw new Error('Corrupt local draft.');
  const draft = value as Partial<LocalActivityDraft>;
  if (typeof draft.schemaVersion !== 'number') throw new Error('Local draft has no schema version.');
  if (draft.schemaVersion > LOCAL_DRAFT_SCHEMA_VERSION) throw new Error('Local draft was created by a newer FarmOS version.');

  // Version 1 is the first production format. Keep this switch explicit so
  // future upgrades cannot accidentally treat an old payload as current.
  if (draft.schemaVersion !== 1) throw new Error('Unsupported local draft schema.');
  if (!draft.localDraftId || !draft.namespace || !draft.farmId || !draft.userRef || !draft.idempotencyKey) {
    throw new Error('Local draft is missing required identity fields.');
  }
  if (!draft.formData || typeof draft.formData !== 'object') throw new Error('Local draft payload is corrupt.');
  return draft as LocalActivityDraft;
}

export function markUnmigratableDraft(value: unknown, _legacyMessage?: string): LocalActivityDraft | null {
  if (!value || typeof value !== 'object') return null;
  const draft = value as Partial<LocalActivityDraft>;
  if (!draft.localDraftId || !draft.namespace || !draft.farmId || !draft.userRef || !draft.idempotencyKey) return null;
  return {
    ...(draft as LocalActivityDraft),
    schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION,
    status: 'needs_review',
    safeErrorCategory: 'schema',
    safeErrorMessage: undefined,
    safeError: userError('SYNC_CONFLICT'),
    formData: draft.formData && typeof draft.formData === 'object' ? draft.formData : {},
  };
}
