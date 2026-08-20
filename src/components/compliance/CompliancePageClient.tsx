'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { EffectiveComplianceRecord } from '@/lib/compliance-data';
import type { ProductOption, MachineOption } from '@/lib/activity-form-context';
import { RecordDetailDialog } from './RecordDetailDialog';
import { CorrectionDialog } from './CorrectionDialog';
import { ReversalDialog } from './ReversalDialog';
import { ExportDialog } from './ExportDialog';

interface FilterState {
  season: string;
  dateFrom: string;
  dateTo: string;
  field: string;
  crop: string;
  product: string;
  operator: string;
  status: string;
  includeReversed: boolean;
}

interface Props {
  records: EffectiveComplianceRecord[];
  summary: {
    total: number;
    complete: number;
    incomplete: number;
    corrected: number;
    reversed: number;
    verificationUnavailable: number;
  };
  seasons: { id: string; year: number }[];
  fields: { id: string; name: string }[];
  crops: string[];
  products: { id: string; name: string }[];
  operators: string[];
  currentFilters: FilterState;
  farmId: string;
  correctionProducts: ProductOption[];
  correctionMachines: MachineOption[];
}

const STATUS_LABEL: Record<string, string> = {
  complete: 'Complete',
  incomplete: 'Incomplete',
  corrected: 'Corrected',
  reversed: 'Reversed',
  verification_unavailable: 'Verification unavailable',
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  complete: { bg: 'var(--color-green-subtle)', fg: 'var(--color-green)' },
  incomplete: { bg: 'var(--color-yellow-subtle, #fef3c7)', fg: 'var(--color-yellow-dark, #92400e)' },
  corrected: { bg: 'var(--color-blue-subtle)', fg: 'var(--color-blue)' },
  reversed: { bg: 'var(--color-red-subtle)', fg: 'var(--color-red)' },
  verification_unavailable: { bg: 'var(--color-border-subtle)', fg: 'var(--color-text-muted)' },
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.verification_unavailable;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: c.bg, color: c.fg, fontSize: 'var(--font-xs)', fontWeight: 500, whiteSpace: 'nowrap' }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function CompliancePageClient({
  records, summary, seasons, fields, crops, products, operators, currentFilters, farmId,
  correctionProducts, correctionMachines,
}: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(currentFilters);
  const [detailRootId, setDetailRootId] = useState<string | null>(null);
  const [correctingRecord, setCorrectingRecord] = useState<EffectiveComplianceRecord | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reversingVersion, setReversingVersion] = useState<number | null>(null);
  const [showExport, setShowExport] = useState(false);

  void farmId;

  function applyFilters(next: FilterState) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.season) params.set('season', next.season);
    if (next.dateFrom) params.set('dateFrom', next.dateFrom);
    if (next.dateTo) params.set('dateTo', next.dateTo);
    if (next.field) params.set('field', next.field);
    if (next.crop) params.set('crop', next.crop);
    if (next.product) params.set('product', next.product);
    if (next.operator) params.set('operator', next.operator);
    if (next.status && next.status !== 'all') params.set('status', next.status);
    if (next.includeReversed) params.set('includeReversed', 'true');
    router.push(`/compliance?${params.toString()}`);
  }

  const cardStyle: React.CSSProperties = {
    padding: 'var(--space-3) var(--space-4)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    minWidth: '120px',
  };

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Total records</div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 600 }}>{summary.total}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Complete</div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 600, color: 'var(--color-green)' }}>{summary.complete}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Incomplete</div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 600 }}>{summary.incomplete}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Corrected</div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 600, color: 'var(--color-blue)' }}>{summary.corrected}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Reversed</div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 600, color: 'var(--color-red)' }}>{summary.reversed}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>Verification unavailable</div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 600 }}>{summary.verificationUnavailable}</div>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <select value={filters.season} onChange={(e) => applyFilters({ ...filters, season: e.target.value })} style={{ padding: '6px 8px' }}>
          <option value="">All seasons</option>
          {seasons.map((s) => <option key={s.id} value={s.id}>{s.year}</option>)}
        </select>
        <input type="date" value={filters.dateFrom} onChange={(e) => applyFilters({ ...filters, dateFrom: e.target.value })} style={{ padding: '6px 8px' }} aria-label="From date" />
        <input type="date" value={filters.dateTo} onChange={(e) => applyFilters({ ...filters, dateTo: e.target.value })} style={{ padding: '6px 8px' }} aria-label="To date" />
        <select value={filters.field} onChange={(e) => applyFilters({ ...filters, field: e.target.value })} style={{ padding: '6px 8px' }}>
          <option value="">All fields</option>
          {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={filters.crop} onChange={(e) => applyFilters({ ...filters, crop: e.target.value })} style={{ padding: '6px 8px' }}>
          <option value="">All crops</option>
          {crops.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.product} onChange={(e) => applyFilters({ ...filters, product: e.target.value })} style={{ padding: '6px 8px' }}>
          <option value="">All products</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.operator} onChange={(e) => applyFilters({ ...filters, operator: e.target.value })} style={{ padding: '6px 8px' }}>
          <option value="">All operators</option>
          {operators.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => applyFilters({ ...filters, status: e.target.value })} style={{ padding: '6px 8px' }}>
          <option value="all">All statuses</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
          <option value="corrected">Corrected</option>
          <option value="reversed">Reversed</option>
          <option value="verification_unavailable">Verification unavailable</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-sm)' }}>
          <input
            type="checkbox"
            checked={filters.includeReversed}
            onChange={(e) => applyFilters({ ...filters, includeReversed: e.target.checked })}
          />
          Include reversed
        </label>
        <div style={{ flex: 1 }} />
        <Button variant="primary" size="sm" onClick={() => setShowExport(true)}>Export</Button>
      </div>

      {/* ── Record list ──────────────────────────────────────────────────── */}
      {records.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-sm)' }}>No records match these filters.</p>
      ) : (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Date</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Field</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Crop</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Product</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Treated area</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Operator</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}>Status</th>
                <th style={{ padding: 'var(--space-2) var(--space-3)' }}></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const data = r.data as { fieldName?: string; crop?: string; productName?: string; areaHa?: number; operatorName?: string };
                return (
                  <tr key={r.activityId} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{new Date(r.date).toLocaleDateString('nl-NL')}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{data.fieldName ?? '—'}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{(data.crop ?? '').replace(/_/g, ' ') || '—'}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{data.productName ?? '—'}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{data.areaHa != null ? `${Number(data.areaHa).toFixed(2)} ha` : '—'}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{data.operatorName ?? '—'}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      <StatusPill status={r.completeness.status} />
                      {r.correctionCount > 0 && (
                        <span style={{ marginLeft: '6px', fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                          ({r.correctionCount} correction{r.correctionCount !== 1 ? 's' : ''})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Button variant="ghost" size="sm" onClick={() => setDetailRootId(r.rootActivityId)}>View</Button>
                        {!r.isReversal && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setCorrectingRecord(r)}>Correct</Button>
                            <Button variant="ghost" size="sm" style={{ color: 'var(--color-red)' }} onClick={() => { setReversingId(r.activityId); setReversingVersion(r.version); }}>Reverse</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailRootId && (
        <RecordDetailDialog rootActivityId={detailRootId} onClose={() => setDetailRootId(null)} />
      )}
      {correctingRecord && (
        <CorrectionDialog
          record={correctingRecord}
          products={correctionProducts}
          machines={correctionMachines}
          onClose={() => setCorrectingRecord(null)}
          onSuccess={() => { setCorrectingRecord(null); router.refresh(); }}
        />
      )}
      {reversingId && reversingVersion !== null && (
        <ReversalDialog
          activityId={reversingId}
          expectedVersion={reversingVersion}
          onClose={() => { setReversingId(null); setReversingVersion(null); }}
          onSuccess={() => { setReversingId(null); setReversingVersion(null); router.refresh(); }}
        />
      )}
      {showExport && (
        <ExportDialog
          seasons={seasons}
          fields={fields}
          crops={crops}
          products={products}
          defaultSeasonId={filters.season}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
