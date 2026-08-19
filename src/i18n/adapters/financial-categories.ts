import type { EconomicSourceType } from '@prisma/client';
import type { Locale } from '../locales';
import { getEnumLabel } from '../enum-labels';
import type { CostCategory } from '@/lib/field-economics';

export type FinancialSourceTypeCode = EconomicSourceType;
export type FinancialAttributionCode = 'direct' | 'allocated' | 'unallocated' | 'partially_allocated';
export type FinancialVersionStateCode = 'original' | 'corrected' | 'reversed' | 'effective' | 'superseded';

export const getFinancialCategoryLabel = (locale: Locale, code: CostCategory | string) =>
  getEnumLabel(locale, 'costCategory', code, 'other');

export const getFinancialSourceTypeLabel = (locale: Locale, code: FinancialSourceTypeCode | string) =>
  getEnumLabel(locale, 'financialSourceType', code, 'unknown');

export const getFinancialAttributionLabel = (locale: Locale, code: FinancialAttributionCode | string) =>
  getEnumLabel(locale, 'financialAttribution', code, 'unknown');

export const getFinancialVersionStateLabel = (locale: Locale, code: FinancialVersionStateCode | string) =>
  getEnumLabel(locale, 'financialVersionState', code, 'unknown');
