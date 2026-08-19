'use client';
// Sprint 25 Part 9/10/13 — the field's economic history, three views: a unified
// event timeline, correction/reversal version chains, and allocation history.
// All data is server-computed and farm-scoped; this component only presents it.
import { useState } from 'react';
import { FinancialVersionTimeline, type TimelineVersion } from './FinancialVersionTimeline';
import styles from './FieldEconomics.module.css';

export interface TimelineEventView {
  id: string; occurredAt: string; type: string; actor: string | null; reason: string | null;
  effect: string; amount: number | null; source: string; resultingStatus: string;
}
export interface VersionGroup { title: string; versions: TimelineVersion[] }

export function FieldEconomicsHistory({ events, corrections, allocations, locale }: {
  events: TimelineEventView[]; corrections: VersionGroup[]; allocations: VersionGroup[]; locale: string;
}) {
  const [tab, setTab] = useState<'timeline' | 'corrections' | 'allocations'>('timeline');
  const eur = (v: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(v);
  const dateTime = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
  return (
    <section className={styles.card}>
      <h2>Economic history</h2>
      <div className={styles.tabs} role="tablist">
        <button role="tab" aria-selected={tab === 'timeline'} className={`${styles.tab} ${tab === 'timeline' ? styles.tabActive : ''}`} onClick={() => setTab('timeline')}>Timeline</button>
        <button role="tab" aria-selected={tab === 'corrections'} className={`${styles.tab} ${tab === 'corrections' ? styles.tabActive : ''}`} onClick={() => setTab('corrections')}>Corrections ({corrections.length})</button>
        <button role="tab" aria-selected={tab === 'allocations'} className={`${styles.tab} ${tab === 'allocations' ? styles.tabActive : ''}`} onClick={() => setTab('allocations')}>Allocations ({allocations.length})</button>
      </div>

      {tab === 'timeline' && (
        events.length === 0 ? <p className={styles.muted}>No economic events recorded yet.</p> : (
          <ol className={styles.timeline}>
            {events.map((e) => (
              <li key={e.id} className={styles.event}>
                <div className={styles.eventHead}>
                  <span className={styles.eventType}>{e.type}{e.amount != null ? ` · ${eur(e.amount)}` : ''}</span>
                  <span className={styles.eventTime}>{dateTime(e.occurredAt)}</span>
                </div>
                <span className={styles.muted}>{e.effect}{e.actor ? ` · ${e.actor}` : ''} · {e.source}</span>
                {e.reason && <span className={styles.muted}>Reason: {e.reason}</span>}
              </li>
            ))}
          </ol>
        )
      )}

      {tab === 'corrections' && (
        corrections.length === 0 ? <p className={styles.muted}>No corrections or reversals on this field.</p> : (
          <div style={{ display: 'grid', gap: 16 }}>{corrections.map((g) => <FinancialVersionTimeline key={g.title} title={g.title} versions={g.versions} />)}</div>
        )
      )}

      {tab === 'allocations' && (
        allocations.length === 0 ? <p className={styles.muted}>No allocation changes on this field.</p> : (
          <div style={{ display: 'grid', gap: 16 }}>{allocations.map((g) => <FinancialVersionTimeline key={g.title} title={g.title} versions={g.versions} />)}</div>
        )
      )}
    </section>
  );
}
