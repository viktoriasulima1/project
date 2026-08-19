'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { offlineRepository } from './db';
import { checkConnectivity, type ConnectivityState } from './network';
import { enqueueDraft } from './queue';
import { processQueue, synchronizeDraft } from './sync';
import { logOfflineEvent } from './observability';
import { offlineNamespace, type LocalActivityDraft } from './types';
import { withQueueLock } from './lock';
import { createRecoveryExport, downloadJson, parseRecoveryImport } from './recovery';
import { inspectOfflineStorage, type OfflineStorageDiagnostics } from './storage';
import { createSupportDiagnostics, type SupportDiagnostics } from './diagnostics';

interface OfflineContextValue {
  userRef: string;
  farmId: string;
  namespace: string;
  connectivity: ConnectivityState;
  drafts: LocalActivityDraft[];
  syncingCount: number;
  usageBytes: number;
  storageDiagnostics: OfflineStorageDiagnostics | null;
  serviceWorkerVersion: string;
  offlineSupportEnabled: boolean;
  setOfflineSupportEnabled(enabled: boolean): Promise<void>;
  saveDraft(draft: LocalActivityDraft): Promise<void>;
  queueDraft(draft: LocalActivityDraft): Promise<LocalActivityDraft>;
  retry(localDraftId?: string): Promise<void>;
  discard(localDraftId: string): Promise<void>;
  clearSynced(): Promise<void>;
  clearAll(): Promise<void>;
  refresh(): Promise<void>;
  exportDrafts(drafts?: LocalActivityDraft[]): void;
  importDrafts(raw: string): Promise<number>;
  supportDiagnostics(): SupportDiagnostics;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ userRef, farmId, children }: { userRef: string; farmId: string; children: React.ReactNode }) {
  const namespace = useMemo(() => offlineNamespace(userRef, farmId), [userRef, farmId]);
  const [connectivity, setConnectivity] = useState<ConnectivityState>('checking');
  const [drafts, setDrafts] = useState<LocalActivityDraft[]>([]);
  const [usageBytes, setUsageBytes] = useState(0);
  const [storageDiagnostics, setStorageDiagnostics] = useState<OfflineStorageDiagnostics | null>(null);
  const [serviceWorkerVersion, setServiceWorkerVersion] = useState('unavailable');
  const [offlineSupportEnabled, setOfflineSupportEnabledState] = useState(true);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    const [items, bytes] = await Promise.all([offlineRepository.listDrafts(namespace), offlineRepository.estimateUsage(namespace)]);
    setDrafts(items);
    setUsageBytes(bytes);
  }, [namespace]);

  const runQueue = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      await withQueueLock(namespace, () => processQueue({ userRef, farmId, namespace }));
      await refresh();
    } finally { running.current = false; }
  }, [farmId, namespace, refresh, userRef]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const next = await checkConnectivity();
      if (cancelled) return;
      setConnectivity((previous) => {
        if ((previous === 'offline' || previous === 'unstable') && next === 'online') logOfflineEvent({ event: 'connectivity_restored', farmId, userRef });
        if (next === 'offline' && previous !== 'offline') logOfflineEvent({ event: 'offline_detected', farmId, userRef });
        return next;
      });
      if (next === 'online') void runQueue();
    };
    void refresh();
    void inspectOfflineStorage(true).then(setStorageDiagnostics);
    void check();
    const online = () => void check();
    const offline = () => { setConnectivity('offline'); logOfflineEvent({ event: 'offline_detected', farmId, userRef }); };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    const timer = window.setInterval(check, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, [farmId, refresh, runQueue, userRef]);

  useEffect(() => {
    const enabled = window.localStorage.getItem('farmos-offline-support') !== 'disabled';
    setOfflineSupportEnabledState(enabled);
    if (!enabled) { setServiceWorkerVersion('disabled'); return; }
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').then(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => setServiceWorkerVersion(String(event.data?.version ?? 'unknown'));
      navigator.serviceWorker.controller?.postMessage({ type: 'FARMOS_VERSION' }, [channel.port2]);
    });
  }, []);

  const value: OfflineContextValue = {
    userRef, farmId, namespace, connectivity, drafts, storageDiagnostics, serviceWorkerVersion, offlineSupportEnabled,
    syncingCount: drafts.filter((d) => d.status === 'syncing').length,
    usageBytes,
    async saveDraft(draft) { await offlineRepository.putDraft(draft); logOfflineEvent({ event: 'draft_saved_locally', farmId, userRef, localDraftId: draft.localDraftId, activityType: draft.activityType }); await refresh(); },
    async queueDraft(draft) {
      const queued = await enqueueDraft(draft);
      await refresh();
      if (connectivity === 'online') {
        const result = await withQueueLock(namespace, () => synchronizeDraft(queued, { userRef, farmId, namespace }));
        await refresh();
        return result ?? queued;
      }
      return queued;
    },
    async retry(localDraftId) {
      if (localDraftId) {
        const draft = await offlineRepository.getDraft(localDraftId);
        if (draft) { await offlineRepository.putDraft({ ...draft, status: 'ready_to_sync', nextSyncAttemptAt: undefined }); }
      }
      if (connectivity === 'online') await runQueue();
      await refresh();
    },
    async discard(localDraftId) { await offlineRepository.deleteDraft(localDraftId); logOfflineEvent({ event: 'draft_discarded', farmId, userRef, localDraftId }); await refresh(); },
    async clearSynced() { await offlineRepository.clearSynced(namespace); await refresh(); },
    async clearAll() { await offlineRepository.clearNamespace(namespace); await refresh(); },
    exportDrafts(selected = drafts) { downloadJson(`farmos-offline-${new Date().toISOString().slice(0,10)}.json`, createRecoveryExport(selected)); },
    async importDrafts(raw) { const imported = parseRecoveryImport(raw, namespace); for (const draft of imported) await offlineRepository.putDraft(draft); await refresh(); return imported.length; },
    supportDiagnostics() { return createSupportDiagnostics({ drafts, connectivity, storage: storageDiagnostics, serviceWorkerVersion }); },
    async setOfflineSupportEnabled(enabled) {
      window.localStorage.setItem('farmos-offline-support', enabled ? 'enabled' : 'disabled');
      setOfflineSupportEnabledState(enabled);
      if (!enabled && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ('caches' in window) {
          const names = await window.caches.keys();
          await Promise.all(names.filter((name) => name.startsWith('farmos-')).map((name) => window.caches.delete(name)));
        }
      }
      window.location.reload();
    },
    refresh,
  };
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const value = useContext(OfflineContext);
  if (!value) throw new Error('useOffline must be used inside OfflineProvider.');
  return value;
}
