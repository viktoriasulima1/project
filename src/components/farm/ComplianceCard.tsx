import Link from 'next/link';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ComplianceItem, ComplianceStatus, ComplianceModule } from '@/types/farm';
import styles from './ComplianceCard.module.css';

const STATUS_VARIANT: Record<ComplianceStatus, 'green' | 'amber' | 'red' | 'default'> = {
  complete: 'green',
  missing: 'red',
  expiring: 'amber',
  expired: 'red',
};

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  complete: 'Complete',
  missing: 'Missing',
  expiring: 'Expiring',
  expired: 'Expired',
};

const MODULE_LABEL: Record<ComplianceModule, string> = {
  spray_diary: 'Spray Diary',
  cap: 'CAP Eco-scheme',
  certificate: 'Certifications',
  report: 'Report',
};

const STATUS_SORT: Record<ComplianceStatus, number> = {
  missing: 0,
  expired: 1,
  expiring: 2,
  complete: 3,
};

interface ComplianceCardProps {
  items: ComplianceItem[];
}

export function ComplianceCard({ items }: ComplianceCardProps) {
  const actionCount = items.filter(
    (i) => i.status === 'missing' || i.status === 'expired',
  ).length;
  const expiringCount = items.filter((i) => i.status === 'expiring').length;

  const sorted = [...items].sort(
    (a, b) => STATUS_SORT[a.status] - STATUS_SORT[b.status],
  );

  return (
    <Card>
      <CardHeader
        icon="✓"
        title="Compliance"
        subtitle={
          actionCount > 0
            ? `${actionCount} action required · ${expiringCount} expiring`
            : expiringCount > 0
            ? `${expiringCount} expiring soon`
            : 'All areas compliant'
        }
      />
      <CardBody padding="none">
        <ul className={styles.list}>
          {sorted.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.itemLeft}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <Badge variant={STATUS_VARIANT[item.status]} size="sm">
                    {STATUS_LABEL[item.status]}
                  </Badge>
                </div>
                <div className={styles.itemMeta}>
                  <span className={styles.module}>{MODULE_LABEL[item.module]}</span>
                  {item.dueDate && (
                    <span
                      className={`${styles.due} ${
                        item.status === 'missing' || item.status === 'expired'
                          ? styles.dueUrgent
                          : ''
                      }`}
                    >
                      Due{' '}
                      {new Date(item.dueDate).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className={styles.note}>{item.description}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <Link href="/compliance" className={styles.viewAll}>
          View full compliance dashboard →
        </Link>
      </CardBody>
    </Card>
  );
}
