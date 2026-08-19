'use client';
// Sprint 25 Parts 2-3 — Correct and Reverse a finalized financial record from
// the Finance page. Never a destructive edit: correction creates a new
// effective version (server enforces append-only, version, idempotency,
// stale-version rejection, audit, economics-recompute-once); reversal excludes
// the record from effective totals while keeping it in history.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { correctFinancialRecord, reverseFinancialRecord } from '@/lib/actions/economics';
import styles from './Finance.module.css';

type Entry = { id: string; date: string; label: string; kind: 'cost' | 'revenue'; recordType: 'expense' | 'revenue'; amount: number; status: string; version: number };
const eur = (value: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value);

export function FinancialRecordActions({ entries }: { entries: Entry[] }) {
  const [correcting, setCorrecting] = useState<Entry | null>(null);
  const [reversing, setReversing] = useState<Entry | null>(null);
  if (!entries.length) return <p>None recorded.</p>;
  return (
    <>
      <ul className={styles.recordList}>
        {entries.map(entry => (
          <li key={entry.id} className={styles.recordRow}>
            <span>{entry.date} · {entry.label} · {eur(entry.amount)} · {entry.status.replaceAll('_', ' ')}{entry.version > 1 ? ` · v${entry.version}` : ''}</span>
            <span className={styles.recordActions}>
              <button type="button" className={styles.linkButton} onClick={() => setCorrecting(entry)}>Correct</button>
              <button type="button" className={styles.linkButtonDanger} onClick={() => setReversing(entry)}>Reverse</button>
            </span>
          </li>
        ))}
      </ul>
      {correcting && <CorrectDialog entry={correcting} onClose={() => setCorrecting(null)} />}
      {reversing && <ReverseDialog entry={reversing} onClose={() => setReversing(null)} />}
    </>
  );
}

function CorrectDialog({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(entry.amount));
  const [revenueStatus, setRevenueStatus] = useState<'expected' | 'approved' | 'received' | ''>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const newAmount = Number(amount);
  const canSubmit = reason.trim().length >= 10 && Number.isFinite(newAmount) && newAmount >= 0 && !pending;

  function submit() {
    setError(null);
    start(async () => {
      const result = await correctFinancialRecord({
        type: entry.recordType, id: entry.id, expectedVersion: entry.version, reason: reason.trim(),
        idempotencyKey: crypto.randomUUID(),
        ...(entry.recordType === 'expense' ? { amount: newAmount } : { totalAmount: newAmount }),
        ...(entry.recordType === 'revenue' && revenueStatus ? { revenueStatus } : {}),
      });
      if (result.error) { setError(result.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div role="dialog" aria-label="Correct record" className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <h2>Correct: {entry.label}</h2>
        <p className={styles.muted}>Creates a new effective version. The original stays in history — it is never overwritten.</p>
        <label>New {entry.recordType === 'expense' ? 'amount' : 'total'} (€)
          <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
        </label>
        <p className={styles.muted}>Was {eur(entry.amount)} → {Number.isFinite(newAmount) ? eur(newAmount) : '—'}</p>
        {entry.recordType === 'revenue' && (
          <label>New revenue status (optional)
            <select value={revenueStatus} onChange={e => setRevenueStatus(e.target.value as typeof revenueStatus)}>
              <option value="">Unchanged</option><option value="received">Received</option><option value="approved">Approved</option><option value="expected">Expected</option>
            </select>
          </label>
        )}
        <label>Correction reason (required, ≥10 characters)
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} />
        </label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.secondary} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.button} disabled={!canSubmit} onClick={submit}>Submit correction</button>
        </div>
      </div>
    </div>
  );
}

function ReverseDialog({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const result = await reverseFinancialRecord({ type: entry.recordType, id: entry.id, reason: reason.trim() });
      if (result.error) { setError(result.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div role="dialog" aria-label="Reverse record" className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <h2>Reverse: {entry.label}</h2>
        <p className={styles.muted}>Use when this {entry.recordType} did not actually happen or was recorded by mistake. It stays visible in history and is excluded from effective totals. This is not ordinary editing — to change a value, use Correct.</p>
        <p>{entry.date} · {eur(entry.amount)}</p>
        <label>Reversal reason (required, ≥10 characters)
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} />
        </label>
        <label className={styles.checkboxRow}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I confirm this record should be reversed.</label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.secondary} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.linkButtonDanger} disabled={!confirmed || reason.trim().length < 10 || pending} onClick={submit}>Reverse this record</button>
        </div>
      </div>
    </div>
  );
}
