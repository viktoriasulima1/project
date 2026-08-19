import Link from 'next/link';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Field, FieldStatus, CropName } from '@/types/farm';
import styles from './FieldsOverviewCard.module.css';

const STATUS_VARIANT: Record<FieldStatus, 'green' | 'amber' | 'red' | 'default'> = {
  healthy: 'green',
  attention: 'amber',
  critical: 'red',
  fallow: 'default',
};

const CROP_LABEL: Record<CropName, string> = {
  wheat: 'Wheat',
  potato: 'Potato',
  onion: 'Onion',
  sugar_beet: 'Sugar beet',
  barley: 'Barley',
  corn: 'Corn',
  rapeseed: 'Rapeseed',
  rye: 'Rye',
  oat: 'Oat',
};

interface FieldsOverviewCardProps {
  fields: Field[];
}

export function FieldsOverviewCard({ fields }: FieldsOverviewCardProps) {
  const totalHa = fields.reduce((s, f) => s + f.hectares, 0);
  const attentionCount = fields.filter((f) => f.status === 'attention' || f.status === 'critical').length;
  const activeCrops = [...new Set(fields.map((f) => f.currentCrop).filter(Boolean))];

  return (
    <Card>
      <CardHeader
        icon="▦"
        title="Fields"
        subtitle={`${fields.length} fields · ${totalHa.toFixed(1)} ha`}
      />
      <CardBody padding="none">
        {/* Stats row */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{fields.length}</span>
            <span className={styles.statLabel}>Fields</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{totalHa.toFixed(0)}</span>
            <span className={styles.statLabel}>Hectares</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${attentionCount > 0 ? styles.statWarning : ''}`}>
              {attentionCount}
            </span>
            <span className={styles.statLabel}>Need attention</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{activeCrops.length}</span>
            <span className={styles.statLabel}>Crop types</span>
          </div>
        </div>

        {/* Field list */}
        <ul className={styles.list}>
          {fields.map((field) => (
            <li key={field.id} className={styles.item}>
              <div className={styles.fieldInfo}>
                <span className={styles.fieldName}>{field.name}</span>
                <span className={styles.fieldHa}>{field.hectares} ha</span>
              </div>
              <div className={styles.fieldMeta}>
                {field.currentCrop && (
                  <span className={styles.crop}>
                    {CROP_LABEL[field.currentCrop]}
                  </span>
                )}
                <Badge variant={STATUS_VARIANT[field.status]} size="sm">
                  {field.status === 'healthy' ? `NDVI ${field.ndviScore ?? '–'}` : field.status}
                </Badge>
              </div>
            </li>
          ))}
        </ul>

        <Link href="/fields" className={styles.viewAll}>
          View all fields →
        </Link>
      </CardBody>
    </Card>
  );
}
