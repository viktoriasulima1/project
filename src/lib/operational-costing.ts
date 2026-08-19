export interface EffectiveRate<T> { effectiveFrom: Date; effectiveTo?: Date | null; value: T; }

export function effectiveRateAt<T>(rates: EffectiveRate<T>[], at: Date): EffectiveRate<T> | null {
  return rates
    .filter(rate => rate.effectiveFrom <= at && (!rate.effectiveTo || rate.effectiveTo >= at))
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] ?? null;
}

export function labourCost(lines: Array<{ hours: number; hourlyRate: number | null }>): number | null {
  if (!lines.length || lines.some(line => line.hourlyRate == null)) return null;
  return roundMoney(lines.reduce((sum, line) => sum + line.hours * line.hourlyRate!, 0));
}

export function machineAndFuelCost(input: {
  hours: number;
  hourlyRate: number | null;
  fuelPolicy: 'included_in_hourly_rate' | 'tracked_separately';
  fuelLitres?: number | null;
  consumptionPerHour?: number | null;
  fuelUnitCost?: number | null;
}) {
  const machineCost = input.hourlyRate == null ? null : roundMoney(input.hours * input.hourlyRate);
  if (input.fuelPolicy === 'included_in_hourly_rate') {
    return { machineCost, fuelLitres: null, fuelCost: 0, totalCost: machineCost, method: 'fuel_included_in_hourly_rate' as const };
  }
  const litres = input.fuelLitres ?? (input.consumptionPerHour == null ? null : input.hours * input.consumptionPerHour);
  const fuelCost = litres == null || input.fuelUnitCost == null ? null : roundMoney(litres * input.fuelUnitCost);
  return { machineCost, fuelLitres: litres, fuelCost, totalCost: machineCost == null || fuelCost == null ? null : roundMoney(machineCost + fuelCost), method: input.fuelLitres != null ? 'actual_fuel_use' as const : 'configured_consumption' as const };
}

export function contractorTotal(rateType: 'total'|'per_hectare'|'per_hour'|'per_tonne'|'per_operation', quantity: number, rate: number): number {
  return roundMoney(rateType === 'total' ? rate : quantity * rate);
}

export function percentageAllocations(amount: number, allocations: Array<{ fieldSeasonId: string; percentage: number }>) {
  if (!allocations.length) throw new Error('At least one allocation is required.');
  const percentage = allocations.reduce((sum, item) => sum + item.percentage, 0);
  if (Math.abs(percentage - 100) > 0.0001) throw new Error('Allocation percentages must total 100%.');
  const cents = Math.round(amount * 100);
  const raw = allocations.map(item => cents * item.percentage / 100);
  const floors = raw.map(Math.floor);
  let remaining = cents - floors.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - floors[index] })).sort((a,b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remaining; index++) floors[order[index].index] += 1;
  return allocations.map((item, index) => ({ ...item, amount: floors[index] / 100 }));
}

export function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
