'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { correctActivity, previewActivityCorrection, type CorrectionFormState } from '@/lib/actions/compliance-corrections';
import type { CorrectionPreview } from '@/lib/correction-preview';
import type { EffectiveComplianceRecord } from '@/lib/compliance-data';
import type { ProductOption, MachineOption } from '@/lib/activity-form-context';

interface Props {
  record: EffectiveComplianceRecord;
  products: ProductOption[];
  machines: MachineOption[];
  onClose: () => void;
  onSuccess: () => void;
}

// Explicitly typed — useActionState infers its state type from BOTH this
// value and the action's own signature, and a bare untyped `{}` wins that
// inference, leaving every field below "does not exist on type {}".
const initialState: CorrectionFormState = {};

function toDatetimeLocal(iso: string): string {
  // <input type="datetime-local"> expects "YYYY-MM-DDTHH:mm", no timezone.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CorrectionDialog({ record, products, machines, onClose, onSuccess }: Props) {
  const data = record.data as {
    operatorName?: string; certificateNumber?: string | null; waterVolumePerHa?: number | null;
    nozzleType?: string | null; areaHa?: number; dosePerHa?: number | null; doseUnit?: string | null;
    bbchStage?: number | null; notes?: string | null;
  };

  const [state, formAction] = useActionState(correctActivity, initialState);
  const idempotencyKey = useRef(crypto.randomUUID()).current;
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<CorrectionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  async function handlePreview() {
    if (!formRef.current) return;
    setPreviewing(true);
    setPreviewError(null);
    const fd = new FormData(formRef.current);
    const result = await previewActivityCorrection(record.activityId, fd);
    setPreviewing(false);
    if (result.error) setPreviewError(result.error);
    else setPreview(result.preview ?? null);
  }

  return (
    <div role="dialog" aria-label="Correct record" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <form
        ref={formRef}
        action={formAction}
        style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', maxWidth: '560px', width: '92%', maxHeight: '88vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>Correct record</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          This creates a new, corrected version. The original record is never edited or deleted — see its full history from &quot;View&quot;.
        </p>

        {state.error && <div role="alert" style={{ padding: 'var(--space-2)', background: 'var(--color-red-subtle)', color: 'var(--color-red)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)', fontSize: 'var(--font-sm)' }}>{state.error}</div>}

        <input type="hidden" name="activityId" value={record.activityId} />
        <input type="hidden" name="expectedVersion" value={record.version} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <div>
            <label htmlFor="c-areaHa" style={{ fontSize: 'var(--font-xs)' }}>Treated area (ha)</label>
            <input id="c-areaHa" name="areaHa" type="number" step="0.01" min="0" defaultValue={data.areaHa} style={{ width: '100%', padding: '6px' }} />
            {state.fieldErrors?.areaHa && <span style={{ color: 'var(--color-red)', fontSize: 'var(--font-xs)' }}>{state.fieldErrors.areaHa[0]}</span>}
          </div>
          <div>
            <label htmlFor="c-date" style={{ fontSize: 'var(--font-xs)' }}>Actual date/time</label>
            <input id="c-date" name="date" type="datetime-local" defaultValue={toDatetimeLocal(record.date.toString())} style={{ width: '100%', padding: '6px' }} />
          </div>
          <div>
            <label htmlFor="c-productId" style={{ fontSize: 'var(--font-xs)' }}>Product</label>
            <select id="c-productId" name="productId" defaultValue={record.productId ?? ''} style={{ width: '100%', padding: '6px' }}>
              <option value="">— none —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
            </select>
            {state.fieldErrors?.productId && <span style={{ color: 'var(--color-red)', fontSize: 'var(--font-xs)' }}>{state.fieldErrors.productId[0]}</span>}
          </div>
          <div>
            <label htmlFor="c-dosePerHa" style={{ fontSize: 'var(--font-xs)' }}>Dose per ha</label>
            <input id="c-dosePerHa" name="dosePerHa" type="number" step="0.001" min="0" defaultValue={data.dosePerHa ?? ''} style={{ width: '100%', padding: '6px' }} />
            {state.fieldErrors?.dosePerHa && <span style={{ color: 'var(--color-red)', fontSize: 'var(--font-xs)' }}>{state.fieldErrors.dosePerHa[0]}</span>}
          </div>
          <div>
            <label htmlFor="c-doseUnit" style={{ fontSize: 'var(--font-xs)' }}>Dose unit</label>
            <select id="c-doseUnit" name="doseUnit" defaultValue={data.doseUnit ?? ''} style={{ width: '100%', padding: '6px' }}>
              <option value="">—</option>
              <option value="L">L</option>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="mL">mL</option>
            </select>
          </div>
          <div>
            <label htmlFor="c-waterVolumePerHa" style={{ fontSize: 'var(--font-xs)' }}>Water volume (L/ha)</label>
            <input id="c-waterVolumePerHa" name="waterVolumePerHa" type="number" step="1" min="0" defaultValue={data.waterVolumePerHa ?? ''} style={{ width: '100%', padding: '6px' }} />
          </div>
          <div>
            <label htmlFor="c-operatorName" style={{ fontSize: 'var(--font-xs)' }}>Operator</label>
            <input id="c-operatorName" name="operatorName" defaultValue={data.operatorName ?? ''} style={{ width: '100%', padding: '6px' }} />
          </div>
          <div>
            <label htmlFor="c-machineId" style={{ fontSize: 'var(--font-xs)' }}>Machine</label>
            <select id="c-machineId" name="machineId" defaultValue={record.machineId ?? ''} style={{ width: '100%', padding: '6px' }}>
              <option value="">— none —</option>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="c-nozzleType" style={{ fontSize: 'var(--font-xs)' }}>Nozzle</label>
            <input id="c-nozzleType" name="nozzleType" defaultValue={data.nozzleType ?? ''} style={{ width: '100%', padding: '6px' }} />
          </div>
          <div>
            <label htmlFor="c-bbchStage" style={{ fontSize: 'var(--font-xs)' }}>BBCH stage</label>
            <input id="c-bbchStage" name="bbchStage" type="number" min="0" max="99" defaultValue={data.bbchStage ?? ''} style={{ width: '100%', padding: '6px' }} />
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-2)' }}>
          <label htmlFor="c-notes" style={{ fontSize: 'var(--font-xs)' }}>Notes</label>
          <textarea id="c-notes" name="notes" defaultValue={data.notes ?? ''} style={{ width: '100%', padding: '6px' }} rows={2} />
        </div>

        <div style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="c-correctionReason" style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>Correction reason (required)</label>
          <textarea id="c-correctionReason" name="correctionReason" required minLength={10} placeholder="What was wrong, and what is the correct value?" style={{ width: '100%', padding: '6px' }} rows={2} />
          {state.fieldErrors?.correctionReason && <span style={{ color: 'var(--color-red)', fontSize: 'var(--font-xs)' }}>{state.fieldErrors.correctionReason[0]}</span>}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <Button type="button" variant="secondary" size="sm" loading={previewing} onClick={handlePreview}>Review correction</Button>
        </div>

        {previewError && <div style={{ color: 'var(--color-red)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-2)' }}>{previewError}</div>}

        {preview && (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: '6px' }}>Preview</h3>
            {Object.keys(preview.diff).length === 0 ? (
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>No fields changed yet.</p>
            ) : (
              <ul style={{ fontSize: 'var(--font-xs)', paddingLeft: '18px', margin: '0 0 8px' }}>
                {Object.entries(preview.diff).map(([field, change]) => (
                  <li key={field}>{field}: {String(change.old ?? '—')} → {String(change.new ?? '—')}</li>
                ))}
              </ul>
            )}
            {preview.stockChanges.length > 0 && (
              <>
                <h4 style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>Stock impact</h4>
                <ul style={{ fontSize: 'var(--font-xs)', paddingLeft: '18px', margin: '0 0 8px' }}>
                  {preview.stockChanges.map((c, i) => (
                    <li key={i}>{c.productName}: {c.quantityDelta > 0 ? '−' : '+'}{Math.abs(c.quantityDelta).toFixed(3)} ({c.direction})</li>
                  ))}
                </ul>
              </>
            )}
            {preview.warnings.map((w, i) => (
              <p key={i} style={{ fontSize: 'var(--font-xs)', color: 'var(--color-red)' }}>⚠ {w}</p>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-xs)', marginTop: '8px' }}>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              I confirm this correction is accurate.
            </label>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!preview || !confirmed}>
            Submit correction
          </Button>
        </div>
      </form>
    </div>
  );
}
