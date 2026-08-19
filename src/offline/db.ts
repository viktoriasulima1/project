import { migrateDraft, markUnmigratableDraft } from './migrations';
import type { LocalActivityDraft, OfflineRepository, SyncReceipt } from './types';

const DB_NAME = 'farmos-offline';
const DB_VERSION = 1;
const MAX_DRAFT_BYTES = 256 * 1024;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const drafts = db.createObjectStore('drafts', { keyPath: 'localDraftId' });
      drafts.createIndex('namespace', 'namespace', { unique: false });
      drafts.createIndex('namespace_updatedAt', ['namespace', 'updatedAt'], { unique: false });
      const receipts = db.createObjectStore('receipts', { keyPath: 'localDraftId' });
      receipts.createIndex('namespace', 'namespace', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open offline storage.'));
    request.onblocked = () => reject(new Error('Offline storage upgrade is blocked by another FarmOS tab.'));
  });
}

export class IndexedDbOfflineRepository implements OfflineRepository {
  async putDraft(draft: LocalActivityDraft): Promise<void> {
    const bytes = new TextEncoder().encode(JSON.stringify(draft)).byteLength;
    if (bytes > MAX_DRAFT_BYTES) throw new Error('Draft exceeds the 256 KB local size limit.');
    const db = await openDatabase();
    const tx = db.transaction('drafts', 'readwrite');
    tx.objectStore('drafts').put(draft);
    await transactionDone(tx);
    db.close();
  }

  async getDraft(localDraftId: string): Promise<LocalActivityDraft | null> {
    const db = await openDatabase();
    const tx = db.transaction('drafts', 'readonly');
    const raw = await requestResult(tx.objectStore('drafts').get(localDraftId));
    await transactionDone(tx);
    db.close();
    if (!raw) return null;
    try { return migrateDraft(raw); } catch {
      const safe = markUnmigratableDraft(raw);
      if (safe) await this.putDraft(safe);
      return safe;
    }
  }

  async listDrafts(namespace: string): Promise<LocalActivityDraft[]> {
    const db = await openDatabase();
    const tx = db.transaction('drafts', 'readonly');
    const raw = await requestResult(tx.objectStore('drafts').index('namespace').getAll(namespace));
    await transactionDone(tx);
    db.close();
    const result: LocalActivityDraft[] = [];
    for (const item of raw) {
      try { result.push(migrateDraft(item)); } catch {
        const safe = markUnmigratableDraft(item);
        if (safe) { await this.putDraft(safe); result.push(safe); }
      }
    }
    return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async deleteDraft(localDraftId: string): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction('drafts', 'readwrite');
    tx.objectStore('drafts').delete(localDraftId);
    await transactionDone(tx);
    db.close();
  }

  async putReceipt(receipt: SyncReceipt): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction('receipts', 'readwrite');
    tx.objectStore('receipts').put(receipt);
    await transactionDone(tx);
    db.close();
  }

  async listReceipts(namespace: string): Promise<SyncReceipt[]> {
    const db = await openDatabase();
    const tx = db.transaction('receipts', 'readonly');
    const result = await requestResult(tx.objectStore('receipts').index('namespace').getAll(namespace));
    await transactionDone(tx);
    db.close();
    return result as SyncReceipt[];
  }

  async clearSynced(namespace: string): Promise<void> {
    const drafts = await this.listDrafts(namespace);
    await Promise.all(drafts.filter((d) => d.status === 'synced' || d.status === 'cancelled').map((d) => this.deleteDraft(d.localDraftId)));
  }

  async clearNamespace(namespace: string): Promise<void> {
    const drafts = await this.listDrafts(namespace);
    await Promise.all(drafts.map((d) => this.deleteDraft(d.localDraftId)));
  }

  async estimateUsage(namespace: string): Promise<number> {
    const [drafts, receipts] = await Promise.all([this.listDrafts(namespace), this.listReceipts(namespace)]);
    return new TextEncoder().encode(JSON.stringify({ drafts, receipts })).byteLength;
  }
}

export const offlineRepository: OfflineRepository = new IndexedDbOfflineRepository();
