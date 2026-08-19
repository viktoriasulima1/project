import type { FinanceData, FieldEconomicsRow } from './finance-data';
import { resolveInsightPriority, type InsightPriorityInputs, type InsightSeverity } from './farm-insights';
import type { BudgetVarianceResult, FinancialCompletenessReasonCode, GrossMarginResult } from './economics';

// The single, presentation-free source used by Dashboard, Farm Insights and
// Daily Briefing. Financial decisions stay in their completed canonical
// resolvers; this module only selects and prioritises existing conditions.

export type EconomicSignalCode =
  | 'BUDGET_OVER_LIMIT'
  | 'MISSING_PURCHASE_PRICE'
  | 'MISSING_LABOUR_RATE'
  | 'MISSING_MACHINE_RATE'
  | 'UNALLOCATED_COST'
  | 'UNALLOCATED_REVENUE'
  | 'BREAK_EVEN_ABOVE_SALE_PRICE'
  | 'INCOMPLETE_PROFITABILITY'
  | 'MARGIN_ON_INCOMPLETE_DATA'
  | 'MISSING_HARVEST'
  | 'MISSING_REVENUE'
  | 'STRONGEST_COMPLETE_MARGIN';

export type EconomicSignalActionCode =
  | 'OPEN_FIELD_DETAIL'
  | 'OPEN_FINANCE'
  | 'ADD_PURCHASE_PRICE'
  | 'ADD_LABOUR_RATE'
  | 'ADD_MACHINE_RATE'
  | 'ALLOCATE_COST'
  | 'ALLOCATE_REVENUE'
  | 'ADD_HARVEST'
  | 'ADD_REVENUE'
  | 'REVIEW_BREAK_EVEN'
  | 'REVIEW_COMPLETENESS';

export type EconomicSignalEvidence =
  | { type: 'budget_variance'; fieldId: string; varianceCents: number; variancePercent: number | null }
  | { type: 'financial_completeness'; fieldIds: string[]; reasonCodes: FinancialCompletenessReasonCode[] }
  | { type: 'product_price_coverage'; pricedLineCount: number; totalLineCount: number }
  | { type: 'allocation_status'; allocation: 'cost' | 'revenue'; amountCents: number }
  | { type: 'break_even'; fieldId: string; breakEvenCentsPerUnit: number; salePriceCentsPerUnit: number; unit: string | null }
  | { type: 'gross_margin'; fieldId: string; result: GrossMarginResult }
  | { type: 'harvest_status'; fieldIds: string[]; recorded: false }
  | { type: 'revenue_status'; fieldIds: string[]; recorded: false };

export interface EconomicSignalMetadata {
  currency: 'EUR';
  affectedCount: number;
  affectedFieldNames: string[];
  affectedCropNames: string[];
  productNames?: string[];
  amountCents?: number;
  percentage?: number | null;
  completenessPercentage?: number | null;
  breakEvenCentsPerUnit?: number;
  salePriceCentsPerUnit?: number;
  unit?: string | null;
  marginPerHaCents?: number;
}

export type SignalRole = 'alert' | 'positive';

export interface RawEconomicSignal {
  id: string;
  signalCode: EconomicSignalCode;
  role: SignalRole;
  actionCode: EconomicSignalActionCode;
  fieldId: string | null;
  metadata: EconomicSignalMetadata;
  evidence: EconomicSignalEvidence[];
  confidence: 'low' | 'medium' | 'high';
  relatedModule: 'finance' | 'inventory';
  priority: InsightPriorityInputs;
  budgetVariance?: BudgetVarianceResult;
}

const fieldNames = (rows: FieldEconomicsRow[]) => rows.slice(0, 3).map((row) => row.field);
const cropNames = (rows: FieldEconomicsRow[]) => rows.slice(0, 3).map((row) => row.crop);
const baseMetadata = (rows: FieldEconomicsRow[], affectedCount = rows.length): EconomicSignalMetadata => ({
  currency: 'EUR', affectedCount, affectedFieldNames: fieldNames(rows), affectedCropNames: cropNames(rows),
});
const completenessReasons = (rows: FieldEconomicsRow[]) => [...new Set(rows.flatMap((row) => row.completenessResult.reasons.map((reason) => reason.code)))];

export function buildEconomicSignals(finance: FinanceData): RawEconomicSignal[] {
  const out: RawEconomicSignal[] = [];
  if (!finance.seasonId) return out;

  const overBudget = finance.fields.filter((field) => field.costVariance.available && field.costVariance.status === 'over_budget');
  if (overBudget.length) {
    const selected = [...overBudget].sort((a, b) => (b.costVariance.metadata.varianceCents ?? 0) - (a.costVariance.metadata.varianceCents ?? 0))[0];
    const varianceCents = selected.costVariance.metadata.varianceCents ?? 0;
    const variancePercent = selected.costVariance.metadata.variancePercent;
    out.push({ id: 'econ-field-over-budget', signalCode: 'BUDGET_OVER_LIMIT', role: 'alert', actionCode: 'OPEN_FIELD_DETAIL', fieldId: selected.fieldId,
      metadata: { ...baseMetadata([selected], overBudget.length), amountCents: varianceCents, percentage: variancePercent, completenessPercentage: selected.completenessPercent },
      evidence: [{ type: 'budget_variance', fieldId: selected.fieldId, varianceCents, variancePercent }], confidence: 'medium', relatedModule: 'finance',
      priority: { urgency: 5, financialImpact: 7, complianceImpact: 1, agronomicRisk: 2, timeSensitivity: 5, confidence: 7, actionability: 6 }, budgetVariance: selected.costVariance });
  }

  if (finance.missingPriceProducts.length) {
    out.push({ id: 'econ-missing-price', signalCode: 'MISSING_PURCHASE_PRICE', role: 'alert', actionCode: 'ADD_PURCHASE_PRICE', fieldId: null,
      metadata: { ...baseMetadata([], finance.missingPriceProducts.length), productNames: finance.missingPriceProducts.slice(0, 4) },
      evidence: [{ type: 'product_price_coverage', pricedLineCount: finance.linesWithPrice, totalLineCount: finance.totalProductLines }], confidence: 'high', relatedModule: 'inventory',
      priority: { urgency: 5, financialImpact: 8, complianceImpact: 1, agronomicRisk: 1, timeSensitivity: 3, confidence: 9, actionability: 8 } });
  }

  const missingLabour = finance.fields.filter((field) => field.completenessResult.reasons.some((reason) => reason.code === 'MISSING_LABOUR_RATE'));
  if (missingLabour.length) out.push({ id: 'econ-missing-labour-rate', signalCode: 'MISSING_LABOUR_RATE', role: 'alert', actionCode: 'ADD_LABOUR_RATE', fieldId: missingLabour[0].fieldId,
    metadata: { ...baseMetadata(missingLabour), completenessPercentage: missingLabour[0].completenessPercent }, evidence: [{ type: 'financial_completeness', fieldIds: missingLabour.map((field) => field.fieldId), reasonCodes: completenessReasons(missingLabour) }],
    confidence: 'high', relatedModule: 'finance', priority: { urgency: 3, financialImpact: 6, complianceImpact: 0, agronomicRisk: 0, timeSensitivity: 3, confidence: 9, actionability: 7 } });

  const missingMachine = finance.fields.filter((field) => field.completenessResult.reasons.some((reason) => reason.code === 'MISSING_MACHINE_RATE'));
  if (missingMachine.length) out.push({ id: 'econ-missing-machine-rate', signalCode: 'MISSING_MACHINE_RATE', role: 'alert', actionCode: 'ADD_MACHINE_RATE', fieldId: missingMachine[0].fieldId,
    metadata: { ...baseMetadata(missingMachine), completenessPercentage: missingMachine[0].completenessPercent }, evidence: [{ type: 'financial_completeness', fieldIds: missingMachine.map((field) => field.fieldId), reasonCodes: completenessReasons(missingMachine) }],
    confidence: 'high', relatedModule: 'finance', priority: { urgency: 3, financialImpact: 6, complianceImpact: 0, agronomicRisk: 0, timeSensitivity: 3, confidence: 9, actionability: 7 } });

  if (finance.unallocatedCostEur != null && finance.unallocatedCostEur > 0) {
    const amountCents = Math.round(finance.unallocatedCostEur * 100);
    out.push({ id: 'econ-unallocated-cost', signalCode: 'UNALLOCATED_COST', role: 'alert', actionCode: 'ALLOCATE_COST', fieldId: null,
      metadata: { ...baseMetadata([], 1), amountCents }, evidence: [{ type: 'allocation_status', allocation: 'cost', amountCents }], confidence: 'high', relatedModule: 'finance',
      priority: { urgency: 4, financialImpact: 7, complianceImpact: 1, agronomicRisk: 1, timeSensitivity: 3, confidence: 9, actionability: 7 } });
  }
  if (finance.unallocatedRevenueEur != null && finance.unallocatedRevenueEur > 0) {
    const amountCents = Math.round(finance.unallocatedRevenueEur * 100);
    out.push({ id: 'econ-unallocated-revenue', signalCode: 'UNALLOCATED_REVENUE', role: 'alert', actionCode: 'ALLOCATE_REVENUE', fieldId: null,
      metadata: { ...baseMetadata([], 1), amountCents }, evidence: [{ type: 'allocation_status', allocation: 'revenue', amountCents }], confidence: 'high', relatedModule: 'finance',
      priority: { urgency: 4, financialImpact: 6, complianceImpact: 1, agronomicRisk: 1, timeSensitivity: 3, confidence: 9, actionability: 7 } });
  }

  const breakEvenRisk = finance.fields.filter((field) => field.completenessStatus === 'profitability_ready' && field.breakEvenPrice != null && field.recordedRevenueEur != null && field.yieldQuantity != null && field.yieldQuantity > 0 && field.recordedRevenueEur / field.yieldQuantity < field.breakEvenPrice);
  if (breakEvenRisk.length) {
    const selected = breakEvenRisk[0];
    const breakEvenCentsPerUnit = Math.round(selected.breakEvenPrice! * 100);
    const salePriceCentsPerUnit = Math.round((selected.recordedRevenueEur! / selected.yieldQuantity!) * 100);
    out.push({ id: 'econ-breakeven-above-sale', signalCode: 'BREAK_EVEN_ABOVE_SALE_PRICE', role: 'alert', actionCode: 'REVIEW_BREAK_EVEN', fieldId: selected.fieldId,
      metadata: { ...baseMetadata([selected]), amountCents: breakEvenCentsPerUnit, completenessPercentage: selected.completenessPercent, breakEvenCentsPerUnit, salePriceCentsPerUnit, unit: selected.yieldUnit },
      evidence: [{ type: 'break_even', fieldId: selected.fieldId, breakEvenCentsPerUnit, salePriceCentsPerUnit, unit: selected.yieldUnit }], confidence: 'high', relatedModule: 'finance',
      priority: { urgency: 5, financialImpact: 8, complianceImpact: 0, agronomicRisk: 2, timeSensitivity: 4, confidence: 8, actionability: 5 } });
  }

  const incomplete = finance.fields.filter((field) => field.completenessStatus !== 'profitability_ready' && (field.recordedCostEur ?? 0) > 0);
  if (incomplete.length) out.push({ id: 'econ-profitability-incomplete', signalCode: 'INCOMPLETE_PROFITABILITY', role: 'alert', actionCode: 'REVIEW_COMPLETENESS', fieldId: incomplete[0].fieldId,
    metadata: { ...baseMetadata(incomplete), completenessPercentage: incomplete[0].completenessPercent }, evidence: [{ type: 'financial_completeness', fieldIds: incomplete.map((field) => field.fieldId), reasonCodes: completenessReasons(incomplete) }], confidence: 'high', relatedModule: 'finance',
    priority: { urgency: 3, financialImpact: 4, complianceImpact: 1, agronomicRisk: 1, timeSensitivity: 3, confidence: 8, actionability: 6 } });

  const marginIncomplete = finance.fields.filter((field) => field.grossMarginEur != null && field.completenessPercent < 100);
  if (marginIncomplete.length) out.push({ id: 'econ-margin-incomplete-data', signalCode: 'MARGIN_ON_INCOMPLETE_DATA', role: 'alert', actionCode: 'REVIEW_COMPLETENESS', fieldId: marginIncomplete[0].fieldId,
    metadata: { ...baseMetadata(marginIncomplete), amountCents: Math.round(marginIncomplete[0].grossMarginEur! * 100), completenessPercentage: marginIncomplete[0].completenessPercent },
    evidence: [{ type: 'gross_margin', fieldId: marginIncomplete[0].fieldId, result: marginIncomplete[0].grossMarginResult }], confidence: 'medium', relatedModule: 'finance',
    priority: { urgency: 2, financialImpact: 4, complianceImpact: 1, agronomicRisk: 1, timeSensitivity: 2, confidence: 7, actionability: 5 } });

  const missingHarvest = finance.fields.filter((field) => (field.recordedCostEur ?? 0) > 0 && field.yieldQuantity == null);
  if (missingHarvest.length) out.push({ id: 'econ-missing-harvest', signalCode: 'MISSING_HARVEST', role: 'alert', actionCode: 'ADD_HARVEST', fieldId: missingHarvest[0].fieldId,
    metadata: { ...baseMetadata(missingHarvest), completenessPercentage: missingHarvest[0].completenessPercent }, evidence: [{ type: 'harvest_status', fieldIds: missingHarvest.map((field) => field.fieldId), recorded: false }], confidence: 'high', relatedModule: 'finance',
    priority: { urgency: 3, financialImpact: 5, complianceImpact: 1, agronomicRisk: 2, timeSensitivity: 4, confidence: 8, actionability: 7 } });

  const missingRevenue = finance.fields.filter((field) => (field.recordedCostEur ?? 0) > 0 && field.yieldQuantity != null && !field.recordedRevenueEur);
  if (missingRevenue.length) out.push({ id: 'econ-missing-revenue', signalCode: 'MISSING_REVENUE', role: 'alert', actionCode: 'ADD_REVENUE', fieldId: missingRevenue[0].fieldId,
    metadata: { ...baseMetadata(missingRevenue), completenessPercentage: missingRevenue[0].completenessPercent }, evidence: [{ type: 'revenue_status', fieldIds: missingRevenue.map((field) => field.fieldId), recorded: false }], confidence: 'high', relatedModule: 'finance',
    priority: { urgency: 3, financialImpact: 6, complianceImpact: 1, agronomicRisk: 1, timeSensitivity: 4, confidence: 8, actionability: 7 } });

  const complete = finance.fields.filter((field) => field.completenessStatus === 'profitability_ready' && field.grossMarginPerHaEur != null);
  if (complete.length) {
    const selected = [...complete].sort((a, b) => (b.grossMarginPerHaEur ?? 0) - (a.grossMarginPerHaEur ?? 0))[0];
    out.push({ id: 'econ-strongest-margin', signalCode: 'STRONGEST_COMPLETE_MARGIN', role: 'positive', actionCode: 'OPEN_FIELD_DETAIL', fieldId: selected.fieldId,
      metadata: { ...baseMetadata([selected]), amountCents: Math.round(selected.grossMarginPerHaEur! * 100), marginPerHaCents: Math.round(selected.grossMarginPerHaEur! * 100), completenessPercentage: selected.completenessPercent },
      evidence: [{ type: 'gross_margin', fieldId: selected.fieldId, result: selected.grossMarginResult }], confidence: 'high', relatedModule: 'finance',
      priority: { urgency: 1, financialImpact: 3, complianceImpact: 0, agronomicRisk: 0, timeSensitivity: 1, confidence: 8, actionability: 3 } });
  }
  return out;
}

export interface EconomicSignal extends Omit<RawEconomicSignal, 'priority'> {
  priority: InsightSeverity;
  priorityScore: number;
  kind: 'rule-based';
  calculatedAt: string;
}

export interface FarmEconomicSignals {
  hasSeason: boolean;
  signals: EconomicSignal[];
  topSignals: EconomicSignal[];
  seasonStrip: { recordedCostEur: number | null; recordedRevenueEur: number | null; grossMarginEur: number | null; completenessPercent: number; completenessStatus: string; profitabilityReady: boolean };
  calculatedAt: string;
}

export function getEconomicSignalRoute(signal: Pick<RawEconomicSignal, 'actionCode' | 'fieldId'>): string {
  if (signal.actionCode === 'ADD_PURCHASE_PRICE') return '/inventory';
  if (signal.actionCode === 'OPEN_FINANCE' || signal.actionCode === 'ADD_LABOUR_RATE' || signal.actionCode === 'ADD_MACHINE_RATE' || signal.actionCode === 'ALLOCATE_COST' || signal.actionCode === 'ALLOCATE_REVENUE') return '/finance';
  return signal.fieldId ? `/fields/${signal.fieldId}` : '/finance';
}

export function getFarmEconomicSignals(finance: FinanceData, calculatedAt = new Date().toISOString()): FarmEconomicSignals {
  const signals = buildEconomicSignals(finance).map((raw): EconomicSignal => {
    const priority = resolveInsightPriority(raw.priority);
    return { ...raw, priority: priority.severity, priorityScore: priority.score, kind: 'rule-based', calculatedAt };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
  return { hasSeason: Boolean(finance.seasonId), signals, topSignals: signals.slice(0, 3), seasonStrip: {
    recordedCostEur: finance.totalRecordedCostEur, recordedRevenueEur: finance.totalRecordedRevenueEur, grossMarginEur: finance.grossMarginEur,
    completenessPercent: finance.completenessPercent, completenessStatus: finance.completenessStatus, profitabilityReady: finance.completenessStatus === 'profitability_ready',
  }, calculatedAt };
}
