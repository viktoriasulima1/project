import { notFound } from 'next/navigation';
import { requireFarm } from '@/lib/require-farm';
import { syncProductsInUse } from '@/integrations/ctgb/sync';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ctgb Sync Report — FarmOS (dev)' };

/**
 * Sprint 18 Part 8 — admin/dev sync report. Dev-only, same gating pattern
 * as LoadDemoFarmButton (NODE_ENV === 'development'). Never exposes
 * secrets — only product names, statuses, and checksums, all of which are
 * public Ctgb data anyway (CC-0 licensed, see docs/Ctgb_Official_Data_Audit.md).
 */
export default async function CtgbSyncReportPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  await requireFarm();
  const report = await syncProductsInUse();

  return (
    <div style={{ padding: 'var(--space-6)', fontFamily: 'monospace', fontSize: 'var(--font-sm)' }}>
      <h1>Ctgb Sync Report</h1>
      <p>Run at: {report.runAt}</p>
      <p>Checked: {report.productsChecked} · Changed: {report.productsChanged} · Unavailable: {report.productsUnavailable}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'var(--space-4)' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #888' }}>Product</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #888' }}>State</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #888' }}>Changed</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #888' }}>Status</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #888' }}>Needs review</th>
          </tr>
        </thead>
        <tbody>
          {report.entries.map((e) => (
            <tr key={e.sourceProductId}>
              <td>{e.officialName}</td>
              <td>{e.state}</td>
              <td>{e.changed ? 'yes' : 'no'}</td>
              <td>{e.previousStatus} → {e.newStatus ?? '?'}</td>
              <td>{e.authorisationStatusChanged && e.referencedByComplianceRecords > 0 ? `⚠ ${e.referencedByComplianceRecords} historical record(s)` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
