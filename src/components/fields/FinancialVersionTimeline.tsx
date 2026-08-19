'use client';
// Sprint 25 Part 10 — reusable version-history timeline for any append-only
// financial record chain (expense / revenue / harvest / allocation / purchase).
// Presentational only: it renders server-computed versions and their before/
// after diff (Part 11). It NEVER allows editing from the timeline. Badges carry
// a text label, not colour alone (Part 17).
import { useState } from 'react';
import styles from './FieldEconomics.module.css';

export type VersionBadge = 'original' | 'corrected' | 'reversed' | 'current' | 'reallocated' | 'replacement';

export interface TimelineVersion {
  key: string;
  version: number;
  statusLabel: string;
  badge: VersionBadge;
  createdAt: string;
  actor: string | null;
  reason: string | null;
  summaryLines: string[];
  diff: Array<{ key: string; old: string; new: string }>;
  isCurrentEffective: boolean;
}

const BADGE_CLASS: Record<VersionBadge, string> = {
  original: styles.badge, corrected: styles.badgeCorrected, reversed: styles.badgeReversed,
  current: styles.badgeCurrent, reallocated: styles.badgeCorrected, replacement: styles.badge,
};

export function FinancialVersionTimeline({ title, versions }: { title: string; versions: TimelineVersion[] }) {
  if (!versions.length) return <p className={styles.muted}>No version history.</p>;
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <ol className={styles.timeline}>
        {versions.map((v) => <VersionRow key={v.key} v={v} />)}
      </ol>
    </section>
  );
}

function VersionRow({ v }: { v: TimelineVersion }) {
  const [open, setOpen] = useState(false);
  const hasDetail = v.diff.length > 0 || v.summaryLines.length > 0;
  return (
    <li className={styles.versionRow}>
      <div className={styles.versionHead}>
        <span className={styles.eventType}>
          Version {v.version}
          <span className={`${styles.badge} ${BADGE_CLASS[v.badge]}`}>{v.statusLabel}</span>
          {v.isCurrentEffective && <span className={`${styles.badge} ${styles.badgeCurrent}`}>Current effective</span>}
        </span>
        <span className={styles.eventTime}>{new Date(v.createdAt).toLocaleString()}</span>
      </div>
      {v.reason && <p className={styles.muted}>Reason: {v.reason}</p>}
      {v.actor && <p className={styles.muted}>By: {v.actor}</p>}
      {hasDetail && (
        <button type="button" className={styles.expandBtn} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Hide details' : 'Show details'}
        </button>
      )}
      {open && (
        <div className={styles.diffGrid}>
          {v.summaryLines.map((line, i) => <div key={i}>{line}</div>)}
          {v.diff.map((d) => (
            <div key={d.key} className={styles.diffRow}>
              <span className={styles.diffKey}>{d.key}</span>
              <span>{d.old}</span><span className={styles.arrow}>→</span><span>{d.new}</span>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
