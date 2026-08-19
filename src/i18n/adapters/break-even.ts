import type { Translate } from '../translator';
import type { Locale } from '../locales';
import { formatCurrency, formatNumber } from '../format';
import type {
  BreakEvenExplanation, BreakEvenComputation, BreakEvenValue, BreakEvenReasonCode, BreakEvenFormulaCode,
} from '@/lib/field-economics';

/**
 * Break-even presentation adapter (Parts 9/15). Maps the code-only resolver output
 * to localized, locale-formatted display text. The resolver imports no i18n/Intl;
 * this is the only place break-even wording and number formatting live. `t` must
 * be bound to the `fields` namespace (`economics.breakEven.*`).
 *
 * Exhaustiveness is compile-time enforced: each switch's `default` assigns the code
 * to `never`, so adding a reason/action/formula code fails the build until handled
 * here (and, via tests, translated in four locales). Values/rounding are unchanged —
 * only separators/currency placement follow the locale.
 */
type BreakEvenActionCode = 'ADD_COST' | 'ADD_HARVEST' | 'ADD_SALE_PRICE' | 'ALIGN_UNITS' | 'REVIEW_ALLOCATIONS';

export interface BreakEvenComputationDisplay {
  available: boolean;
  valueText: string | null;
  formulaText: string | null;
  reasonText: string | null;
  actionText: string | null;
}

export interface BreakEvenDisplayModel {
  title: string;
  priceLabel: string;
  yieldLabel: string;
  unavailableLabel: string;
  price: BreakEvenComputationDisplay;
  yieldValue: BreakEvenComputationDisplay;
}

function actionForReason(code: BreakEvenReasonCode): BreakEvenActionCode {
  switch (code) {
    case 'INCOMPLETE_COST': return 'ADD_COST';
    case 'MISSING_HARVEST': return 'ADD_HARVEST';
    case 'MISSING_SALE_PRICE': return 'ADD_SALE_PRICE';
    case 'INCOMPATIBLE_UNITS': return 'ALIGN_UNITS';
    case 'UNALLOCATED_COSTS': return 'REVIEW_ALLOCATIONS';
    default: { const _exhaustive: never = code; void _exhaustive; return 'ADD_COST'; }
  }
}

function reasonLabel(t: Translate, code: BreakEvenReasonCode): string {
  switch (code) {
    case 'INCOMPLETE_COST':
    case 'MISSING_HARVEST':
    case 'MISSING_SALE_PRICE':
    case 'INCOMPATIBLE_UNITS':
    case 'UNALLOCATED_COSTS':
      return t(`economics.breakEven.reasons.${code}`);
    default: { const _exhaustive: never = code; void _exhaustive; return ''; }
  }
}

function actionLabel(t: Translate, code: BreakEvenActionCode): string {
  switch (code) {
    case 'ADD_COST':
    case 'ADD_HARVEST':
    case 'ADD_SALE_PRICE':
    case 'ALIGN_UNITS':
    case 'REVIEW_ALLOCATIONS':
      return t(`economics.breakEven.actions.${code}`);
    default: { const _exhaustive: never = code; void _exhaustive; return ''; }
  }
}

function formulaLabel(t: Translate, code: BreakEvenFormulaCode): string {
  switch (code) {
    case 'COST_PER_YIELD':
    case 'COST_PER_PRICE':
      return t(`economics.breakEven.formula.${code}`);
    default: { const _exhaustive: never = code; void _exhaustive; return ''; }
  }
}

function valueText(locale: Locale, v: BreakEvenValue): string {
  // price = currency per yield unit; yield = a quantity in yield units.
  return v.formulaCode === 'COST_PER_YIELD'
    ? `${formatCurrency(v.result, locale)}/${v.yieldUnit}`
    : `${formatNumber(v.result, locale)} ${v.yieldUnit}`;
}

function formulaText(t: Translate, locale: Locale, v: BreakEvenValue): string {
  const label = formulaLabel(t, v.formulaCode);
  return v.formulaCode === 'COST_PER_YIELD'
    ? `${label}: ${formatCurrency(v.totalCost, locale)} ÷ ${formatNumber(v.divisor, locale)} ${v.yieldUnit}`
    : `${label}: ${formatCurrency(v.totalCost, locale)} ÷ ${formatCurrency(v.divisor, locale)}`;
}

function computationDisplay(t: Translate, locale: Locale, c: BreakEvenComputation): BreakEvenComputationDisplay {
  if (c.available && c.value) {
    return { available: true, valueText: valueText(locale, c.value), formulaText: formulaText(t, locale, c.value), reasonText: null, actionText: null };
  }
  const reasonText = c.reasonCodes.map((code) => reasonLabel(t, code)).filter(Boolean).join(' ');
  // Primary action = the first (highest-precedence) blocking reason's action.
  const primary = c.reasonCodes[0];
  return { available: false, valueText: null, formulaText: null, reasonText, actionText: primary ? actionLabel(t, actionForReason(primary)) : null };
}

export function buildBreakEvenDisplayModel(t: Translate, locale: Locale, result: BreakEvenExplanation): BreakEvenDisplayModel {
  return {
    title: t('economics.breakEven.title'),
    priceLabel: t('economics.breakEven.price'),
    yieldLabel: t('economics.breakEven.yield'),
    unavailableLabel: t('economics.breakEven.unavailable'),
    price: computationDisplay(t, locale, result.price),
    yieldValue: computationDisplay(t, locale, result.yieldValue),
  };
}
