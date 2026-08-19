import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveFarm } from '@/lib/farm';
import { configuredPhotoStorage, verifyPhotoRead } from '@/lib/scouting/photo-storage';

export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const{id}=await params,url=new URL(request.url),farm=await getActiveFarm();const exp=Number(url.searchParams.get('exp')),signature=url.searchParams.get('signature')??'';const signed=Number.isFinite(exp)&&verifyPhotoRead(id,exp,signature);const photo=await db.scoutingPhoto.findFirst({where:{id,...(!signed?{farmId:farm?.id??'no-farm'}:{})}});if(!photo)return NextResponse.json({error:'Photo not found.'},{status:404});try{const bytes=await configuredPhotoStorage().readObject(photo.storageKey);return new NextResponse(Buffer.from(bytes),{headers:{'content-type':photo.mimeType,'content-length':String(photo.sizeBytes),'content-disposition':`inline; filename="scouting-${photo.id}.${photo.mimeType.split('/')[1]}"`,'cache-control':'private, max-age=60','x-content-type-options':'nosniff'}});}catch{return NextResponse.json({error:'Photo binary is temporarily unavailable.'},{status:503});}}
