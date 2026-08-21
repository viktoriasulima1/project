import { Topbar } from '@/components/layout/Topbar';
import { EconomicsForms } from '@/components/finance/EconomicsForms';
import { RateForms } from '@/components/finance/RateForms';
import { FinancialRecordActions } from '@/components/finance/FinancialRecordActions';
import { AllocationSection } from '@/components/finance/reallocation/AllocationSection';
import styles from '@/components/finance/Finance.module.css';
import { requireFarm } from '@/lib/require-farm';
import { getFinanceData } from '@/lib/finance-data';
import { getAllocatableRecords } from '@/lib/reallocation-data';
import { db } from '@/lib/db';
import { getServerI18n } from '@/i18n/server';
import { buildFinancialCompletenessDisplayModel } from '@/i18n/adapters/financial-completeness';
import { buildBudgetVarianceDisplayModel } from '@/i18n/adapters/budget-variance';
import { buildGrossMarginDisplayModel } from '@/i18n/adapters/gross-margin';
import type { FinancialCompletenessActionCode } from '@/lib/economics';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Field economics — FarmOS' };

const actionHref: Record<FinancialCompletenessActionCode, string> = {
  ADD_PURCHASE_PRICE: '/inventory',
  ADD_LABOUR_RATE: '/finance#rates',
  ADD_MACHINE_RATE: '/finance#rates',
  ADD_CONTRACTOR_COST: '/finance',
  ADD_HARVEST: '/finance#add-financial-data',
  ADD_REVENUE: '/finance',
  RECORD_OVERHEAD_CHOICE: '/finance#add-financial-data',
  ALIGN_UNITS: '/finance',
};

export default async function FinancePage() {
  const farm = await requireFarm();
  const finance = await getFinanceData(farm);
  const { locale, t } = await getServerI18n(['fields']);
  const eur = (value: number | null) => value == null
    ? 'Not recorded'
    : new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);
  const num = (value: number | null, suffix = '') => value == null ? 'Not recorded' : `${value.toFixed(2)}${suffix}`;
  const [fieldSeasons, inventory, employees, machines, allocatable] = await Promise.all([
    finance.seasonId
      ? db.fieldSeason.findMany({
        where: { seasonId: finance.seasonId, field: { farmId: farm.id, deletedAt: null } },
        include: { field: true },
        orderBy: { field: { name: 'asc' } },
      })
      : [],
    db.inventoryItem.findMany({ where: { farmId: farm.id }, orderBy: { name: 'asc' } }),
    db.employee.findMany({ where: { farmId: farm.id, isActive: true }, orderBy: { name: 'asc' } }),
    db.machine.findMany({ where: { farmId: farm.id }, orderBy: { name: 'asc' } }),
    getAllocatableRecords(farm, finance.seasonId ?? undefined),
  ]);
  const dialogFields = finance.fields.map((field) => ({
    fieldSeasonId: field.fieldSeasonId,
    label: field.field,
    crop: field.crop,
    hectares: field.hectares,
    yield: field.yieldQuantity,
  }));
  const completenessRows = finance.fields.map((field) => ({
    field,
    display: buildFinancialCompletenessDisplayModel(t, locale, field.completenessResult),
  }));
  const budgetVarianceByField = new Map(finance.fields.map((field) => [
    field.fieldSeasonId,
    buildBudgetVarianceDisplayModel(t, locale, field.costVariance),
  ]));
  const grossMarginByField = new Map(finance.fields.map((field) => [field.fieldSeasonId, buildGrossMarginDisplayModel(t, locale, field.grossMarginResult)]));

  return (
    <>
      <Topbar title="Field economics" subtitle="Recorded operational economics — not statutory accounting" farmName={farm.name} />
      <main className={styles.page}>
        <section className={styles.metrics}>
          <Metric label="Recorded costs" value={eur(finance.totalRecordedCostEur)} />
          <Metric label="Recorded revenue" value={eur(finance.totalRecordedRevenueEur)} />
          <Metric label={t('economics.grossMargin.title')} value={eur(finance.grossMarginEur)} />
          <Metric label={t('economics.completeness.title')} value={`${finance.completenessPercent}%`} />
        </section>

        <section className={styles.card} data-testid="finance-completeness-section">
          <h2>{t('economics.completeness.title')}</h2>
          <div className={styles.completenessList}>
            {completenessRows.map(({ field, display }) => (
              <article key={field.fieldSeasonId} className={styles.completenessItem} data-field-id={field.fieldId}>
                <h3>{field.field}</h3>
                <p data-testid="finance-completeness-status">
                  <strong>{display.summary}</strong> · {display.statusLabel}
                </p>
                {display.recordedItems.length > 0 && (
                  <p className={styles.muted}>
                    {display.recordedLabel}: {display.recordedList}.
                  </p>
                )}
                {display.reasonItems.length > 0 && (
                  <p className={styles.muted} data-testid="finance-completeness-reasons">
                    {display.missingLabel}: {display.reasonList}.
                  </p>
                )}
                {display.actions.length > 0 && (
                  <div className={styles.completenessActions} data-testid="finance-completeness-actions">
                    {display.actions.map((action) => (
                      <a key={action.code} className={styles.secondary} href={actionHref[action.code]}>
                        {action.label}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className={styles.grid}>
          {finance.seasonId && (
            <div id="add-financial-data">
              <EconomicsForms
                seasonId={finance.seasonId}
                fields={fieldSeasons.map((item) => ({ id: item.id, label: `${item.field.name} · ${item.crop}` }))}
                inventory={inventory.map((item) => ({
                  id: item.id,
                  label: `${item.name} · ${item.currentStock} ${item.unit} · ${item.purchasePricePerUnit ?? 'unvalued'}`,
                  unit: item.unit,
                }))}
              />
            </div>
          )}
          <div className={styles.card}>
            <h2>Unallocated and pending</h2>
            <p>Costs: {eur(finance.unallocatedCostEur)}</p>
            <p>Revenue: {eur(finance.unallocatedRevenueEur)}</p>
            <p>Expected revenue: {eur(finance.expectedRevenueEur)}</p>
            <p>Approved revenue: {eur(finance.approvedRevenueEur)}</p>
            <p className={styles.muted}>Only received income enters recorded revenue. Allocations are never assigned silently.</p>
            <a className={styles.button} href="/reports">Open economics reports</a>
          </div>
        </section>

        <div id="rates">
          <RateForms
            employees={employees.map((item) => ({ id: item.id, label: `${item.name} · ${item.labourCostType.replaceAll('_', ' ')}` }))}
            machines={machines.map((item) => ({ id: item.id, label: item.name }))}
          />
        </div>

        <section className={styles.card}>
          <h2>Field profitability</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Field / crop</th><th>Area</th><th>Cost</th><th>Revenue</th><th>{t('economics.grossMargin.title')}</th><th>Cost/ha</th><th>Yield</th><th>Cost/unit</th><th>Budget variance</th><th>Complete</th></tr></thead>
              <tbody>
                {finance.fields.map((row) => (
                  <tr key={row.fieldSeasonId}>
                    <td><strong>{row.field}</strong><br /><span className={styles.muted}>{row.crop.replaceAll('_', ' ')}</span></td>
                    <td>{row.hectares.toFixed(2)} ha</td>
                    <td>{eur(row.recordedCostEur)}</td>
                    <td>{eur(row.recordedRevenueEur)}</td>
                    <td data-testid="finance-gross-margin" data-field-id={row.fieldId} className={row.grossMarginEur == null ? styles.na : row.grossMarginEur < 0 ? styles.negative : styles.positive}><strong>{grossMarginByField.get(row.fieldSeasonId)!.marginText ?? grossMarginByField.get(row.fieldSeasonId)!.notRecorded}</strong><br /><span data-testid="finance-gross-margin-status" className={styles.muted}>{grossMarginByField.get(row.fieldSeasonId)!.statusLabel}</span></td>
                    <td>{eur(row.costPerHaEur)}</td>
                    <td>{num(row.yieldQuantity, row.yieldUnit ? ` ${row.yieldUnit}` : '')}</td>
                    <td>{eur(row.costPerYieldUnit)}</td>
                    <td data-testid="finance-budget-variance" data-field-id={row.fieldId}>
                      <strong>{budgetVarianceByField.get(row.fieldSeasonId)!.varianceText}</strong><br />
                      <span className={styles.muted} data-testid="finance-budget-variance-status">{budgetVarianceByField.get(row.fieldSeasonId)!.statusLabel}</span>
                    </td>
                    <td>{row.completenessPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AllocationSection records={allocatable.records} fields={dialogFields} />
        <section className={styles.card}>
          <h2>Crop comparison</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Crop</th><th>Fields</th><th>Area</th><th>Cost/ha</th><th>Margin/ha</th><th>Completeness</th></tr></thead>
              <tbody>{finance.crops.map((row) => <tr key={row.crop}><td>{row.crop.replaceAll('_', ' ')}</td><td>{row.fields}</td><td>{row.hectares.toFixed(2)} ha</td><td>{eur(row.costPerHaEur)}</td><td>{eur(row.grossMarginPerHaEur)}</td><td>{row.completenessPercent}%</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className={styles.grid}>
          <div className={styles.card}>
            <h2>Recent purchases</h2>
            {finance.recentPurchases.length
              ? finance.recentPurchases.map((item) => <p key={item.id}>{item.date} · {item.item} · {item.quantity} {item.unit} · {eur(item.total)}</p>)
              : <p>None recorded.</p>}
            <p className={styles.muted}>Purchases cannot be edited after stock has been used. Reverse this purchase and create a replacement entry — the original purchase and any consumed cost snapshots stay unchanged in history.</p>
          </div>
          <div className={styles.card}><h2>Recent financial entries</h2><FinancialRecordActions entries={finance.recentEntries} /></div>
        </section>
        <p className={styles.muted}>Calculated {new Date(finance.lastCalculatedAt).toLocaleString(locale)}. Gross margin excludes missing and unallocated values and is not statutory profit.</p>
      </main>
    </>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className={`${styles.card} ${styles.metric}`}><span>{label}</span><strong>{value}</strong>{note && <small className={styles.muted}>{note}</small>}</div>;
}
