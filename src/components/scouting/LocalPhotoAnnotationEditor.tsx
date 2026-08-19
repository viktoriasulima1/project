'use client';
import { useEffect, useState } from 'react';
import type { PhotoAnnotation } from '@/lib/scouting/photo-policy';
import { PhotoAnnotationEditor } from './PhotoAnnotationEditor';

export function LocalPhotoAnnotationEditor({file,name,annotations,onSave}:{file:Blob;name:string;annotations:PhotoAnnotation[];onSave:(annotations:PhotoAnnotation[])=>void|Promise<void>}){
 const[editing,setEditing]=useState(false),[url,setUrl]=useState(''),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next)},[file]);
 async function save(next:PhotoAnnotation[]){setSaving(true);setMessage('Saving locally…');try{await onSave(next);setMessage('Saved locally on this device. No server synchronization is claimed.');setEditing(false)}catch(error){setMessage(error instanceof Error?error.message:'Local annotation save failed.')}finally{setSaving(false)}}
 if(!editing)return <div><button type="button" onClick={()=>setEditing(true)}>Review local annotations</button>{message&&<p role="status">{message}</p>}</div>;
 return <div><h4>Local annotations — {name}</h4><PhotoAnnotationEditor src={url} annotations={annotations} onSave={save} onCancel={()=>setEditing(false)} saving={saving}/>{message&&<p role="status">{message}</p>}</div>
}
