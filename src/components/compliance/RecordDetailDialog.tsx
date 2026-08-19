'use client';

import { useEffect, useState } from 'react';
import { getComplianceRecordDetail, type RecordDetail } from '@/lib/actions/compliance-detail';
import { CORRECTION_FIELD_LABEL } from '@/lib/correction-field-labels';

interface Props {
  rootActivityId: string;
  onClose: () => void;
}

const LABEL_TEXT: Record<string, string> = {
  original: 'Original',
  corrected: 'Corrected',
  reversed: 'Reversed',
  current: 'Current effective record',
};

const ACTION_TEXT: Record<string, string> = {
  created: 'Created',
  planned: 'Planned',
  completed: 'Completed',
  corrected: 'Corrected',
  reversed: 'Reversed',
  archived: 'Archived',
  restored: 'Restored',
  exported: 'Exported',
  verification_status_changed: 'Verification status changed',
  inventory_adjusted: 'Inventory adjusted',
  compliance_snapshot_created: 'Compliance snapshot created',
};

export function RecordDetailDialog({ rootActivityId, onClose }: Props) {
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getComplianceRecordDetail(rootActivityId).then((res) => {
      if (cancelled) return;
      if (res.error) setError(res.error);
      else setDetail(res.detail ?? null);
    });
    return () => { cancelled = true; };
  }, [rootActivityId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="Record details"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', maxWidth: '640px', width: '92%', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>Record details</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        {error && <p style={{ color: 'var(--color-red)' }}>{error}</p>}
        {!detail && !error && <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>}

        {detail && (
          <>
            <section style={{ marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Correction chain</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {detail.chain.map((v) => (
                  <div key={v.activityId} style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <strong style={{ fontSize: 'var(--font-xs)' }}>v{v.version}</strong>
                      {v.labels.map((l) => (
                        <span key={l} style={{ fontSize: 'var(--font-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--color-blue-subtle)', color: 'var(--color-blue)' }}>
                          {LABEL_TEXT[l]}
                        </span>
                      ))}
                      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>{new Date(v.createdAt).toLocaleString('nl-NL')}</span>
                    </div>
                    {v.correctionReason && (
                      <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Reason: {v.correctionReason}</p>
                    )}
                    {v.correctionDiff && Object.keys(v.correctionDiff).filter((k) => k !== 'idempotencyKey').length > 0 && (
                      <ul style={{ fontSize: 'var(--font-xs)', margin: '4px 0 0', paddingLeft: '18px' }}>
                        {Object.entries(v.correctionDiff)
                          .filter(([k]) => k !== 'idempotencyKey')
                          .map(([field, change]) => (
                            <li key={field}>{CORRECTION_FIELD_LABEL[field] ?? field}: {String(change.old ?? '—')} → {String(change.new ?? '—')}</li>
                          ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Inventory movements</h3>
              {detail.inventoryMovements.length === 0 ? (
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>No inventory movements for this record.</p>
              ) : (
                <table style={{ width: '100%', fontSize: 'var(--font-xs)', borderCollapse: 'collapse' }}>
                  <tbody>
                    {detail.inventoryMovements.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '4px' }}>{new Date(m.createdAt).toLocaleString('nl-NL')}</td>
                        <td style={{ padding: '4px' }}>{m.productName}</td>
                        <td style={{ padding: '4px' }}>{m.direction}</td>
                        <td style={{ padding: '4px', textAlign: 'right' }}>{m.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section>
              <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Audit history</h3>
              {detail.auditHistory.length === 0 ? (
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>No audit events recorded.</p>
              ) : (
                <ul style={{ fontSize: 'var(--font-xs)', display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '18px' }}>
                  {detail.auditHistory.map((e) => (
                    <li key={e.id}>
                      {new Date(e.occurredAt).toLocaleString('nl-NL')} — {ACTION_TEXT[e.action] ?? e.action}
                      {e.reason ? ` — "${e.reason}"` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
