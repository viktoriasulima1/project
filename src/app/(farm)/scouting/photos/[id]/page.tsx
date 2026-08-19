import { notFound } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { PersistedPhotoAnnotations } from '@/components/scouting/PersistedPhotoAnnotations';
import { PhotoSuggestionReview } from '@/components/scouting/PhotoSuggestionReview';
import { requireFarm } from '@/lib/require-farm';
import { db } from '@/lib/db';
import { configuredPhotoStorage } from '@/lib/scouting/photo-storage';
import type { PhotoAnnotation } from '@/lib/scouting/photo-policy';
import styles from '@/components/scouting/Scouting.module.css';

export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const farm=await requireFarm(),{id}=await params;
 const photo=await db.scoutingPhoto.findFirst({where:{id,farmId:farm.id},include:{annotationVersions:{orderBy:{version:'asc'}},observation:{include:{visit:{include:{field:true,fieldSeason:true}},followUpWorkOrder:true,suggestions:true}}}});
 if(!photo)notFound();
 const url=await configuredPhotoStorage().generateShortLivedDownloadUrl(photo.id,300);
 const versions=photo.annotationVersions.map(version=>({id:version.id,version:version.version,annotations:(Array.isArray(version.annotationsJson)?version.annotationsJson:[]) as PhotoAnnotation[],correctionReason:version.correctionReason,isEffective:version.isEffective,createdAt:version.createdAt.toISOString()}));
 return <><Topbar title="Private scouting photo" subtitle="Authenticated evidence viewer" farmName={farm.name}/><main className={styles.page}><section className={styles.card}><img src={url} alt={photo.observation.description} style={{maxWidth:'100%',height:'auto'}}/><p>{photo.originalName} · {Math.round(photo.sizeBytes/1024)} KB · {photo.uploadStatus}</p><a href={url} download>Download private copy</a></section><section className={styles.card}><h2>Evidence context</h2><p><strong>{photo.observation.visit.field.name}</strong> · {photo.observation.visit.fieldSeason.crop} · {photo.observation.visit.visitDate.toLocaleString()}</p><p>{photo.observation.issueType} · {photo.observation.certainty} · {photo.observation.severity}</p><p>BBCH {photo.observation.visit.fieldSeason.bbchStage??'not recorded'} · location {photo.latitude&&photo.longitude?'approved and stored':'not stored'}</p></section><section className={styles.card}><PersistedPhotoAnnotations photoId={photo.id} src={url} finalized={photo.uploadStatus==='finalized'} versions={versions}/></section><section className={styles.card}><PhotoSuggestionReview photoId={photo.id}/>{photo.observation.suggestions.length>0&&<p>{photo.observation.suggestions.length} prior review record(s) retained.</p>}{photo.observation.followUpWorkOrder&&<a href={`/work-orders?field=${photo.observation.visit.fieldId}`}>View related Work Order</a>}</section></main></>
}
