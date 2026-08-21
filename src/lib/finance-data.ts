import type { Farm } from '@prisma/client';
import { db } from './db';
import { resolveBudgetVariance, resolveEconomicsCompleteness, resolveFieldEconomics, type BudgetVarianceResult, type FinancialCompletenessResult, type FinancialCompletenessReasonCode, type GrossMarginResult } from './economics';

export interface FieldEconomicsRow {
  fieldSeasonId: string; fieldId: string; field: string; crop: string; hectares: number;
  recordedCostEur: number | null; recordedRevenueEur: number | null; grossMarginEur: number | null;
  costPerHaEur: number | null; revenuePerHaEur: number | null; grossMarginPerHaEur: number | null;
  yieldQuantity: number | null; yieldUnit: string | null; yieldPerHa: number | null; costPerYieldUnit: number | null;
  harvestRecorded: boolean; harvestRecordCount: number;
  breakEvenPrice: number | null; breakEvenYield: number | null; completenessPercent: number; completenessStatus: string;
  completenessResult: FinancialCompletenessResult; budgetCostEur: number | null; budgetRevenueEur: number | null; costVariance: BudgetVarianceResult;
  grossMarginResult: GrossMarginResult;
}
export interface CropEconomicsRow { crop:string; fields:number; hectares:number; costEur:number|null; revenueEur:number|null; grossMarginEur:number|null; costPerHaEur:number|null; grossMarginPerHaEur:number|null; completenessPercent:number; }
export interface FinanceData {
  hasFinancialData:boolean; seasonId:string|null; seasonYear:number|null; currency:string;
  totalRecordedCostEur:number|null; totalRecordedRevenueEur:number|null; grossMarginEur:number|null;
  completenessPercent:number; completenessStatus:string; fields:FieldEconomicsRow[]; crops:CropEconomicsRow[];
  unallocatedCostEur:number|null; unallocatedRevenueEur:number|null; missingData:FinancialCompletenessReasonCode[];
  recentPurchases:Array<{id:string;date:string;item:string;quantity:number;unit:string;total:number;unitCost:number}>;
  recentEntries:Array<
    | {id:string;date:string;label:string;kind:'cost'|'revenue';recordType:'expense'|'revenue';amount:number;status:string;version:number}
    | {id:string;date:string;label:string;kind:'harvest';recordType:'harvest';grossQuantity:number;saleableQuantity:number|null;unit:string;status:string;version:number}
  >;
  expectedRevenueEur:number|null; approvedRevenueEur:number|null; lastCalculatedAt:string;
  hasActivityData:boolean; costByField:Array<{key:string;label:string;hectares:number;costEur:number;costPerHaEur:number}>; costByCrop:Array<{key:string;label:string;hectares:number;costEur:number;costPerHaEur:number}>;
  totalProductLines:number; linesWithPrice:number; missingPriceProducts:string[]; dateRangeStart:string|null; dateRangeEnd:string|null;
}

const sumKnown=(values:Array<number|null>)=>{if(values.some(v=>v==null))return null;let total=0;for(const value of values)total+=value??0;return total;};

export function aggregateHarvestYield(rows: ReadonlyArray<{ saleableQuantity: unknown; grossQuantity: unknown }>): number | null {
  return rows.length ? rows.reduce((sum, row) => sum + Number(row.saleableQuantity ?? row.grossQuantity), 0) : null;
}

export async function getFinanceData(farm: Farm, seasonId?: string): Promise<FinanceData> {
  const season=await db.season.findFirst({where:{farmId:farm.id,...(seasonId?{id:seasonId}:{isActive:true})},orderBy:{year:'desc'}});
  const empty:FinanceData={hasFinancialData:false,seasonId:season?.id??null,seasonYear:season?.year??null,currency:farm.currency,totalRecordedCostEur:null,totalRecordedRevenueEur:null,grossMarginEur:null,completenessPercent:0,completenessStatus:'insufficient_data',fields:[],crops:[],unallocatedCostEur:null,unallocatedRevenueEur:null,missingData:[],recentPurchases:[],recentEntries:[],expectedRevenueEur:null,approvedRevenueEur:null,lastCalculatedAt:new Date().toISOString(),hasActivityData:false,costByField:[],costByCrop:[],totalProductLines:0,linesWithPrice:0,missingPriceProducts:[],dateRangeStart:null,dateRangeEnd:null};
  if(!season)return empty;
  const [fieldSeasons,entries,purchases,expenses,revenues]=await Promise.all([
    db.fieldSeason.findMany({where:{seasonId:season.id,field:{farmId:farm.id,deletedAt:null}},include:{field:true,activities:{where:{status:'completed',deletedAt:null},include:{costSnapshots:true}},harvestResults:{where:{status:'active'}},seasonPlanItems:{where:{status:{not:'cancelled'}}}},orderBy:{field:{name:'asc'}}}),
    db.economicEntry.findMany({where:{farmId:farm.id,seasonId:season.id,status:'active'},orderBy:{costDate:'desc'}}),
    db.inventoryPurchase.findMany({where:{farmId:farm.id,seasonId:season.id,status:'active'},include:{inventoryItem:{select:{name:true}}},orderBy:{purchaseDate:'desc'},take:10}),
    db.financialExpense.findMany({where:{farmId:farm.id,seasonId:season.id,status:'active'},orderBy:{expenseDate:'desc'},take:10}),
    db.revenueEntry.findMany({where:{farmId:farm.id,seasonId:season.id,status:'active'},orderBy:{revenueDate:'desc'},take:20}),
  ]);
  const rows:FieldEconomicsRow[]=fieldSeasons.map(fs=>{
    const fieldEntries=entries.filter(e=>e.fieldSeasonId===fs.id);
    const costs=fieldEntries.filter(e=>e.kind==='cost'); const revenue=fieldEntries.filter(e=>e.kind==='revenue');
    const inputActivities=fs.activities.filter(activity=>activity.productId!=null);
    const missingSnapshotCosts=inputActivities.flatMap(activity=>activity.costSnapshots.length===0?[null]:activity.costSnapshots.filter(snapshot=>snapshot.unitCost==null).map(()=>null));
    const directCosts:Array<number|null>=[...costs.filter(e=>e.allocationMethod==='direct_field').map(e=>Number(e.amount)),...missingSnapshotCosts];
    if(costs.length===0&&inputActivities.length===0)directCosts.push(null);
    const allocatedCosts=costs.filter(e=>e.allocationMethod!=='direct_field').map(e=>Number(e.amount));
    const costSnapshots=fs.activities.flatMap(a=>a.costSnapshots);
    const productPricesKnown=inputActivities.every(activity=>activity.costSnapshots.length>0&&activity.costSnapshots.every(snapshot=>snapshot.unitCost!=null));
    const labourApplicable=fs.activities.some(a=>a.actualHours!=null); const machineryApplicable=fs.activities.some(a=>a.machineHours!=null);
    const harvestUnits=new Set(fs.harvestResults.map(h=>h.unit)); const revenueUnits=new Set(revenues.filter(r=>r.fieldSeasonId===fs.id&&r.quantity!=null).map(r=>r.unit).filter(Boolean));
    const unitsCompatible=harvestUnits.size<=1&&revenueUnits.size<=1&&(!harvestUnits.size||!revenueUnits.size||[...harvestUnits][0]===[...revenueUnits][0]);
    const completeness=resolveEconomicsCompleteness({productPricesKnown,labourApplicable,labourRatesKnown:fieldEntries.some(e=>e.sourceType==='labour'),machineryApplicable,machineryRatesKnown:fieldEntries.some(e=>e.sourceType==='machinery'),contractorApplicable:false,contractorRecorded:true,harvestRecorded:fs.harvestResults.length>0,revenueRecorded:revenue.length>0,overheadChoiceRecorded:farm.overheadChoiceRecorded,unitsCompatible});
    const harvestRecordCount=fs.harvestResults.length;
    // An empty aggregate is missing evidence, not a recorded zero. A real row
    // whose quantity is zero remains distinguishable and is displayed as zero.
    const yieldQuantity=harvestUnits.size<=1?aggregateHarvestYield(fs.harvestResults):null;
    const recordedPrice=revenueUnits.size<=1&&revenue.length?revenue.filter(e=>e.quantity&&Number(e.quantity)>0).map(e=>Number(e.amount)/Number(e.quantity)).at(0)??null:null;
    const resolved=resolveFieldEconomics({hectares:Number(fs.field.hectares),directCosts,allocatedCosts,recordedRevenue:revenue.map(e=>Number(e.amount)),saleableYield:yieldQuantity,yieldUnit:harvestUnits.size===1?String([...harvestUnits][0]):null,recordedPricePerUnit:recordedPrice,completeness});
    const budgets=fs.seasonPlanItems.map(p=>{const components=[p.expectedInputCostEur,p.expectedLabourCostEur,p.expectedMachineCostEur,p.expectedContractorCostEur,p.expectedOverheadEur].filter(v=>v!=null);return components.length?components.reduce((sum,v)=>sum+Number(v),0):p.expectedCostEur==null?null:Number(p.expectedCostEur)});
    const budgetCost=budgets.some(v=>v!=null)?budgets.reduce<number>((sum,v)=>sum+(v??0),0):null; const budgetRevenue=fs.seasonPlanItems.some(p=>p.expectedRevenueEur!=null)?fs.seasonPlanItems.reduce((sum,p)=>sum+Number(p.expectedRevenueEur??0),0):null;
    return{fieldSeasonId:fs.id,fieldId:fs.fieldId,field:fs.field.name,crop:fs.crop,hectares:Number(fs.field.hectares),recordedCostEur:resolved.totalRecordedCosts,recordedRevenueEur:resolved.recordedRevenue,grossMarginEur:resolved.grossMargin,costPerHaEur:resolved.costPerHa,revenuePerHaEur:resolved.revenuePerHa,grossMarginPerHaEur:resolved.grossMarginPerHa,yieldQuantity,yieldUnit:resolved.yieldUnit,yieldPerHa:resolved.yieldPerHa,costPerYieldUnit:resolved.costPerYieldUnit,harvestRecorded:harvestRecordCount>0,harvestRecordCount,breakEvenPrice:resolved.breakEvenPrice,breakEvenYield:resolved.breakEvenYield,completenessPercent:resolved.completeness,completenessStatus:resolved.completenessStatus,completenessResult:completeness,grossMarginResult:resolved.grossMarginResult,budgetCostEur:budgetCost,budgetRevenueEur:budgetRevenue,costVariance:resolveBudgetVariance({budget:budgetCost,actual:resolved.totalRecordedCosts,currency:farm.currency,actualCostComplete:missingSnapshotCosts.length===0,unpricedRecordCount:missingSnapshotCosts.length})};
  });
  const cropMap=new Map<string,FieldEconomicsRow[]>();for(const row of rows)cropMap.set(row.crop,[...(cropMap.get(row.crop)??[]),row]);
  const crops=[...cropMap].map(([crop,items])=>{const hectares=items.reduce((s,r)=>s+r.hectares,0),cost=sumKnown(items.map(r=>r.recordedCostEur)),revenue=sumKnown(items.map(r=>r.recordedRevenueEur)),margin=cost!=null&&revenue!=null?revenue-cost:null;return{crop,fields:items.length,hectares,costEur:cost,revenueEur:revenue,grossMarginEur:margin,costPerHaEur:cost==null?null:cost/hectares,grossMarginPerHaEur:margin==null?null:margin/hectares,completenessPercent:Math.round(items.reduce((s,r)=>s+r.completenessPercent,0)/items.length)}});
  const totalCost=sumKnown(rows.map(r=>r.recordedCostEur)),totalRevenue=sumKnown(rows.map(r=>r.recordedRevenueEur));
  const unallocated=entries.filter(e=>!e.fieldSeasonId); const unallocatedCosts=unallocated.filter(e=>e.kind==='cost'); const unallocatedRevenue=unallocated.filter(e=>e.kind==='revenue'); const expectedRevenue=revenues.filter(r=>r.revenueStatus==='expected'); const approvedRevenue=revenues.filter(r=>r.revenueStatus==='approved'); const missingData=[...new Set(rows.flatMap(r=>r.completenessResult.reasons.map(reason=>reason.code)))];
  const snapshots=fieldSeasons.flatMap(fs=>fs.activities.flatMap(a=>a.costSnapshots));const missingProducts=[...new Set(snapshots.filter(s=>s.unitCost==null).map(s=>s.itemName))];const dates=entries.map(e=>e.costDate.toISOString().slice(0,10)).sort();
  return{hasFinancialData:entries.length>0||purchases.length>0||revenues.length>0||fieldSeasons.some(f=>f.harvestResults.length>0),seasonId:season.id,seasonYear:season.year,currency:farm.currency,totalRecordedCostEur:totalCost,totalRecordedRevenueEur:totalRevenue,grossMarginEur:totalCost!=null&&totalRevenue!=null?totalRevenue-totalCost:null,completenessPercent:rows.length?Math.round(rows.reduce((s,r)=>s+r.completenessPercent,0)/rows.length):0,completenessStatus:rows.every(r=>r.completenessStatus==='profitability_ready')?'profitability_ready':rows.some(r=>r.completenessStatus==='partial_profitability')?'partial_profitability':'insufficient_data',fields:rows,crops,unallocatedCostEur:unallocatedCosts.length?unallocatedCosts.reduce((s,e)=>s+Number(e.amount),0):null,unallocatedRevenueEur:unallocatedRevenue.length?unallocatedRevenue.reduce((s,e)=>s+Number(e.amount),0):null,missingData,recentPurchases:purchases.map(p=>({id:p.id,date:p.purchaseDate.toISOString().slice(0,10),item:p.inventoryItem.name,quantity:Number(p.quantity),unit:p.unit,total:Number(p.totalAmount),unitCost:Number(p.unitCost)})),recentEntries:[...expenses.map(e=>({id:e.id,date:e.expenseDate.toISOString().slice(0,10),label:e.description,kind:'cost' as const,recordType:'expense' as const,amount:Number(e.amount),status:e.status,version:e.version})),...revenues.map(e=>({id:e.id,date:e.revenueDate.toISOString().slice(0,10),label:e.name,kind:'revenue' as const,recordType:'revenue' as const,amount:Number(e.totalAmount),status:e.revenueStatus,version:e.version})),...fieldSeasons.flatMap(fs=>fs.harvestResults.map(h=>({id:h.id,date:h.harvestDate.toISOString().slice(0,10),label:`${fs.field.name} harvest`,kind:'harvest' as const,recordType:'harvest' as const,grossQuantity:Number(h.grossQuantity),saleableQuantity:h.saleableQuantity==null?null:Number(h.saleableQuantity),unit:h.unit,status:h.status,version:h.version})))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,15),expectedRevenueEur:expectedRevenue.length?expectedRevenue.reduce((s,r)=>s+Number(r.totalAmount),0):null,approvedRevenueEur:approvedRevenue.length?approvedRevenue.reduce((s,r)=>s+Number(r.totalAmount),0):null,lastCalculatedAt:new Date().toISOString(),hasActivityData:snapshots.length>0,costByField:rows.map(r=>({key:r.fieldId,label:r.field,hectares:r.hectares,costEur:r.recordedCostEur??0,costPerHaEur:r.costPerHaEur??0})),costByCrop:crops.map(r=>({key:r.crop,label:r.crop.replaceAll('_',' '),hectares:r.hectares,costEur:r.costEur??0,costPerHaEur:r.costPerHaEur??0})),totalProductLines:snapshots.length,linesWithPrice:snapshots.filter(s=>s.unitCost!=null).length,missingPriceProducts:missingProducts,dateRangeStart:dates.at(0)??null,dateRangeEnd:dates.at(-1)??null};
}
