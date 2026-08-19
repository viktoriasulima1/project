import { describe, expect, it } from 'vitest';
import { contractorTotal, effectiveRateAt, labourCost, machineAndFuelCost, percentageAllocations } from '../operational-costing';

describe('operational costing invariants', () => {
  it('selects the historical rate effective on completion date', () => expect(effectiveRateAt([{effectiveFrom:new Date('2026-01-01'),effectiveTo:new Date('2026-05-31'),value:20},{effectiveFrom:new Date('2026-06-01'),value:30}],new Date('2026-04-10'))?.value).toBe(20));
  it('selects the latest overlapping effective version', () => expect(effectiveRateAt([{effectiveFrom:new Date('2026-01-01'),value:20},{effectiveFrom:new Date('2026-03-01'),value:25}],new Date('2026-04-10'))?.value).toBe(25));
  it('returns null where no rate is effective', () => expect(effectiveRateAt([{effectiveFrom:new Date('2027-01-01'),value:20}],new Date('2026-04-10'))).toBeNull());
  it('costs multiple workers', () => expect(labourCost([{hours:2,hourlyRate:20},{hours:3,hourlyRate:30}])).toBe(130));
  it('keeps missing labour rate unknown', () => expect(labourCost([{hours:2,hourlyRate:null}])).toBeNull());
  it('keeps an empty labour set unknown', () => expect(labourCost([])).toBeNull());
  it('costs machine hours', () => expect(machineAndFuelCost({hours:3,hourlyRate:40,fuelPolicy:'included_in_hourly_rate'}).machineCost).toBe(120));
  it('does not add fuel when included', () => expect(machineAndFuelCost({hours:3,hourlyRate:40,fuelPolicy:'included_in_hourly_rate',fuelLitres:99,fuelUnitCost:2}).totalCost).toBe(120));
  it('uses actual separate fuel', () => expect(machineAndFuelCost({hours:2,hourlyRate:40,fuelPolicy:'tracked_separately',fuelLitres:10,fuelUnitCost:1.5}).totalCost).toBe(95));
  it('uses configured consumption only without actual litres', () => expect(machineAndFuelCost({hours:2,hourlyRate:40,fuelPolicy:'tracked_separately',consumptionPerHour:6,fuelUnitCost:1.5}).fuelCost).toBe(18));
  it('keeps separate fuel unknown without price', () => expect(machineAndFuelCost({hours:2,hourlyRate:40,fuelPolicy:'tracked_separately',fuelLitres:10,fuelUnitCost:null}).totalCost).toBeNull());
  it.each([['total',4,50,50],['per_hectare',4,50,200],['per_hour',4,50,200],['per_tonne',4,50,200],['per_operation',4,50,200]] as const)('calculates contractor %s', (type,q,rate,total) => expect(contractorTotal(type,q,rate)).toBe(total));
  it('allocates exactly with deterministic cents', () => expect(percentageAllocations(10,[{fieldSeasonId:'a',percentage:33.3333},{fieldSeasonId:'b',percentage:33.3333},{fieldSeasonId:'c',percentage:33.3334}]).map(x=>x.amount)).toEqual([3.33,3.33,3.34]));
  it('rejects allocation percentages below 100', () => expect(()=>percentageAllocations(10,[{fieldSeasonId:'a',percentage:90}])).toThrow('100%'));
  it('preserves the original total', () => expect(percentageAllocations(12.37,[{fieldSeasonId:'a',percentage:25},{fieldSeasonId:'b',percentage:75}]).reduce((s,x)=>s+x.amount,0)).toBe(12.37));
});
