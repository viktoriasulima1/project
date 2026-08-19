import Link from 'next/link';
import type { FarmEconomicSignals, EconomicSignal } from '@/lib/farm-economic-signals';
import styles from './EconomicsDecisionsCard.module.css';
import { getServerI18n } from '@/i18n/server';
import { buildEconomicSignalDisplayModel } from '@/i18n/adapters/economic-signals';
import type { Locale } from '@/i18n/locales';
import type { Translate } from '@/i18n/translator';

const SEV_CLASS: Record<string, string> = { critical: styles.sevCritical, high: styles.sevHigh, medium: styles.sevMedium, low: styles.sevLow };
const money = (locale: Locale, value: number | null, t: Translate) => value == null ? t('economics.signals.notRecorded') : new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);

export async function EconomicsDecisionsCard({ data }: { data: FarmEconomicSignals }) {
  const { locale, t } = await getServerI18n(['fields']);
  if (!data.hasSeason) return <section className={styles.card} data-testid="economics-decisions-card" aria-label={t('economics.signals.title')}><div className={styles.head}><h2>{t('economics.signals.title')}</h2></div><p className={styles.empty}>{t('economics.signals.noSeason')}</p></section>;
  const strip = data.seasonStrip;
  return (
    <section className={styles.card} data-testid="economics-decisions-card" aria-label={t('economics.signals.title')}>
      <div className={styles.head}><h2>{t('economics.signals.title')}</h2><span className={styles.calc}>{t('economics.signals.calculated', { date: new Date(data.calculatedAt).toLocaleString(locale) })}</span></div>
      <div className={styles.strip}>
        <div className={styles.stat}><span>{t('economics.signals.recordedCosts')}</span><strong>{money(locale, strip.recordedCostEur, t)}</strong></div>
        <div className={styles.stat}><span>{t('economics.signals.recordedRevenue')}</span><strong>{money(locale, strip.recordedRevenueEur, t)}</strong></div>
        <div className={styles.stat}><span>{t('economics.signals.grossMargin')}</span><strong>{money(locale, strip.grossMarginEur, t)}</strong></div>
        <div className={styles.stat}><span>{t('economics.signals.completeness')}</span><strong>{strip.completenessPercent}%</strong></div>
      </div>
      {!strip.profitabilityReady && <p className={styles.notReady}>{t('economics.signals.incomplete')}</p>}
      {data.topSignals.length === 0 ? <p className={styles.empty}>{t('economics.signals.none')}</p> : <div className={styles.signals}>{data.topSignals.map((signal) => <SignalRow key={signal.id} signal={signal} t={t} locale={locale} />)}</div>}
      {data.signals.length > data.topSignals.length && <Link className={styles.more} href="/ai">{t('economics.signals.more', { count: data.signals.length })} →</Link>}
    </section>
  );
}

function SignalRow({ signal, t, locale }: { signal: EconomicSignal; t: Translate; locale: Locale }) {
  const model = buildEconomicSignalDisplayModel(t, locale, signal);
  return <div className={styles.signal} data-testid={`economic-signal-${signal.signalCode}`}>
    <div className={styles.signalHead}><span className={styles.title} data-testid="economic-signal-title">{model.title}</span><span className={`${styles.sev} ${SEV_CLASS[signal.priority] ?? ''}`}>{model.severityLabel}</span></div>
    <p className={styles.explain} data-testid="economic-signal-explanation">{model.explanation}</p>
    <div className={styles.meta}><span>{model.evidence}</span><span>{t('economics.signals.ruleBased', { confidence: signal.confidence })}</span></div>
    <Link className={styles.cta} data-testid="economic-signal-action" href={model.actionHref}>{model.actionLabel}</Link>
  </div>;
}
