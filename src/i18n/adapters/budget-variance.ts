import type { Locale } from '../locales';
import type { Translate } from '../translator';
import { formatCurrency, formatNumber } from '../format';
import type { BudgetVarianceActionCode, BudgetVarianceReasonCode, BudgetVarianceResult, BudgetVarianceStatus } from '@/lib/economics';
import type { BudgetRowCode, BudgetRowNoteCode } from '@/lib/field-economics-detail';

export interface BudgetVarianceDisplayModel {
  title: string;
  budgetLabel: string;
  actualLabel: string;
  varianceLabel: string;
  notRecordedLabel: string;
  statusLabel: string;
  explanation: string;
  actionLabel: string;
  budgetText: string;
  actualText: string;
  varianceText: string;
  percentageText: string;
}

function statusLabel(t: Translate, code: BudgetVarianceStatus): string {
  switch (code) {
    case 'within_budget': case 'over_budget': case 'under_budget': case 'unavailable': return t(`economics.budgetVariance.status.${code}`);
    default: { const neverCode: never = code; return neverCode; }
  }
}

function reasonLabel(t: Translate, code: BudgetVarianceReasonCode): string {
  switch (code) {
    case 'WITHIN_BUDGET': case 'OVER_BUDGET': case 'UNDER_BUDGET':
    case 'BUDGET_NOT_RECORDED': case 'ACTUAL_COST_NOT_RECORDED': case 'BUDGET_AND_ACTUAL_NOT_RECORDED':
    case 'ACTUAL_COST_INCOMPLETE': case 'CURRENCY_MISMATCH': return t(`economics.budgetVariance.reasons.${code}`);
    default: { const neverCode: never = code; return neverCode; }
  }
}

function actionLabel(t: Translate, code: BudgetVarianceActionCode): string {
  switch (code) {
    case 'ADD_BUDGET': case 'RECORD_ACTUAL_COST': case 'REVIEW_COSTS': case 'REVIEW_UNPRICED_COSTS':
    case 'OPEN_FINANCE': case 'NO_ACTION_REQUIRED': return t(`economics.budgetVariance.actions.${code}`);
    default: { const neverCode: never = code; return neverCode; }
  }
}

const units = (cents: number | null) => cents == null ? null : cents / 100;

export function buildBudgetVarianceDisplayModel(t: Translate, locale: Locale, result: BudgetVarianceResult): BudgetVarianceDisplayModel {
  const m = result.metadata;
  const missing = t('economics.budgetVariance.notRecorded');
  const currency = m.currency;
  return {
    title: t('economics.budgetVariance.title'),
    budgetLabel: t('economics.budgetVariance.labels.budget'),
    actualLabel: t('economics.budgetVariance.labels.actual'),
    varianceLabel: t('economics.budgetVariance.labels.variance'),
    notRecordedLabel: missing,
    statusLabel: statusLabel(t, result.status),
    explanation: reasonLabel(t, result.reasonCode),
    actionLabel: actionLabel(t, result.actionCode),
    budgetText: m.budgetCents == null ? missing : formatCurrency(units(m.budgetCents)!, locale, currency),
    actualText: m.actualCents == null ? missing : formatCurrency(units(m.actualCents)!, locale, currency),
    varianceText: m.varianceCents == null ? missing : formatCurrency(units(m.varianceCents)!, locale, currency),
    percentageText: m.variancePercent == null ? missing : `${formatNumber(m.variancePercent, locale, { maximumFractionDigits: 1 })}%`,
  };
}

export function budgetRowLabel(t: Translate, code: BudgetRowCode): string {
  switch (code) {
    case 'INPUT_COST': case 'LABOUR': case 'MACHINERY': case 'CONTRACTOR': case 'TOTAL_COST':
    case 'YIELD': case 'REVENUE': case 'GROSS_MARGIN': return t(`economics.budgetVariance.rows.${code}`);
    default: { const neverCode: never = code; return neverCode; }
  }
}

export function budgetRowNote(t: Translate, code: BudgetRowNoteCode): string {
  switch (code) {
    case 'PLANNED_NOT_RECORDED': case 'ACTUAL_INCOMPLETE': case 'HARVEST_NOT_RECORDED':
    case 'REVENUE_NOT_RECORDED': case 'GROSS_MARGIN_INCOMPLETE': return t(`economics.budgetVariance.notes.${code}`);
    default: { const neverCode: never = code; return neverCode; }
  }
}
