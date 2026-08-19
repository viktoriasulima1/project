import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { validatePhotoStorageConfig } from '@/lib/scouting/storage-config';

export const dynamic='force-dynamic';
export async function GET(){
 const farm=await getActiveFarmOrThrow();
 try{const config=validatePhotoStorageConfig(),orphanQueueCount=await db.scoutingPhoto.count({where:{farmId:farm.id,uploadStatus:{not:'finalized'}}});return NextResponse.json({configured:config.provider!=='unavailable',sharedProvider:config.provider==='object_gateway',providerCategory:config.provider,regionConfigured:Boolean(config.region),bucketConfigured:Boolean(config.bucket),signedLifetimeSeconds:config.signedSeconds,cleanupSchedulerConfigured:Boolean(process.env.SCOUTING_STORAGE_CLEANUP_SCHEDULE),orphanQueueCount,reachable:'not_probed_by_safe_status',checkedAt:new Date().toISOString()})}catch{return NextResponse.json({configured:false,sharedProvider:false,providerCategory:'invalid',cleanupSchedulerConfigured:false,orphanQueueCount:null,reachable:false,checkedAt:new Date().toISOString()},{status:503})}
}
