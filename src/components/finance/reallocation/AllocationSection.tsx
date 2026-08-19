'use client';
// Sprint 25 — Finance page reallocation sections: unallocated, partially
// allocated, and recently reallocated records, each with an Allocate/Reallocate
// action that opens the ReallocationDialog. Client wrapper so the dialog's open
// state lives in the browser; the record list itself is server-loaded.
import { useState } from 'react';
import { ReallocationDialog, type DialogField } from './ReallocationDialog';
import type { AllocatableRecord } from '@/lib/reallocation-data';
import styles from '../Finance.module.css';

const eur = (v: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v);

function Group({ title, empty, records, onOpen }: { title: string; empty: string; records: AllocatableRecord[]; onOpen: (r: AllocatableRecord) => void }) {
  return (
    <div className={styles.card}>
      <h2>{title}</h2>
      {records.length === 0 ? <p className={styles.muted}>{empty}</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Type</th><th>Date</th><th>Description</th><th>Total</th><th>Allocated</th><th>Unallocated</th><th>Destinations</th><th>Version</th><th></th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.economicEntryId}>
                  <td>{r.kind}</td><td>{r.date}</td><td>{r.label}{r.reference ? ` · ${r.reference}` : ''}</td>
                  <td>{eur(r.amount)}</td><td>{eur(r.allocatedAmount)}</td><td>{eur(r.unallocatedAmount)}</td>
                  <td>{r.destinationsSummary}</td><td>{r.version || '—'}</td>
                  <td><button type="button" className={styles.linkButton} onClick={() => onOpen(r)}>{r.status === 'unallocated' ? 'Allocate' : 'Reallocate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AllocationSection({ records, fields }: { records: AllocatableRecord[]; fields: DialogField[] }) {
  const [active, setActive] = useState<AllocatableRecord | null>(null);
  const unallocated = records.filter(r => r.status === 'unallocated');
  const partial = records.filter(r => r.status === 'partially_allocated');
  const reallocated = records.filter(r => r.status === 'reallocated');

  return (
    <>
      <Group title="Unallocated records" empty="All field-linked costs and revenue are allocated." records={unallocated} onOpen={setActive} />
      <Group title="Partially allocated records" empty="No partially allocated records." records={partial} onOpen={setActive} />
      <Group title="Recently reallocated records" empty="Allocation changes will appear here." records={reallocated} onOpen={setActive} />
      {active && <ReallocationDialog record={active} fields={fields} onClose={() => setActive(null)} onSaved={() => { /* dialog refreshes the route on success */ }} />}
    </>
  );
}
