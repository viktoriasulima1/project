import type { ConnectivityState } from './network';
import type { OfflineStorageDiagnostics } from './storage';
import type { LocalActivityDraft } from './types';

export interface SupportDiagnostics {
  generatedAt: string;
  deviceSessionId: string;
  appVersion: string;
  serviceWorkerVersion: string;
  localSchemaVersion: number;
  connectivity: ConnectivityState;
  userAgent: string;
  storage: OfflineStorageDiagnostics | null;
  draftCount: number;
  queueCount: number;
  lastSuccessfulSync: string | null;
}

export function deviceSessionId(): string {
  const key = 'farmos-device-session-id';
  let value = sessionStorage.getItem(key);
  if (!value) { value = crypto.randomUUID(); sessionStorage.setItem(key, value); }
  return value;
}

export function createSupportDiagnostics(input: { drafts: LocalActivityDraft[]; connectivity: ConnectivityState; storage: OfflineStorageDiagnostics | null; serviceWorkerVersion: string }): SupportDiagnostics {
  return {
    generatedAt: new Date().toISOString(), deviceSessionId: deviceSessionId(), appVersion: '0.2.0', serviceWorkerVersion: input.serviceWorkerVersion,
    localSchemaVersion: 1, connectivity: input.connectivity, userAgent: navigator.userAgent, storage: input.storage,
    draftCount: input.drafts.length, queueCount: input.drafts.filter((draft) => !['synced', 'cancelled', 'draft'].includes(draft.status)).length,
    lastSuccessfulSync: input.drafts.filter((draft) => draft.syncedAt).map((draft) => draft.syncedAt!).sort().at(-1) ?? null,
  };
}
