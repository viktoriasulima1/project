export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { FieldEconomicsHistory, type VersionGroup } from '@/components/fields/FieldEconomicsHistory';
import { FieldActionsBar } from '@/components/fields/FieldActionsBar';
import type { TimelineVersion } from '@/components/fields/FinancialVersionTimeline';
import { requireFarm } from '@/lib/require-farm';
import { db } from '@/lib/db';
import {
  getFieldEconomicsDetail, getFieldEconomicSourceRecords, getFieldEconomicTimeline,
  getFinancialRecordVersionHistory, getAllocationHistory, type VersionedType,
} from '@/lib/field-economics-detail';
import { getFinancialAttributionLabel, getFinancialCategoryLabel, getFinancialSourceTypeLabel, getFinancialVersionStateLabel } from '@/i18n/adapters/financial-categories';
import { resolveFieldHealthStatus } from '@/lib/scouting/field-health';
import { buildFieldHealthDisplayModel } from '@/i18n/adapters/field-health';
import { buildBreakEvenDisplayModel } from '@/i18n/adapters/break-even';
import { buildFinancialCompletenessDisplayModel } from '@/i18n/adapters/financial-completeness';
import { buildBudgetVarianceDisplayModel, budgetRowLabel, budgetRowNote } from '@/i18n/adapters/budget-variance';
import { buildGrossMarginDisplayModel } from '@/i18n/adapters/gross-margin';
import { getServerLocale, getServerI18n } from '@/i18n/server';
import { getEnumLabel } from '@/i18n/enum-labels';
import styles from '@/components/fields/FieldEconomics.module.css';

export const metadata = { title: 'Field economics — FarmOS' };

const eur = (v: number | null) => (v == null ? 'Not recorded' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v));
const num = (v: number | null, suffix = '') => (v == null ? 'Not recorded' : `${v.toFixed(2)}${suffix}`);
const pct = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)}%`);

export default async function FieldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const farm = await requireFarm();
  const detail = await getFieldEconomicsDetail(farm, id);
  // Cross-farm or missing field → not found (never reveals existence — Part 19).
  if (!detail) notFound();

  const fsId = detail.fieldSeasonId;
  const scouting = fsId ? await db.fieldSeason.findFirst({ where: { id: fsId, field: { farmId: farm.id } }, include: { cropStageRecords: { orderBy: { observedAt: 'desc' }, take: 10 }, scoutingVisits: { orderBy: { visitDate: 'desc' }, take: 8, include: { observations: { include: { photos: true, followUpWorkOrder: true } } } } } }) : null;
  const currentStage = scouting?.cropStageRecords.find((record) => record.isEffective);
  const health = resolveFieldHealthStatus({ hasActiveSeason: Boolean(fsId), observations: scouting?.scoutingVisits.flatMap((visit) => visit.observations) ?? [], growthStageObservedAt: currentStage?.observedAt });
  const locale = await getServerLocale();
  const [sources, timeline, corrections, allocations] = await Promise.all([
    fsId ? getFieldEconomicSourceRecords(farm, fsId) : Promise.resolve({ records: [], total: 0 }),
    fsId ? getFieldEconomicTimeline(farm, fsId) : Promise.resolve({ events: [], total: 0 }),
    fsId ? buildCorrectionGroups(farm, fsId, locale) : Promise.resolve([] as VersionGroup[]),
    fsId ? buildAllocationGroups(farm, fsId, locale) : Promise.resolve([] as VersionGroup[]),
  ]);

  const s = detail.summary;
  const { t } = await getServerI18n(['fields']);
  const healthModel = buildFieldHealthDisplayModel(t, health);
  const breakEvenModel = buildBreakEvenDisplayModel(t, locale, detail.breakEven);
  const completenessModel = buildFinancialCompletenessDisplayModel(t, locale, detail.completeness);
  const budgetModel = buildBudgetVarianceDisplayModel(t, locale, detail.budget.result);
  const grossMarginModel = s ? buildGrossMarginDisplayModel(t, locale, s.grossMarginResult) : null;
  return (
    <>
      <Topbar title={detail.field.name} subtitle={detail.crop ? `${detail.crop.replaceAll('_', ' ')} · ${detail.season?.year ?? ''}` : t('detail.noActiveSeason')} farmName={farm.name} />
      <main className={styles.page}>
        <div className={styles.header}>
          <div>
            <a className={styles.back} href="/fields">{t('detail.allFields')}</a>
            <div className={styles.headerMeta}>
              <span>{`${detail.field.hectares.toFixed(2)} ha`}</span>
              <span>{t('detail.soil')}: {getEnumLabel(locale, 'soilType', detail.field.soilType)}</span>
              <span>{t('detail.status')}: {getEnumLabel(locale, 'fieldStatus', detail.field.status)}</span>
              <span>{t('detail.completeness')}: {detail.header.completenessPercent}% · {detail.header.completenessStatus.replaceAll('_', ' ')}</span>
              <span>{t('detail.calculated', { date: new Date(detail.header.lastCalculatedAt).toLocaleString(locale) })}</span>
            </div>
          </div>
        </div>

        {!fsId && <section className={styles.card}><p className={styles.muted}>{t('detail.noEconomics')}</p></section>}

        <section className={styles.card}>
          <h2>{t('detail.cropHealth')}</h2>
          <p><strong>{healthModel.statusLabel}</strong> · {t('detail.healthMeta', { confidence: health.confidence, freshness: health.freshness })}</p>
          <p>{healthModel.reason}</p><p className={styles.muted}>{healthModel.actionLabel}</p>
          <div className={styles.actions}><a className={styles.button} href={`/scouting?field=${detail.field.id}`}>{t('detail.startScouting')}</a><a className={styles.secondary} href={`/scouting?field=${detail.field.id}`}>{t('detail.addObservation')}</a></div>
        </section>
        <section className={styles.card}>
          <h2>{t('detail.currentGrowthStage')}</h2>
          {currentStage ? <><p><strong>{currentStage.stageSystem} {currentStage.stageCode}</strong> · {currentStage.label}</p><p className={styles.muted}>{t('detail.observed', { date: currentStage.observedAt.toLocaleString(locale), source: currentStage.source.replaceAll('_',' '), confidence: currentStage.confidence })}</p><details><summary>{t('detail.viewStageHistory')}</summary><ul>{scouting?.cropStageRecords.map((record)=><li key={record.id}>{record.stageSystem} {record.stageCode} · {record.label} · {record.observedAt.toLocaleDateString(locale)} {record.isEffective ? t('detail.current') : t('detail.superseded')}</li>)}</ul></details></> : <p className={styles.muted}>{t('detail.noGrowthStage')}</p>}
        </section>
        <section className={styles.card}><h2>{t('detail.recentScouting')}</h2>{scouting?.scoutingVisits.length ? <ul>{scouting.scoutingVisits.map((visit)=><li key={visit.id}>{visit.visitDate.toLocaleString(locale)} · {t('detail.visitSummary', { observations: visit.observations.length, open: visit.observations.filter((o)=>['open','monitoring','action_planned'].includes(o.status)).length, photos: visit.observations.reduce((n,o)=>n+o.photos.length,0) })}</li>)}</ul> : <p className={styles.muted}>{t('detail.noScoutingVisits')}</p>}<p className={styles.disclaimer}>{t('detail.scoutingDisclaimer')}</p></section>

        {/* Part 2 — summary metrics */}
        <section className={styles.metrics}>
          <Metric label="Total recorded cost" value={eur(s?.recordedCostEur ?? null)} />
          <Metric label="Cost / hectare" value={eur(s?.costPerHaEur ?? null)} />
          <Metric label="Recorded revenue" value={eur(s?.recordedRevenueEur ?? null)} />
          <Metric testId="harvest-metric" label="Harvest" value={num(s?.yieldQuantity ?? null, s?.yieldUnit ? ` ${s.yieldUnit}` : '')} />
          <Metric testId="yield-per-ha-metric" label="Yield / ha" value={num(s?.yieldPerHa ?? null)} />
          <Metric label="Cost / unit" value={eur(s?.costPerYieldUnit ?? null)} />
        </section>

        {grossMarginModel && <section className={styles.card} data-testid="gross-margin-section">
          <h2>{grossMarginModel.title}</h2>
          <div className={styles.metrics}>
            <Metric label={grossMarginModel.revenueLabel} value={grossMarginModel.revenueText ?? grossMarginModel.notRecorded} />
            <Metric label={grossMarginModel.costLabel} value={grossMarginModel.costText ?? grossMarginModel.notRecorded} />
            <Metric testId="gross-margin-value" label={grossMarginModel.marginLabel} value={grossMarginModel.marginText ?? grossMarginModel.notRecorded} />
            <Metric testId="margin-per-hectare-value" label={grossMarginModel.perHaLabel} value={grossMarginModel.perHaText ?? grossMarginModel.notRecorded} />
          </div>
          <p data-testid="gross-margin-status"><strong>{grossMarginModel.statusLabel}</strong></p>
          <p data-testid="gross-margin-reason" className={styles.muted}>{grossMarginModel.explanation}</p>
          <a data-testid="gross-margin-action" className={styles.secondary} href={grossMarginModel.actionCode === 'ADD_REVENUE' || grossMarginModel.actionCode === 'ADD_EXPENSE' ? '/finance' : grossMarginModel.actionCode === 'REVIEW_UNPRICED_COSTS' ? '/inventory' : `/fields/${detail.field.id}#cost-breakdown`}>{grossMarginModel.actionLabel}</a>
        </section>}

        {/* Part 6 — completeness */}
        <section className={styles.card} data-testid="financial-completeness-section">
          <h2>{completenessModel.title}</h2>
          <div className={styles.completeness}>
            <div className={styles.bar}><div className={styles.barFill} style={{ width: `${detail.completeness.percentage}%` }} /></div>
            <p data-testid="completeness-status"><strong>{completenessModel.summary}</strong> · {completenessModel.statusLabel}</p>
            {completenessModel.recordedItems.length > 0 && <p className={styles.muted}>{completenessModel.recordedLabel}: {completenessModel.recordedList}.</p>}
            {completenessModel.reasonItems.length > 0 && <p className={styles.muted} data-testid="completeness-reasons">{completenessModel.missingLabel}: {completenessModel.reasonList}.</p>}
            {completenessModel.actions.length > 0 && <div className={styles.chips} data-testid="completeness-actions">{completenessModel.actions.map((action) => <span key={action.code} className={styles.pill}>{action.label}</span>)}</div>}
          </div>
        </section>

        {/* Part 3 — cost breakdown */}
        <section className={styles.card} data-testid="cost-breakdown">
          <h2>{t('economics.costCategories.title')}</h2>
          {detail.breakdown.rows.length === 0 ? <p className={styles.muted}>{t('economics.costCategories.empty')}</p> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="sr-only">{t('economics.costCategories.caption')}</caption>
                <thead><tr><th>{t('economics.costCategories.category')}</th><th className={styles.num}>{t('economics.costCategories.amount')}</th><th className={styles.num}>{t('economics.costCategories.share')}</th><th className={styles.num}>{t('economics.costCategories.records')}</th><th>{t('economics.costCategories.attribution')}</th><th>{t('economics.costCategories.completeness')}</th></tr></thead>
                <tbody>
                  {detail.breakdown.rows.map((r) => (
                    <tr key={r.category} data-testid={`cost-category-${r.category}`}>
                      <td data-testid="cost-category-label">{getFinancialCategoryLabel(locale, r.category)}</td>
                      <td data-testid="cost-category-amount" className={r.recordedAmount == null ? `${styles.num} ${styles.na}` : styles.num}>{eur(r.recordedAmount)}</td>
                      <td className={styles.num}>{pct(r.shareOfRecordedCost)}</td>
                      <td className={styles.num}>{r.recordCount}</td>
                      <td>{r.hasDirect && r.hasAllocated ? t('economics.costCategories.directAndAllocated') : getFinancialAttributionLabel(locale, r.hasAllocated ? 'allocated' : 'direct')}</td>
                      <td>{r.complete ? t('economics.costCategories.complete') : <span className={styles.na}>{t('economics.costCategories.partial')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.muted}>{t('economics.costCategories.note')}</p>
        </section>

        {/* Part 5 — direct vs allocated */}
        <section className={styles.card}>
          <h2>{t('economics.attribution.title')}</h2>
          <table className={styles.table}>
            <tbody>
              <tr><td>{t('economics.attribution.direct')}</td><td className={styles.num}>{eur(detail.split.recordedDirect)}</td></tr>
              <tr><td>{t('economics.attribution.allocated')}</td><td className={styles.num}>{eur(detail.split.allocatedToField)}</td></tr>
              <tr><td><strong>{t('economics.attribution.total')}</strong></td><td className={styles.num}><strong>{eur(detail.split.totalFieldCost)}</strong></td></tr>
              {detail.split.excludedReversed > 0 && <tr><td>{t('economics.attribution.reversed')}</td><td className={styles.num}>{eur(detail.split.excludedReversed)}</td></tr>}
              <tr><td>{t('economics.attribution.unallocated')}</td><td className={`${styles.num} ${styles.muted}`}>{eur(detail.farmUnallocatedCostEur)}</td></tr>
            </tbody>
          </table>
          <p className={styles.muted}>{t('economics.attribution.note')}</p>
        </section>

        {/* Part 8 — break-even (localized via presentation adapter) */}
        <section className={styles.card} data-testid="break-even-section" aria-labelledby="break-even-heading">
          <h2 id="break-even-heading">{breakEvenModel.title}</h2>
          <div className={styles.metrics}>
            <div>
              <h3>{breakEvenModel.priceLabel}</h3>
              {breakEvenModel.price.available
                ? <p><strong>{breakEvenModel.price.valueText}</strong><br /><span className={styles.muted}>{breakEvenModel.price.formulaText}</span></p>
                : <p className={styles.na}>{breakEvenModel.unavailableLabel} — {breakEvenModel.price.reasonText}{breakEvenModel.price.actionText ? ` · ${breakEvenModel.price.actionText}` : ''}</p>}
            </div>
            <div>
              <h3>{breakEvenModel.yieldLabel}</h3>
              {breakEvenModel.yieldValue.available
                ? <p><strong>{breakEvenModel.yieldValue.valueText}</strong><br /><span className={styles.muted}>{breakEvenModel.yieldValue.formulaText}</span></p>
                : <p className={styles.na}>{breakEvenModel.unavailableLabel} — {breakEvenModel.yieldValue.reasonText}{breakEvenModel.yieldValue.actionText ? ` · ${breakEvenModel.yieldValue.actionText}` : ''}</p>}
            </div>
          </div>
        </section>

        {/* Part 7 — budget vs actual */}
        <section className={styles.card} data-testid="budget-variance-section">
          <h2>{budgetModel.title}</h2>
          <div className={styles.metrics}>
            <Metric testId="budget-value" label={budgetModel.budgetLabel} value={budgetModel.budgetText} />
            <Metric testId="actual-cost-value" label={budgetModel.actualLabel} value={budgetModel.actualText} />
            <Metric testId="variance-value" label={budgetModel.varianceLabel} value={budgetModel.varianceText} note={budgetModel.percentageText} />
          </div>
          <p data-testid="budget-variance-status"><strong>{budgetModel.statusLabel}</strong> · {budgetModel.explanation}</p>
          <a data-testid="budget-variance-action" className={styles.secondary} href={detail.budget.result.actionCode === 'ADD_BUDGET' ? '/planning' : detail.budget.result.actionCode === 'RECORD_ACTUAL_COST' ? '/finance' : detail.budget.result.actionCode === 'REVIEW_UNPRICED_COSTS' ? '/inventory' : '/finance'}>{budgetModel.actionLabel}</a>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>{t('economics.budgetVariance.labels.line')}</th><th className={styles.num}>{budgetModel.budgetLabel}</th><th className={styles.num}>{budgetModel.actualLabel}</th><th className={styles.num}>{budgetModel.varianceLabel}</th><th className={styles.num}>%</th></tr></thead>
              <tbody>
                {detail.budget.rows.map((r) => (
                  <tr key={r.code}>
                    <td>{budgetRowLabel(t, r.code)}{r.noteCode && <span className={styles.muted}> · {budgetRowNote(t, r.noteCode)}</span>}</td>
                    <td className={styles.num}>{r.code === 'YIELD' ? num(r.planned) : eur(r.planned)}</td>
                    <td className={styles.num}>{r.code === 'YIELD' ? num(r.actual) : eur(r.actual)}</td>
                    <td className={`${styles.num} ${r.variance.metadata.varianceCents == null ? styles.na : r.variance.metadata.varianceCents > 0 ? styles.negative : styles.positive}`}>{r.variance.metadata.varianceCents == null ? '—' : r.code === 'YIELD' ? num(r.variance.metadata.varianceCents / 100) : eur(r.variance.metadata.varianceCents / 100)}</td>
                    <td className={styles.num}>{pct(r.variance.metadata.variancePercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Part 4 — source records */}
        <section className={styles.card}>
          <h2>Source records ({sources.total})</h2>
          {sources.records.length === 0 ? <p className={styles.muted}>No source records for this field.</p> : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Date</th><th>Description</th><th>Module</th><th className={styles.num}>Amount</th><th>Allocation</th><th>Version</th></tr></thead>
                <tbody>
                  {sources.records.map((r) => (
                    <tr key={r.economicEntryId}>
                      <td>{r.date}</td>
                      <td>{r.description}{r.versionStateCode === 'corrected' && <span className={`${styles.badge} ${styles.badgeCorrected}`}>{getFinancialVersionStateLabel(locale, r.versionStateCode)}</span>}</td>
                      <td>{getFinancialSourceTypeLabel(locale, r.sourceTypeCode)} · {getFinancialCategoryLabel(locale, r.categoryCode)}</td>
                      <td className={`${styles.num} ${r.kind === 'revenue' ? styles.positive : ''}`}>{eur(r.amount)}</td>
                      <td>{getFinancialAttributionLabel(locale, r.attributionCode)}</td>
                      <td>{r.version ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.muted}>Every field value traces to a source record here. Identifiers are shown as descriptions, not raw database ids.</p>
        </section>

        {/* Part 9/10/13 — history */}
        {fsId && <FieldEconomicsHistory events={timeline.events} corrections={corrections} allocations={allocations} locale={locale} />}

        {/* Part 12 — purchase reversal-only disclosure */}
        <section className={styles.card}>
          <h2>Purchase history</h2>
          <p className={styles.muted}>Inventory purchases used by this field are reversal-only. This purchase was reversed and replaced. Historical activity costs remain based on the price known at completion — reversing a purchase never rewrites a past activity&apos;s recorded cost.</p>
        </section>

        {/* Part 14/15 — actions */}
        <FieldActionsBar hasActiveSeason={Boolean(detail.season)} lastCalculatedAt={detail.header.lastCalculatedAt} />
      </main>
    </>
  );
}

function Metric({ label, value, note, testId }: { label: string; value: string; note?: string; testId?: string }) {
  return <div className={`${styles.card} ${styles.metric}`} data-testid={testId}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

// ─── Server-side mappers from the query layer to timeline view models ─────────

const money = (v: number | string | null) => (v == null || v === '' ? '—' : typeof v === 'number' ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v) : String(v));

async function buildCorrectionGroups(farm: Awaited<ReturnType<typeof requireFarm>>, fieldSeasonId: string, locale: Awaited<ReturnType<typeof getServerLocale>>): Promise<VersionGroup[]> {
  const [exp, rev, harv] = await Promise.all([
    db.financialExpense.findMany({ where: { farmId: farm.id, fieldSeasonId, status: { in: ['active', 'reversed'] }, OR: [{ version: { gt: 1 } }, { status: 'reversed' }] }, select: { id: true, description: true }, take: 10 }),
    db.revenueEntry.findMany({ where: { farmId: farm.id, fieldSeasonId, status: { in: ['active', 'reversed'] }, OR: [{ version: { gt: 1 } }, { status: 'reversed' }] }, select: { id: true, name: true }, take: 10 }),
    db.harvestResult.findMany({ where: { farmId: farm.id, fieldSeasonId, status: { in: ['active', 'reversed'] }, OR: [{ version: { gt: 1 } }, { status: 'reversed' }] }, select: { id: true }, take: 10 }),
  ]);
  const jobs: Array<{ type: VersionedType; id: string; title: string }> = [
    ...exp.map((r) => ({ type: 'expense' as const, id: r.id, title: `Expense · ${r.description}` })),
    ...rev.map((r) => ({ type: 'revenue' as const, id: r.id, title: `Revenue · ${r.name}` })),
    ...harv.map((r) => ({ type: 'harvest' as const, id: r.id, title: 'Harvest' })),
  ];
  const histories = await Promise.all(jobs.map((j) => getFinancialRecordVersionHistory(farm, j.type, j.id)));
  return histories.map((h, i) => {
    if (!h) return null;
    const versions: TimelineVersion[] = h.entries.map((e) => ({
      key: e.id, version: e.version, statusLabel: getFinancialVersionStateLabel(locale, e.statusCode),
      // Reversed first — a reversed version-1 record must not read as "Original".
      badge: e.rawStatus === 'reversed' ? 'reversed' : e.version === 1 ? 'original' : e.isCurrentEffective ? 'current' : 'corrected',
      createdAt: e.createdAt, actor: e.actor, reason: e.reason,
      summaryLines: Object.entries(e.values).map(([k, v]) => `${k}: ${typeof v === 'number' ? money(v) : String(v ?? '—')}`),
      diff: Object.entries(e.diff).map(([k, d]) => ({ key: k, old: money(d.old), new: money(d.new) })),
      isCurrentEffective: e.isCurrentEffective,
    }));
    return { title: jobs[i].title, versions };
  // Show a chain with more than one version OR any reversal (a reversed record
  // is a single version but still belongs in the corrections/reversals history).
  }).filter((g): g is VersionGroup => g != null && (g.versions.length > 1 || g.versions.some((v) => v.badge === 'reversed')));
}

async function buildAllocationGroups(farm: Awaited<ReturnType<typeof requireFarm>>, fieldSeasonId: string, locale: Awaited<ReturnType<typeof getServerLocale>>): Promise<VersionGroup[]> {
  const reallocated = await db.economicAllocation.findMany({ where: { farmId: farm.id, fieldSeasonId, version: { gt: 1 } }, select: { economicEntryId: true }, distinct: ['economicEntryId'], take: 10 });
  const histories = await Promise.all(reallocated.map((r) => getAllocationHistory(farm, r.economicEntryId)));
  return histories.map((h) => {
    if (!h || h.versions.length === 0) return null;
    const versions: TimelineVersion[] = h.versions.map((v) => ({
      key: `${h.economicEntryId}-${v.version}`, version: v.version, statusLabel: getFinancialVersionStateLabel(locale, v.statusCode),
      badge: v.isCurrentEffective ? 'current' : 'reallocated', createdAt: v.createdAt, actor: v.actor, reason: v.reason,
      summaryLines: [
        `Method: ${v.method}`,
        ...v.destinations.map((d) => `${d.field ?? 'Unassigned'}: ${d.percentage.toFixed(1)}% · ${money(d.amount)}`),
        ...(v.unallocatedAmount > 0.005 ? [`Unallocated: ${money(v.unallocatedAmount)}`] : []),
      ],
      diff: [], isCurrentEffective: v.isCurrentEffective,
    }));
    return { title: `Allocation · ${h.sourceType.replaceAll('_', ' ')} · ${money(h.recordAmount)}`, versions };
  }).filter((g): g is VersionGroup => g != null);
}
