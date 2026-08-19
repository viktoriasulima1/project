import type { OfflineActivityType, SafeErrorCategory } from './types';

export type OfflineEventName = 'offline_detected' | 'draft_saved_locally' | 'sync_started' | 'sync_succeeded' | 'sync_failed' | 'sync_conflict' | 'draft_discarded' | 'connectivity_restored';

export interface OfflineEvent {
  event: OfflineEventName;
  farmId?: string;
  userRef?: string;
  localDraftId?: string;
  activityType?: OfflineActivityType;
  attemptCount?: number;
  errorCategory?: SafeErrorCategory;
  durationMs?: number;
}

export function logOfflineEvent(event: OfflineEvent): void {
  // Deliberately no raw form data, notes, names, certificates or tokens.
  // eslint-disable-next-line no-console
  console.info('[offline-event]', JSON.stringify({ ...event, timestamp: new Date().toISOString() }));
}
