import type { Locale } from '../locales';
import type { Translate } from '../translator';
import { getEconomicSignalRoute, type EconomicSignal, type EconomicSignalActionCode, type EconomicSignalCode, type RawEconomicSignal } from '@/lib/farm-economic-signals';

const money = (locale: Locale, cents?: number) => cents == null ? null : new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
const percent = (locale: Locale, value?: number | null) => value == null ? null : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);

const signalKey = (code: EconomicSignalCode, leaf: 'title' | 'explanation' | 'evidence') => `economics.signals.types.${code}.${leaf}` as const;
const actionKey = (code: EconomicSignalActionCode) => `economics.signals.actions.${code}` as const;

export function buildEconomicSignalDisplayModel(t: Translate, locale: Locale, signal: RawEconomicSignal | EconomicSignal) {
  const fields = signal.metadata.affectedFieldNames.join(', ');
  const crops = signal.metadata.affectedCropNames.map((crop) => crop.replaceAll('_', ' ')).join(', ');
  const products = signal.metadata.productNames?.join(', ') ?? '';
  const values = {
    count: signal.metadata.affectedCount,
    field: fields,
    crop: crops,
    products,
    amount: money(locale, signal.metadata.amountCents) ?? t('economics.signals.notRecorded'),
    percent: percent(locale, signal.metadata.percentage) ?? t('economics.signals.notRecorded'),
    completeness: percent(locale, signal.metadata.completenessPercentage) ?? t('economics.signals.notRecorded'),
    breakEven: money(locale, signal.metadata.breakEvenCentsPerUnit) ?? t('economics.signals.notRecorded'),
    salePrice: money(locale, signal.metadata.salePriceCentsPerUnit) ?? t('economics.signals.notRecorded'),
    unit: signal.metadata.unit ?? t('economics.signals.unit'),
  };
  return {
    title: t(signalKey(signal.signalCode, 'title'), values),
    explanation: t(signalKey(signal.signalCode, 'explanation'), values),
    evidence: t(signalKey(signal.signalCode, 'evidence'), values),
    actionLabel: t(actionKey(signal.actionCode), values),
    actionHref: getEconomicSignalRoute(signal),
    severityLabel: 'priority' in signal && typeof signal.priority === 'string' ? t(`economics.signals.severity.${signal.priority}`) : null,
  };
}
