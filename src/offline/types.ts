import type { UserFacingError } from '@/lib/user-error';

export const LOCAL_DRAFT_SCHEMA_VERSION = 1;

export type DraftStatus =
  | 'draft'
  | 'ready_to_sync'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'failed'
  | 'cancelled'
  | 'needs_review';

export type OfflineActivityType =
  | 'spray' | 'fertilise' | 'harvest' | 'tillage' | 'sow'
  | 'irrigate' | 'scout' | 'soil_sample' | 'other';

export type SafeErrorCategory =
  | 'network' | 'timeout' | 'authorization' | 'validation'
  | 'conflict' | 'insufficient_stock' | 'stale_reference'
  | 'schema' | 'server' | 'unknown';

export interface ConflictMetadata {
  category: SafeErrorCategory;
  message: string;
  field?: string;
  offlineValue?: string | number | null;
  serverValue?: string | number | null;
}

export interface LocalActivityDraft {
  localDraftId: string;
  schemaVersion: number;
  namespace: string;
  farmId: string;
  userRef: string;
  activityType: OfflineActivityType;
  recordType?: 'activity' | 'expense' | 'purchase' | 'harvest' | 'revenue';
  status: DraftStatus;
  formData: Record<string, string>;
  validationErrors?: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
  lastSyncAttemptAt?: string;
  nextSyncAttemptAt?: string;
  syncAttemptCount: number;
  idempotencyKey: string;
  serverActivityId?: string;
  serverRecordId?: string;
  safeErrorCategory?: SafeErrorCategory;
  safeErrorMessage?: string;
  safeError?: UserFacingError;
  conflictMetadata?: ConflictMetadata;
  syncedAt?: string;
  aiOriginalText?: string;
  splitGroupId?: string;
  splitIndex?: number;
  splitCount?: number;
  aiReviewState?: 'unreviewed' | 'reviewing' | 'reviewed';
}

export interface SyncReceipt {
  localDraftId: string;
  namespace: string;
  serverActivityId: string;
  syncedAt: string;
  idempotencyKey: string;
}

export interface OfflineRepository {
  putDraft(draft: LocalActivityDraft): Promise<void>;
  getDraft(localDraftId: string): Promise<LocalActivityDraft | null>;
  listDrafts(namespace: string): Promise<LocalActivityDraft[]>;
  deleteDraft(localDraftId: string): Promise<void>;
  putReceipt(receipt: SyncReceipt): Promise<void>;
  listReceipts(namespace: string): Promise<SyncReceipt[]>;
  clearSynced(namespace: string): Promise<void>;
  clearNamespace(namespace: string): Promise<void>;
  estimateUsage(namespace: string): Promise<number>;
}

export function offlineNamespace(userRef: string, farmId: string): string {
  return `${userRef}:${farmId}`;
}
