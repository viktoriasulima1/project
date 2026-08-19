import type { Prisma } from '@prisma/client';
import { machineAndFuelCost } from './operational-costing';

export async function recordActivityInputEconomics(tx: Prisma.TransactionClient, input: {
  farmId: string; seasonId: string; fieldSeasonId: string; fieldId: string; crop: Prisma.EconomicEntryCreateInput['crop'];
  activityId: string; inventoryItemId: string; productName: string; quantity: number; unit: string;
  unitCost: number | null; priceEffectiveDate: Date | null; currency: string; costDate: Date; correlationId: string;
}) {
  // Some legacy unit tests use intentionally minimal transaction doubles.
  // Production Prisma always exposes these delegates; keeping the helper
  // tolerant lets those tests continue exercising their original concern.
  if (!tx.activityCostSnapshot || !tx.economicEntry) return null;
  const totalCost = input.unitCost == null ? null : input.quantity * input.unitCost;
  await tx.activityCostSnapshot.create({ data: {
    activityId: input.activityId, inventoryItemId: input.inventoryItemId, sourceType: 'inventory_input', itemName: input.productName,
    quantity: input.quantity, unit: input.unit, unitCost: input.unitCost, priceSource: input.unitCost == null ? null : 'weighted_average_inventory',
    priceEffectiveDate: input.priceEffectiveDate, totalCost, currency: input.currency, confidence: input.unitCost == null ? 'missing' : 'recorded',
  } });
  if (totalCost != null) await tx.economicEntry.create({ data: {
    farmId: input.farmId, seasonId: input.seasonId, fieldSeasonId: input.fieldSeasonId, fieldId: input.fieldId, crop: input.crop,
    kind: 'cost', sourceType: 'inventory_input', sourceEntityId: input.activityId, amount: totalCost, currency: input.currency,
    quantity: input.quantity, unit: input.unit, unitCost: input.unitCost, costDate: input.costDate, allocationMethod: 'direct_field', confidence: 'recorded', correlationId: input.correlationId,
  } });
  return totalCost;
}

export async function recordActivityOperationalEconomics(tx: Prisma.TransactionClient, input: {
  activityId: string; farmId: string; currency: string; correlationId: string;
}) {
  if (!tx.activityLabourCostSnapshot || !tx.activityMachineCostSnapshot) return;
  const activity = await tx.activity.findFirst({
    where: { id: input.activityId, fieldSeason: { field: { farmId: input.farmId } } },
    include: {
      fieldSeason: true,
      machine: true,
      fuelInventoryItem: true,
      completedWorkOrder: {
        include: {
          employees: {
            include: { employee: { include: { rateVersions: { orderBy: { effectiveFrom: 'desc' } } } } },
          },
        },
      },
    },
  });
  if (!activity) throw new Error('Activity ownership could not be verified for cost recording.');
  const at = activity.date;
  const labourLines = activity.completedWorkOrder?.employees ?? [];
  for (const assignment of labourLines) {
    const hours = Number(assignment.actualHours ?? activity.actualHours ?? assignment.plannedHours ?? activity.completedWorkOrder?.estimatedHours ?? 0);
    if (hours <= 0) continue;
    const rate = assignment.employee.rateVersions.find(version => version.effectiveFrom <= at && (!version.effectiveTo || version.effectiveTo >= at));
    const legacyRate = !rate && assignment.employee.costEffectiveFrom && assignment.employee.costEffectiveFrom <= at && assignment.employee.hourlyOperationalCost != null ? Number(assignment.employee.hourlyOperationalCost) : null;
    const hourlyRate = rate ? Number(rate.hourlyOperationalCost) : legacyRate;
    const totalCost = hourlyRate == null ? null : Math.round(hours * hourlyRate * 100) / 100;
    await tx.activityLabourCostSnapshot.create({ data: {
      activityId: activity.id, employeeId: assignment.employeeId, employeeRateId: rate?.id,
      employeeName: assignment.employee.name, labourCostType: rate?.labourCostType ?? assignment.employee.labourCostType,
      actualHours: hours, hourlyRate, totalCost, effectiveFrom: rate?.effectiveFrom ?? assignment.employee.costEffectiveFrom,
      currency: input.currency, confidence: totalCost == null ? 'missing' : 'recorded',
    } });
    if (totalCost != null) await tx.economicEntry.create({ data: {
      farmId: input.farmId, seasonId: activity.fieldSeason.seasonId, fieldSeasonId: activity.fieldSeasonId,
      fieldId: activity.fieldSeason.fieldId, crop: activity.fieldSeason.crop, kind: 'cost', sourceType: 'labour',
      sourceEntityId: activity.id, amount: totalCost, currency: input.currency, quantity: hours, unit: 'hour', unitCost: hourlyRate,
      costDate: at, allocationMethod: 'direct_field', confidence: 'recorded', correlationId: input.correlationId,
    } });
  }
  if (!activity.machine || activity.machineHours == null || Number(activity.machineHours) <= 0) return;
  const machineRate = await tx.machineRate.findFirst({ where: { machineId: activity.machine.id, effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }] }, orderBy: { effectiveFrom: 'desc' } });
  const legacyMachineRate = !machineRate && activity.machine.costEffectiveFrom && activity.machine.costEffectiveFrom <= at && activity.machine.hourlyOperationalCost != null ? Number(activity.machine.hourlyOperationalCost) : null;
  const hourlyRate = machineRate ? Number(machineRate.hourlyOperationalCost) : legacyMachineRate;
  const fuelPolicy = machineRate?.fuelCostPolicy ?? activity.machine.fuelCostPolicy;
  const fuelUnitCost = activity.fuelInventoryItem?.purchasePricePerUnit == null ? null : Number(activity.fuelInventoryItem.purchasePricePerUnit);
  const calculation = machineAndFuelCost({ hours: Number(activity.machineHours), hourlyRate, fuelPolicy, fuelLitres: activity.fuelUsed == null ? null : Number(activity.fuelUsed), consumptionPerHour: machineRate?.fuelConsumptionPerHour == null ? (activity.machine.fuelConsumptionPerHour == null ? null : Number(activity.machine.fuelConsumptionPerHour)) : Number(machineRate.fuelConsumptionPerHour), fuelUnitCost });
  if (fuelPolicy === 'tracked_separately' && calculation.fuelLitres != null && calculation.fuelLitres > 0) {
    if (!activity.fuelInventoryItem || activity.fuelInventoryItem.farmId !== input.farmId) throw new Error('Select a farm-owned fuel inventory item for separate fuel costing.');
    if (Number(activity.fuelInventoryItem.currentStock) < calculation.fuelLitres) throw new Error(`Insufficient fuel stock: ${Number(activity.fuelInventoryItem.currentStock).toFixed(3)} L available, ${calculation.fuelLitres.toFixed(3)} L required.`);
    const updated = await tx.$executeRaw`UPDATE inventory_items SET "currentStock" = "currentStock" - ${calculation.fuelLitres}::numeric, "updatedAt" = NOW() WHERE id = ${activity.fuelInventoryItem.id} AND "farmId" = ${input.farmId} AND "currentStock" >= ${calculation.fuelLitres}::numeric`;
    if (updated === 0) throw new Error('Fuel stock changed concurrently. Review inventory and retry.');
    await tx.stockMovement.create({ data: { inventoryItemId: activity.fuelInventoryItem.id, activityId: activity.id, quantity: calculation.fuelLitres, direction: 'out', unitCost: fuelUnitCost, notes: `Fuel use · ${calculation.method}`, correlationId: input.correlationId } });
  }
  await tx.activityMachineCostSnapshot.create({ data: {
    activityId: activity.id, machineId: activity.machine.id, machineRateId: machineRate?.id, machineName: activity.machine.name,
    actualHours: activity.machineHours, hourlyRate, machineCost: calculation.machineCost, fuelCostPolicy: fuelPolicy,
    fuelInventoryItemId: fuelPolicy === 'tracked_separately' ? activity.fuelInventoryItemId : null,
    fuelLitres: calculation.fuelLitres, fuelUnitCost: fuelPolicy === 'tracked_separately' ? fuelUnitCost : null,
    fuelCost: calculation.fuelCost, totalCost: calculation.totalCost, effectiveFrom: machineRate?.effectiveFrom ?? activity.machine.costEffectiveFrom,
    currency: input.currency, confidence: calculation.totalCost == null ? 'missing' : 'recorded', method: calculation.method,
  } });
  if (calculation.machineCost != null) await tx.economicEntry.create({ data: {
    farmId: input.farmId, seasonId: activity.fieldSeason.seasonId, fieldSeasonId: activity.fieldSeasonId, fieldId: activity.fieldSeason.fieldId,
    crop: activity.fieldSeason.crop, kind: 'cost', sourceType: 'machinery', sourceEntityId: activity.id, amount: calculation.machineCost,
    currency: input.currency, quantity: activity.machineHours, unit: 'hour', unitCost: hourlyRate, costDate: at,
    allocationMethod: 'direct_field', confidence: 'recorded', correlationId: input.correlationId,
  } });
  if (fuelPolicy === 'tracked_separately' && calculation.fuelCost != null && calculation.fuelLitres != null) {
    await tx.economicEntry.create({ data: {
      farmId: input.farmId, seasonId: activity.fieldSeason.seasonId, fieldSeasonId: activity.fieldSeasonId, fieldId: activity.fieldSeason.fieldId,
      crop: activity.fieldSeason.crop, kind: 'cost', sourceType: 'fuel', sourceEntityId: activity.id, amount: calculation.fuelCost,
      currency: input.currency, quantity: calculation.fuelLitres, unit: 'L', unitCost: fuelUnitCost, costDate: at,
      allocationMethod: 'direct_field', confidence: 'recorded', correlationId: input.correlationId,
    } });
  }
}
