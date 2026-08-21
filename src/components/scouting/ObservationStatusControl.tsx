'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setObservationStatus } from '@/lib/actions/scouting';
import styles from './Scouting.module.css';

const STATUS_OPTIONS = ['open', 'monitoring', 'action_planned', 'resolved', 'dismissed', 'superseded'] as const;
type ObservationStatusValue = (typeof STATUS_OPTIONS)[number];

interface Props {
  observationId: string;
  currentStatus: string;
  statusLabels: Record<string, string>;
  labels: { change: string; cancel: string; reasonPlaceholder: string; save: string };
}

export function ObservationStatusControl({ observationId, currentStatus, statusLabels, labels }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ObservationStatusValue>(
    (STATUS_OPTIONS as readonly string[]).includes(currentStatus) ? (currentStatus as ObservationStatusValue) : 'open',
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button type="button" className={styles.link} onClick={() => setOpen(true)}>
        {labels.change}
      </button>
    );
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await setObservationStatus({ observationId, status, reason });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReason('');
      router.refresh();
    });
  }

  return (
    <span className={styles.statusControl}>
      <select value={status} onChange={(e) => setStatus(e.target.value as ObservationStatusValue)} disabled={pending}>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{statusLabels[s] ?? s}</option>
        ))}
      </select>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={labels.reasonPlaceholder} disabled={pending} />
      <span className={styles.statusActions}>
        <button type="button" className={styles.primary} disabled={pending} onClick={handleSave}>{labels.save}</button>
        <button type="button" className={styles.secondary} disabled={pending} onClick={() => { setOpen(false); setError(null); }}>{labels.cancel}</button>
      </span>
      {error && <span className={styles.error}>{error}</span>}
    </span>
  );
}
