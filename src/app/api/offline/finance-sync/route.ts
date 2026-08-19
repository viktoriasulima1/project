import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createFinancialExpense, createHarvestResult, createInventoryPurchase, createRevenueEntry } from '@/lib/actions/economics';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { isTrustedMutationOrigin } from '@/lib/origin';
import { newCorrelationId } from '@/lib/audit';
import { userError, type UserFacingError } from '@/lib/user-error';

export const dynamic = 'force-dynamic';
const errorResponse=(error:UserFacingError,status:number)=>NextResponse.json({ok:false,error},{status});
const allowed: Record<string, Set<string>> = {
  expense:new Set(['seasonId','fieldSeasonId','sourceType','description','expenseDate','amount','quantity','unit','allocationMethod','reference','notes']),
  purchase:new Set(['inventoryItemId','seasonId','supplier','purchaseDate','quantity','unit','totalAmount','vatAmount','batchLot','invoiceReference','notes']),
  harvest:new Set(['seasonId','fieldSeasonId','harvestDate','harvestedAreaHa','grossQuantity','saleableQuantity','unit','moisturePercent','qualityGrade','storageLocation','batchLot','wasteLoss']),
  revenue:new Set(['seasonId','fieldSeasonId','type','name','revenueDate','quantity','unit','pricePerUnit','totalAmount','buyer','allocationMethod','revenueStatus','reference','notes']),
};
type FinanceType=keyof typeof allowed;
const digest=(type:string,data:Record<string,string>)=>createHash('sha256').update(JSON.stringify({type,data:Object.fromEntries(Object.entries(data).sort(([a],[b])=>a.localeCompare(b)))})).digest('hex');

export async function POST(request:Request){
  if(!isTrustedMutationOrigin(request))return errorResponse(userError('REQUEST_NOT_ALLOWED',{correlationId:newCorrelationId()}),403);
  const body=await request.json().catch(()=>null) as {recordType?:FinanceType;formData?:Record<string,unknown>}|null;
  if(!body?.recordType||!allowed[body.recordType]||!body.formData)return errorResponse(userError('INVALID_VALUE',{field:'formData',correlationId:newCorrelationId()}),400);
  const localDraftId=typeof body.formData.localDraftId==='string'?body.formData.localDraftId:'';const idempotencyKey=typeof body.formData.idempotencyKey==='string'?body.formData.idempotencyKey:'';
  if(!localDraftId||!idempotencyKey)return errorResponse(userError('REQUIRED_FIELD',{field:'formData',metadata:{fields:['localDraftId','idempotencyKey']},correlationId:newCorrelationId()}),400);
  const values:Record<string,string>={};for(const[key,value]of Object.entries(body.formData))if(allowed[body.recordType].has(key)&&typeof value==='string')values[key]=value;
  const hash=digest(body.recordType,values);const farm=await getActiveFarmOrThrow();
  const existing=body.recordType==='purchase'?await db.inventoryPurchase.findFirst({where:{farmId:farm.id,OR:[{offlineDraftId:localDraftId},{idempotencyKey}]}}):body.recordType==='expense'?await db.financialExpense.findFirst({where:{farmId:farm.id,OR:[{offlineDraftId:localDraftId},{idempotencyKey}]}}):body.recordType==='harvest'?await db.harvestResult.findFirst({where:{farmId:farm.id,OR:[{offlineDraftId:localDraftId},{idempotencyKey}]}}):await db.revenueEntry.findFirst({where:{farmId:farm.id,OR:[{offlineDraftId:localDraftId},{idempotencyKey}]}});
  if(existing)return existing.submissionHash===hash?NextResponse.json({success:true,recordId:existing.id}):NextResponse.json({error:'This offline key was already used with different financial data.',category:'conflict'},{status:409});
  const form=new FormData();for(const[key,value]of Object.entries(values))form.set(key,value);form.set('offlineDraftId',localDraftId);form.set('idempotencyKey',idempotencyKey);
  const result=body.recordType==='purchase'?await createInventoryPurchase({},form):body.recordType==='expense'?await createFinancialExpense({},form):body.recordType==='harvest'?await createHarvestResult({},form):await createRevenueEntry({},form);
  if(!result.success||!result.id)return NextResponse.json({error:result.error??'Finance draft needs review.',category:(result.error?.includes('does not belong')?'stale_reference':'validation')},{status:409});
  if(body.recordType==='purchase')await db.inventoryPurchase.update({where:{id:result.id},data:{submissionHash:hash}});else if(body.recordType==='expense')await db.financialExpense.update({where:{id:result.id},data:{submissionHash:hash}});else if(body.recordType==='harvest')await db.harvestResult.update({where:{id:result.id},data:{submissionHash:hash}});else await db.revenueEntry.update({where:{id:result.id},data:{submissionHash:hash}});
  return NextResponse.json({success:true,recordId:result.id});
}
