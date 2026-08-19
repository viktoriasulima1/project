import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { requireFarm } from '@/lib/require-farm';
import { getBriefingHistory } from '@/lib/ai/daily-briefing-service';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Briefing history — FarmOS' };

export default async function BriefingHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const farm = await requireFarm(); const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1); const history = await getBriefingHistory(farm.id, page);
  return <><Topbar title="Briefing history" subtitle="Read-only historical snapshots" farmName={farm.name} />
    <main style={{ padding: 'var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
      <p style={{ margin: 0, padding: 'var(--space-3)', background: 'var(--color-amber-subtle)', borderRadius: 'var(--radius-md)' }}>Historical briefing — do not use as current operational advice. Open Dashboard for current priorities.</p>
      {history.map((briefing) => <article key={briefing.id} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
        <h2 style={{ marginTop: 0, fontSize: 'var(--font-sm)' }}>{briefing.generatedAt.toLocaleString('nl-NL')} · {briefing.mode === 'grounded_ai' ? 'Grounded AI' : 'Rule-based fallback'}</h2>
        <p>Status: {briefing.status} · Data: {briefing.weatherFreshness} · Model: {briefing.model} · Prompt: {briefing.promptVersion}</p>
        <ol>{(briefing.topItemsSnapshot as Array<{ title: string }>).map((item) => <li key={item.title}>{item.title}</li>)}</ol>
        <p>Changes: {JSON.stringify(briefing.whatChangedSnapshot)} · Feedback entries: {briefing.feedback.length}</p>
      </article>)}
      {history.length === 0 && <p>No generated briefings yet. Open Dashboard to generate the first safe briefing.</p>}
      <nav style={{ display: 'flex', gap: 'var(--space-3)' }}>{page > 1 && <Link href={`/ai/briefings?page=${page - 1}`}>← Newer</Link>}{history.length === 10 && <Link href={`/ai/briefings?page=${page + 1}`}>Older →</Link>}</nav>
    </main></>;
}
