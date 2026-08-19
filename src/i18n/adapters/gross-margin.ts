import type { Locale } from '../locales';
import type { Translate } from '../translator';
import type { GrossMarginActionCode, GrossMarginReasonCode, GrossMarginResult, GrossMarginStatus } from '@/lib/economics';

const money = (locale: Locale, currency: string, cents: number | null) => cents == null ? null : new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
const statusKey = (status: GrossMarginStatus) => `economics.grossMargin.status.${status}` as const;
const reasonKey = (reason: GrossMarginReasonCode) => `economics.grossMargin.reasons.${reason}` as const;
const actionKey = (action: GrossMarginActionCode) => `economics.grossMargin.actions.${action}` as const;

export function buildGrossMarginDisplayModel(t: Translate, locale: Locale, result: GrossMarginResult) {
  const { metadata } = result;
  return {
    title: t('economics.grossMargin.title'), statusLabel: t(statusKey(result.status)), explanation: t(reasonKey(result.reasonCode)),
    actionLabel: t(actionKey(result.actionCode)), revenueLabel: t('economics.grossMargin.labels.revenue'), costLabel: t('economics.grossMargin.labels.totalCost'),
    marginLabel: t('economics.grossMargin.labels.margin'), perHaLabel: t('economics.grossMargin.labels.perHa'), notRecorded: t('economics.grossMargin.notRecorded'),
    revenueText: money(locale, metadata.currency, metadata.revenueCents), costText: money(locale, metadata.currency, metadata.totalCostCents),
    marginText: money(locale, metadata.currency, metadata.grossMarginCents), perHaText: money(locale, metadata.currency, metadata.marginPerHaCents),
    available: result.available, status: result.status, reasonCode: result.reasonCode, actionCode: result.actionCode,
  };
}
