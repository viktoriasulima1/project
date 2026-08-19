import type { LocalActivityDraft, OfflineRepository, SyncReceipt } from './types';

/** Deterministic repository used by unit tests and support tooling. It
 * mirrors the namespace guarantees of IndexedDB without a browser global. */
export class MemoryOfflineRepository implements OfflineRepository {
  drafts = new Map<string, LocalActivityDraft>();
  receipts = new Map<string, SyncReceipt>();
  async putDraft(draft: LocalActivityDraft) { this.drafts.set(draft.localDraftId, structuredClone(draft)); }
  async getDraft(id: string) { return structuredClone(this.drafts.get(id) ?? null); }
  async listDrafts(namespace: string) { return [...this.drafts.values()].filter((d) => d.namespace === namespace).sort((a,b) => a.createdAt.localeCompare(b.createdAt)).map((d) => structuredClone(d)); }
  async deleteDraft(id: string) { this.drafts.delete(id); }
  async putReceipt(receipt: SyncReceipt) { this.receipts.set(receipt.localDraftId, structuredClone(receipt)); }
  async listReceipts(namespace: string) { return [...this.receipts.values()].filter((r) => r.namespace === namespace).map((r) => structuredClone(r)); }
  async clearSynced(namespace: string) { for (const d of await this.listDrafts(namespace)) if (d.status === 'synced' || d.status === 'cancelled') this.drafts.delete(d.localDraftId); }
  async clearNamespace(namespace: string) { for (const d of await this.listDrafts(namespace)) this.drafts.delete(d.localDraftId); }
  async estimateUsage(namespace: string) { return new TextEncoder().encode(JSON.stringify({ drafts: await this.listDrafts(namespace), receipts: await this.listReceipts(namespace) })).byteLength; }
}
