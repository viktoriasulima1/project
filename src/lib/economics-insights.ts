import type { FinanceData } from './finance-data';
import { buildEconomicSignals, type RawEconomicSignal } from './farm-economic-signals';

/** Farm Insights consumes the same canonical signal objects as Dashboard. */
export type EconomicsRawInsight = RawEconomicSignal;

export function resolveEconomicsInsights(finance: FinanceData): EconomicsRawInsight[] {
  return buildEconomicSignals(finance).filter((signal) => signal.role === 'alert');
}
