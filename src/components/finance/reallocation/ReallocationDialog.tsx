'use client';
// Sprint 25 — reusable 4-step reallocation dialog. All allocation math comes
// from the server (previewReallocationForRecord + reallocateEconomicRecord,
// which both call the shared previewReallocation engine). This component never
// computes final totals itself — it only collects the method + destinations,
// renders the server preview, and submits. The four steps of Part 3 are
// modeled as explicit internal stages rather than six separate files.
import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useOffline } from '@/offline/OfflineProvider';
import { previewReallocationForRecord, reallocateEconomicRecord, type RecordPreviewResult, type ReallocationResult } from '@/lib/actions/reallocation';
import type { AllocationMethod } from '@/lib/reallocation-preview';
import type { AllocatableRecord } from '@/lib/reallocation-data';
import styles from '../Finance.module.css';
import { useTranslations } from '@/i18n/LocaleProvider';

export interface DialogField { fieldSeasonId: string; label: string; crop: string; hectares: number; yield: number | null }
type Props = { record: AllocatableRecord; fields: DialogField[]; onClose: () => void; onSaved: () => void };
type Stage = 'method' | 'destinations' | 'preview' | 'confirm' | 'result';

const METHODS: { value: AllocationMethod; title: string; help: string; needsFields: boolean }[] = [
  { value: 'direct_field', title: 'Direct field', help: 'Assign the full amount to one field.', needsFields: true },
  { value: 'selected_fields', title: 'Selected fields', help: 'Choose several fields and enter a percentage or amount for each.', needsFields: true },
  { value: 'per_hectare', title: 'Proportional by hectares', help: 'Distribute proportionally using the selected fields’ hectares.', needsFields: true },
  { value: 'per_yield', title: 'Proportional by yield', help: 'Distribute proportionally using recorded saleable yield.', needsFields: true },
  { value: 'crop_level', title: 'Crop level', help: 'Keep at the crop aggregate; not split to individual fields.', needsFields: false },
  { value: 'unallocated', title: 'Leave unallocated', help: 'Keep this amount visible at farm level without affecting field margins.', needsFields: false },
];
const eur = (v: number | null) => v == null ? 'Not recorded' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v);

export function ReallocationDialog({ record, fields, onClose, onSaved }: Props) {
  const t = useTranslations('fields');
  const router = useRouter();
  const online = useOffline().connectivity === 'online';
  const idempotencyKey = useRef(crypto.randomUUID()).current;
  const [stage, setStage] = useState<Stage>('method');
  const [method, setMethod] = useState<AllocationMethod>('per_hectare');
  const [mode, setMode] = useState<'percentage' | 'amount'>('percentage');
  const [selected, setSelected] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [partial, setPartial] = useState(false);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<RecordPreviewResult['preview'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReallocationResult | null>(null);
  const [previewing, startPreview] = useTransition();
  const [saving, startSave] = useTransition();
  const errorRef = useRef<HTMLDivElement>(null);

  const def = METHODS.find(m => m.value === method)!;
  const reasonRequired = record.version > 0;

  function toggle(id: string) { setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }
  function buildDestinations() {
    if (method === 'direct_field') return selected.slice(0, 1).map(id => ({ fieldSeasonId: id }));
    if (method === 'selected_fields') return selected.map(id => mode === 'percentage'
      ? { fieldSeasonId: id, percentage: Number(values[id] || 0) }
      : { fieldSeasonId: id, amountCents: Math.round(Number(values[id] || 0) * 100) });
    if (method === 'per_hectare' || method === 'per_yield') return selected.map(id => ({ fieldSeasonId: id }));
    return [];
  }
  const destinationsValid = def.needsFields ? (method === 'direct_field' ? selected.length === 1 : selected.length >= 1) : true;

  function focusError() { requestAnimationFrame(() => errorRef.current?.focus()); }

  function runPreview() {
    setError(null); setPreview(null);
    startPreview(async () => {
      const res = await previewReallocationForRecord({ economicEntryId: record.economicEntryId, allocationMethod: method, destinations: buildDestinations(), partialAllocationAllowed: partial });
      if (res.error) { setError(res.error); focusError(); return; }
      setPreview(res.preview ?? null); setStage('preview');
    });
  }
  function submit() {
    setError(null);
    startSave(async () => {
      const res = await reallocateEconomicRecord({ economicEntryId: record.economicEntryId, expectedVersion: record.version, allocationMethod: method, destinations: buildDestinations(), partialAllocationAllowed: partial, reason: reason.trim() || undefined, idempotencyKey });
      if (res.error) { setError(res.error); focusError(); return; }
      setResult(res); setStage('result'); router.refresh(); onSaved();
    });
  }

  const blocked = (preview?.blocked.length ?? 0) > 0;

  return (
    <div role="dialog" aria-label={`Reallocate ${record.label}`} aria-modal="true" className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>Reallocate: {record.label}</h2>
          <button type="button" className={styles.linkButton} onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className={styles.muted}>{record.date} · {eur(record.amount)} · currently {record.status.replaceAll('_', ' ')}{record.version > 0 ? ` (v${record.version})` : ''}</p>

        {!online && (
          <div className={styles.warning} role="status">Reallocation requires an internet connection because multiple field totals must be updated atomically. You can review the current allocation, but changes are disabled.</div>
        )}
        {error && <div ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{error}{/stale|changed while/i.test(error) && <> <button type="button" className={styles.linkButton} onClick={() => { setStage('method'); router.refresh(); }}>Reload current allocation</button></>}</div>}

        {/* Step 1 — method */}
        {stage === 'method' && (
          <fieldset style={{ border: 0, padding: 0, display: 'grid', gap: 6 }}>
            <legend className={styles.muted}>Step 1 of 4 — allocation method</legend>
            {METHODS.map(m => (
              <label key={m.value} className={styles.checkboxRow}>
                <input type="radio" name="method" checked={method === m.value} disabled={!online} onChange={() => { setMethod(m.value); setSelected([]); setValues({}); }} />
                <span><strong>{m.title}</strong> — <span className={styles.muted}>{m.help}</span></span>
              </label>
            ))}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondary} onClick={onClose}>Cancel</button>
              <button type="button" className={styles.button} disabled={!online} onClick={() => setStage(def.needsFields ? 'destinations' : 'preview')}>Next</button>
            </div>
          </fieldset>
        )}

        {/* Step 2 — destinations */}
        {stage === 'destinations' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className={styles.muted}>Step 2 of 4 — destinations ({def.title})</p>
            {method === 'selected_fields' && (
              <label className={styles.checkboxRow}>Mode:
                <select value={mode} onChange={e => setMode(e.target.value as 'percentage' | 'amount')}><option value="percentage">Percentage</option><option value="amount">Amount (€)</option></select>
              </label>
            )}
            <label className={styles.checkboxRow}><input type="checkbox" checked={partial} onChange={e => setPartial(e.target.checked)} /> Allocate only part — leave a visible remainder</label>
            {fields.map(f => {
              const yieldMissing = method === 'per_yield' && f.yield == null;
              const isSel = selected.includes(f.fieldSeasonId);
              return (
                <div key={f.fieldSeasonId} className={styles.checkboxRow}>
                  <input type={method === 'direct_field' ? 'radio' : 'checkbox'} name="dest" checked={isSel} disabled={yieldMissing} onChange={() => method === 'direct_field' ? setSelected([f.fieldSeasonId]) : toggle(f.fieldSeasonId)} />
                  <span>{f.label} · {f.hectares.toFixed(1)} ha{method === 'per_yield' && <> · yield {f.yield == null ? 'not recorded (disabled)' : f.yield}</>}</span>
                  {method === 'selected_fields' && isSel && (
                    <input type="number" step="0.01" min="0" style={{ width: 90 }} placeholder={mode === 'percentage' ? '%' : '€'} value={values[f.fieldSeasonId] ?? ''} onChange={e => setValues(v => ({ ...v, [f.fieldSeasonId]: e.target.value }))} />
                  )}
                </div>
              );
            })}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondary} onClick={() => setStage('method')}>Back</button>
              <button type="button" className={styles.button} disabled={!online || !destinationsValid || previewing} onClick={runPreview}>{previewing ? 'Previewing…' : 'Preview'}</button>
            </div>
          </div>
        )}

        {/* Step 3 — preview */}
        {stage === 'preview' && preview && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className={styles.muted}>Step 3 of 4 — preview</p>
            {blocked
              ? <ul className={styles.error}>{preview.blocked.map((b, i) => <li key={i}>{b}</li>)}</ul>
              : <>
                  <p>Original {eur(preview.recordAmount)} · allocated {eur(preview.totalAllocated)} · remaining unallocated {eur(preview.remainingUnallocated)} · rounding difference {eur(preview.roundingDifference)}</p>
                  {preview.perField.length > 0 && (
                    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Field</th><th>Allocated</th><th>Cost before→after</th><th>Revenue before→after</th><th>Margin/ha Δ</th></tr></thead><tbody>
                      {preview.perField.map(f => (
                        <tr key={f.fieldSeasonId}><td>{f.field} ({f.crop.replaceAll('_', ' ')})</td><td>{eur(f.allocatedAmount)}</td><td>{eur(f.beforeCostEur)} → {eur(f.afterCostEur)}</td><td>{eur(f.beforeRevenueEur)} → {eur(f.afterRevenueEur)}</td><td>{f.marginReasonCode ? <span className={styles.muted}>{t(`economics.grossMargin.reasons.${f.marginReasonCode}`)}</span> : f.marginPerHaChangeEur == null ? '—' : eur(f.marginPerHaChangeEur)}</td></tr>
                      ))}
                    </tbody></table></div>
                  )}
                  {preview.warnings.map((w, i) => <p key={i} className={styles.muted}>⚠ {w}</p>)}
                </>}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondary} onClick={() => setStage('destinations')}>Back</button>
              <button type="button" className={styles.button} disabled={blocked} onClick={() => setStage('confirm')}>Continue</button>
            </div>
          </div>
        )}

        {/* Step 4 — confirm */}
        {stage === 'confirm' && preview && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className={styles.muted}>Step 4 of 4 — confirm</p>
            <p>Allocating {eur(preview.totalAllocated)} of {eur(preview.recordAmount)} via {def.title.toLowerCase()}; {eur(preview.remainingUnallocated)} stays unallocated.</p>
            <label>Reason {reasonRequired ? '(required)' : '(optional)'}
              <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} />
            </label>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondary} onClick={() => setStage('preview')}>Back</button>
              <button type="button" className={styles.button} disabled={!online || saving || (reasonRequired && reason.trim().length < 10)} onClick={submit}>{saving ? 'Saving…' : 'Save reallocation'}</button>
            </div>
          </div>
        )}

        {/* Result */}
        {stage === 'result' && result && (
          <div role="status" style={{ display: 'grid', gap: 6 }}>
            <h3>Reallocation saved.</h3>
            <p>Effective version {result.effectiveVersion} · allocated {eur((result.totalAllocatedCents ?? 0) / 100)} · remaining {eur((result.unallocatedCents ?? 0) / 100)}.</p>
            {!!result.affectedFieldSeasonIds?.length && <p className={styles.muted}>{result.affectedFieldSeasonIds.length} field(s) updated.</p>}
            <div className={styles.dialogActions}><button type="button" className={styles.button} onClick={onClose}>Close</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
