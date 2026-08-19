'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { createInventoryItem, searchCtgbProductsAction } from '@/lib/actions/inventory';
import type { CreateInventoryItemState } from '@/lib/actions/inventory';
import { CtgbSourceNote } from '@/components/disclaimers/CtgbSourceNote';
import type { NormalizedCtgbProduct } from '@/integrations/ctgb/types';
import styles from './AddInventoryItemDialog.module.css';
import { useLocale, useTranslations } from '@/i18n/LocaleProvider';
import { buildUserErrorDisplayModel } from '@/i18n/adapters/user-error';
import type { UserFacingError } from '@/lib/user-error';

const initialState: CreateInventoryItemState = {};

const CATEGORY_OPTIONS = [
  { value: 'herbicide', label: 'Herbicide' },
  { value: 'fungicide', label: 'Fungicide' },
  { value: 'insecticide', label: 'Insecticide' },
  { value: 'fertiliser', label: 'Fertiliser' },
  { value: 'seed', label: 'Seed' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'other', label: 'Other' },
];

const UNIT_OPTIONS = ['L', 'kg', 'T', 'bag', 'box'];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'search' | 'stock-details' | 'manual';

export function AddInventoryItemDialog({ onClose, onSuccess }: Props) {
  const [state, formAction, isPending] = useActionState(createInventoryItem, initialState);
  const dialogRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const errorT = useTranslations('errors');
  const displayError = (error: UserFacingError) => buildUserErrorDisplayModel({ translator: errorT, locale, error }).message;
  const firstError = state.error ?? Object.values(state.fieldErrors ?? {})[0];

  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<Awaited<ReturnType<typeof searchCtgbProductsAction>> | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<NormalizedCtgbProduct | null>(null);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  useEffect(() => {
    if (firstError) errorRef.current?.focus();
  }, [firstError]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 2) {
      setSearchState(null);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      searchCtgbProductsAction(query).then(setSearchState).finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(handle);
  }, [mode, query]);

  function selectProduct(p: NormalizedCtgbProduct) {
    setSelected(p);
    setMode('stock-details');
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div ref={dialogRef} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {mode === 'search' && 'Search official product'}
            {mode === 'stock-details' && 'Add stock details'}
            {mode === 'manual' && 'Add product manually'}
          </h2>
          <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Close">×</button>
        </div>

        {mode === 'search' && (
          <div className={styles.body}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="ctgb-query">Product name</label>
              <input
                id="ctgb-query"
                className={styles.input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Amistar Opti"
                autoFocus
              />
            </div>

            {searching && <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Searching official Ctgb register…</p>}

            {searchState && searchState.state === 'unavailable' && (
              <div className={`${styles.statusBanner} ${styles.statusUnavailable}`}>
                Official product lookup is unavailable right now.{searchState.error ? ` (${displayError(searchState.error)})` : ''} You can still add this product manually below.
              </div>
            )}
            {searchState && searchState.state === 'degraded' && searchState.products.length > 0 && (
              <div className={`${styles.statusBanner} ${styles.statusDegraded}`}>
                Showing cached official data — live verification is currently unavailable.
              </div>
            )}

            {searchState && searchState.products.length > 0 && (
              <div className={styles.resultList}>
                {searchState.products.map((p) => (
                  <div key={p.sourceProductId} className={styles.resultItem}>
                    <div className={styles.resultInfo}>
                      <span className={styles.resultName}>{p.officialName}</span>
                      <span className={styles.resultMeta}>
                        Auth. no. {p.authorisationNumber} · {p.authorisationStatus}
                        {p.isIncomplete ? ' · incomplete official data' : ''}
                      </span>
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => selectProduct(p)}>
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {searchState && searchState.products.length === 0 && searchState.state !== 'unavailable' && query.trim().length >= 2 && !searching && (
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>No official product matched &quot;{query}&quot;.</p>
            )}

            <button type="button" className={styles.manualLink} onClick={() => setMode('manual')}>
              Product not found / manual entry
            </button>
          </div>
        )}

        {(mode === 'stock-details' || mode === 'manual') && (
          <form action={formAction}>
            {mode === 'stock-details' && selected && (
              <input type="hidden" name="ctgbSourceProductId" value={selected.sourceProductId} />
            )}
            <div className={styles.body}>
              {firstError && <div ref={errorRef} className={styles.globalError} role="alert" tabIndex={-1}>{displayError(firstError)}</div>}

              {mode === 'stock-details' && selected && (
                <>
                  <div className={styles.selectedProduct}>
                    <strong>{selected.officialName}</strong>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                      Authorisation no. {selected.authorisationNumber}
                    </span>
                  </div>
                  <CtgbSourceNote
                    sourceUrl={selected.sourceUrl}
                    fetchedAt={selected.fetchedAt}
                    authorisationStatus={selected.authorisationStatus}
                    isIncomplete={selected.isIncomplete}
                  />
                  <input type="hidden" name="name" value={selected.officialName} />
                </>
              )}

              {mode === 'manual' && (
                <>
                  <span className={styles.unverifiedBadge}>Unverified — not validated against Ctgb</span>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="name">Product name *</label>
                    <input id="name" name="name" className={styles.input} defaultValue={state.values?.name} aria-describedby={state.fieldErrors?.name ? 'inventory-name-error' : undefined} />
                    {state.fieldErrors?.name && <span id="inventory-name-error" className={styles.errorMsg}>{displayError(state.fieldErrors.name)}</span>}
                  </div>
                </>
              )}

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="category">Category *</label>
                  <select id="category" name="category" className={styles.select} defaultValue={state.values?.category ?? 'herbicide'} aria-describedby={state.fieldErrors?.category ? 'inventory-category-error' : undefined}>
                    {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  {state.fieldErrors?.category && <span id="inventory-category-error" className={styles.errorMsg}>{displayError(state.fieldErrors.category)}</span>}
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="unit">Unit *</label>
                  <select id="unit" name="unit" className={styles.select} defaultValue={state.values?.unit ?? 'L'} aria-describedby={state.fieldErrors?.unit ? 'inventory-unit-error' : undefined}>
                    {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {state.fieldErrors?.unit && <span id="inventory-unit-error" className={styles.errorMsg}>{displayError(state.fieldErrors.unit)}</span>}
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="currentStock">Current stock</label>
                  <input id="currentStock" name="currentStock" type="number" inputMode="decimal" step="0.01" min="0" className={styles.input} defaultValue={state.values?.currentStock ?? '0'} aria-describedby={state.fieldErrors?.currentStock ? 'inventory-current-stock-error' : undefined} />
                  {state.fieldErrors?.currentStock && <span id="inventory-current-stock-error" className={styles.errorMsg}>{displayError(state.fieldErrors.currentStock)}</span>}
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="minimumStock">Minimum stock</label>
                  <input id="minimumStock" name="minimumStock" type="number" inputMode="decimal" step="0.01" min="0" className={styles.input} defaultValue={state.values?.minimumStock ?? '0'} aria-describedby={state.fieldErrors?.minimumStock ? 'inventory-minimum-stock-error' : undefined} />
                  {state.fieldErrors?.minimumStock && <span id="inventory-minimum-stock-error" className={styles.errorMsg}>{displayError(state.fieldErrors.minimumStock)}</span>}
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="purchasePricePerUnit">Purchase price per unit (€)</label>
                  <input id="purchasePricePerUnit" name="purchasePricePerUnit" type="number" inputMode="decimal" step="0.01" min="0" className={styles.input} defaultValue={state.values?.purchasePricePerUnit} aria-describedby={state.fieldErrors?.purchasePricePerUnit ? 'inventory-price-error' : undefined} />
                  {state.fieldErrors?.purchasePricePerUnit && <span id="inventory-price-error" className={styles.errorMsg}>{displayError(state.fieldErrors.purchasePricePerUnit)}</span>}
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="expiryDate">Expiry date</label>
                  <input id="expiryDate" name="expiryDate" type="date" className={styles.input} defaultValue={state.values?.expiryDate} aria-describedby={state.fieldErrors?.expiryDate ? 'inventory-expiry-error' : undefined} />
                  {state.fieldErrors?.expiryDate && <span id="inventory-expiry-error" className={styles.errorMsg}>{displayError(state.fieldErrors.expiryDate)}</span>}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="supplierName">Supplier (optional)</label>
                <input id="supplierName" name="supplierName" className={styles.input} defaultValue={state.values?.supplierName} />
              </div>
            </div>

            <div className={styles.footer}>
              <Button type="button" variant="ghost" onClick={() => setMode('search')}>← Back to search</Button>
              <Button type="submit" variant="primary" loading={isPending}>Add product</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
