'use client';

import { useState, useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { BrpImportMap } from './BrpImportMap';
import { BrpSourceNote } from '@/components/disclaimers/BrpSourceNote';
import { searchBrpNearFarmAction, confirmBrpParcelImport } from '@/lib/actions/brp-import';
import type { ConfirmBrpImportState } from '@/lib/actions/brp-import';
import type { PdokParcelSearchResult } from '@/integrations/pdok/types';
import styles from './BrpImportClient.module.css';

const CROP_OPTIONS = ['wheat', 'potato', 'onion', 'sugar_beet', 'barley', 'oilseed_rape', 'cover_crop', 'grass', 'other'];

const initialConfirmState: ConfirmBrpImportState = {};

interface Props {
  centerLat: number;
  centerLon: number;
  initialResult: PdokParcelSearchResult;
  activeSeasonId: string | null;
}

export function BrpImportClient({ centerLat, centerLon, initialResult, activeSeasonId }: Props) {
  const [result, setResult] = useState(initialResult);
  const [searching, setSearching] = useState(false);
  const [radius, setRadius] = useState(1500);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [assignCrop, setAssignCrop] = useState('');
  const [state, formAction, isPending] = useActionState(confirmBrpParcelImport, initialConfirmState);
  const router = useRouter();

  // Navigation is a side effect — it must run in an effect, not directly in
  // the render body (calling router.push() during render is unreliable:
  // it can race with the render/commit cycle and, in a real browser, was
  // observed to leave the page on /fields/import/brp instead of actually
  // completing the redirect).
  useEffect(() => {
    if (state.success && state.fieldId) {
      router.push('/fields');
    }
  }, [state.success, state.fieldId, router]);

  async function handleResearch(newRadius: number) {
    setRadius(newRadius);
    setSearching(true);
    setSelectedIndex(null);
    const r = await searchBrpNearFarmAction(newRadius);
    setResult(r);
    setSearching(false);
  }

  const selected = selectedIndex != null ? result.parcels[selectedIndex] : null;

  return (
    <div className={styles.layout}>
      <div>
        <div className={styles.toolbar}>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>Search radius:</span>
          {[500, 1500, 3000].map((r) => (
            <Button key={r} variant={r === radius ? 'primary' : 'ghost'} size="sm" onClick={() => handleResearch(r)} disabled={searching}>
              {r}m
            </Button>
          ))}
        </div>

        {searching && <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>Searching PDOK…</p>}

        {result.state === 'unavailable' && (
          <div className={styles.globalError}>
            The official PDOK parcel service is unavailable right now{result.unavailableReason ? ` (${result.unavailableReason})` : ''}.
            You can still create a field manually from the Fields page. Try again shortly, or use a wider radius.
          </div>
        )}

        {result.state === 'ok' && result.parcels.length === 0 && !searching && (
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>
            No BRP parcels found within {radius}m of your farm coordinates. Try a larger radius.
          </p>
        )}

        {result.state === 'ok' && result.parcels.length > 0 && (
          <BrpImportMap
            centerLat={centerLat}
            centerLon={centerLon}
            parcels={result.parcels}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />
        )}

        {result.parcels.length > 0 && (
          <div className={styles.parcelList} style={{ marginTop: 'var(--space-3)' }}>
            {result.parcels.map((p, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.parcelItem} ${i === selectedIndex ? styles.parcelItemSelected : ''}`}
                onClick={() => setSelectedIndex(i)}
              >
                {p.cropLabel} · {p.areaHa.toFixed(2)} ha · {p.datasetYear} · {p.category}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.panel}>
        {!selected ? (
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>
            Select a parcel on the map or from the list to review and import it.
          </p>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="geometry" value={JSON.stringify(selected.geometry)} />
            <input type="hidden" name="sourceUrl" value={selected.sourceUrl} />
            <input type="hidden" name="datasetYear" value={selected.datasetYear} />
            <input type="hidden" name="importedAreaHa" value={selected.areaHa} />
            <input type="hidden" name="importedCropValue" value={selected.cropLabel} />
            {selected.cropCode != null && <input type="hidden" name="importedCropCode" value={selected.cropCode} />}

            {state.error && <div className={styles.globalError} role="alert">{state.error}</div>}

            <BrpSourceNote datasetYear={selected.datasetYear} />

            <div className={styles.fieldGroup}>
              <span className={styles.label}>Public crop (as declared)</span>
              <strong>{selected.cropLabel}</strong>
            </div>
            <div className={styles.fieldGroup}>
              <span className={styles.label}>Calculated area</span>
              <strong>{selected.areaHa.toFixed(2)} ha</strong>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="fieldName">This parcel is relevant to my farm — field name *</label>
              <input
                id="fieldName" name="fieldName" className={styles.input}
                value={fieldName} onChange={(e) => setFieldName(e.target.value)}
                placeholder="e.g. Noordkamp"
              />
              {state.fieldErrors?.fieldName && <span className={styles.errorMsg}>{state.fieldErrors.fieldName[0]}</span>}
            </div>

            {activeSeasonId && (
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="assignCrop">Assign current crop/season (optional)</label>
                <select
                  id="assignCrop" name="crop" className={styles.select}
                  value={assignCrop} onChange={(e) => setAssignCrop(e.target.value)}
                >
                  <option value="">— Don&apos;t assign yet —</option>
                  {CROP_OPTIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
                {assignCrop && <input type="hidden" name="seasonId" value={activeSeasonId} />}
              </div>
            )}

            <Button type="submit" variant="primary" loading={isPending} disabled={!fieldName.trim()}>
              Confirm and import this field
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
