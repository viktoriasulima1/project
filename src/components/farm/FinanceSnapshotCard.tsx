import Link from 'next/link';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import type { FinanceData } from '@/lib/finance-data';
import styles from './FinanceSnapshotCard.module.css';

function formatEur(value: number | null): string {
  if (value == null) return 'Not recorded';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}€${(abs / 1_000).toFixed(0)}k`;
  return `${sign}€${abs.toFixed(0)}`;
}

interface FinanceSnapshotCardProps {
  finance: FinanceData;
}

/**
 * Shows only what's real: recorded input cost derived from actual activity +
 * inventory-price data, and how complete that picture is. Deliberately never
 * shows revenue, margin, or "on track"/"at risk" verdicts — no income model
 * exists in this product yet, so none of those numbers would be real. See
 * docs/Sprint_16_Half_Built_Loops_Audit.md, Workflow 3.
 */
export function FinanceSnapshotCard({ finance }: FinanceSnapshotCardProps) {
  return (
    <Card>
      <CardHeader
        icon="€"
        title="Finance Snapshot"
        subtitle={finance.seasonYear ? `Season ${finance.seasonYear} · recorded cost` : 'Recorded cost'}
      />
      <CardBody padding="none">
        {!finance.hasFinancialData ? (
          <div style={{ padding: 'var(--space-4)', fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)' }}>
            Cost tracking is active. Profitability becomes available after income and harvest revenue are recorded.
          </div>
        ) : (
          <>
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Recorded cost</span>
                <span className={styles.metricValue}>{formatEur(finance.totalRecordedCostEur)}</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Fields</span>
                <span className={styles.metricValue}>{finance.fields.length}</span>
              </div>
              <div className={`${styles.metric} ${finance.completenessPercent < 100 ? styles.metricAlert : styles.metricPositive}`}>
                <span className={styles.metricLabel}>Price coverage</span>
                <span className={styles.metricValue}>{finance.completenessPercent}%</span>
              </div>
            </div>

            <div className={styles.marginSection}>
              <ul className={styles.cropList}>
                {finance.crops.slice(0, 4).map((cf) => (
                  <li key={cf.crop} className={styles.cropItem}>
                    <div className={styles.cropInfo}>
                      <span className={styles.cropName}>{cf.crop.replaceAll('_', ' ')}</span>
                      <span className={styles.cropHa}>{cf.hectares.toFixed(1)} ha</span>
                    </div>
                    <span className={styles.cropCost}>{formatEur(cf.costEur)}</span>
                  </li>
                ))}
              </ul>
              {finance.completenessPercent < 100 && (
                <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--color-text-muted)' }}>
                  {finance.missingPriceProducts.length} product{finance.missingPriceProducts.length !== 1 ? 's' : ''} missing a purchase price — totals are undercounted until added.
                </p>
              )}
            </div>
          </>
        )}

        <Link href="/finance" className={styles.viewAll}>
          Full cost report →
        </Link>
      </CardBody>
    </Card>
  );
}
