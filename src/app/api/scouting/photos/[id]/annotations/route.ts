import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { isTrustedMutationOrigin } from '@/lib/origin';
import { validateAnnotationSet } from '@/lib/scouting/photo-policy';

export const dynamic='force-dynamic';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const farm=await getActiveFarmOrThrow(),{id}=await params;
 const photo=await db.scoutingPhoto.findFirst({where:{id,farmId:farm.id},include:{annotationVersions:{orderBy:{version:'asc'}}}});
 if(!photo)return NextResponse.json({error:'Photo not found.'},{status:404});
 return NextResponse.json({photoId:photo.id,finalized:photo.uploadStatus==='finalized',versions:photo.annotationVersions.map(v=>({id:v.id,version:v.version,annotations:v.annotationsJson,correctionReason:v.correctionReason,isEffective:v.isEffective,previousVersionId:v.previousVersionId,createdAt:v.createdAt}))});
}

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isTrustedMutationOrigin(request))return NextResponse.json({error:'Untrusted request origin.'},{status:403});
 const farm=await getActiveFarmOrThrow(),actor=await getClerkUserId()??farm.clerkUserId,{id}=await params;
 const body=await request.json().catch(()=>null) as {annotations?:unknown;baseVersionId?:string|null;correctionReason?:string}|null;
 let annotations;try{annotations=validateAnnotationSet(body?.annotations)}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid annotations.'},{status:400})}
 const reason=String(body?.correctionReason??'').normalize('NFKC').replace(/[<>]/g,'').trim().slice(0,500);
 const photo=await db.scoutingPhoto.findFirst({where:{id,farmId:farm.id},include:{observation:{include:{visit:true}}}});
 if(!photo)return NextResponse.json({error:'Photo not found.'},{status:404});
 if(photo.observation.farmId!==farm.id||photo.observation.visit.farmId!==farm.id)return NextResponse.json({error:'Photo relationship is invalid.'},{status:409});
 if(photo.uploadStatus==='finalized'&&!reason)return NextResponse.json({error:'A correction reason is required for a finalized photo.'},{status:400});
 const allFarmVersions=await db.photoAnnotationVersion.findMany({where:{farmId:farm.id,photoId:{not:id}},select:{annotationsJson:true}});
 const foreignIds=new Set(allFarmVersions.flatMap(v=>Array.isArray(v.annotationsJson)?v.annotationsJson:[]).flatMap(a=>typeof a==='object'&&a&&'id'in a?[String(a.id)]:[]));
 if(annotations.some(a=>foreignIds.has(a.id)))return NextResponse.json({error:'An annotation ID already belongs to another photo.'},{status:409});
 try{
  const saved=await db.$transaction(async tx=>{
   const current=await tx.photoAnnotationVersion.findFirst({where:{photoId:id,isEffective:true},orderBy:{version:'desc'}});
   if((body?.baseVersionId??null)!==(current?.id??null))throw new Error('ANNOTATION_CONFLICT');
   if(current)await tx.photoAnnotationVersion.update({where:{id:current.id},data:{isEffective:false}});
   const next=await tx.photoAnnotationVersion.create({data:{farmId:farm.id,photoId:id,version:(current?.version??0)+1,annotationsJson:annotations,correctionReason:photo.uploadStatus==='finalized'?reason:null,actorUserId:actor,previousVersionId:current?.id,isEffective:true}});
   await tx.scoutingPhoto.update({where:{id},data:{annotationJson:annotations}});
   await tx.auditEvent.create({data:{farmId:farm.id,actorUserId:actor,entityType:'PhotoAnnotationVersion',entityId:next.id,previousVersionId:current?.id,action:current?'corrected':'created',source:'web',correlationId:randomUUID(),reason:photo.uploadStatus==='finalized'?reason:null,metadataJson:{schemaVersion:1,photoId:id,observationId:photo.observationId,visitId:photo.observation.visitId,version:next.version,annotationCount:annotations.length,finalized:photo.uploadStatus==='finalized'}}});
   return next;
  },{isolationLevel:'Serializable'});
  return NextResponse.json({success:true,id:saved.id,version:saved.version,isEffective:true,status:'synchronized'});
 }catch(error){if(error instanceof Error&&error.message==='ANNOTATION_CONFLICT')return NextResponse.json({error:'Server annotations changed. Review the local and server versions before saving.',status:'conflict'},{status:409});throw error}
}
