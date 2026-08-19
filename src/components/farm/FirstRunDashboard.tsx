import Link from 'next/link';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { FirstRunDashboardData } from '@/lib/first-run-dashboard-data';
import type { PrimaryAction } from '@/lib/dashboard-experience';
import styles from './FirstRunDashboard.module.css';

const CROP_LABEL: Record<string, string> = {
  wheat: 'Wheat',
  potato: 'Potato',
  onion: 'Onion',
  sugar_beet: 'Sugar beet',
  barley: 'Barley',
  oilseed_rape: 'Oilseed rape',
  cover_crop: 'Cover crop',
  grass: 'Grass',
  other: 'Other',
};

interface Props {
  data: FirstRunDashboardData;
  primaryAction: PrimaryAction | null;
  fieldCount: number;
}

// Secondary, non-dominant links shown alongside the one primary CTA — never
// styled to compete with it (Part 2: "only one CTA should be visually
// dominant").
const SECONDARY_LINKS: Record<string, { label: string; href: string }> = {
  add_inventory: { label: 'Record an activity instead', href: '/activities' },
  record_activity: { label: 'Add another product', href: '/onboarding?step=inventory' },
  add_field: { label: 'Record an activity', href: '/activities' },
  review_weather: { label: 'Add another field', href: '/fields' },
};

export function FirstRunDashboard({ data, primaryAction, fieldCount }: Props) {
  const secondary = primaryAction ? SECONDARY_LINKS[primaryAction.key] : null;

  return (
    <div className={styles.container}>
      <div className={styles.setupBanner}>
        <span className={styles.checkIcon}>✓</span>
        <span>Farm setup complete — here&apos;s what&apos;s ready so far.</span>
      </div>

      <div className={styles.summaryGrid}>
        <Card>
          <CardHeader icon="◈" title="Farm" />
          <CardBody padding="sm">
            <p className={styles.summaryValue}>{data.farmName}</p>
            <p className={styles.summaryMeta}>
              {data.seasonYear ? `Season ${data.seasonYear} · active` : 'No active season'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon="▦" title="First field" />
          <CardBody padding="sm">
            {data.firstField ? (
              <>
                <p className={styles.summaryValue}>{data.firstField.name}</p>
                <p className={styles.summaryMeta}>
                  {data.firstField.hectares.toFixed(1)} ha
                  {data.firstField.crop && ` · ${CROP_LABEL[data.firstField.crop] ?? data.firstField.crop}`}
                  {fieldCount > 1 && ` · +${fieldCount - 1} more field${fieldCount - 1 !== 1 ? 's' : ''}`}
                </p>
              </>
            ) : (
              <p className={styles.summaryMeta}>No field yet</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon="◌" title="Weather" />
          <CardBody padding="sm">
            {data.hasCoordinates && data.weather ? (
              <>
                <p className={styles.summaryValue}>{Math.round(data.weather.currentTempCelsius)}°C</p>
                <p className={styles.summaryMeta}>{data.weather.location}</p>
              </>
            ) : (
              <>
                <p className={styles.summaryMeta}>No coordinates set yet</p>
                <Link href="/onboarding?step=farm" className={styles.inlineLink}>Add coordinates</Link>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Not shown: revenue, margins, compliance status, or AI insights —
          with zero recorded activities, all of those would be zeros
          dressed up as information, not real answers. */}
      <div className={styles.explainer}>
        Finance, compliance, and AI insights will appear here once you&apos;ve recorded
        some activity — there&apos;s nothing real to show yet, so we&apos;re not faking it.
      </div>

      {primaryAction && (
        <div className={styles.actionArea}>
          <Link href={primaryAction.href}>
            <Button variant="primary" size="md" className={styles.primaryCta}>
              {primaryAction.label}
            </Button>
          </Link>
          {secondary && (
            <Link href={secondary.href} className={styles.secondaryLink}>
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
