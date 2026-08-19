import Link from 'next/link';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { InventoryItem, InventoryCategory } from '@/types/farm';
import styles from './InventoryAlertsCard.module.css';

const CATEGORY_LABEL: Record<InventoryCategory, string> = {
  herbicide: 'Herbicide',
  fungicide: 'Fungicide',
  insecticide: 'Insecticide',
  fertilizer: 'Fertilizer',
  seed: 'Seed',
  fuel: 'Fuel',
  other: 'Other',
};

function stockPercent(item: InventoryItem): number {
  if (item.minimumStock === 0) return 100;
  return Math.min(100, Math.round((item.currentStock / (item.minimumStock * 2)) * 100));
}

function isLowStock(item: InventoryItem): boolean {
  return item.currentStock < item.minimumStock;
}

function isExpiringSoon(item: InventoryItem): boolean {
  if (!item.expiryDate) return false;
  const expiry = new Date(item.expiryDate);
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return expiry <= in30 && expiry >= new Date();
}

interface InventoryAlertsCardProps {
  items: InventoryItem[];
}

export function InventoryAlertsCard({ items }: InventoryAlertsCardProps) {
  const lowCount = items.filter(isLowStock).length;
  const expiringCount = items.filter(isExpiringSoon).length;

  return (
    <Card>
      <CardHeader
        icon="◫"
        title="Inventory Alerts"
        subtitle={`${lowCount} low stock · ${expiringCount} expiring`}
      />
      <CardBody padding="none">
        {items.length === 0 ? (
          <p className={styles.empty}>All stock levels OK.</p>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => {
              const low = isLowStock(item);
              const expiring = isExpiringSoon(item);
              const pct = stockPercent(item);
              return (
                <li key={item.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemName}>{item.name}</span>
                    <div className={styles.badges}>
                      {low && <Badge variant="red" size="sm">Low stock</Badge>}
                      {expiring && <Badge variant="amber" size="sm">Expiring</Badge>}
                    </div>
                  </div>
                  <div className={styles.itemMeta}>
                    <span className={styles.category}>
                      {CATEGORY_LABEL[item.category]}
                    </span>
                    <span className={styles.stock}>
                      {item.currentStock} {item.unit} of {item.minimumStock} {item.unit} min
                    </span>
                  </div>
                  {/* Stock bar */}
                  <div className={styles.barTrack}>
                    <div
                      className={`${styles.barFill} ${low ? styles.barLow : styles.barOk}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {item.expiryDate && (
                    <span className={styles.expiry}>
                      Expires {new Date(item.expiryDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/inventory" className={styles.viewAll}>
          View full inventory →
        </Link>
      </CardBody>
    </Card>
  );
}
