import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { seedReadyFarm, type SeededFarm } from './seed-farms';

/**
 * Sprint 25 E2E stabilization — deterministic economics fixtures (Part 7). Built
 * on a seeded ready farm, then augmented via direct Prisma so the Dashboard
 * economics signals and Field Detail history flows have real, stable data to
 * assert against — rather than the bare ready farm (which has zero activities,
 * so the dashboard renders its first_run view with no economics section, and no
 * history to show).
 *
 * Refuses to run against a non-E2E database, like the other setup helpers.
 */
function e2ePrisma(): PrismaClient {
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/e2e|test/i.test(url)) {
    throw new Error('seed-economics.ts refuses to run without a valid E2E_DATABASE_URL (must contain "e2e" or "test").');
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export interface EconomicsFixture extends SeededFarm {
  seasonId: string;
  /** Description of the corrected expense's effective (v2) row. */
  correctedExpenseLabel: string;
  reversedExpenseLabel: string;
  reallocatedLabel: string;
  productName: string;
  operatorName: string;
  machineName: string;
}

export type CompletenessScenario =
  | 'complete'
  | 'missing_purchase_price'
  | 'missing_labour_rate'
  | 'missing_machine_rate'
  | 'missing_labour_and_machine_rates';
export type BudgetVarianceScenario = 'over_budget' | 'exact_match' | 'under_budget' | 'missing_budget' | 'missing_actual' | 'zero_budget' | 'zero_actual' | 'incomplete_actual';

/**
 * Seeds a farm with the full economics scenario used by the Dashboard-signals
 * and Field-Detail-history E2E flows:
 *  - one completed activity (so the dashboard leaves first_run and renders the
 *    Economics decisions section);
 *  - a field over its planned cost (over-budget signal + recorded field cost);
 *  - received revenue left unallocated (unallocated-revenue signal);
 *  - a corrected expense chain on the field (Original → Current effective);
 *  - a reversed expense on the field (excluded from totals, kept in history);
 *  - a reallocated cost on the field (allocation v1 → v2).
 */
export async function seedEconomicsFarm(clerkUserId: string, farmName: string, options: {
  withActiveSeason?: boolean;
  withHarvest?: boolean;
  completenessScenario?: CompletenessScenario;
  budgetVarianceScenario?: BudgetVarianceScenario;
} = {}): Promise<EconomicsFixture> {
  const seeded = await seedReadyFarm(clerkUserId, farmName);
  const db = e2ePrisma();
  try {
    // No-active-season fixture: unlink the field's season so Field Detail resolves
    // hasActiveSeason=false (drives the NO_ACTIVE_SEASON action reason). No economics.
    if (options.withActiveSeason === false) {
      const fs = await db.fieldSeason.findFirstOrThrow({ where: { id: seeded.fieldSeasonId } });
      await db.activity.deleteMany({ where: { fieldSeasonId: fs.id } });
      await db.fieldSeason.delete({ where: { id: fs.id } });
      return {
        ...seeded, seasonId: fs.seasonId, correctedExpenseLabel: '', reversedExpenseLabel: '',
        reallocatedLabel: '', productName: '', operatorName: '', machineName: '',
      };
    }
    const fs = await db.fieldSeason.findFirstOrThrow({ where: { id: seeded.fieldSeasonId }, include: { field: true, season: true } });
    const seasonId = fs.seasonId;
    const farmId = seeded.farmId;
    const crop = fs.crop;
    const day = (n: number) => new Date(Date.UTC(2026, 5, n));
    await db.farm.update({ where: { id: farmId }, data: { overheadChoiceRecorded: true, overheadPolicyNote: 'E2E deterministic overhead choice' } });

    // Clean any prior economics rows for this farm so re-runs are idempotent.
    await db.economicAllocation.deleteMany({ where: { farmId } });
    await db.economicEntry.deleteMany({ where: { farmId } });
    await db.financialExpense.deleteMany({ where: { farmId } });
    await db.revenueEntry.deleteMany({ where: { farmId } });
    await db.seasonPlanItem.deleteMany({ where: { farmId } });
    await db.activity.deleteMany({ where: { fieldSeason: { field: { farmId } } } });
    await db.harvestResult.deleteMany({ where: { farmId } });

    // 1. One completed activity → dashboard leaves first_run (early_usage).
    const scenario = options.completenessScenario ?? 'complete';
    const productName = 'Amistar Opti';
    const operatorName = 'E2E Operator';
    const machineName = 'Sprayer 1';
    const needsProduct = scenario === 'missing_purchase_price' || options.budgetVarianceScenario === 'incomplete_actual';
    const needsLabour = scenario === 'missing_labour_rate' || scenario === 'missing_labour_and_machine_rates';
    const needsMachine = scenario === 'missing_machine_rate' || scenario === 'missing_labour_and_machine_rates';
    const activity = await db.activity.create({
      data: {
        fieldSeasonId: fs.id,
        type: needsProduct ? 'spray' : 'scout',
        status: 'completed',
        date: day(1),
        operatorName,
        areaHa: fs.field.hectares,
        productId: needsProduct ? seeded.productId : null,
        dosePerHa: needsProduct ? 1 : null,
        doseUnit: needsProduct ? 'L' : null,
        actualHours: needsLabour ? 2 : null,
        machineHours: needsMachine ? 1.5 : null,
        machineId: needsMachine ? seeded.machineId : null,
      },
    });
    if (needsProduct) {
      await db.inventoryItem.update({
        where: { id: seeded.productId },
        data: { purchasePricePerUnit: null, currentStock: 487.5 },
      });
      await db.activityCostSnapshot.create({
        data: {
          activityId: activity.id,
          inventoryItemId: seeded.productId,
          sourceType: 'inventory_input',
          itemName: productName,
          quantity: 12.5,
          unit: 'L',
          unitCost: null,
          totalCost: null,
          confidence: 'missing',
        },
      });
      await db.stockMovement.create({
        data: {
          inventoryItemId: seeded.productId,
          activityId: activity.id,
          quantity: 12.5,
          direction: 'out',
          unitCost: null,
          notes: 'E2E valid usage with genuinely absent purchase price',
        },
      });
    }

    // 2. Over-budget field: a low plan + a higher recorded direct cost.
    const budgetPlan = await db.seasonPlanItem.create({ data: { farmId, fieldSeasonId: fs.id, operationType: 'spray', title: 'Planned spray', windowStart: day(1), windowEnd: day(10), expectedCostEur: 100, expectedInputCostEur: 100, status: 'planned' } });
    const overBudgetExpense = await db.financialExpense.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, sourceType: 'field_rent', description: 'Field rent (over budget)', expenseDate: day(2), amount: 500, allocationMethod: 'direct_field', confidence: 'recorded', status: 'active', correlationId: randomUUID() } });
    await db.economicEntry.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, fieldId: fs.fieldId, crop, kind: 'cost', sourceType: 'field_rent', sourceEntityId: overBudgetExpense.id, amount: 500, currency: 'EUR', costDate: day(2), allocationMethod: 'direct_field', confidence: 'recorded', status: 'active', correlationId: randomUUID() } });

    // 3. Unallocated received revenue → unallocated-revenue signal.
    const revenue = await db.revenueEntry.create({ data: { farmId, seasonId, type: 'crop_sale', name: 'Unallocated crop sale', revenueDate: day(3), totalAmount: 1200, allocationMethod: 'unallocated', revenueStatus: 'received', status: 'active', correlationId: randomUUID() } });
    await db.economicEntry.create({ data: { farmId, seasonId, fieldSeasonId: null, fieldId: null, kind: 'revenue', sourceType: 'crop_sale', sourceEntityId: revenue.id, amount: 1200, currency: 'EUR', costDate: day(3), allocationMethod: 'unallocated', confidence: 'allocated', status: 'active', correlationId: randomUUID() } });
    const unallocatedExpense = await db.financialExpense.create({
      data: {
        farmId, seasonId, fieldSeasonId: null, sourceType: 'miscellaneous',
        description: 'E2E unallocated farm expense', expenseDate: day(3), amount: 275,
        allocationMethod: 'unallocated', confidence: 'recorded', status: 'active',
        correlationId: randomUUID(),
      },
    });
    await db.economicEntry.create({
      data: {
        farmId, seasonId, fieldSeasonId: null, fieldId: null, crop: null,
        kind: 'cost', sourceType: 'miscellaneous', sourceEntityId: unallocatedExpense.id,
        amount: 275, currency: 'EUR', costDate: day(3), allocationMethod: 'unallocated',
        confidence: 'recorded', status: 'active', correlationId: randomUUID(),
      },
    });

    // 4. Corrected expense chain on the field: v1 corrected → v2 active.
    const correctedExpenseLabel = 'Seed invoice (corrected)';
    const corrCorrelation = randomUUID();
    const expenseV1 = await db.financialExpense.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, sourceType: 'miscellaneous', description: correctedExpenseLabel, expenseDate: day(4), amount: 500, allocationMethod: 'direct_field', confidence: 'recorded', status: 'corrected', correlationId: corrCorrelation, version: 1 } });
    const expenseV2 = await db.financialExpense.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, sourceType: 'miscellaneous', description: correctedExpenseLabel, expenseDate: day(4), amount: 450, allocationMethod: 'direct_field', confidence: 'recorded', status: 'active', correlationId: corrCorrelation, version: 2, correctionOfId: expenseV1.id, correctionReason: 'Corrected keyed amount' } });
    await db.economicEntry.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, fieldId: fs.fieldId, crop, kind: 'cost', sourceType: 'miscellaneous', sourceEntityId: expenseV2.id, amount: 450, currency: 'EUR', costDate: day(4), allocationMethod: 'direct_field', confidence: 'recorded', status: 'active', correlationId: corrCorrelation } });
    await db.auditEvent.create({ data: { farmId, entityType: 'FinancialExpense', entityId: expenseV2.id, action: 'corrected', source: 'web', correlationId: corrCorrelation, reason: 'Corrected keyed amount', occurredAt: day(4) } });

    // 5. Reversed expense on the field (kept in history, excluded from totals).
    const reversedExpenseLabel = 'Duplicate charge (reversed)';
    const revCorrelation = randomUUID();
    const reversed = await db.financialExpense.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, sourceType: 'miscellaneous', description: reversedExpenseLabel, expenseDate: day(5), amount: 200, allocationMethod: 'direct_field', confidence: 'recorded', status: 'reversed', correlationId: revCorrelation, correctionReason: 'Recorded by mistake' } });
    await db.economicEntry.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, fieldId: fs.fieldId, crop, kind: 'cost', sourceType: 'miscellaneous', sourceEntityId: reversed.id, amount: 200, currency: 'EUR', costDate: day(5), allocationMethod: 'direct_field', confidence: 'recorded', status: 'reversed', correlationId: revCorrelation } });
    await db.auditEvent.create({ data: { farmId, entityType: 'FinancialExpense', entityId: reversed.id, action: 'reversed', source: 'web', correlationId: revCorrelation, reason: 'Recorded by mistake', occurredAt: day(5) } });

    // 6. Reallocated cost on the field: allocation v1 corrected → v2 active.
    const reallocatedLabel = 'Shared machinery (reallocated)';
    const reallocCorrelation = randomUUID();
    const reallocExpense = await db.financialExpense.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, sourceType: 'miscellaneous', description: reallocatedLabel, expenseDate: day(6), amount: 300, allocationMethod: 'per_hectare', confidence: 'allocated', status: 'active', correlationId: reallocCorrelation } });
    const reallocEntry = await db.economicEntry.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, fieldId: fs.fieldId, crop, kind: 'cost', sourceType: 'miscellaneous', sourceEntityId: reallocExpense.id, amount: 300, currency: 'EUR', costDate: day(6), allocationMethod: 'per_hectare', confidence: 'allocated', status: 'active', correlationId: reallocCorrelation } });
    await db.economicAllocation.create({ data: { farmId, economicEntryId: reallocEntry.id, fieldSeasonId: fs.id, percentage: 100, amount: 300, originalAmount: 300, method: 'direct_field', version: 1, status: 'corrected', reason: 'Initial allocation' } });
    await db.economicAllocation.create({ data: { farmId, economicEntryId: reallocEntry.id, fieldSeasonId: fs.id, percentage: 60, amount: 180, originalAmount: 300, method: 'per_hectare', version: 2, status: 'active', reason: 'Reallocated by hectares', correlationId: reallocCorrelation } });
    await db.auditEvent.create({ data: { farmId, entityType: 'EconomicAllocation', entityId: reallocEntry.id, action: 'allocation_changed', source: 'web', correlationId: reallocCorrelation, reason: 'Reallocated by hectares', occurredAt: day(6), metadataJson: { newVersion: 2 } } });

    // 7. Deterministic field revenue supplies a compatible recorded sale price.
    const fieldRevenue = await db.revenueEntry.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, type: 'crop_sale', name: 'E2E field crop sale', revenueDate: day(8), quantity: 40, unit: 'tonnes', pricePerUnit: 50, totalAmount: 2000, allocationMethod: 'direct_field', revenueStatus: 'received', status: 'active', correlationId: randomUUID() } });
    await db.economicEntry.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, fieldId: fs.fieldId, crop, kind: 'revenue', sourceType: 'crop_sale', sourceEntityId: fieldRevenue.id, amount: 2000, currency: 'EUR', quantity: 40, unit: 'tonnes', unitCost: 50, costDate: day(8), allocationMethod: 'direct_field', confidence: 'recorded', status: 'active', correlationId: randomUUID() } });

    // 8. Complete fixtures contain a positive harvest. Passing withHarvest:false
    // isolates MISSING_HARVEST while preserving costs and sale-price evidence.
    if (options.withHarvest !== false) {
      await db.harvestResult.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, harvestDate: day(7), harvestedAreaHa: fs.field.hectares, grossQuantity: 40, saleableQuantity: 40, unit: 'tonnes', status: 'active', correlationId: randomUUID() } });
    }

    // Budget-variance variants reuse the same corrected/reversed fixture. The
    // active field total is €1,250; reversed €200 remains excluded and the
    // corrected chain contributes only its effective €450 version.
    const budgetScenario = options.budgetVarianceScenario ?? 'over_budget';
    if (budgetScenario === 'exact_match') await db.seasonPlanItem.update({ where: { id: budgetPlan.id }, data: { expectedCostEur: 1250, expectedInputCostEur: 1250 } });
    if (budgetScenario === 'under_budget') await db.seasonPlanItem.update({ where: { id: budgetPlan.id }, data: { expectedCostEur: 1500, expectedInputCostEur: 1500 } });
    if (budgetScenario === 'missing_budget') await db.seasonPlanItem.delete({ where: { id: budgetPlan.id } });
    if (budgetScenario === 'zero_budget') await db.seasonPlanItem.update({ where: { id: budgetPlan.id }, data: { expectedCostEur: 0, expectedInputCostEur: 0 } });
    if (budgetScenario === 'missing_actual' || budgetScenario === 'zero_actual') {
      await db.economicAllocation.deleteMany({ where: { farmId } });
      await db.economicEntry.deleteMany({ where: { farmId, fieldSeasonId: fs.id, kind: 'cost', status: 'active' } });
      if (budgetScenario === 'zero_actual') await db.economicEntry.create({ data: { farmId, seasonId, fieldSeasonId: fs.id, fieldId: fs.fieldId, crop, kind: 'cost', sourceType: 'miscellaneous', sourceEntityId: randomUUID(), amount: 0, currency: 'EUR', costDate: day(9), allocationMethod: 'direct_field', confidence: 'recorded', status: 'active', correlationId: randomUUID() } });
    }

    return {
      ...seeded,
      seasonId,
      correctedExpenseLabel,
      reversedExpenseLabel,
      reallocatedLabel,
      productName,
      operatorName,
      machineName,
    };
  } finally {
    await db.$disconnect();
  }
}
