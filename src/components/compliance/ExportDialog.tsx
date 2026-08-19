'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { previewExportCount } from '@/lib/actions/compliance-export-preview';
import type { ExportRequestFilters } from '@/lib/compliance-export/types';

interface Props {
  seasons: { id: string; year: number }[];
  fields: { id: string; name: string }[];
  crops: string[];
  products: { id: string; name: string }[];
  defaultSeasonId: string;
  onClose: () => void;
}

export function ExportDialog({ seasons, fields, crops, products, defaultSeasonId, onClose }: Props) {
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [seasonId, setSeasonId] = useState(defaultSeasonId);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fieldIds, setFieldIds] = useState<string[]>([]);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [includeIncomplete, setIncludeIncomplete] = useState(true);
  const [includeCorrectionHistory, setIncludeCorrectionHistory] = useState(false);
  const [includeReversed, setIncludeReversed] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function currentFilters(): ExportRequestFilters {
    return {
      seasonId: seasonId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      fieldIds: fieldIds.length > 0 ? fieldIds : undefined,
      crops: selectedCrops.length > 0 ? selectedCrops : undefined,
      productIds: productIds.length > 0 ? productIds : undefined,
      effectiveOnly: !includeCorrectionHistory,
      includeReversed,
      includeIncomplete,
      includeCorrectionHistory,
    };
  }

  useEffect(() => {
    let cancelled = false;
    setCounting(true);
    previewExportCount(currentFilters()).then((res) => {
      if (cancelled) return;
      setCounting(false);
      setCount(res.count);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId, dateFrom, dateTo, fieldIds, selectedCrops, productIds, includeIncomplete, includeCorrectionHistory, includeReversed]);

  function toggle(list: string[], value: string, setList: (v: string[]) => void) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleExport() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch('/api/compliance/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, filters: currentFilters() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Export failed.');
        setDownloading(false);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match ? match[1] : `farmos-spray-diary.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloading(false);
    } catch {
      setError('Export failed. Check your connection and try again.');
      setDownloading(false);
    }
  }

  return (
    <div role="dialog" aria-label="Export compliance records" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', maxWidth: '520px', width: '92%', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>Export compliance records</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <Button variant={format === 'pdf' ? 'primary' : 'secondary'} size="sm" onClick={() => setFormat('pdf')}>PDF spray diary</Button>
          <Button variant={format === 'csv' ? 'primary' : 'secondary'} size="sm" onClick={() => setFormat('csv')}>CSV</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-xs)' }}>Season</label>
            <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} style={{ width: '100%', padding: '6px' }}>
              <option value="">All seasons</option>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.year}</option>)}
            </select>
          </div>
          <div />
          <div>
            <label style={{ fontSize: 'var(--font-xs)' }}>From date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '100%', padding: '6px' }} />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-xs)' }}>To date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '100%', padding: '6px' }} />
          </div>
        </div>

        <details style={{ marginBottom: 'var(--space-3)' }}>
          <summary style={{ fontSize: 'var(--font-sm)', cursor: 'pointer' }}>Select specific fields, crops or products (optional)</summary>
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>Fields</p>
              {fields.map((f) => (
                <label key={f.id} style={{ display: 'block', fontSize: 'var(--font-xs)' }}>
                  <input type="checkbox" checked={fieldIds.includes(f.id)} onChange={() => toggle(fieldIds, f.id, setFieldIds)} /> {f.name}
                </label>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>Crops</p>
              {crops.map((c) => (
                <label key={c} style={{ display: 'block', fontSize: 'var(--font-xs)' }}>
                  <input type="checkbox" checked={selectedCrops.includes(c)} onChange={() => toggle(selectedCrops, c, setSelectedCrops)} /> {c.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>Products</p>
              {products.map((p) => (
                <label key={p.id} style={{ display: 'block', fontSize: 'var(--font-xs)' }}>
                  <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggle(productIds, p.id, setProductIds)} /> {p.name}
                </label>
              ))}
            </div>
          </div>
        </details>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: 'var(--space-3)', fontSize: 'var(--font-xs)' }}>
          <label><input type="checkbox" checked={includeIncomplete} onChange={(e) => setIncludeIncomplete(e.target.checked)} /> Include incomplete records (visibly marked)</label>
          <label><input type="checkbox" checked={includeCorrectionHistory} onChange={(e) => setIncludeCorrectionHistory(e.target.checked)} /> Include full correction history (every version, not just current)</label>
          <label><input type="checkbox" checked={includeReversed} onChange={(e) => setIncludeReversed(e.target.checked)} /> Include reversed records</label>
        </div>

        <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-3)' }}>
          {counting ? 'Counting records…' : `${count ?? 0} record${count === 1 ? '' : 's'} will be exported.`}
        </p>

        {error && <div role="alert" style={{ padding: 'var(--space-2)', background: 'var(--color-red-subtle)', color: 'var(--color-red)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)', fontSize: 'var(--font-sm)' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={downloading} disabled={counting || count === 0} onClick={handleExport}>
            Export {format.toUpperCase()}
          </Button>
        </div>
      </div>
    </div>
  );
}
