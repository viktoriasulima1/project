import { migrateDraft } from './migrations';
import { LOCAL_DRAFT_SCHEMA_VERSION, type LocalActivityDraft } from './types';
import { userError } from '@/lib/user-error';

export interface OfflineRecoveryExport { format: 'farmos-offline-recovery'; schemaVersion: number; exportedAt: string; drafts: LocalActivityDraft[] }

export function createRecoveryExport(drafts: LocalActivityDraft[], now = new Date()): OfflineRecoveryExport {
  return { format: 'farmos-offline-recovery', schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION, exportedAt: now.toISOString(), drafts };
}

export function parseRecoveryImport(raw: string, namespace: string): LocalActivityDraft[] {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Recovery file is not an object.');
  const file = value as Partial<OfflineRecoveryExport>;
  if (file.format !== 'farmos-offline-recovery' || file.schemaVersion !== LOCAL_DRAFT_SCHEMA_VERSION || !Array.isArray(file.drafts)) throw new Error('Unsupported FarmOS recovery file.');
  if (file.drafts.length > 100) throw new Error('Recovery file contains too many drafts.');
  return file.drafts.map((rawDraft) => {
    const draft = migrateDraft(rawDraft);
    if (draft.namespace !== namespace) throw new Error('Recovery file belongs to another account or farm.');
    return { ...draft, status: 'needs_review' as const, serverActivityId: undefined, syncedAt: undefined, safeErrorCategory: 'schema' as const, safeErrorMessage: undefined, safeError: userError('SYNC_CONFLICT'), updatedAt: new Date().toISOString() };
  });
}

export function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
