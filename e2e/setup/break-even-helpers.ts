import { expect, type Locator, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { breakEvenExplanation, type BreakEvenExplanation } from '../../src/lib/field-economics';
import { findVisibleDomainCodeLeaks } from '../../src/lib/visible-domain-code';
import {
  resolveEconomicsCompleteness, type CompletenessStatus,
  type FinancialCompletenessActionCode, type FinancialCompletenessReasonCode,
  type FinancialRecordedDataCode,
  resolveBudgetVariance, type BudgetVarianceResult,
} from '../../src/lib/economics';

export const DOMAIN_CODES = [
  'BREAK_EVEN_AVAILABLE', 'INCOMPLETE_COST', 'MISSING_HARVEST',
  'MISSING_SALE_PRICE', 'INCOMPATIBLE_UNITS', 'UNALLOCATED_COSTS',
  'ADD_COST', 'ADD_HARVEST', 'ADD_SALE_PRICE', 'ALIGN_UNITS',
  'REVIEW_ALLOCATIONS',
] as const;

function e2eDb(): PrismaClient {
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/e2e|test/i.test(url)) throw new Error('Break-even E2E helpers refuse non-E2E databases.');
  return new PrismaClient({ datasources: { db: { url } } });
}

export async function getVisibleBodyText(page: Page): Promise<string> {
  const bodyText = await page.locator('body').innerText();
  const accessibleMetadata = await page.locator('[aria-label], [title]').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const html = element as HTMLElement;
      const style = getComputedStyle(html);
      if (html.hidden || html.closest('[hidden], [aria-hidden="true"], [inert]') || style.display === 'none' || style.visibility === 'hidden') return [];
      return [html.getAttribute('aria-label'), html.getAttribute('title')].filter((value): value is string => Boolean(value));
    }).join('\n'));
  return `${bodyText}\n${accessibleMetadata}`;
}

export async function expectNoVisibleDomainCodeLeak(page: Page, codes: readonly string[] = DOMAIN_CODES): Promise<void> {
  const userContent = await getVisibleBodyText(page);
  expect(findVisibleDomainCodeLeaks(userContent, codes), 'raw domain codes must not be user-visible').toEqual([]);
}

export function getBreakEvenSection(page: Page): Locator {
  return page.getByTestId('break-even-section');
}

export function getBreakEvenCard(section: Locator, kind: 'price' | 'yield'): Locator {
  const pattern = kind === 'price' ? /price|prijs|preis|cena/i : /yield|opbrengst|ertrag|wydajno/i;
  return section.getByRole('heading', { level: 3 }).filter({ hasText: pattern }).locator('..');
}

export async function openSeededBreakEvenField(page: Page, fieldId: string): Promise<void> {
  await page.goto(`/fields/${fieldId}`);
  await expect(page).toHaveURL(new RegExp(`/fields/${fieldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(getBreakEvenSection(page)).toBeVisible();
}

export async function getCanonicalBreakEvenForField(clerkUserId: string, fieldId: string): Promise<BreakEvenExplanation> {
  const db = e2eDb();
  try {
    const fieldSeason = await db.fieldSeason.findFirstOrThrow({
      where: { fieldId, field: { farm: { clerkUserId }, deletedAt: null }, season: { isActive: true } },
      include: { harvestResults: { where: { status: 'active' } }, field: true },
    });
    const [costs, revenues] = await Promise.all([
      db.economicEntry.findMany({ where: { farmId: fieldSeason.field.farmId, fieldSeasonId: fieldSeason.id, kind: 'cost', status: 'active' } }),
      db.revenueEntry.findMany({ where: { farmId: fieldSeason.field.farmId, fieldSeasonId: fieldSeason.id, status: 'active' } }),
    ]);
    const harvestUnits = new Set(fieldSeason.harvestResults.map((row) => row.unit));
    const revenueUnits = new Set(revenues.filter((row) => row.quantity != null).map((row) => row.unit).filter((unit): unit is string => Boolean(unit)));
    const unitsCompatible = harvestUnits.size <= 1 && revenueUnits.size <= 1
      && (!harvestUnits.size || !revenueUnits.size || [...harvestUnits][0] === [...revenueUnits][0]);
    const yieldQuantity = fieldSeason.harvestResults.length
      ? fieldSeason.harvestResults.reduce((sum, row) => sum + Number(row.saleableQuantity ?? row.grossQuantity), 0)
      : null;
    const priced = revenues.find((row) => row.quantity != null && Number(row.quantity) > 0);
    return breakEvenExplanation({
      totalRecordedCost: costs.length ? costs.reduce((sum, row) => sum + Number(row.amount), 0) : null,
      costsComplete: costs.length > 0,
      saleableYield: yieldQuantity,
      yieldUnit: harvestUnits.size === 1 ? String([...harvestUnits][0]) : null,
      recordedPricePerUnit: priced ? Number(priced.totalAmount) / Number(priced.quantity) : null,
      unitsCompatible,
      hasUnallocatedRemainder: false,
    });
  } finally {
    await db.$disconnect();
  }
}

export interface CanonicalFinancialCompletenessEvidence {
  status: CompletenessStatus;
  percentage: number;
  recordedCodes: FinancialRecordedDataCode[];
  reasonCodes: FinancialCompletenessReasonCode[];
  actionCodes: FinancialCompletenessActionCode[];
  relevantCanonicalMetadata: {
    applicableCheckCount: number;
    passedCheckCount: number;
    unpricedRecordCount: number;
    labourActivitiesWithoutRecordedRate: number;
    machineActivitiesWithoutRecordedRate: number;
    fieldCostTotal: number | null;
    productNames: string[];
    operatorNames: string[];
    machineNames: string[];
  };
}

export async function getCanonicalFinancialCompletenessForField(
  clerkUserId: string,
  fieldId: string,
): Promise<CanonicalFinancialCompletenessEvidence> {
  const db = e2eDb();
  try {
    const row = await db.fieldSeason.findFirstOrThrow({
      where: { fieldId, field: { farm: { clerkUserId }, deletedAt: null }, season: { isActive: true } },
      include: {
        field: { include: { farm: true } },
        harvestResults: { where: { status: 'active' } },
        activities: { where: { status: 'completed', deletedAt: null }, include: { costSnapshots: true, machine: true } },
      },
    });
    const [entries, revenues] = await Promise.all([
      db.economicEntry.findMany({ where: { farmId: row.field.farmId, fieldSeasonId: row.id, status: 'active' } }),
      db.revenueEntry.findMany({ where: { farmId: row.field.farmId, fieldSeasonId: row.id, status: 'active' } }),
    ]);
    const harvestUnits = new Set(row.harvestResults.map((item) => item.unit));
    const revenueUnits = new Set(revenues.filter((item) => item.quantity != null).map((item) => item.unit).filter(Boolean));
    const result = resolveEconomicsCompleteness({
      productPricesKnown: row.activities.filter((activity) => activity.productId != null).every((activity) => activity.costSnapshots.length > 0 && activity.costSnapshots.every((snapshot) => snapshot.unitCost != null)),
      labourApplicable: row.activities.some((activity) => activity.actualHours != null),
      labourRatesKnown: entries.some((entry) => entry.sourceType === 'labour'),
      machineryApplicable: row.activities.some((activity) => activity.machineHours != null),
      machineryRatesKnown: entries.some((entry) => entry.sourceType === 'machinery'),
      contractorApplicable: false, contractorRecorded: true,
      harvestRecorded: row.harvestResults.length > 0,
      revenueRecorded: entries.some((entry) => entry.kind === 'revenue'),
      overheadChoiceRecorded: row.field.farm.overheadChoiceRecorded,
      unitsCompatible: harvestUnits.size <= 1 && revenueUnits.size <= 1 && (!harvestUnits.size || !revenueUnits.size || [...harvestUnits][0] === [...revenueUnits][0]),
    });
    const unpricedRecordCount = row.activities
      .filter((activity) => activity.productId != null)
      .reduce((count, activity) => count + (activity.costSnapshots.length === 0
        ? 1
        : activity.costSnapshots.filter((snapshot) => snapshot.unitCost == null).length), 0);
    const fieldCosts = entries.filter((entry) => entry.kind === 'cost');
    return {
      status: result.status,
      percentage: result.percentage,
      recordedCodes: result.recordedCodes,
      reasonCodes: result.reasons.map((reason) => reason.code),
      actionCodes: result.actionCodes,
      relevantCanonicalMetadata: {
        ...result.metadata,
        unpricedRecordCount,
        labourActivitiesWithoutRecordedRate: entries.some((entry) => entry.sourceType === 'labour')
          ? 0
          : row.activities.filter((activity) => activity.actualHours != null).length,
        machineActivitiesWithoutRecordedRate: entries.some((entry) => entry.sourceType === 'machinery')
          ? 0
          : row.activities.filter((activity) => activity.machineHours != null).length,
        fieldCostTotal: unpricedRecordCount > 0
          ? null
          : fieldCosts.length
            ? fieldCosts.reduce((sum, entry) => sum + Number(entry.amount), 0)
            : null,
        productNames: row.activities.flatMap((activity) => activity.costSnapshots.map((snapshot) => snapshot.itemName)),
        operatorNames: [...new Set(row.activities.map((activity) => activity.operatorName))],
        machineNames: row.activities.flatMap((activity) => activity.machine ? [activity.machine.name] : []),
      },
    };
  } finally {
    await db.$disconnect();
  }
}

export async function getCanonicalAllocationEvidenceForField(clerkUserId: string, fieldId: string) {
  const db = e2eDb();
  try {
    const row = await db.fieldSeason.findFirstOrThrow({
      where: { fieldId, field: { farm: { clerkUserId }, deletedAt: null }, season: { isActive: true } },
      include: { field: true },
    });
    const [fieldEntries, unallocatedEntries, activeAllocations] = await Promise.all([
      db.economicEntry.findMany({
        where: { farmId: row.field.farmId, fieldSeasonId: row.id, status: 'active' },
        select: { kind: true, amount: true },
      }),
      db.economicEntry.findMany({
        where: {
          farmId: row.field.farmId, fieldSeasonId: null, status: 'active',
          allocationMethod: 'unallocated',
        },
        select: { kind: true, amount: true },
      }),
      db.economicAllocation.findMany({
        where: { farmId: row.field.farmId, fieldSeasonId: row.id, status: 'active' },
        select: { economicEntryId: true, amount: true, originalAmount: true, percentage: true, version: true },
      }),
    ]);
    const sum = (kind: 'cost' | 'revenue', rows: typeof fieldEntries) =>
      rows.filter((entry) => entry.kind === kind).reduce((total, entry) => total + Number(entry.amount), 0);
    return {
      fieldCostTotal: sum('cost', fieldEntries),
      fieldRevenueTotal: sum('revenue', fieldEntries),
      unallocatedCostTotal: sum('cost', unallocatedEntries),
      unallocatedRevenueTotal: sum('revenue', unallocatedEntries),
      activeAllocations: activeAllocations.map((allocation) => ({
        economicEntryId: allocation.economicEntryId,
        amount: Number(allocation.amount),
        originalAmount: Number(allocation.originalAmount),
        remainder: Number(allocation.originalAmount) - Number(allocation.amount),
        percentage: Number(allocation.percentage),
        version: allocation.version,
      })),
    };
  } finally {
    await db.$disconnect();
  }
}

export async function getCanonicalBudgetVarianceForField(clerkUserId: string, fieldId: string) {
  const db = e2eDb();
  try {
    const row = await db.fieldSeason.findFirstOrThrow({
      where: { fieldId, field: { farm: { clerkUserId }, deletedAt: null }, season: { isActive: true } },
      include: {
        field: { include: { farm: true } },
        seasonPlanItems: { where: { status: { not: 'cancelled' } } },
        activities: { where: { status: 'completed', deletedAt: null }, include: { costSnapshots: true } },
      },
    });
    const entries = await db.economicEntry.findMany({
      where: { farmId: row.field.farmId, fieldSeasonId: row.id, kind: 'cost', status: 'active' },
      select: { amount: true, currency: true, sourceType: true, sourceEntityId: true },
    });
    const budgets = row.seasonPlanItems.map((plan) => {
      const components = [plan.expectedInputCostEur, plan.expectedLabourCostEur, plan.expectedMachineCostEur, plan.expectedContractorCostEur, plan.expectedOverheadEur].filter((value) => value != null);
      return components.length ? components.reduce((sum, value) => sum + Number(value), 0) : plan.expectedCostEur == null ? null : Number(plan.expectedCostEur);
    });
    const budget = budgets.some((value) => value != null) ? budgets.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
    const unpricedRecordCount = row.activities.filter((activity) => activity.productId != null).reduce((count, activity) => count + (activity.costSnapshots.length === 0 ? 1 : activity.costSnapshots.filter((snapshot) => snapshot.unitCost == null).length), 0);
    const actual = unpricedRecordCount > 0 || entries.length === 0 ? null : entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const result: BudgetVarianceResult = resolveBudgetVariance({ budget, actual, currency: row.field.farm.currency, actualCostComplete: unpricedRecordCount === 0, unpricedRecordCount });
    return {
      available: result.available,
      status: result.status,
      reasonCode: result.reasonCode,
      actionCode: result.actionCode,
      budgetCents: result.metadata.budgetCents,
      actualCents: result.metadata.actualCents,
      varianceCents: result.metadata.varianceCents,
      variancePercent: result.metadata.variancePercent,
      currency: result.metadata.currency,
      relevantCanonicalMetadata: {
        unpricedRecordCount,
        costRecordCount: entries.length,
        includedSourceTypes: [...new Set(entries.map((entry) => entry.sourceType))],
      },
    };
  } finally {
    await db.$disconnect();
  }
}
