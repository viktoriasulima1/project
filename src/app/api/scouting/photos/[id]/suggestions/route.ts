import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { isTrustedMutationOrigin } from '@/lib/origin';
import { deterministicPhotoSuggestion } from '@/lib/scouting/photo-ai';

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isTrustedMutationOrigin(request))return NextResponse.json({error:'Untrusted origin.'},{status:403});
 const body=await request.json().catch(()=>null) as {consent?:boolean}|null;if(!body?.consent)return NextResponse.json({error:'Explicit photo-processing consent is required.'},{status:400});
 const farm=await getActiveFarmOrThrow(),actor=await getClerkUserId()??farm.clerkUserId,{id}=await params;
 const photo=await db.scoutingPhoto.findFirst({where:{id,farmId:farm.id,uploadStatus:'finalized'},include:{observation:{include:{visit:{include:{fieldSeason:true}}}}}});if(!photo)return NextResponse.json({error:'Finalized photo not found.'},{status:404});
 const recent=await db.photoSuggestion.count({where:{photo:{farmId:farm.id},createdAt:{gte:new Date(Date.now()-60_000)}}});if(recent>=5)return NextResponse.json({error:'Photo suggestion rate limit reached. Try again shortly.'},{status:429});
 const safeContext={crop:photo.observation.visit.fieldSeason.crop,bbch:photo.observation.visit.fieldSeason.bbchStage,category:photo.observation.category},contextChecksum=createHash('sha256').update(JSON.stringify(safeContext)).digest('hex');
 const output=deterministicPhotoSuggestion({crop:safeContext.crop,category:safeContext.category});
 const suggestion=await db.$transaction(async tx=>{const row=await tx.photoSuggestion.create({data:{observationId:photo.observationId,photoId:photo.id,provider:output.provider,model:output.model,candidatesJson:output.candidates,visibleFeaturesJson:output.candidates.flatMap(candidate=>candidate.visibleFeatures),alternativesJson:output.candidates.flatMap(candidate=>candidate.alternatives),confidence:String(Math.max(...output.candidates.map(candidate=>candidate.confidence),0)),contextChecksum,derivedChecksum:photo.checksum,promptVersion:'photo-suggestion-v1',schemaVersion:1,cannotDetermine:output.candidates.length===0,status:'completed'}});await tx.auditEvent.create({data:{farmId:farm.id,actorUserId:actor,entityType:'PhotoSuggestion',entityId:row.id,action:'created',source:'web',correlationId:row.id,metadataJson:{schemaVersion:1,event:'photo_suggestion_requested',provider:output.provider,confirmedDiagnosis:false,treatmentAuthorized:false,gpsShared:false,filenameShared:false,storageKeyShared:false}}});return row});
 return NextResponse.json({id:suggestion.id,output});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!isTrustedMutationOrigin(request))return NextResponse.json({error:'Untrusted origin.'},{status:403});
 const body=await request.json().catch(()=>null) as {suggestionId?:string;decision?:'suspected'|'rejected'|'unknown'|'consultation';feedback?:string}|null,farm=await getActiveFarmOrThrow(),actor=await getClerkUserId()??farm.clerkUserId,{id}=await params;
 const suggestion=await db.photoSuggestion.findFirst({where:{id:body?.suggestionId,photoId:id,photo:{farmId:farm.id}}});if(!suggestion)return NextResponse.json({error:'Suggestion not found.'},{status:404});
 if(!['suspected','rejected','unknown','consultation'].includes(body?.decision??''))return NextResponse.json({error:'A valid review decision is required.'},{status:400});
 const status=body?.decision==='suspected'?'accepted_as_suspected':body?.decision==='rejected'?'rejected':'kept_unknown';
 await db.photoSuggestion.update({where:{id:suggestion.id},data:{status,farmerAction:body?.decision,reviewedBy:actor,reviewedAt:new Date()}});
 if(body?.decision==='suspected')await db.scoutingObservation.update({where:{id:suggestion.observationId},data:{certainty:'suspected_cause'}});
 let workOrderId:string|undefined;
 if(body?.decision==='consultation'){const observation=await db.scoutingObservation.findUnique({where:{id:suggestion.observationId},include:{visit:true}});if(observation){if(observation.followUpWorkOrderId)workOrderId=observation.followUpWorkOrderId;else{const order=await db.workOrder.create({data:{farmId:farm.id,fieldSeasonId:observation.visit.fieldSeasonId,operationType:'scout',title:'Agronomist consultation for unconfirmed photo observation',priority:'medium',status:'ready',createdBy:actor}});workOrderId=order.id;await db.scoutingObservation.update({where:{id:observation.id},data:{followUpWorkOrderId:order.id,status:'action_planned'}});await db.auditEvent.create({data:{farmId:farm.id,actorUserId:actor,entityType:'WorkOrder',entityId:order.id,action:'created',source:'web',correlationId:randomUUID(),metadataJson:{sourceObservationId:observation.id,sourceSuggestionId:suggestion.id,treatmentAuthorized:false}}})}}}
 return NextResponse.json({success:true,status,workOrderId,feedbackRecorded:Boolean(body?.feedback)});
}
