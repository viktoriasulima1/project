'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { refreshDailyBriefing, submitBriefingFeedback } from '@/lib/actions/ai-briefing';
import type { DailyBriefingResult } from '@/lib/ai/daily-briefing-service';
import styles from './GroundedBriefingCard.module.css';

export function GroundedBriefingCard({ briefing }: { briefing: DailyBriefingResult }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  useEffect(() => { const update = () => setOnline(navigator.onLine); update(); addEventListener('online', update); addEventListener('offline', update); return () => { removeEventListener('online', update); removeEventListener('offline', update); }; }, []);
  const facts = new Map(briefing.facts.map((fact) => [fact.id, fact]));
  const feedback = (itemId: string, feedbackType: 'helpful' | 'not_useful' | 'incorrect' | 'already_knew') => startTransition(async () => {
    const result = await submitBriefingFeedback({ briefingId: briefing.id, itemId, feedbackType });
    setMessage(result.error ?? 'Feedback saved. It will be used for evaluation, not automatic retraining.');
  });
  const items = (list: typeof briefing.output.primary, secondary = false) => list.map((item) => {
    const fact = facts.get(item.factId);
    return <article className={styles.item} key={item.factId} data-blocked={item.blockerStatus === 'blocked'}>
      <div className={styles.itemHeader}><span className={styles.status}>{item.blockerStatus}</span><h3>{item.title}</h3></div>
      <p className={styles.action}>{item.recommendedAction}</p>
      <p>{item.whyItMatters}</p>
      {item.financialContext && <p className={styles.finance}>{item.financialContext}</p>}
      <div className={styles.meta}><span>{item.confidence} confidence</span><span>{item.dataFreshness} data</span>{secondary && <span>Can usually wait</span>}</div>
      <details className={styles.evidence}>
        <summary>Why / evidence</summary>
        <p>Deterministic source: {fact?.source ?? 'FarmOS priority resolver'}</p>
        <p>Observed: {fact ? new Date(fact.timestamp).toLocaleString('nl-NL') : 'Current snapshot'}</p>
        <p>AI may rewrite the explanation; priority and facts are calculated by FarmOS.</p>
        <ul>{item.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>
      </details>
      <div className={styles.itemFooter}>
        <Link href={item.nextActionRoute}>Open action →</Link>
        <div className={styles.feedback} aria-label="Briefing feedback">
          <button disabled={pending} onClick={() => feedback(item.factId, 'helpful')}>Helpful</button>
          <button disabled={pending} onClick={() => feedback(item.factId, 'not_useful')}>Not useful</button>
          <button disabled={pending} onClick={() => feedback(item.factId, 'incorrect')}>Incorrect</button>
          <button disabled={pending} onClick={() => feedback(item.factId, 'already_knew')}>Already knew</button>
        </div>
      </div>
    </article>;
  });
  return <section className={styles.card} aria-labelledby="daily-briefing-title">
    <header className={styles.header}>
      <div><h2 id="daily-briefing-title">Daily Farm Briefing</h2><p>Generated {new Date(briefing.generatedAt).toLocaleString('nl-NL')} · {briefing.weatherFreshness} weather</p></div>
      <div className={styles.controls}><span className={styles.mode}>{briefing.mode === 'grounded_ai' ? 'Grounded AI' : 'Rule-based fallback'}</span><button disabled={pending || !online} onClick={() => startTransition(async () => { await refreshDailyBriefing(); location.reload(); })}>{pending ? 'Refreshing…' : 'Refresh'}</button><Link href="/ai/briefings">History</Link></div>
    </header>
    {briefing.fallbackReason && <p className={styles.fallback}>Grounded AI wording is temporarily unavailable. FarmOS is showing rule-based priorities.</p>}
    {!online && <p className={styles.fallback}>Offline: this is the last synchronized briefing and may be stale. Generation is disabled until you reconnect.</p>}
    {(briefing.whatChanged.added.length > 0 || briefing.whatChanged.resolved.length > 0 || briefing.whatChanged.changed.length > 0) && <details className={styles.changed}><summary>What changed since the previous briefing</summary><p>{briefing.whatChanged.added.length} new · {briefing.whatChanged.resolved.length} resolved · {briefing.whatChanged.changed.length} changed factual signals</p></details>}
    <div className={styles.primary}>{items(briefing.output.primary)}</div>
    {briefing.output.secondary.length > 0 && <><h3 className={styles.secondaryTitle}>Can safely wait</h3><div className={styles.secondary}>{items(briefing.output.secondary, true)}</div></>}
    {briefing.output.seasonEconomicsNote && <p className={styles.seasonNote}>{briefing.output.seasonEconomicsNote}</p>}
    {message && <p className={styles.message} role="status">{message}</p>}
  </section>;
}
