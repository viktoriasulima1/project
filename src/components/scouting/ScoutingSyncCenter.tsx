'use client';
import { useEffect, useState } from 'react';
import { deleteScoutingDraft, listScoutingDrafts, scoutingRecoveryManifest, updateScoutingPhotoAnnotations, type LocalScoutingDraft } from '@/offline/scouting-db';
import { retryScoutingPhoto } from '@/offline/scouting-sync';
import { classifyPhotoFailure, visitSyncProgress } from '@/lib/scouting/sync-status';
import { LocalPhotoAnnotationEditor } from './LocalPhotoAnnotationEditor';
import styles from './Scouting.module.css';

export function ScoutingSyncCenter({namespace}:{namespace:string}){
 const[drafts,setDrafts]=useState<LocalScoutingDraft[]>([]),[paused,setPaused]=useState(false),[online,setOnline]=useState(false),[activeItem,setActiveItem]=useState<string|null>(null),[message,setMessage]=useState('');
 const load=()=>listScoutingDrafts(namespace).then(setDrafts);
 useEffect(()=>{const change=()=>setOnline(navigator.onLine);change();addEventListener('online',change);addEventListener('offline',change);load().catch(()=>undefined);return()=>{removeEventListener('online',change);removeEventListener('offline',change)}},[namespace]);
 const download=(name:string,value:unknown)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=name;link.click();URL.revokeObjectURL(url)};
 async function retry(draft:LocalScoutingDraft,localPhotoId:string){setActiveItem(localPhotoId);setMessage('Retrying selected item…');const outcome=await retryScoutingPhoto(structuredClone(draft),localPhotoId,namespace);setMessage(outcome.message);await load();setActiveItem(null)}
 return <section className={styles.card}>
  <h2>Scouting photo sync</h2><p>{drafts.length} local visit(s) · {drafts.flatMap(draft=>draft.observations.flatMap(observation=>observation.photos)).filter(photo=>photo.status!=='uploaded').length} photo(s) pending/failed.</p>
  <div className={styles.location}><button onClick={()=>setPaused(true)} disabled={paused}>Pause</button><button onClick={()=>setPaused(false)} disabled={!paused}>Resume</button><button onClick={()=>download('farmos-scouting-recovery.json',scoutingRecoveryManifest(drafts))}>Export local metadata</button></div>
  {message&&<p role="status" aria-live="polite">{message}</p>}
  {drafts.map(draft=>{const photos=draft.observations.flatMap(observation=>observation.photos),progress=visitSyncProgress({visit:Boolean(draft.serverVisitId),observations:draft.observations.length,observationsDone:draft.observations.filter(observation=>observation.serverObservationId).length,stageRequired:Boolean(draft.stageCode),stageDone:Boolean(draft.serverVisitId&&draft.stageCode),photos:photos.length,photosDone:photos.filter(photo=>photo.status==='uploaded').length,workOrders:0,workOrdersDone:0});return <article className={styles.visit} key={draft.localVisitId}>
   <h3>{draft.syncStatus.replaceAll('_',' ')} · {progress.label}</h3><p>{draft.error??'Local evidence remains safe on this device.'}</p><p>Updated {new Date(draft.updatedAt).toLocaleString()}</p>
   {photos.map(photo=>{const failure=photo.error?classifyPhotoFailure({message:photo.error,online}):null;return <div key={photo.localPhotoId}><strong>{photo.name}</strong> · {photo.status.replaceAll('_',' ')}{failure&&<span> · {failure.category.replaceAll('_',' ')}</span>}<p>{photo.annotations.length} local annotation(s) · Last attempt: {photo.lastAttemptAt?new Date(photo.lastAttemptAt).toLocaleString():'not attempted'} · Retry count: {photo.retryCount??0} · Local data is safe.</p>{photo.error&&<p>{photo.error}</p>}
    {photo.status!=='uploaded'&&<LocalPhotoAnnotationEditor file={photo.file} name={photo.name} annotations={photo.annotations} onSave={async annotations=>{await updateScoutingPhotoAnnotations({localVisitId:draft.localVisitId,localPhotoId:photo.localPhotoId,namespace,annotations});await load()}}/>}
    <div className={styles.location}><button onClick={()=>retry(draft,photo.localPhotoId)} disabled={paused||!online||activeItem!==null||photo.status==='uploaded'||failure?.retryable===false}>{activeItem===photo.localPhotoId?'Retrying…':'Retry this item'}</button>{photo.serverPhotoId&&<a href={`/scouting/photos/${photo.serverPhotoId}`}>Review</a>}<button onClick={()=>{const url=URL.createObjectURL(photo.file),link=document.createElement('a');link.href=url;link.download=photo.name;link.click();URL.revokeObjectURL(url)}}>Export photo</button></div>
   </div>})}
   <button onClick={async()=>{if(confirm('Remove this local copy? Uploaded server evidence is not deleted.')){await deleteScoutingDraft(draft.localVisitId);await load()}}}>Remove local copy</button>
  </article>})}
  {paused&&<p role="status">Synchronization paused. Local evidence remains on this device.</p>}
 </section>
}
