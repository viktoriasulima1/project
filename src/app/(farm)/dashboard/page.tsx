export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Topbar } from '@/components/layout/Topbar';
import { GroundedBriefingCard } from '@/components/farm/GroundedBriefingCard';
import { WeatherCard } from '@/components/farm/WeatherCard';
import { TasksCard } from '@/components/farm/TasksCard';
import { FieldsOverviewCard } from '@/components/farm/FieldsOverviewCard';
import { InventoryAlertsCard } from '@/components/farm/InventoryAlertsCard';
import { FinanceSnapshotCard } from '@/components/farm/FinanceSnapshotCard';
import { EconomicsDecisionsCard } from '@/components/farm/EconomicsDecisionsCard';
import { ComplianceCard } from '@/components/farm/ComplianceCard';
import { getFarmEconomicSignals } from '@/lib/farm-economic-signals';
import { FirstRunDashboard } from '@/components/farm/FirstRunDashboard';
import { Button } from '@/components/ui/Button';
import { getDashboardExperienceState } from '@/lib/dashboard-experience';
import { getRealDashboardData } from '@/lib/dashboard-data';
import { getFirstRunDashboardData } from '@/lib/first-run-dashboard-data';
import { getFinanceData } from '@/lib/finance-data';
import { getFarmInsights } from '@/lib/farm-insights';
import type { FarmInsight } from '@/lib/farm-insights';
import { LoadDemoFarmButton } from '@/components/farm/LoadDemoFarmButton';
import type { AIBriefingItem, NavModule } from '@/types/farm';
import styles from './page.module.css';
import { getOrGenerateDailyBriefing } from '@/lib/ai/daily-briefing-service';

// Sprint 16 Part 9 — the dashboard must not compute its own second version
// of "what needs attention"; it reuses the same getFarmInsights resolver
// the dedicated Farm Insights page calls, so the two can never disagree.
function toBriefingItems(insights: FarmInsight[]): AIBriefingItem[] {
  return insights.slice(0, 5).map((i) => ({
    id: i.id,
    priority: i.severity === 'low' ? 'low' : i.severity === 'medium' ? 'medium' : 'high',
    title: i.title,
    explanation: i.explanation,
    relatedModule: i.relatedModule as NavModule,
    actionLabel: i.actionLabel,
  }));
}

export const metadata = {
  title: 'Dashboard — FarmOS',
};

export default async function DashboardPage() {
  const experience = await getDashboardExperienceState();
  const { setupState } = experience;

  if (experience.state === 'onboarding_incomplete') {
    return (
      <>
        <Topbar title="FarmOS" subtitle="No farm configured" />
        <div style={{
          padding: '64px 40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-4)',
        }}>
          <div>
            <p style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              Finish setting up your farm
            </p>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: 440 }}>
              Create your farm, active season and first field to start using FarmOS.
            </p>
          </div>
          <div style={{ width: 200 }}>
            <div style={{
              height: 6, borderRadius: 999, background: 'var(--color-surface-elevated)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${setupState.completionPercent}%`,
                background: 'var(--color-blue)', transition: 'width 0.25s ease',
              }} />
            </div>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              {setupState.completionPercent}% complete
            </p>
          </div>
          <Link href={setupState.nextRoute}>
            <Button variant="primary">Start onboarding</Button>
          </Link>
          {process.env.NODE_ENV === 'development' && <LoadDemoFarmButton />}
        </div>
      </>
    );
  }

  // Reuse the farm already resolved inside getDashboardExperienceState() —
  // do not call getActiveFarm() again in the same request.
  const farm = setupState.farm;
  if (!farm) {
    // Defensive: setup said ready, but the farm vanished between reads
    // (e.g. deleted concurrently). Re-render the empty state rather than
    // crash on a null farm.
    return (
      <>
        <Topbar title="FarmOS" subtitle="No farm configured" />
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Farm setup incomplete. <Link href="/onboarding" style={{ color: 'var(--color-blue)' }}>Continue onboarding</Link>.
        </div>
      </>
    );
  }

  if (experience.state === 'first_run') {
    const firstRunData = await getFirstRunDashboardData(farm);
    return (
      <>
        <Topbar title={farm.name} subtitle="Your farm is set up" farmName={farm.name} />
        <FirstRunDashboard
          data={firstRunData}
          primaryAction={experience.primaryAction}
          fieldCount={experience.fieldCount}
        />
      </>
    );
  }

  // early_usage and active_farm both use the normal full dashboard — see
  // docs/Sprint_10_First_Value_Report.md for why early_usage doesn't get
  // its own distinct UI in this pass.
  const [data, financeData, insightsResult, groundedBriefing] = await Promise.all([
    getRealDashboardData(farm),
    getFinanceData(farm),
    getFarmInsights(farm),
    getOrGenerateDailyBriefing(farm),
  ]);
  const briefing = toBriefingItems(insightsResult.insights);
  // Sprint 25 Part 5 — dashboard economics signals from the SAME shared source
  // Farm Insights uses (getFarmEconomicSignals → buildEconomicSignals).
  const economicSignals = getFarmEconomicSignals(financeData, insightsResult.lastCalculatedAt);

  const today = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      <Topbar
        title={data.farm.name}
        subtitle={`${data.farm.location} · ${data.farm.totalHectares} ha · ${today}`}
        farmName={data.farm.name}
      />
      <main className={styles.grid}>
        {/* Full-width deterministic briefing. Language enhancement may only
            run after grounded context and structured-output validation. */}
        <div className={styles.fullWidth}>
          <GroundedBriefingCard briefing={groundedBriefing} />
        </div>

        {/* Full-width economics decisions (shared signal source) */}
        <div className={styles.fullWidth}>
          <EconomicsDecisionsCard data={economicSignals} />
        </div>

        {/* 3-column row: Weather · Tasks · Inventory */}
        <WeatherCard forecast={data.weather} />
        <TasksCard tasks={data.tasks} />
        <InventoryAlertsCard items={data.inventoryAlerts} />

        {/* 3-column row: Fields · Finance · Compliance */}
        <FieldsOverviewCard fields={data.fields} />
        <FinanceSnapshotCard finance={financeData} />
        <ComplianceCard items={data.compliance} />
      </main>
    </>
  );
}
