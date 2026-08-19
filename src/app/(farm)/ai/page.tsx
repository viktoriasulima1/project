import { Topbar } from '@/components/layout/Topbar';
import { StubPage } from '@/components/layout/StubPage';
import { requireFarm } from '@/lib/require-farm';
import { getFarmInsights } from '@/lib/farm-insights';
import type { FarmInsight } from '@/lib/farm-insights';
import { getServerI18n } from '@/i18n/server';
import { buildBudgetVarianceDisplayModel } from '@/i18n/adapters/budget-variance';
import type { Locale } from '@/i18n/locales';
import type { Translate } from '@/i18n/translator';
import { buildEconomicSignalDisplayModel } from '@/i18n/adapters/economic-signals';
import type { RawEconomicSignal } from '@/lib/farm-economic-signals';
import { buildSprayWindowDisplayModel } from '@/i18n/adapters/spray-window';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Farm Insights — FarmOS' };

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--color-red)',
  high: 'var(--color-red)',
  medium: 'var(--color-blue)',
  low: 'var(--color-text-muted)',
};

function InsightCard({ insight, t, locale }: { insight: FarmInsight; t: Translate; locale: Locale }) {
  const budget = insight.budgetVariance ? buildBudgetVarianceDisplayModel(t, locale, insight.budgetVariance) : null;
  const economic = insight.signalCode && insight.actionCode && insight.signalMetadata && insight.signalEvidence ? buildEconomicSignalDisplayModel(t, locale, {
    id: insight.id, signalCode: insight.signalCode, actionCode: insight.actionCode, fieldId: insight.fieldId ?? null,
    metadata: insight.signalMetadata, evidence: insight.signalEvidence, confidence: insight.confidence,
    relatedModule: insight.relatedModule as RawEconomicSignal['relatedModule'], role: 'alert', priority: {} as RawEconomicSignal['priority'], budgetVariance: insight.budgetVariance,
  }) : null;
  const spray = insight.sprayWindow ? buildSprayWindowDisplayModel(t, locale, insight.sprayWindow) : null;
  const title = economic?.title ?? spray?.statusLabel ?? (budget ? t('economics.budgetVariance.signal.title', { count: insight.affectedCount ?? 1 }) : insight.title);
  const explanation = economic?.explanation ?? spray?.explanation ?? (budget ? t('economics.budgetVariance.signal.explanation', { field: insight.affected ?? '', amount: budget.varianceText, percent: budget.percentageText }) : insight.explanation);
  return (
    <div style={{
      padding: 'var(--space-4)',
      border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${SEVERITY_COLOR[insight.severity]}`,
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-text-primary)' }}>{title}</span>
        <span style={{
          fontSize: 'var(--font-xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: SEVERITY_COLOR[insight.severity],
          fontWeight: 600,
        }}>
          {insight.severity}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-text-secondary)' }}>{explanation}</p>
      <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>{economic?.evidence ?? (budget ? t('economics.budgetVariance.signal.whyItMatters') : insight.whyItMatters)}</p>
      <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
        {economic ? `${economic.evidence} · ${t('economics.signals.ruleBased', { confidence: insight.confidence })}` : `Evidence: ${insight.evidence} · Confidence: ${insight.confidence} · Rule-based insight (no AI/ML model involved)`}
      </p>
      <a href={economic?.actionHref ?? insight.actionHref} style={{ fontSize: 'var(--font-xs)', color: 'var(--color-blue)', textDecoration: 'underline', alignSelf: 'flex-start' }}>
        {economic?.actionLabel ?? budget?.actionLabel ?? insight.actionLabel} →
      </a>
    </div>
  );
}

export default async function FarmInsightsPage() {
  const farm = await requireFarm();
  const result = await getFarmInsights(farm);
  const { locale, t } = await getServerI18n(['fields']);

  if (!result.hasAnySourceData) {
    return (
      <>
        <Topbar title="Farm Insights" subtitle="Automated checks — rule-based, not AI" farmName={farm.name} />
        <StubPage
          icon="✦"
          title="No insights yet"
          description="Insights are generated from real tasks, inventory, compliance, employees and fields — add some farm data to start seeing them."
          action={{ label: 'Go to dashboard', href: '/dashboard' }}
        />
      </>
    );
  }

  return (
    <>
      <Topbar title="Farm Insights" subtitle="Automated checks — rule-based, not AI" farmName={farm.name} />
      <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <a href="/ai/briefings" style={{ color: 'var(--color-blue)', alignSelf: 'flex-start' }}>View Daily Farm Briefing history →</a>
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--color-blue-subtle)',
          border: '1px solid var(--color-blue-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-xs)',
          color: 'var(--color-blue)',
        }}>
          Every insight below is a deterministic, rule-based check against your real farm data — never a general AI chatbot,
          and never presented as one. Last calculated: {new Date(result.lastCalculatedAt).toLocaleString('nl-NL')}.
        </div>

        {result.insights.length === 0 ? (
          <StubPage
            icon="✓"
            title="No insights right now"
            description="Nothing needs attention today. Insights appear here as tasks, stock, compliance or certificates need action."
          />
        ) : (
          <>
            <section>
              <h2 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
                Needs attention
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {result.aboveTheFold.length > 0 ? (
                  result.aboveTheFold.map((i) => <InsightCard key={i.id} insight={i} t={t} locale={locale} />)
                ) : (
                  <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>Nothing critical or high-priority right now.</p>
                )}
              </div>
            </section>

            {result.rest.length > 0 && (
              <section>
                <h2 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
                  Other insights
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {result.rest.map((i) => <InsightCard key={i.id} insight={i} t={t} locale={locale} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
