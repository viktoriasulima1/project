import { describe, expect, it } from 'vitest';
import { allocateAmount, financialDrivers, resolveBudgetVariance, resolveEconomicsCompleteness, resolveFieldEconomics, resolveGrossMargin, weightedAverageCost, yieldPerHectare } from '../economics';

describe('weighted average valuation', () => {
  it('values first purchase',()=>expect(weightedAverageCost({currentQuantity:0,currentUnitCost:null,purchaseQuantity:10,purchaseTotal:50})).toBe(5));
  it('weights a second purchase',()=>expect(weightedAverageCost({currentQuantity:10,currentUnitCost:5,purchaseQuantity:10,purchaseTotal:70})).toBe(6));
  it('handles unequal quantities',()=>expect(weightedAverageCost({currentQuantity:5,currentUnitCost:4,purchaseQuantity:15,purchaseTotal:120})).toBe(7));
  it('accepts explicit zero-cost purchase',()=>expect(weightedAverageCost({currentQuantity:0,currentUnitCost:null,purchaseQuantity:5,purchaseTotal:0})).toBe(0));
  it('does not divide by zero',()=>expect(weightedAverageCost({currentQuantity:0,currentUnitCost:null,purchaseQuantity:0,purchaseTotal:0})).toBeNull());
  it('rejects negative quantity',()=>expect(weightedAverageCost({currentQuantity:-1,currentUnitCost:5,purchaseQuantity:1,purchaseTotal:5})).toBeNull());
  it('reports missing existing valuation',()=>expect(weightedAverageCost({currentQuantity:5,currentUnitCost:null,purchaseQuantity:5,purchaseTotal:20})).toBeNull());
});

describe('allocation and yield', () => {
  it('allocates equally',()=>expect(allocateAmount(100,[1,1])).toEqual([50,50]));
  it('allocates by hectares',()=>expect(allocateAmount(100,[1,3])).toEqual([25,75]));
  it('preserves rounded total',()=>expect(allocateAmount(100,[1,1,1])?.reduce((a,b)=>a+b,0)).toBe(100));
  it('rejects zero weights',()=>expect(allocateAmount(100,[0,0])).toBeNull());
  it('rejects negative weight',()=>expect(allocateAmount(100,[1,-1])).toBeNull());
  it('calculates yield per hectare',()=>expect(yieldPerHectare(40,5)).toBe(8));
  it('blocks zero hectares',()=>expect(yieldPerHectare(40,0)).toBeNull());
  it('preserves explicit zero harvest',()=>expect(yieldPerHectare(0,5)).toBe(0));
});

const complete = () => resolveEconomicsCompleteness({productPricesKnown:true,labourApplicable:false,labourRatesKnown:false,machineryApplicable:false,machineryRatesKnown:false,contractorApplicable:false,contractorRecorded:false,harvestRecorded:true,revenueRecorded:true,overheadChoiceRecorded:true,unitsCompatible:true});
describe('completeness', () => {
  it('is profitability ready',()=>expect(complete().status).toBe('profitability_ready'));
  it('is 100 percent when complete',()=>expect(complete().percentage).toBe(100));
  it('reports missing product prices',()=>expect(resolveEconomicsCompleteness({...base(),productPricesKnown:false}).reasons.map(r=>r.code)).toContain('MISSING_PRODUCT_PRICE'));
  it('reports missing machine rate when applicable',()=>expect(resolveEconomicsCompleteness({...base(),machineryApplicable:true,machineryRatesKnown:false}).reasons.map(r=>r.code)).toContain('MISSING_MACHINE_RATE'));
  it('ignores machine rate when not applicable',()=>expect(resolveEconomicsCompleteness(base()).reasons.map(r=>r.code)).not.toContain('MISSING_MACHINE_RATE'));
  it('reports missing labour rate',()=>expect(resolveEconomicsCompleteness({...base(),labourApplicable:true,labourRatesKnown:false}).reasons.map(r=>r.code)).toContain('MISSING_LABOUR_RATE'));
  it('reports missing contractor cost',()=>expect(resolveEconomicsCompleteness({...base(),contractorApplicable:true,contractorRecorded:false}).reasons.map(r=>r.code)).toContain('MISSING_CONTRACTOR_COST'));
  it('is cost tracking without harvest',()=>expect(resolveEconomicsCompleteness({...base(),harvestRecorded:false}).status).toBe('cost_tracking_active'));
  it('is partial without revenue',()=>expect(resolveEconomicsCompleteness({...base(),revenueRecorded:false}).status).toBe('partial_profitability'));
  it('is partial on unit mismatch',()=>expect(resolveEconomicsCompleteness({...base(),unitsCompatible:false}).status).toBe('partial_profitability'));
  it('is insufficient with missing material cost',()=>expect(resolveEconomicsCompleteness({...base(),productPricesKnown:false}).status).toBe('insufficient_data'));
});

function base(){return {productPricesKnown:true,labourApplicable:false,labourRatesKnown:false,machineryApplicable:false,machineryRatesKnown:false,contractorApplicable:false,contractorRecorded:false,harvestRecorded:true,revenueRecorded:true,overheadChoiceRecorded:true,unitsCompatible:true};}
describe('field economics',()=>{
  const result=()=>resolveFieldEconomics({hectares:10,directCosts:[500],allocatedCosts:[100],recordedRevenue:[1000],saleableYield:20,yieldUnit:'tonnes',recordedPricePerUnit:50,completeness:complete(),calculatedAt:'now'});
  it('totals direct costs',()=>expect(result().directCosts).toBe(500));
  it('totals allocated costs',()=>expect(result().allocatedCosts).toBe(100));
  it('totals recorded costs',()=>expect(result().totalRecordedCosts).toBe(600));
  it('totals revenue',()=>expect(result().recordedRevenue).toBe(1000));
  it('calculates gross margin',()=>expect(result().grossMargin).toBe(400));
  it('calculates cost per hectare',()=>expect(result().costPerHa).toBe(60));
  it('calculates revenue per hectare',()=>expect(result().revenuePerHa).toBe(100));
  it('calculates margin per hectare',()=>expect(result().grossMarginPerHa).toBe(40));
  it('calculates cost per yield unit',()=>expect(result().costPerYieldUnit).toBe(30));
  it('calculates break-even price',()=>expect(result().breakEvenPrice).toBe(30));
  it('calculates break-even yield',()=>expect(result().breakEvenYield).toBe(12));
  it('does not treat missing cost as zero',()=>expect(resolveFieldEconomics({...input(),directCosts:[null]}).totalRecordedCosts).toBeNull());
  it('does not invent missing revenue',()=>expect(resolveFieldEconomics({...input(),recordedRevenue:[]}).recordedRevenue).toBeNull());
  it('blocks gross margin with missing cost',()=>expect(resolveFieldEconomics({...input(),directCosts:[null]}).grossMargin).toBeNull());
  it('blocks break-even at partial completeness',()=>expect(resolveFieldEconomics({...input(),completeness:resolveEconomicsCompleteness({...base(),revenueRecorded:false})}).breakEvenPrice).toBeNull());
});
function input(){return {hectares:10,directCosts:[500] as Array<number|null>,allocatedCosts:[100] as Array<number|null>,recordedRevenue:[1000],saleableYield:20,yieldUnit:'tonnes',recordedPricePerUnit:50,completeness:complete()};}

describe('canonical gross margin', () => {
  const margin = (recordedRevenue: number | null, totalRecordedCost: number | null, over: Partial<Parameters<typeof resolveGrossMargin>[0]> = {}) => resolveGrossMargin({ recordedRevenue, totalRecordedCost, fieldAreaHa: 10, completeness: complete(), ...over });
  it('classifies positive, zero and negative without changing the formula', () => {
    expect(margin(1000, 600)).toMatchObject({available:true,status:'positive',reasonCode:'POSITIVE_MARGIN',metadata:{grossMarginCents:40000,marginPerHaCents:4000}});
    expect(margin(600, 600)).toMatchObject({available:true,status:'zero',reasonCode:'ZERO_MARGIN',metadata:{grossMarginCents:0}});
    expect(margin(500, 600)).toMatchObject({available:true,status:'negative',reasonCode:'NEGATIVE_MARGIN',metadata:{grossMarginCents:-10000}});
  });
  it('distinguishes explicit zero values from missing values', () => {
    expect(margin(0, 0)).toMatchObject({available:true,status:'zero',metadata:{revenueCents:0,totalCostCents:0}});
    expect(margin(null, 0)).toMatchObject({available:false,reasonCode:'MISSING_REVENUE',actionCode:'ADD_REVENUE',metadata:{revenueCents:null,totalCostCents:0}});
    expect(margin(0, null)).toMatchObject({available:false,reasonCode:'MISSING_COST',actionCode:'ADD_EXPENSE',metadata:{revenueCents:0,totalCostCents:null}});
  });
  it('keeps incomplete cost linked to canonical completeness evidence', () => {
    const completeness = resolveEconomicsCompleteness({...base(),productPricesKnown:false});
    expect(margin(1000, null, {completeness,unpricedRecordCount:2})).toMatchObject({available:false,status:'partial',reasonCode:'INCOMPLETE_COST',actionCode:'REVIEW_UNPRICED_COSTS',metadata:{unpricedRecordCount:2,completenessStatus:'insufficient_data',completenessReasonCodes:['MISSING_PRODUCT_PRICE']}});
  });
  it('keeps missing/zero hectares honest and rounds serialized cents', () => {
    expect(margin(10.015, 0, {fieldAreaHa:0}).metadata.marginPerHaCents).toBeNull();
    expect(margin(10.015, 0, {fieldAreaHa:3}).metadata).toMatchObject({revenueCents:1002,grossMarginCents:1002,marginPerHaCents:334});
  });
  it('contains no final presentation prose', () => expect(JSON.stringify(margin(1000,600))).not.toMatch(/positive margin|gross margin|view cost/i));
  it('is the canonical projection of legacy field economics numbers', () => {
    const resolved = resolveFieldEconomics(input());
    expect(resolved.grossMarginResult.metadata.grossMarginCents).toBe(Math.round(resolved.grossMargin! * 100));
    expect(resolved.grossMarginResult.metadata.marginPerHaCents).toBe(Math.round(resolved.grossMarginPerHa! * 100));
  });
});

describe('budget and evidence drivers',()=>{
  it('calculates over-budget variance without changing the sign',()=>expect(resolveBudgetVariance({budget:100,actual:125})).toMatchObject({available:true,status:'over_budget',reasonCode:'OVER_BUDGET',actionCode:'REVIEW_COSTS',metadata:{budgetCents:10000,actualCents:12500,varianceCents:2500,variancePercent:25}}));
  it('calculates under-budget variance',()=>expect(resolveBudgetVariance({budget:100,actual:75})).toMatchObject({available:true,status:'under_budget',reasonCode:'UNDER_BUDGET',metadata:{varianceCents:-2500,variancePercent:-25}}));
  it('classifies an exact match',()=>expect(resolveBudgetVariance({budget:100,actual:100})).toMatchObject({available:true,status:'within_budget',reasonCode:'WITHIN_BUDGET',metadata:{varianceCents:0,variancePercent:0}}));
  it('distinguishes missing budget from zero',()=>expect(resolveBudgetVariance({budget:null,actual:125})).toMatchObject({available:false,reasonCode:'BUDGET_NOT_RECORDED',metadata:{budgetCents:null,actualCents:12500}}));
  it('distinguishes missing actual from zero',()=>expect(resolveBudgetVariance({budget:125,actual:null})).toMatchObject({available:false,reasonCode:'ACTUAL_COST_NOT_RECORDED',metadata:{budgetCents:12500,actualCents:null}}));
  it('reports both values missing',()=>expect(resolveBudgetVariance({budget:null,actual:null})).toMatchObject({available:false,reasonCode:'BUDGET_AND_ACTUAL_NOT_RECORDED'}));
  it('preserves explicit zero budget and blocks only the percentage denominator',()=>expect(resolveBudgetVariance({budget:0,actual:10})).toMatchObject({available:true,status:'over_budget',metadata:{budgetCents:0,actualCents:1000,varianceCents:1000,variancePercent:null}}));
  it('preserves explicit zero actual cost',()=>expect(resolveBudgetVariance({budget:10,actual:0})).toMatchObject({available:true,status:'under_budget',metadata:{actualCents:0,varianceCents:-1000,variancePercent:-100}}));
  it('blocks falsely precise variance for incomplete actual cost',()=>expect(resolveBudgetVariance({budget:100,actual:null,actualCostComplete:false,unpricedRecordCount:2})).toMatchObject({available:false,reasonCode:'ACTUAL_COST_INCOMPLETE',actionCode:'REVIEW_UNPRICED_COSTS',metadata:{varianceCents:null,unpricedRecordCount:2}}));
  it('blocks a currency mismatch',()=>expect(resolveBudgetVariance({budget:100,actual:100,currency:'EUR',actualCurrency:'GBP'})).toMatchObject({available:false,reasonCode:'CURRENCY_MISMATCH'}));
  it('reconciles cents before percentage calculation',()=>expect(resolveBudgetVariance({budget:10.005,actual:10.015}).metadata).toMatchObject({budgetCents:1001,actualCents:1002,varianceCents:1}));
  it('returns canonical metadata without final prose',()=>expect(JSON.stringify(resolveBudgetVariance({budget:100,actual:125}))).not.toMatch(/budget is|costs exceed|review costs/i));
  it('returns a canonical quantity driver code',()=>expect(financialDrivers({plannedQuantity:10,actualQuantity:11})).toEqual(['PRODUCT_QUANTITY_ABOVE_PLAN']));
  it('does not invent unsupported cause',()=>expect(financialDrivers({plannedQuantity:null,actualQuantity:11})).toEqual([]));
});
