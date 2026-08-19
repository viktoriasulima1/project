import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validatePhotoStorageConfig } from './storage-config';
import { ObjectGatewayPhotoStorage } from './object-gateway-storage';
import { S3CompatiblePhotoStorage } from './s3-compatible-storage';
import { signPhotoRead, verifyPhotoRead } from './photo-read-token';

// Re-exported for existing importers (e.g. the photos API route).
export { signPhotoRead, verifyPhotoRead };

export interface StoredPhotoMetadata{key:string;size:number;checksum:string;contentType:string;finalized:boolean;}
export interface PrivatePhotoStorage{createUploadAuthorization(scope:{farmId:string;visitId:string;observationId:string;objectId?:string}):Promise<{key:string}>;uploadObject(key:string,bytes:Uint8Array,contentType:string):Promise<StoredPhotoMetadata>;readObject(key:string):Promise<Uint8Array>;deleteUnfinalized(key:string):Promise<void>;markFinalized(key:string):Promise<void>;verifyChecksum(key:string,checksum:string):Promise<boolean>;retrieveMetadata(key:string):Promise<StoredPhotoMetadata>;generateShortLivedDownloadUrl(photoId:string,expiresSeconds:number):Promise<string>;}

const root=path.resolve(process.env.SCOUTING_PHOTO_LOCAL_ROOT??'.private/scouting-photos');
function safeKey(key:string){const resolved=path.resolve(root,key);if(!resolved.startsWith(root+path.sep))throw new Error('Invalid storage key.');return resolved;}
function keyFor(s:{farmId:string;visitId:string;observationId:string;objectId?:string}){return `${s.farmId}/${s.visitId}/${s.observationId}/${s.objectId??randomUUID()}.original`;}

class LocalPrivatePhotoStorage implements PrivatePhotoStorage{
 async createUploadAuthorization(scope:{farmId:string;visitId:string;observationId:string;objectId?:string}){return{key:keyFor(scope)};}
 async uploadObject(key:string,bytes:Uint8Array,contentType:string){const target=safeKey(key),temp=`${target}.uploading`;await mkdir(path.dirname(target),{recursive:true});await writeFile(temp,bytes,{flag:'wx'});const checksum=createHash('sha256').update(bytes).digest('hex');await writeFile(`${temp}.json`,JSON.stringify({contentType,checksum,finalized:false}));return{key,size:bytes.byteLength,checksum,contentType,finalized:false};}
 async readObject(key:string){return new Uint8Array(await readFile(safeKey(key)));}
 async deleteUnfinalized(key:string){const target=safeKey(key);const metadata=await this.retrieveMetadata(key).catch(()=>null);if(metadata?.finalized)throw new Error('Finalized evidence follows retention policy and cannot be deleted here.');await Promise.all([rm(target,{force:true}),rm(`${target}.uploading`,{force:true}),rm(`${target}.json`,{force:true}),rm(`${target}.uploading.json`,{force:true})]);}
 async markFinalized(key:string){const target=safeKey(key),temp=`${target}.uploading`;await rename(temp,target);const raw=JSON.parse(await readFile(`${temp}.json`,'utf8')) as StoredPhotoMetadata;await writeFile(`${target}.json`,JSON.stringify({...raw,finalized:true}));await rm(`${temp}.json`,{force:true});}
 async verifyChecksum(key:string,checksum:string){return(createHash('sha256').update(await this.readObject(key)).digest('hex'))===checksum;}
 async retrieveMetadata(key:string){const target=safeKey(key);const finalized=await stat(target).then(()=>true).catch(()=>false);const file=finalized?target:`${target}.uploading`;const [s,raw]=await Promise.all([stat(file),readFile(`${file}.json`,'utf8')]);const data=JSON.parse(raw);return{key,size:s.size,checksum:data.checksum,contentType:data.contentType,finalized};}
 async generateShortLivedDownloadUrl(photoId:string,expiresSeconds:number){const t=signPhotoRead(photoId,expiresSeconds);return`/api/scouting/photos/${photoId}?exp=${t.exp}&signature=${t.signature}`;}
}
class UnavailablePhotoStorage implements PrivatePhotoStorage{private fail():never{throw new Error('Private photo storage is unavailable; the visit remains safely local.');}async createUploadAuthorization():Promise<never>{return this.fail()}async uploadObject():Promise<never>{return this.fail()}async readObject():Promise<never>{return this.fail()}async deleteUnfinalized():Promise<never>{return this.fail()}async markFinalized():Promise<never>{return this.fail()}async verifyChecksum():Promise<never>{return this.fail()}async retrieveMetadata():Promise<never>{return this.fail()}async generateShortLivedDownloadUrl():Promise<never>{return this.fail()}}
export function configuredPhotoStorage():PrivatePhotoStorage{const c=validatePhotoStorageConfig();if(c.provider==='unavailable')return new UnavailablePhotoStorage();if(c.provider==='object_gateway')return new ObjectGatewayPhotoStorage(c as Required<Pick<typeof c,'endpoint'|'region'|'bucket'|'accessKey'|'secretKey'>>);if(c.provider==='s3_compatible')return new S3CompatiblePhotoStorage({endpoint:c.endpoint!,region:c.region!,bucket:c.bucket!,accessKeyId:c.accessKey!,secretAccessKey:c.secretKey!,forcePathStyle:c.forcePathStyle??false,signedUrlSeconds:c.signedSeconds});return new LocalPrivatePhotoStorage();}
