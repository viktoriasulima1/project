import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow, getClerkUserId } from '@/lib/farm';
import { isTrustedMutationOrigin } from '@/lib/origin';
import { configuredPhotoStorage } from '@/lib/scouting/photo-storage';
import { PHOTO_LIMITS, sanitizePhotoName, validateAnnotationSet, validatePhoto } from '@/lib/scouting/photo-policy';

export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!isTrustedMutationOrigin(request))return NextResponse.json({error:'Untrusted request origin.'},{status:403});
 const farm=await getActiveFarmOrThrow(),actor=await getClerkUserId()??farm.clerkUserId,form=await request.formData();
 const observationId=String(form.get('observationId')??''),localPhotoId=String(form.get('localPhotoId')??''),file=form.get('photo');
 if(!(file instanceof File)||!observationId||!/^[0-9a-f-]{36}$/i.test(localPhotoId))return NextResponse.json({error:'Photo, observation and valid local photo ID are required.'},{status:400});
 const observation=await db.scoutingObservation.findFirst({where:{id:observationId,farmId:farm.id},include:{visit:true,photos:true}});
 if(!observation)return NextResponse.json({error:'Observation not found.'},{status:404});
 const bytes=new Uint8Array(await file.arrayBuffer());let mime:string,annotations;
 try{mime=validatePhoto(bytes,file.type);annotations=validateAnnotationSet(JSON.parse(String(form.get('annotations')??'[]')))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid photo evidence.'},{status:400})}
 const checksum=createHash('sha256').update(bytes).digest('hex');
 let photo=await db.scoutingPhoto.findUnique({where:{localPhotoId}});
 if(photo&&photo.farmId!==farm.id)return NextResponse.json({error:'Photo not found.'},{status:404});
 if(photo&&photo.observationId!==observationId)return NextResponse.json({error:'Photo idempotency key belongs to another observation.'},{status:409});
 if(photo&&photo.checksum!==checksum)return NextResponse.json({error:'Photo retry checksum conflicts with the original local item.'},{status:409});
 if(photo?.uploadStatus==='finalized')return NextResponse.json({success:true,photoId:photo.id,deduplicated:true,checkpoint:'finalized'});
 if(!photo&&observation.photos.length>=PHOTO_LIMITS.maxPhotosPerObservation)return NextResponse.json({error:'Maximum 5 photos per observation.'},{status:400});
 const storage=configuredPhotoStorage(),objectId=photo?.id??randomUUID();
 try{
  if(!photo){
   const duplicate=await db.scoutingPhoto.findFirst({where:{farmId:farm.id,checksum,uploadStatus:'finalized'}});if(duplicate)return NextResponse.json({success:true,photoId:duplicate.id,deduplicated:true,checkpoint:'finalized'});
   const authorization=await storage.createUploadAuthorization({farmId:farm.id,visitId:observation.visitId,observationId,objectId});
   photo=await db.scoutingPhoto.create({data:{id:objectId,farmId:farm.id,observationId,storageKey:authorization.key,originalName:sanitizePhotoName(file.name),mimeType:mime,sizeBytes:bytes.byteLength,checksum,annotationJson:annotations,capturedAt:new Date(),localPhotoId,uploadStatus:'authorization_created'}});
  }
  let metadata=await storage.retrieveMetadata(photo.storageKey).catch(()=>null);
  if(!metadata){metadata=await storage.uploadObject(photo.storageKey,bytes,mime);await db.scoutingPhoto.update({where:{id:photo.id},data:{uploadStatus:'binary_uploaded'}})}
  if(metadata.checksum!==checksum)throw new Error('Uploaded photo checksum verification failed.');
  await db.scoutingPhoto.update({where:{id:photo.id},data:{uploadStatus:'checksum_verified'}});
  const existingVersion=await db.photoAnnotationVersion.findFirst({where:{photoId:photo.id},orderBy:{version:'desc'}});
  if(!existingVersion)await db.photoAnnotationVersion.create({data:{farmId:farm.id,photoId:photo.id,version:1,annotationsJson:annotations,actorUserId:actor,isEffective:true}});
  await db.scoutingPhoto.update({where:{id:photo.id},data:{uploadStatus:'db_attached',annotationJson:annotations}});
  if(!metadata.finalized)await storage.markFinalized(photo.storageKey);
  await db.$transaction(async tx=>{await tx.scoutingPhoto.update({where:{id:photo!.id},data:{uploadStatus:'finalized',finalizedAt:new Date()}});const prior=await tx.auditEvent.findFirst({where:{farmId:farm.id,entityType:'ScoutingPhoto',entityId:photo!.id,action:'created'}});if(!prior)await tx.auditEvent.create({data:{farmId:farm.id,actorUserId:actor,entityType:'ScoutingPhoto',entityId:photo!.id,action:'created',source:'web',correlationId:localPhotoId,metadataJson:{schemaVersion:2,event:'photo_finalized',observationId,checksumVerified:true,sizeBytes:bytes.byteLength,idempotencyKey:localPhotoId}}})});
  return NextResponse.json({success:true,photoId:photo.id,checkpoint:'finalized'});
 }catch(error){if(photo)await db.scoutingPhoto.update({where:{id:photo.id},data:{uploadStatus:'failed'}}).catch(()=>undefined);return NextResponse.json({error:error instanceof Error?error.message:'Photo upload failed; the persisted checkpoint and local evidence were preserved.',photoId:photo?.id,checkpoint:photo?.uploadStatus??'local'},{status:503})}
}
