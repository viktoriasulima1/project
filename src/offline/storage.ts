export interface OfflineStorageDiagnostics {
  indexedDbAvailable: boolean;
  persistenceRequested: boolean;
  persistenceGranted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function inspectOfflineStorage(requestPersistence = true): Promise<OfflineStorageDiagnostics> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  let persistenceGranted: boolean | null = null;
  let persistenceRequested = false;
  if (storage?.persisted) persistenceGranted = await storage.persisted().catch(() => null);
  if (requestPersistence && persistenceGranted === false && storage?.persist) {
    persistenceRequested = true;
    persistenceGranted = await storage.persist().catch(() => false);
  }
  const estimate = await storage?.estimate?.().catch(() => undefined);
  return {
    indexedDbAvailable: typeof indexedDB !== 'undefined',
    persistenceRequested,
    persistenceGranted,
    usageBytes: estimate?.usage ?? null,
    quotaBytes: estimate?.quota ?? null,
  };
}
