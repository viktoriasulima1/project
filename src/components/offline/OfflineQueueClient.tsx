'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useOffline } from '@/offline/OfflineProvider';
import { draftAge } from '@/offline/drafts';
import { useLocale, useTranslations } from '@/i18n/LocaleProvider';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import { userError, type UserFacingError } from '@/lib/user-error';
import styles from './OfflineQueueClient.module.css';

const LABEL: Record<string,string> = { draft:'Saved on this device',ready_to_sync:'Waiting to synchronize',syncing:'Synchronizing',synced:'Synced with FarmOS',conflict:'Conflict — review required',needs_review:'Conflict — review required',failed:'Sync failed — retry available',cancelled:'Cancelled' };

export function OfflineQueueClient() {
  const { drafts, connectivity, usageBytes, storageDiagnostics, serviceWorkerVersion, offlineSupportEnabled, setOfflineSupportEnabled, retry, discard, clearSynced, clearAll, exportDrafts, importDrafts, supportDiagnostics } = useOffline();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [importError, setImportError] = useState<UserFacingError | null>(null);
  const errorT = useTranslations('errors');
  const locale = useLocale();
  const persistence = storageDiagnostics?.persistenceGranted;
  const importErrorDisplay = importError ? buildUserErrorDisplayModel({ translator: errorT, locale, error: importError }) : null;
  const copyDiagnostics = async () => { await navigator.clipboard.writeText(JSON.stringify(supportDiagnostics(), null, 2)); setMessage('Diagnostic information copied.'); };
  return <main className={styles.container}>
    <section className={styles.diagnostics}><h2>Offline mode</h2><label className={styles.switch}><input type="checkbox" checked={offlineSupportEnabled} onChange={(event) => { const enabled = event.target.checked; if (!enabled && drafts.some(d => !['synced','cancelled'].includes(d.status)) && !confirm('Offline drafts will be kept, but offline pages will stop working. Export a recovery copy first if needed. Continue?')) return; void setOfflineSupportEnabled(enabled); }} /><span>{offlineSupportEnabled ? 'Offline support enabled' : 'Offline support disabled'}</span></label><p className={styles.meta}>Turning this off unregisters the service worker and clears only cached site files. IndexedDB drafts are not deleted. The page reloads after the change.</p></section>
    <section className={styles.explanation}>Activity drafts are stored in IndexedDB on this device, isolated to this signed-in account and farm. No passwords, tokens, or secret keys are stored. Server inventory and compliance records change only after confirmed synchronization.</section>
    {persistence === false && <section className={styles.explanation}>This browser did not grant persistent storage. Drafts are saved locally, but the browser may remove them under storage pressure. Export a recovery copy before clearing site data.</section>}
    <section className={styles.diagnostics}><h2>Device storage diagnostics</h2><dl><div><dt>IndexedDB</dt><dd>{storageDiagnostics?.indexedDbAvailable ? 'Available' : 'Unavailable'}</dd></div><div><dt>Persistence requested</dt><dd>{storageDiagnostics?.persistenceRequested ? 'Yes' : 'No / already known'}</dd></div><div><dt>Persistence granted</dt><dd>{persistence == null ? 'Not reported' : persistence ? 'Yes' : 'No'}</dd></div><div><dt>Browser usage / quota</dt><dd>{storageDiagnostics?.usageBytes == null ? 'Not reported' : `${(storageDiagnostics.usageBytes/1024/1024).toFixed(1)} / ${((storageDiagnostics.quotaBytes ?? 0)/1024/1024).toFixed(1)} MB`}</dd></div><div><dt>Drafts / queued</dt><dd>{drafts.length} / {drafts.filter(d => !['draft','synced','cancelled'].includes(d.status)).length}</dd></div><div><dt>Last successful sync</dt><dd>{drafts.filter(d=>d.syncedAt).map(d=>d.syncedAt!).sort().at(-1) ?? 'None on this device'}</dd></div><div><dt>Service worker</dt><dd>{serviceWorkerVersion}</dd></div></dl></section>
    <div className={styles.toolbar}><span>Connection: {connectivity} · FarmOS local data: {(usageBytes / 1024).toFixed(1)} KB</span><button onClick={() => void retry()} disabled={connectivity !== 'online'}>Retry waiting items</button><button onClick={() => exportDrafts()}>Export all local drafts</button><button onClick={() => { setImportError(null); input.current?.click(); }}>Import recovery copy</button><input ref={input} className={styles.hidden} type="file" accept="application/json,.json" aria-describedby={importError ? 'recovery-import-error' : undefined} onChange={(event) => { const file=event.target.files?.[0]; if(file) void file.text().then(importDrafts).then(count=>{setImportError(null);setMessage(`${count} item(s) imported for review.`);}).catch(()=>{setMessage('');setImportError(userError('INVALID_VALUE',{field:'recoveryFile'}));}); }} /><button onClick={() => void copyDiagnostics()}>Copy diagnostic information</button><button onClick={() => void clearSynced()}>Clear synced local data</button><button onClick={() => { if(confirm('Delete ALL local drafts for this account and farm? Unsynced regulated activities will be permanently lost. Export a copy first.')) void clearAll(); }}>Delete all local drafts</button></div>
    {importErrorDisplay && <p id="recovery-import-error" className={styles.error} role="alert">{importErrorDisplay.message}</p>}
    {message && <p role="status">{message}</p>}
    {!drafts.length ? <p className={styles.empty}>No offline drafts or queued activities on this device.</p> : <ul className={styles.list}>{drafts.map((draft, index) => <li key={draft.localDraftId} className={styles.item}>
      <div><strong>{draft.activityType.replace('_',' ')}</strong><span>{LABEL[draft.status] ?? draft.status}</span></div>
      <div className={styles.meta}>Queue position: {index + 1} · Field: {draft.formData.fieldSeasonId || 'Review required'} · Created: {new Date(draft.createdAt).toLocaleString()} · Saved {draftAge(draft.updatedAt)} · Last attempt: {draft.lastSyncAttemptAt ? new Date(draft.lastSyncAttemptAt).toLocaleString() : 'Never'} · Attempts: {draft.syncAttemptCount}</div>
      {(draft.safeError || draft.safeErrorMessage) && <p className={styles.error} role="alert">{buildUserErrorDisplayModel({ translator: errorT, locale, error: draft.safeError ?? userError('GENERIC') }).message}</p>}
      <div className={styles.actions}>{['failed','conflict','needs_review','ready_to_sync'].includes(draft.status) && <button onClick={() => void retry(draft.localDraftId)}>Retry</button>}{['conflict','needs_review','draft'].includes(draft.status) && <Link href="/activities">Review</Link>}{draft.serverActivityId && <Link href="/activities">Open synchronized record</Link>}<button onClick={() => exportDrafts([draft])}>Export local copy</button>{draft.status !== 'syncing' && <button onClick={() => { if(confirm(`Discard this ${draft.activityType} draft? If it is unsynchronized, the regulated activity will be permanently lost from this device.`)) void discard(draft.localDraftId); }}>Discard</button>}</div>
    </li>)}</ul>}
  </main>;
}
