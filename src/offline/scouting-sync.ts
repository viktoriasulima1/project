'use client';
import { createScoutingVisit } from '@/lib/actions/scouting';
import { OBSERVATION_CATEGORIES } from '@/lib/scouting/categories';
import { classifyPhotoFailure } from '@/lib/scouting/sync-status';
import { putScoutingDraft, type LocalScoutingDraft } from './scouting-db';

export type RetryResult='retried'|'dependency_retried'|'blocked_by_dependency'|'permanent_failure'|'conflict'|'already_synchronized';
export async function retryScoutingPhoto(draft:LocalScoutingDraft,localPhotoId:string,expectedNamespace:string):Promise<{result:RetryResult;message:string;draft:LocalScoutingDraft}>{
 if(draft.namespace!==expectedNamespace)return{result:'permanent_failure',message:'The active farm/user session does not own this local item.',draft};
 const observation=draft.observations.find(row=>row.photos.some(photo=>photo.localPhotoId===localPhotoId)),photo=observation?.photos.find(row=>row.localPhotoId===localPhotoId);
 if(!observation||!photo)return{result:'permanent_failure',message:'Local photo item was not found.',draft};
 if(photo.status==='uploaded'&&photo.serverPhotoId)return{result:'already_synchronized',message:'Photo is already synchronized.',draft};
 let dependencyRetried=false;
 if(!draft.serverVisitId||!observation.serverObservationId){
  const visit=await createScoutingVisit({localVisitId:draft.localVisitId,fieldSeasonId:draft.fieldSeasonId,visitDate:draft.visitDate,overallCondition:draft.overallCondition as 'good'|'fair'|'poor'|'critical'|undefined,notes:draft.notes,stageSystem:'BBCH',stageCode:draft.stageCode,stageLabel:draft.stageLabel,observations:draft.observations.map(row=>({category:(OBSERVATION_CATEGORIES as readonly string[]).includes(row.category)?row.category as typeof OBSERVATION_CATEGORIES[number]:'general_note',issueType:row.issueType,severity:row.severity as 'low'|'moderate'|'high'|'critical',affectedPercent:row.affectedPercent,description:row.description,certainty:'symptom_observed',confidence:'medium'}))});
  if(visit.error){draft.syncStatus=visit.error.toLowerCase().includes('conflict')?'conflict':'failed';draft.error=visit.error;await putScoutingDraft(draft);return{result:draft.syncStatus==='conflict'?'conflict':'blocked_by_dependency',message:visit.error,draft}}
  draft.serverVisitId=visit.id;draft.observations.forEach((row,index)=>{row.serverObservationId=visit.observationIds?.[index]});dependencyRetried=true;
 }
 if(!observation.serverObservationId)return{result:'blocked_by_dependency',message:'The source observation is not synchronized.',draft};
 photo.retryCount=(photo.retryCount??0)+1;photo.lastAttemptAt=new Date().toISOString();photo.status='uploading';photo.error=undefined;draft.syncStatus='partially_synced';draft.updatedAt=photo.lastAttemptAt;await putScoutingDraft(draft);
 const body=new FormData();body.set('observationId',observation.serverObservationId);body.set('localPhotoId',photo.localPhotoId);body.set('photo',photo.file,photo.name);body.set('annotations',JSON.stringify(photo.annotations));
 try{const response=await fetch('/api/scouting/photos',{method:'POST',body}),json=await response.json();if(!response.ok)throw Object.assign(new Error(json.error??'Photo retry failed.'),{status:response.status});photo.status='uploaded';photo.serverPhotoId=json.photoId;photo.checkpoint='finalized';photo.error=undefined;const pending=draft.observations.flatMap(row=>row.photos).some(row=>row.status!=='uploaded');draft.syncStatus=pending?'partially_synced':'synced';draft.updatedAt=new Date().toISOString();await putScoutingDraft(draft);return{result:dependencyRetried?'dependency_retried':'retried',message:`Photo synchronized. ${draft.observations.flatMap(row=>row.photos).filter(row=>row.status==='uploaded').length} of ${draft.observations.flatMap(row=>row.photos).length} photos complete.`,draft}}
 catch(error){const status=typeof error==='object'&&error&&'status'in error?Number(error.status):undefined,classified=classifyPhotoFailure({status,message:error instanceof Error?error.message:'Photo retry failed.',online:navigator.onLine});photo.status='failed';photo.error=error instanceof Error?error.message:'Photo retry failed.';photo.failureCategory=classified.category;draft.syncStatus='partially_synced';draft.updatedAt=new Date().toISOString();await putScoutingDraft(draft);return{result:classified.retryable?'retried':'permanent_failure',message:photo.error,draft}}
}
