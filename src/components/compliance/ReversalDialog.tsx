'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { reverseActivity, previewActivityReversal, type ReversalPreview, type ReversalFormState } from '@/lib/actions/compliance-corrections';

interface Props {
  activityId: string;
  expectedVersion: number;
  onClose: () => void;
  onSuccess: () => void;
}

// See the identical comment in CorrectionDialog.tsx — useActionState's
// state type is inferred from this initial value too, not just the action.
const initialState: ReversalFormState = {};

export function ReversalDialog({ activityId, expectedVersion, onClose, onSuccess }: Props) {
  const [state, formAction] = useActionState(reverseActivity, initialState);
  const idempotencyKey = useRef(crypto.randomUUID()).current;
  const [preview, setPreview] = useState<ReversalPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    previewActivityReversal(activityId).then((res) => {
      if (cancelled) return;
      setLoadingPreview(false);
      if (res.preview) setPreview(res.preview);
    });
    return () => { cancelled = true; };
  }, [activityId]);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <div role="dialog" aria-label="Reverse record" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <form action={formAction} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', maxWidth: '480px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-red)' }}>Reverse record</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          Use this when the application did not actually happen, or was recorded by mistake or as a duplicate. This does not
          delete the original — it stays visible in history, and is excluded from active compliance totals by default.
        </p>

        {state.error && <div role="alert" style={{ padding: 'var(--space-2)', background: 'var(--color-red-subtle)', color: 'var(--color-red)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)', fontSize: 'var(--font-sm)' }}>{state.error}</div>}

        <input type="hidden" name="activityId" value={activityId} />
        <input type="hidden" name="expectedVersion" value={expectedVersion} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        {loadingPreview && <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Loading preview…</p>}
        {preview && (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: '6px' }}>Stock to be restored</h3>
            {preview.stockRestored.length === 0 ? (
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>No product was consumed by this record.</p>
            ) : (
              <ul style={{ fontSize: 'var(--font-xs)', paddingLeft: '18px', margin: 0 }}>
                {preview.stockRestored.map((s, i) => <li key={i}>{s.productName}: +{s.quantity.toFixed(3)}</li>)}
              </ul>
            )}
          </div>
        )}

        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="r-reason" style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>Reversal reason (required)</label>
          <textarea id="r-reason" name="reason" required minLength={10} placeholder="Why is this record being reversed?" style={{ width: '100%', padding: '6px' }} rows={2} />
          {state.fieldErrors?.reason && <span style={{ color: 'var(--color-red)', fontSize: 'var(--font-xs)' }}>{state.fieldErrors.reason[0]}</span>}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-xs)', marginBottom: 'var(--space-3)' }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          I confirm this record should be reversed.
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={!confirmed || loadingPreview}>Reverse this record</Button>
        </div>
      </form>
    </div>
  );
}
