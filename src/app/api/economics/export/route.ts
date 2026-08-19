import { randomUUID, createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { getEconomicsExportData } from '@/lib/economics-export/data';
import { buildEconomicsCsv, type EconomicsCsvType } from '@/lib/economics-export/csv';
import { buildEconomicsPdf, type EconomicsPdfType } from '@/lib/economics-export/pdf';
import { getServerI18n } from '@/i18n/server';

const csvTypes=new Set<EconomicsCsvType>(['field_economics','crop_economics','purchases','expenses','harvest','revenue','budget_vs_actual','unallocated_records']);
const pdfTypes=new Set<EconomicsPdfType>(['field_cost','crop_comparison','season_gross_margin','budget_vs_actual','purchase_history','cost_source_breakdown']);
export async function GET(request:Request){const url=new URL(request.url),seasonId=url.searchParams.get('seasonId'),format=url.searchParams.get('format'),type=url.searchParams.get('type'),includeHistory=url.searchParams.get('includeHistory')==='true';if(!seasonId||!format||!type)return NextResponse.json({error:'Season, format, and report type are required.'},{status:400});const farm=await getActiveFarmOrThrow(),exportId=randomUUID();try{const [data,i18n]=await Promise.all([getEconomicsExportData(farm,seasonId),getServerI18n(['fields'])]);let bytes:Uint8Array,contentType:string,extension:string;if(format==='csv'&&csvTypes.has(type as EconomicsCsvType)){bytes=new TextEncoder().encode(buildEconomicsCsv(type as EconomicsCsvType,data,includeHistory));contentType='text/csv; charset=utf-8';extension='csv';}else if(format==='pdf'&&pdfTypes.has(type as EconomicsPdfType)){bytes=await buildEconomicsPdf(type as EconomicsPdfType,data,exportId,{locale:i18n.locale,t:i18n.t});contentType='application/pdf';extension='pdf';}else return NextResponse.json({error:'Unsupported economics report.'},{status:400});
    // Part 16 — provenance: a SHA-256 checksum of the exact bytes served, plus
    // a safe filename with no path/CRLF characters. The generated file itself
    // is not persisted (only enough metadata to answer who/what/when after).
    const checksum=createHash('sha256').update(bytes).digest('hex');
    const safeName=`${type}-${data.season.year}`.replace(/[^a-z0-9_-]/gi,'_');
    await db.auditEvent.create({data:{farmId:farm.id,actorUserId:await getClerkUserId(),entityType:'EconomicsExport',entityId:exportId,action:'exported',source:'web',correlationId:exportId,metadataJson:{schemaVersion:1,seasonId,format,type,includeHistory,recordCount:data.finance.fields.length,checksum,appVersion:process.env.npm_package_version??'dev'}}});
    return new NextResponse(Buffer.from(bytes),{headers:{'content-type':contentType,'content-disposition':`attachment; filename="${safeName}.${extension}"`,'x-export-id':exportId,'x-export-checksum':checksum}});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Report could not be generated.'},{status:403});}}
