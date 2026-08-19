'use server';

import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { weightedAverageCost } from '@/lib/economics';
import { contractorTotal, percentageAllocations } from '@/lib/operational-costing';
import { handleActionError } from '@/lib/user-error';

const units = ['L', 'kg', 'T', 'bag', 'box'] as const;
const allocationMethods = ['direct_field', 'per_hectare', 'per_crop_area', 'equal_active_field', 'yield_proportional', 'unallocated'] as const;
const expenseSources = ['labour','machinery','fuel','contractor','field_rent','utilities','soil_lab','miscellaneous','manual_expense'] as const;

function clean(data: FormData) { return Object.fromEntries([...data.entries()].filter(([, value]) => value !== '')); }
const offlineKeys={offlineDraftId:z.string().uuid().optional(),idempotencyKey:z.string().uuid().optional()};
function financeHash(data:Record<string,unknown>){return createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(data).filter(([key])=>!['offlineDraftId','idempotencyKey'].includes(key)).sort(([a],[b])=>a.localeCompare(b))))).digest('hex');}
function refreshFinance() { for (const path of ['/finance','/inventory','/dashboard','/ai']) revalidatePath(path); }
async function audit(farmId: string, entityType: string, entityId: string, action: 'created'|'corrected'|'reversed'|'inventory_adjusted', correlationId: string, metadata: object = {}) {
  await db.auditEvent.create({ data: { farmId, actorUserId: await getClerkUserId(), entityType, entityId, action, source: 'web', correlationId, metadataJson: { schemaVersion: 1, ...metadata } } });
}

const purchaseSchema = z.object({ inventoryItemId:z.string().uuid(),seasonId:z.string().uuid(),supplier:z.string().max(160).optional(),purchaseDate:z.coerce.date(),quantity:z.coerce.number().positive(),unit:z.enum(units),totalAmount:z.coerce.number().nonnegative(),vatAmount:z.coerce.number().nonnegative().optional(),batchLot:z.string().max(120).optional(),invoiceReference:z.string().max(160).optional(),notes:z.string().max(1000).optional(),...offlineKeys });
export async function createInventoryPurchase(_previous: unknown, formData: FormData): Promise<{error?:string;success?:boolean;id?:string}> {
  const parsed=purchaseSchema.safeParse(clean(formData)); if(!parsed.success)return{error:parsed.error.issues[0]?.message};
  const farm=await getActiveFarmOrThrow(); const d=parsed.data; const correlationId=randomUUID(); const submissionHash=financeHash(d);
  if(d.offlineDraftId||d.idempotencyKey){const existing=await db.inventoryPurchase.findFirst({where:{farmId:farm.id,OR:[...(d.offlineDraftId?[{offlineDraftId:d.offlineDraftId}]:[]),...(d.idempotencyKey?[{idempotencyKey:d.idempotencyKey}]:[])]}});if(existing)return existing.submissionHash===submissionHash?{success:true,id:existing.id}:{error:'This offline purchase key was already used with different data.'};}
  try {
    const purchase=await db.$transaction(async tx=>{
      const [item,season]=await Promise.all([tx.inventoryItem.findFirst({where:{id:d.inventoryItemId,farmId:farm.id}}),tx.season.findFirst({where:{id:d.seasonId,farmId:farm.id}})]);
      if(!item||!season)throw new Error('Inventory item or season does not belong to this farm.');
      if(!season.isActive)throw new Error('Season is closed. Review this draft before synchronizing.');
      if(item.unit!==d.unit)throw new Error(`Purchase unit must match inventory unit ${item.unit}.`);
      const average=weightedAverageCost({currentQuantity:Number(item.currentStock),currentUnitCost:item.purchasePricePerUnit==null?null:Number(item.purchasePricePerUnit),purchaseQuantity:d.quantity,purchaseTotal:d.totalAmount});
      if(average==null)throw new Error('Existing stock has no valuation. Record its value before adding a weighted-average purchase.');
      const created=await tx.inventoryPurchase.create({data:{...d,submissionHash:(d.offlineDraftId||d.idempotencyKey)?submissionHash:null,farmId:farm.id,unitCost:d.totalAmount/d.quantity,correlationId}});
      await tx.inventoryItem.update({where:{id:item.id},data:{currentStock:{increment:d.quantity},purchasePricePerUnit:average,valuationEffectiveAt:d.purchaseDate,supplierName:d.supplier??item.supplierName}});
      await tx.stockMovement.create({data:{inventoryItemId:item.id,purchaseId:created.id,quantity:d.quantity,direction:'in',unitCost:d.totalAmount/d.quantity,notes:d.invoiceReference?`Purchase ${d.invoiceReference}`:'Inventory purchase',correlationId}});
      return created;
    },{isolationLevel:'Serializable'});
    await audit(farm.id,'InventoryPurchase',purchase.id,'created',correlationId,{inventoryItemId:d.inventoryItemId,valuationMethod:'weighted_average'}); refreshFinance(); return{success:true,id:purchase.id};
  }catch(error){return{error:handleActionError('createInventoryPurchase',error).message};}
}

export async function reverseInventoryPurchase(id:string,reason:string):Promise<{error?:string;success?:boolean}> {
  if(reason.trim().length<10)return{error:'Give a reversal reason of at least 10 characters.'};
  const farm=await getActiveFarmOrThrow(); const correlationId=randomUUID();
  try{await db.$transaction(async tx=>{const purchase=await tx.inventoryPurchase.findFirst({where:{id,farmId:farm.id,status:'active'},include:{inventoryItem:true}});if(!purchase)throw new Error('Active purchase not found.');const stock=Number(purchase.inventoryItem.currentStock),qty=Number(purchase.quantity),average=purchase.inventoryItem.purchasePricePerUnit==null?null:Number(purchase.inventoryItem.purchasePricePerUnit);if(stock<qty)throw new Error('Purchase cannot be reversed because some of this stock has already been consumed. Use an auditable correction instead.');const remaining=stock-qty;const remainingValue=average==null?null:stock*average-Number(purchase.totalAmount);if(remaining>0&&(remainingValue==null||remainingValue<0))throw new Error('Remaining inventory valuation cannot be determined safely.');await tx.inventoryPurchase.update({where:{id},data:{status:'reversed',notes:`${purchase.notes??''}\nReversed: ${reason}`.trim()}});await tx.inventoryItem.update({where:{id:purchase.inventoryItemId},data:{currentStock:{decrement:qty},purchasePricePerUnit:remaining===0?null:(remainingValue!/remaining),valuationEffectiveAt:new Date()}});await tx.stockMovement.create({data:{inventoryItemId:purchase.inventoryItemId,purchaseId:id,quantity:qty,direction:'correction',unitCost:purchase.unitCost,notes:`Purchase reversal: ${reason}`,correlationId}});},{isolationLevel:'Serializable'});await audit(farm.id,'InventoryPurchase',id,'reversed',correlationId,{reason});refreshFinance();return{success:true};}catch(error){return{error:handleActionError('reverseInventoryPurchase',error).message};}
}

const expenseSchema=z.object({seasonId:z.string().uuid(),fieldSeasonId:z.string().uuid().optional(),sourceType:z.enum(expenseSources),description:z.string().min(1).max(200),expenseDate:z.coerce.date(),amount:z.coerce.number().nonnegative(),quantity:z.coerce.number().positive().optional(),unit:z.string().max(30).optional(),allocationMethod:z.enum(allocationMethods),reference:z.string().max(160).optional(),notes:z.string().max(1000).optional(),...offlineKeys});
export async function createFinancialExpense(_previous:unknown,formData:FormData):Promise<{error?:string;success?:boolean;id?:string}>{const parsed=expenseSchema.safeParse(clean(formData));if(!parsed.success)return{error:parsed.error.issues[0]?.message};const farm=await getActiveFarmOrThrow(),d=parsed.data,correlationId=randomUUID();try{const result=await db.$transaction(async tx=>{const season=await tx.season.findFirst({where:{id:d.seasonId,farmId:farm.id}});if(!season)throw new Error('Season not found.');const fs=d.fieldSeasonId?await tx.fieldSeason.findFirst({where:{id:d.fieldSeasonId,field:{farmId:farm.id},seasonId:d.seasonId},include:{field:true}}):null;if(d.fieldSeasonId&&!fs)throw new Error('Field season does not belong to this farm.');if(d.allocationMethod==='direct_field'&&!fs)throw new Error('Direct-field expense requires a field.');const expense=await tx.financialExpense.create({data:{...d,farmId:farm.id,confidence:d.allocationMethod==='direct_field'?'recorded':'allocated',correlationId}});await tx.economicEntry.create({data:{farmId:farm.id,seasonId:d.seasonId,fieldSeasonId:fs?.id,fieldId:fs?.fieldId,crop:fs?.crop,kind:'cost',sourceType:d.sourceType,sourceEntityId:expense.id,amount:d.amount,currency:farm.currency,quantity:d.quantity,unit:d.unit,unitCost:d.quantity?d.amount/d.quantity:null,costDate:d.expenseDate,allocationMethod:d.allocationMethod,confidence:d.allocationMethod==='direct_field'?'recorded':'allocated',correlationId}});return expense;});await audit(farm.id,'FinancialExpense',result.id,'created',correlationId,{sourceType:d.sourceType,allocationMethod:d.allocationMethod});refreshFinance();return{success:true,id:result.id};}catch(error){return{error:handleActionError('createFinancialExpense',error).message};}}

const harvestSchema=z.object({seasonId:z.string().uuid(),fieldSeasonId:z.string().uuid(),harvestDate:z.coerce.date(),harvestedAreaHa:z.coerce.number().positive(),grossQuantity:z.coerce.number().nonnegative(),saleableQuantity:z.coerce.number().nonnegative().optional(),unit:z.enum(['kg','tonnes','boxes','pieces']),moisturePercent:z.coerce.number().min(0).max(100).optional(),qualityGrade:z.string().max(100).optional(),storageLocation:z.string().max(160).optional(),batchLot:z.string().max(120).optional(),wasteLoss:z.coerce.number().nonnegative().optional(),...offlineKeys});
export async function createHarvestResult(_previous:unknown,formData:FormData):Promise<{error?:string;success?:boolean;id?:string}>{const parsed=harvestSchema.safeParse(clean(formData));if(!parsed.success)return{error:parsed.error.issues[0]?.message};const farm=await getActiveFarmOrThrow(),d=parsed.data,correlationId=randomUUID();try{const fs=await db.fieldSeason.findFirst({where:{id:d.fieldSeasonId,seasonId:d.seasonId,field:{farmId:farm.id}}});if(!fs)return{error:'Field season does not belong to this farm.'};if(d.saleableQuantity!=null&&d.saleableQuantity>d.grossQuantity)return{error:'Saleable quantity cannot exceed gross quantity.'};const result=await db.harvestResult.create({data:{...d,farmId:farm.id,correlationId}});await audit(farm.id,'HarvestResult',result.id,'created',correlationId,{unit:d.unit});refreshFinance();return{success:true,id:result.id};}catch(error){return{error:handleActionError('createHarvestResult',error).message};}}

const revenueSchema=z.object({seasonId:z.string().uuid(),fieldSeasonId:z.string().uuid().optional(),type:z.enum(['crop_sale','subsidy','contract_income','insurance_compensation','other_farm_income']),name:z.string().min(1).max(200),revenueDate:z.coerce.date(),quantity:z.coerce.number().positive().optional(),unit:z.string().max(30).optional(),pricePerUnit:z.coerce.number().nonnegative().optional(),totalAmount:z.coerce.number().nonnegative(),buyer:z.string().max(160).optional(),allocationMethod:z.enum(allocationMethods),revenueStatus:z.enum(['expected','approved','received']),reference:z.string().max(160).optional(),notes:z.string().max(1000).optional(),...offlineKeys});
export async function createRevenueEntry(_previous:unknown,formData:FormData):Promise<{error?:string;success?:boolean;id?:string}>{const parsed=revenueSchema.safeParse(clean(formData));if(!parsed.success)return{error:parsed.error.issues[0]?.message};const farm=await getActiveFarmOrThrow(),d=parsed.data,correlationId=randomUUID();try{const result=await db.$transaction(async tx=>{const season=await tx.season.findFirst({where:{id:d.seasonId,farmId:farm.id}});if(!season)throw new Error('Season not found.');const fs=d.fieldSeasonId?await tx.fieldSeason.findFirst({where:{id:d.fieldSeasonId,seasonId:d.seasonId,field:{farmId:farm.id}},include:{field:true}}):null;if(d.fieldSeasonId&&!fs)throw new Error('Field season does not belong to this farm.');if(d.allocationMethod==='direct_field'&&!fs)throw new Error('Direct-field revenue requires a field.');if(d.quantity&&d.pricePerUnit!=null&&Math.abs(d.quantity*d.pricePerUnit-d.totalAmount)>.02)throw new Error('Quantity × unit price does not match total revenue.');const revenue=await tx.revenueEntry.create({data:{...d,farmId:farm.id,correlationId}});if(d.revenueStatus==='received')await tx.economicEntry.create({data:{farmId:farm.id,seasonId:d.seasonId,fieldSeasonId:fs?.id,fieldId:fs?.fieldId,crop:fs?.crop,kind:'revenue',sourceType:d.type==='other_farm_income'?'other_income':d.type,sourceEntityId:revenue.id,amount:d.totalAmount,currency:farm.currency,quantity:d.quantity,unit:d.unit,unitCost:d.pricePerUnit,costDate:d.revenueDate,allocationMethod:d.allocationMethod,confidence:d.allocationMethod==='direct_field'?'recorded':'allocated',correlationId}});return revenue;});await audit(farm.id,'RevenueEntry',result.id,'created',correlationId,{type:d.type,status:d.revenueStatus});refreshFinance();return{success:true,id:result.id};}catch(error){return{error:handleActionError('createRevenueEntry',error).message};}}

export async function recordOverheadChoice(note: string): Promise<{ error?: string; success?: boolean }> {
  const farm = await getActiveFarmOrThrow();
  if (!note.trim()) return { error: 'Describe whether overhead is allocated or intentionally excluded.' };
  const correlationId = randomUUID();
  await db.farm.update({ where: { id: farm.id }, data: { overheadChoiceRecorded: true, overheadPolicyNote: note.trim().slice(0, 500) } });
  await audit(farm.id, 'FarmEconomicsPolicy', farm.id, 'created', correlationId, { overheadChoiceRecorded: true });
  refreshFinance();
  return { success: true };
}

export async function configureEmployeeRate(input: { employeeId:string; hourlyOperationalCost:number; labourCostType:'employee'|'owner_estimate'|'contractor'; effectiveFrom:string }) {
  const parsed=z.object({employeeId:z.string().uuid(),hourlyOperationalCost:z.number().nonnegative(),labourCostType:z.enum(['employee','owner_estimate','contractor']),effectiveFrom:z.coerce.date()}).safeParse(input);
  if(!parsed.success)return{error:parsed.error.issues[0]?.message}; const farm=await getActiveFarmOrThrow(),d=parsed.data,correlationId=randomUUID();
  try{const rate=await db.$transaction(async tx=>{const employee=await tx.employee.findFirst({where:{id:d.employeeId,farmId:farm.id,isActive:true}});if(!employee)throw new Error('Employee does not belong to this farm.');const existing=await tx.employeeRate.findFirst({where:{employeeId:d.employeeId,effectiveFrom:d.effectiveFrom}});if(existing)throw new Error('A rate already starts on this date. Choose another effective date.');const prior=await tx.employeeRate.findFirst({where:{employeeId:d.employeeId,effectiveFrom:{lt:d.effectiveFrom},OR:[{effectiveTo:null},{effectiveTo:{gte:d.effectiveFrom}}]},orderBy:{effectiveFrom:'desc'}});if(prior)await tx.employeeRate.update({where:{id:prior.id},data:{effectiveTo:new Date(d.effectiveFrom.getTime()-86400000)}});const created=await tx.employeeRate.create({data:{...d,farmId:farm.id}});await tx.employee.update({where:{id:employee.id},data:{hourlyOperationalCost:d.hourlyOperationalCost,costEffectiveFrom:d.effectiveFrom,labourCostType:d.labourCostType}});return created;});await audit(farm.id,'EmployeeRate',rate.id,'created',correlationId,{employeeId:d.employeeId,effectiveFrom:d.effectiveFrom.toISOString().slice(0,10)});refreshFinance();return{success:true,id:rate.id};}catch(error){return{error:handleActionError('configureEmployeeRate',error).message};}
}
export async function configureEmployeeRateForm(_previous:unknown,formData:FormData){const raw=clean(formData);return configureEmployeeRate({employeeId:String(raw.employeeId),hourlyOperationalCost:Number(raw.hourlyOperationalCost),labourCostType:String(raw.labourCostType) as 'employee'|'owner_estimate'|'contractor',effectiveFrom:String(raw.effectiveFrom)});}

export async function configureMachineRate(input:{machineId:string;hourlyOperationalCost:number;fuelCostPolicy:'included_in_hourly_rate'|'tracked_separately';fuelConsumptionPerHour?:number;contractorRate?:number;effectiveFrom:string}){
  const parsed=z.object({machineId:z.string().uuid(),hourlyOperationalCost:z.number().nonnegative(),fuelCostPolicy:z.enum(['included_in_hourly_rate','tracked_separately']),fuelConsumptionPerHour:z.number().nonnegative().optional(),contractorRate:z.number().nonnegative().optional(),effectiveFrom:z.coerce.date()}).safeParse(input);if(!parsed.success)return{error:parsed.error.issues[0]?.message};const farm=await getActiveFarmOrThrow(),d=parsed.data,correlationId=randomUUID();
  try{const rate=await db.$transaction(async tx=>{const machine=await tx.machine.findFirst({where:{id:d.machineId,farmId:farm.id}});if(!machine)throw new Error('Machine does not belong to this farm.');if(await tx.machineRate.findFirst({where:{machineId:d.machineId,effectiveFrom:d.effectiveFrom}}))throw new Error('A rate already starts on this date. Choose another effective date.');const prior=await tx.machineRate.findFirst({where:{machineId:d.machineId,effectiveFrom:{lt:d.effectiveFrom},OR:[{effectiveTo:null},{effectiveTo:{gte:d.effectiveFrom}}]},orderBy:{effectiveFrom:'desc'}});if(prior)await tx.machineRate.update({where:{id:prior.id},data:{effectiveTo:new Date(d.effectiveFrom.getTime()-86400000)}});const created=await tx.machineRate.create({data:{...d,farmId:farm.id}});await tx.machine.update({where:{id:machine.id},data:{hourlyOperationalCost:d.hourlyOperationalCost,fuelCostPolicy:d.fuelCostPolicy,fuelConsumptionPerHour:d.fuelConsumptionPerHour,costEffectiveFrom:d.effectiveFrom,contractorRate:d.contractorRate}});return created;});await audit(farm.id,'MachineRate',rate.id,'created',correlationId,{machineId:d.machineId,fuelCostPolicy:d.fuelCostPolicy});refreshFinance();return{success:true,id:rate.id};}catch(error){return{error:handleActionError('configureMachineRate',error).message};}
}
export async function configureMachineRateForm(_previous:unknown,formData:FormData){const raw=clean(formData);return configureMachineRate({machineId:String(raw.machineId),hourlyOperationalCost:Number(raw.hourlyOperationalCost),fuelCostPolicy:String(raw.fuelCostPolicy) as 'included_in_hourly_rate'|'tracked_separately',fuelConsumptionPerHour:raw.fuelConsumptionPerHour==null?undefined:Number(raw.fuelConsumptionPerHour),contractorRate:raw.contractorRate==null?undefined:Number(raw.contractorRate),effectiveFrom:String(raw.effectiveFrom)});}

export async function createContractorCost(input:{seasonId:string;fieldSeasonId?:string;workOrderId?:string;activityId?:string;contractor:string;operation:string;costDate:string;rateType:'total'|'per_hectare'|'per_hour'|'per_tonne'|'per_operation';quantity:number;unit:string;rate:number;reference?:string}){
  const parsed=z.object({seasonId:z.string().uuid(),fieldSeasonId:z.string().uuid().optional(),workOrderId:z.string().uuid().optional(),activityId:z.string().uuid().optional(),contractor:z.string().min(1).max(160),operation:z.string().min(1).max(160),costDate:z.coerce.date(),rateType:z.enum(['total','per_hectare','per_hour','per_tonne','per_operation']),quantity:z.number().positive(),unit:z.string().min(1).max(30),rate:z.number().nonnegative(),reference:z.string().max(160).optional()}).safeParse(input);if(!parsed.success)return{error:parsed.error.issues[0]?.message};const farm=await getActiveFarmOrThrow(),d=parsed.data,correlationId=randomUUID();
  try{const result=await db.$transaction(async tx=>{const season=await tx.season.findFirst({where:{id:d.seasonId,farmId:farm.id}});if(!season)throw new Error('Season does not belong to this farm.');const fs=d.fieldSeasonId?await tx.fieldSeason.findFirst({where:{id:d.fieldSeasonId,seasonId:d.seasonId,field:{farmId:farm.id}},include:{field:true}}):null;if(d.fieldSeasonId&&!fs)throw new Error('Field does not belong to this farm.');if(d.workOrderId&&!await tx.workOrder.findFirst({where:{id:d.workOrderId,farmId:farm.id}}))throw new Error('Work order does not belong to this farm.');if(d.activityId&&!await tx.activity.findFirst({where:{id:d.activityId,fieldSeason:{field:{farmId:farm.id}}}}))throw new Error('Activity does not belong to this farm.');if(d.activityId&&await tx.contractorCost.findFirst({where:{activityId:d.activityId,status:'active'}}))throw new Error('This activity already has an active contractor cost.');const totalAmount=contractorTotal(d.rateType,d.quantity,d.rate);const created=await tx.contractorCost.create({data:{...d,totalAmount,farmId:farm.id,correlationId}});await tx.economicEntry.create({data:{farmId:farm.id,seasonId:d.seasonId,fieldSeasonId:fs?.id,fieldId:fs?.fieldId,crop:fs?.crop,kind:'cost',sourceType:'contractor',sourceEntityId:created.id,amount:totalAmount,currency:farm.currency,quantity:d.quantity,unit:d.unit,unitCost:d.rate,costDate:d.costDate,allocationMethod:fs?'direct_field':'unallocated',confidence:fs?'recorded':'allocated',correlationId}});return created;});await audit(farm.id,'ContractorCost',result.id,'created',correlationId,{rateType:d.rateType,activityId:d.activityId});refreshFinance();return{success:true,id:result.id};}catch(error){return{error:handleActionError('createContractorCost',error).message};}
}

export async function allocateEconomicEntry(input:{economicEntryId:string;allocations:Array<{fieldSeasonId:string;percentage:number}>;reason:string}){
  const parsed=z.object({economicEntryId:z.string().uuid(),allocations:z.array(z.object({fieldSeasonId:z.string().uuid(),percentage:z.number().positive().max(100)})).min(1),reason:z.string().min(10).max(500)}).safeParse(input);if(!parsed.success)return{error:parsed.error.issues[0]?.message};const farm=await getActiveFarmOrThrow(),d=parsed.data,correlationId=randomUUID();
  try{await db.$transaction(async tx=>{const entry=await tx.economicEntry.findFirst({where:{id:d.economicEntryId,farmId:farm.id,status:'active'}});if(!entry)throw new Error('Economic entry does not belong to this farm.');const fields=await tx.fieldSeason.findMany({where:{id:{in:d.allocations.map(x=>x.fieldSeasonId)},seasonId:entry.seasonId,field:{farmId:farm.id}},include:{field:true}});if(fields.length!==new Set(d.allocations.map(x=>x.fieldSeasonId)).size)throw new Error('One or more allocation fields do not belong to this farm and season.');const rows=percentageAllocations(Number(entry.amount),d.allocations);const prior=await tx.economicAllocation.findMany({where:{economicEntryId:entry.id,status:'active'}});if(prior.length)await tx.economicAllocation.updateMany({where:{id:{in:prior.map(x=>x.id)}},data:{status:'corrected'}});const nextVersion=prior.reduce((max,row)=>Math.max(max,row.version),0)+1;await tx.economicAllocation.createMany({data:rows.map(row=>({farmId:farm.id,economicEntryId:entry.id,fieldSeasonId:row.fieldSeasonId,percentage:row.percentage,amount:row.amount,originalAmount:entry.amount,method:'per_hectare',version:nextVersion,reason:d.reason}))});});await audit(farm.id,'EconomicAllocation',d.economicEntryId,'corrected',correlationId,{reason:d.reason,fieldCount:d.allocations.length});refreshFinance();return{success:true};}catch(error){return{error:handleActionError('allocateEconomicEntry',error).message};}
}

// Sprint 25 Part 2 — append-only correction for finalized financial records.
// Scoped to expense/revenue/harvest (the types reverseFinancialRecord already
// groups, with clean EconomicEntry semantics). Purchase correction is
// intentionally NOT here: correcting a weighted-average purchase in place can
// corrupt inventory valuation once stock is partly consumed, so purchases stay
// reversal-only (reverseInventoryPurchase) until a dedicated safe re-valuation
// path exists. Labour/machinery costs derive from activity snapshots + rates
// and are corrected via the activity/rate, not here. See
// docs/Sprint_25_Finalization_Audit.md.
const FINANCIAL_TABLE = { expense: 'financial_expenses', revenue: 'revenue_entries', harvest: 'harvest_results' } as const;
const correctionSchema = z.object({
  type: z.enum(['expense','revenue','harvest']),
  id: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1),
  reason: z.string().min(10,'Give a correction reason of at least 10 characters.').max(500),
  idempotencyKey: z.string().uuid(),
  amount: z.coerce.number().nonnegative().optional(),            // expense: corrected amount
  totalAmount: z.coerce.number().nonnegative().optional(),       // revenue: corrected total
  revenueStatus: z.enum(['expected','approved','received']).optional(), // revenue
  grossQuantity: z.coerce.number().nonnegative().optional(),     // harvest
  saleableQuantity: z.coerce.number().nonnegative().optional(),  // harvest
});
export type FinanceCorrectionState = { error?:string; success?:boolean; id?:string };

export async function correctFinancialRecord(input:z.input<typeof correctionSchema>):Promise<FinanceCorrectionState>{
  const parsed=correctionSchema.safeParse(input); if(!parsed.success)return{error:parsed.error.issues[0]?.message};
  const farm=await getActiveFarmOrThrow(); const d=parsed.data; const correlationId=randomUUID();
  try{
    const created=await db.$transaction(async tx=>{
      // Idempotency (Part 2): the same key never produces a second correction,
      // even under a double submit. The new version row carries the key.
      const dup=d.type==='expense'?await tx.financialExpense.findFirst({where:{idempotencyKey:d.idempotencyKey,farmId:farm.id},select:{id:true}})
        :d.type==='revenue'?await tx.revenueEntry.findFirst({where:{idempotencyKey:d.idempotencyKey,farmId:farm.id},select:{id:true}})
        :await tx.harvestResult.findFirst({where:{idempotencyKey:d.idempotencyKey,farmId:farm.id},select:{id:true}});
      if(dup)return dup;
      // Row lock so two simultaneous corrections cannot both pass the version
      // check and fork the chain. Table name is from a fixed whitelist, never
      // user input, so interpolation here is safe.
      await tx.$queryRawUnsafe(`SELECT id FROM ${FINANCIAL_TABLE[d.type]} WHERE id = $1 FOR UPDATE`,d.id);

      if(d.type==='expense'){
        const prev=await tx.financialExpense.findFirst({where:{id:d.id,farmId:farm.id,status:'active'}});
        if(!prev)throw new Error('Active expense not found for this farm.');
        if(prev.version!==d.expectedVersion)throw new Error('This record was changed by another action. Reload and review the latest version.');
        await tx.financialExpense.update({where:{id:prev.id},data:{status:'corrected'}});
        const next=await tx.financialExpense.create({data:{farmId:prev.farmId,seasonId:prev.seasonId,fieldSeasonId:prev.fieldSeasonId,sourceType:prev.sourceType,description:prev.description,expenseDate:prev.expenseDate,amount:d.amount??prev.amount,quantity:prev.quantity,unit:prev.unit,allocationMethod:prev.allocationMethod,confidence:prev.confidence,reference:prev.reference,notes:prev.notes,correlationId,version:prev.version+1,correctionOfId:prev.id,correctionReason:d.reason,idempotencyKey:d.idempotencyKey}});
        await supersedeEconomicEntries(tx,farm.id,prev.id);
        const fs=prev.fieldSeasonId?await tx.fieldSeason.findFirst({where:{id:prev.fieldSeasonId},select:{fieldId:true,crop:true}}):null;
        await tx.economicEntry.create({data:{farmId:farm.id,seasonId:prev.seasonId,fieldSeasonId:prev.fieldSeasonId,fieldId:fs?.fieldId,crop:fs?.crop,kind:'cost',sourceType:prev.sourceType,sourceEntityId:next.id,amount:next.amount,currency:farm.currency,quantity:prev.quantity,unit:prev.unit,unitCost:prev.quantity?Number(next.amount)/Number(prev.quantity):null,costDate:prev.expenseDate,allocationMethod:prev.allocationMethod,confidence:prev.confidence,correlationId}});
        return next;
      }
      if(d.type==='revenue'){
        const prev=await tx.revenueEntry.findFirst({where:{id:d.id,farmId:farm.id,status:'active'}});
        if(!prev)throw new Error('Active revenue record not found for this farm.');
        if(prev.version!==d.expectedVersion)throw new Error('This record was changed by another action. Reload and review the latest version.');
        const nextStatus=d.revenueStatus??prev.revenueStatus;
        await tx.revenueEntry.update({where:{id:prev.id},data:{status:'corrected'}});
        const next=await tx.revenueEntry.create({data:{farmId:prev.farmId,seasonId:prev.seasonId,fieldSeasonId:prev.fieldSeasonId,type:prev.type,name:prev.name,revenueDate:prev.revenueDate,quantity:prev.quantity,unit:prev.unit,pricePerUnit:prev.pricePerUnit,totalAmount:d.totalAmount??prev.totalAmount,buyer:prev.buyer,qualityGrade:prev.qualityGrade,batchReference:prev.batchReference,allocationMethod:prev.allocationMethod,revenueStatus:nextStatus,reference:prev.reference,notes:prev.notes,correlationId,version:prev.version+1,correctionOfId:prev.id,correctionReason:d.reason,idempotencyKey:d.idempotencyKey}});
        await supersedeEconomicEntries(tx,farm.id,prev.id);
        // Only received income is recorded revenue — mirror createRevenueEntry.
        if(nextStatus==='received'){const fs=prev.fieldSeasonId?await tx.fieldSeason.findFirst({where:{id:prev.fieldSeasonId},select:{fieldId:true,crop:true}}):null;await tx.economicEntry.create({data:{farmId:farm.id,seasonId:prev.seasonId,fieldSeasonId:prev.fieldSeasonId,fieldId:fs?.fieldId,crop:fs?.crop,kind:'revenue',sourceType:prev.type==='other_farm_income'?'other_income':prev.type,sourceEntityId:next.id,amount:next.totalAmount,currency:farm.currency,quantity:prev.quantity,unit:prev.unit,unitCost:prev.pricePerUnit,costDate:prev.revenueDate,allocationMethod:prev.allocationMethod,confidence:prev.allocationMethod==='direct_field'?'recorded':'allocated',correlationId}});}
        return next;
      }
      // harvest — no EconomicEntry (revenue is the economic surface, not harvest)
      const prev=await tx.harvestResult.findFirst({where:{id:d.id,farmId:farm.id,status:'active'}});
      if(!prev)throw new Error('Active harvest record not found for this farm.');
      if(prev.version!==d.expectedVersion)throw new Error('This record was changed by another action. Reload and review the latest version.');
      const gross=d.grossQuantity??Number(prev.grossQuantity); const saleable=d.saleableQuantity??(prev.saleableQuantity==null?null:Number(prev.saleableQuantity));
      if(saleable!=null&&saleable>gross)throw new Error('Saleable quantity cannot exceed gross quantity.');
      await tx.harvestResult.update({where:{id:prev.id},data:{status:'corrected'}});
      return tx.harvestResult.create({data:{farmId:prev.farmId,seasonId:prev.seasonId,fieldSeasonId:prev.fieldSeasonId,harvestDate:prev.harvestDate,harvestedAreaHa:prev.harvestedAreaHa,grossQuantity:gross,saleableQuantity:saleable,unit:prev.unit,moisturePercent:prev.moisturePercent,qualityGrade:prev.qualityGrade,storageLocation:prev.storageLocation,batchLot:prev.batchLot,wasteLoss:prev.wasteLoss,correlationId,version:prev.version+1,correctionOfId:prev.id,correctionReason:d.reason,idempotencyKey:d.idempotencyKey}});
    },{isolationLevel:'Serializable'});
    await audit(farm.id,d.type==='expense'?'FinancialExpense':d.type==='revenue'?'RevenueEntry':'HarvestResult',created.id,'corrected',correlationId,{reason:d.reason,correctionOfId:d.id,previousVersion:d.expectedVersion});
    refreshFinance(); return{success:true,id:created.id};
  }catch(error){return{error:handleActionError('correctFinancialRecord',error).message};}
}
// Mark every active EconomicEntry for a source record as corrected so it drops
// out of active totals; the caller then writes the fresh replacement entry.
async function supersedeEconomicEntries(tx:Prisma.TransactionClient,farmId:string,sourceEntityId:string){
  await tx.economicEntry.updateMany({where:{farmId,sourceEntityId,status:'active'},data:{status:'corrected'}});
}
export async function correctFinancialRecordForm(_previous:unknown,formData:FormData):Promise<FinanceCorrectionState>{
  const raw=clean(formData);
  return correctFinancialRecord({type:raw.type as 'expense'|'revenue'|'harvest',id:String(raw.id),expectedVersion:Number(raw.expectedVersion),reason:String(raw.reason??''),idempotencyKey:String(raw.idempotencyKey),amount:raw.amount==null?undefined:Number(raw.amount),totalAmount:raw.totalAmount==null?undefined:Number(raw.totalAmount),revenueStatus:raw.revenueStatus as 'expected'|'approved'|'received'|undefined,grossQuantity:raw.grossQuantity==null?undefined:Number(raw.grossQuantity),saleableQuantity:raw.saleableQuantity==null?undefined:Number(raw.saleableQuantity)});
}

export async function reverseFinancialRecord(input:{type:'expense'|'harvest'|'revenue';id:string;reason:string}){
  const parsed=z.object({type:z.enum(['expense','harvest','revenue']),id:z.string().uuid(),reason:z.string().min(10).max(500)}).safeParse(input);if(!parsed.success)return{error:parsed.error.issues[0]?.message};const farm=await getActiveFarmOrThrow(),d=parsed.data,correlationId=randomUUID();
  try{await db.$transaction(async tx=>{const record=d.type==='expense'?await tx.financialExpense.findFirst({where:{id:d.id,farmId:farm.id,status:'active'}}):d.type==='harvest'?await tx.harvestResult.findFirst({where:{id:d.id,farmId:farm.id,status:'active'}}):await tx.revenueEntry.findFirst({where:{id:d.id,farmId:farm.id,status:'active'}});if(!record)throw new Error('Active financial record not found for this farm.');if(d.type==='expense')await tx.financialExpense.update({where:{id:d.id},data:{status:'reversed',correctionReason:d.reason}});else if(d.type==='harvest')await tx.harvestResult.update({where:{id:d.id},data:{status:'reversed',correctionReason:d.reason}});else await tx.revenueEntry.update({where:{id:d.id},data:{status:'reversed',correctionReason:d.reason}});const economic=await tx.economicEntry.findMany({where:{farmId:farm.id,sourceEntityId:d.id,status:'active'}});for(const entry of economic){await tx.economicEntry.update({where:{id:entry.id},data:{status:'reversed'}});await tx.economicEntry.create({data:{farmId:entry.farmId,seasonId:entry.seasonId,fieldSeasonId:entry.fieldSeasonId,fieldId:entry.fieldId,crop:entry.crop,kind:entry.kind,sourceType:entry.sourceType,sourceEntityId:d.id,amount:-Number(entry.amount),currency:entry.currency,quantity:entry.quantity==null?null:-Number(entry.quantity),unit:entry.unit,unitCost:entry.unitCost,costDate:new Date(),allocationMethod:entry.allocationMethod,confidence:entry.confidence,reversalOfId:entry.id,correlationId,status:'active'}});}});await audit(farm.id,d.type==='expense'?'FinancialExpense':d.type==='harvest'?'HarvestResult':'RevenueEntry',d.id,'reversed',correlationId,{reason:d.reason});refreshFinance();return{success:true};}catch(error){return{error:handleActionError('reverseFinancialRecord',error).message};}
}
