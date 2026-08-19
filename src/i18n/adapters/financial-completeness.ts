import type { Translate } from '../translator';
import type { Locale } from '../locales';
import type {
  CompletenessStatus, FinancialCompletenessActionCode,
  FinancialCompletenessReasonCode, FinancialCompletenessResult,
  FinancialRecordedDataCode,
} from '@/lib/economics';

export interface FinancialCompletenessDisplayModel {
  title: string;
  statusLabel: string;
  summary: string;
  recordedLabel: string;
  missingLabel: string;
  recordedItems: string[];
  reasonItems: string[];
  actions: Array<{ code: FinancialCompletenessActionCode; label: string }>;
  recordedList: string;
  reasonList: string;
}

function statusText(t: Translate, code: CompletenessStatus): string {
  switch (code) {
    case 'insufficient_data':
    case 'cost_tracking_active':
    case 'partial_profitability':
    case 'profitability_ready': return t(`economics.completeness.status.${code}`);
    default: { const neverCode: never = code; return String(neverCode); }
  }
}
function recordedText(t: Translate, code: FinancialRecordedDataCode): string {
  switch (code) {
    case 'PRODUCT_PRICES_RECORDED': case 'LABOUR_RATES_RECORDED': case 'MACHINE_RATES_RECORDED':
    case 'CONTRACTOR_COSTS_RECORDED': case 'HARVEST_RECORDED': case 'REVENUE_RECORDED':
    case 'OVERHEAD_CHOICE_RECORDED': case 'UNITS_COMPATIBLE': return t(`economics.completeness.recorded.${code}`);
    default: { const neverCode: never = code; return String(neverCode); }
  }
}
function reasonText(t: Translate, code: FinancialCompletenessReasonCode): string {
  switch (code) {
    case 'MISSING_PRODUCT_PRICE': case 'MISSING_LABOUR_RATE': case 'MISSING_MACHINE_RATE':
    case 'MISSING_CONTRACTOR_COST': case 'MISSING_HARVEST': case 'MISSING_REVENUE':
    case 'MISSING_OVERHEAD_CHOICE': case 'INCOMPATIBLE_UNITS': return t(`economics.completeness.reasons.${code}`);
    default: return t('economics.completeness.unknown');
  }
}
function actionText(t: Translate, code: FinancialCompletenessActionCode): string {
  switch (code) {
    case 'ADD_PURCHASE_PRICE': case 'ADD_LABOUR_RATE': case 'ADD_MACHINE_RATE':
    case 'ADD_CONTRACTOR_COST': case 'ADD_HARVEST': case 'ADD_REVENUE':
    case 'RECORD_OVERHEAD_CHOICE': case 'ALIGN_UNITS': return t(`economics.completeness.actions.${code}`);
    default: { const neverCode: never = code; return String(neverCode); }
  }
}

export function buildFinancialCompletenessDisplayModel(t: Translate, locale: Locale, result: FinancialCompletenessResult): FinancialCompletenessDisplayModel {
  const recordedItems = result.recordedCodes.map((code) => recordedText(t, code));
  const reasonItems = result.reasons.map((reason) => reasonText(t, reason.code));
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
  return {
    title: t('economics.completeness.title'),
    statusLabel: statusText(t, result.status),
    summary: t('economics.completeness.summary', { percentage: result.percentage }),
    recordedLabel: t('economics.completeness.recordedLabel'),
    missingLabel: t('economics.completeness.missingLabel'),
    recordedItems, reasonItems,
    actions: result.actionCodes.map((code) => ({ code, label: actionText(t, code) })),
    recordedList: list.format(recordedItems),
    reasonList: list.format(reasonItems),
  };
}
