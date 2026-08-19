import 'server-only';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { PrivatePhotoStorage, StoredPhotoMetadata } from './photo-storage';
import { signPhotoRead } from './photo-read-token';

/**
 * Sprint 27 — direct S3-compatible private photo storage adapter. Implements the
 * existing PrivatePhotoStorage interface with a self-contained AWS Signature V4
 * signer (no SDK dependency), so any S3-compatible provider (AWS S3, MinIO, Ceph
 * RGW, Cloudflare R2, Backblaze B2) can be used as the shared multi-node backing
 * store. ALL vendor-specific configuration (endpoint, region, path-style,
 * signing) stays inside this adapter — scouting domain services are unchanged.
 *
 * Security: the client-facing signed read (`generateShortLivedDownloadUrl`)
 * returns the FarmOS internal route, which re-checks ownership and streams bytes
 * server-side via `readObject`. A raw S3 URL or storage key is NEVER handed to a
 * client. The direct presigned URL (`presignGetUrl`) exists only for the
 * synthetic storage contract.
 */

export interface S3CompatibleConfig {
  endpoint: string;      // HTTPS base, e.g. https://s3.eu-west-1.amazonaws.com or a MinIO host
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  signedUrlSeconds: number;
}

const SERVICE = 's3';
const ALGO = 'AWS4-HMAC-SHA256';
const UNSIGNED = 'UNSIGNED-PAYLOAD';

const sha256hex = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data, 'utf8').digest();
// RFC-3986 encode a single path segment (never encodes an already-safe char);
// object keys keep '/', so each segment is encoded and re-joined.
const enc = (s: string) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const encodeKey = (key: string) => key.split('/').map(enc).join('/');

export class S3CompatiblePhotoStorage implements PrivatePhotoStorage {
  constructor(private readonly c: S3CompatibleConfig) {}

  private host() { return new URL(this.c.endpoint).host; }
  // Path-style: {endpoint}/{bucket}/{key}; virtual-hosted: {bucket}.{host}/{key}.
  private objectUrl(key: string) {
    const base = new URL(this.c.endpoint);
    if (this.c.forcePathStyle) return `${base.origin}/${encodeURIComponent(this.c.bucket)}/${encodeKey(key)}`;
    return `${base.protocol}//${this.c.bucket}.${base.host}/${encodeKey(key)}`;
  }
  private canonicalPath(key: string) {
    return this.c.forcePathStyle ? `/${encodeURIComponent(this.c.bucket)}/${encodeKey(key)}` : `/${encodeKey(key)}`;
  }
  private signingKey(dateStamp: string) {
    return hmac(hmac(hmac(hmac('AWS4' + this.c.secretAccessKey, dateStamp), this.c.region), SERVICE), 'aws4_request');
  }
  private amzDates() {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    return { amzDate, dateStamp: amzDate.slice(0, 8) };
  }

  /** Header-signed request (PUT/GET/HEAD/DELETE). extraHeaders are signed too. */
  private async signedFetch(method: string, key: string, opts: { body?: Uint8Array; extraHeaders?: Record<string, string> } = {}) {
    const url = this.objectUrl(key);
    const host = new URL(url).host;
    const { amzDate, dateStamp } = this.amzDates();
    const payloadHash = opts.body ? sha256hex(opts.body) : sha256hex('');
    const headers: Record<string, string> = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...(opts.extraHeaders ?? {}) };
    const signedNames = Object.keys(headers).map((h) => h.toLowerCase()).sort();
    const canonicalHeaders = signedNames.map((h) => `${h}:${String(headers[Object.keys(headers).find((k) => k.toLowerCase() === h)!]).trim()}\n`).join('');
    const signedHeaders = signedNames.join(';');
    const canonicalRequest = [method, new URL(url).pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${dateStamp}/${this.c.region}/${SERVICE}/aws4_request`;
    const stringToSign = [ALGO, amzDate, scope, sha256hex(canonicalRequest)].join('\n');
    const signature = hmac(this.signingKey(dateStamp), stringToSign).toString('hex');
    headers.authorization = `${ALGO} Credential=${this.c.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const res = await fetch(url, { method, headers, body: opts.body ? Buffer.from(opts.body) : undefined });
    return res;
  }

  /** Unsigned direct object URL — contract use only (private bucket ⇒ 403). */
  directObjectUrl(key: string) { return this.objectUrl(key); }

  /** Query-signed presigned GET URL (direct S3 read) — contract use only. */
  presignGetUrl(key: string, expiresSeconds: number) {
    const url = new URL(this.objectUrl(key));
    const host = url.host;
    const { amzDate, dateStamp } = this.amzDates();
    const scope = `${dateStamp}/${this.c.region}/${SERVICE}/aws4_request`;
    const q = new URLSearchParams({
      'X-Amz-Algorithm': ALGO,
      'X-Amz-Credential': `${this.c.accessKeyId}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(Math.max(1, Math.min(expiresSeconds, 900))),
      'X-Amz-SignedHeaders': 'host',
    });
    const canonicalRequest = ['GET', url.pathname, q.toString(), `host:${host}\n`, 'host', UNSIGNED].join('\n');
    const stringToSign = [ALGO, amzDate, scope, sha256hex(canonicalRequest)].join('\n');
    const signature = hmac(this.signingKey(dateStamp), stringToSign).toString('hex');
    q.set('X-Amz-Signature', signature);
    return `${url.origin}${url.pathname}?${q.toString()}`;
  }

  private classify(status: number): never {
    if (status === 401) throw new Error('S3 request unauthenticated (401).');
    if (status === 403) throw new Error('S3 request forbidden/unauthorized (403).');
    if (status === 404) throw new Error('S3 object or bucket not found (404).');
    if (status === 503 || status === 500) throw new Error('S3-compatible storage provider unavailable.');
    throw new Error(`S3 request failed (${status}).`);
  }

  async createUploadAuthorization(scope: { farmId: string; visitId: string; observationId: string; objectId?: string }) {
    return { key: `${scope.farmId}/${scope.visitId}/${scope.observationId}/${scope.objectId ?? randomUUID()}.original` };
  }

  async uploadObject(key: string, bytes: Uint8Array, contentType: string): Promise<StoredPhotoMetadata> {
    const checksum = sha256hex(bytes);
    // Store the SHA-256 as object metadata so verifyChecksum/HEAD can read it
    // back provider-independently (S3 ETag is MD5 and not reliable here).
    const res = await this.signedFetch('PUT', key, { body: bytes, extraHeaders: { 'content-type': contentType, 'x-amz-meta-sha256': checksum } });
    if (!res.ok) this.classify(res.status);
    return { key, size: bytes.byteLength, checksum, contentType, finalized: false };
  }

  async readObject(key: string): Promise<Uint8Array> {
    const res = await this.signedFetch('GET', key);
    if (!res.ok) this.classify(res.status);
    return new Uint8Array(await res.arrayBuffer());
  }

  async retrieveMetadata(key: string): Promise<StoredPhotoMetadata> {
    const res = await this.signedFetch('HEAD', key);
    if (!res.ok) this.classify(res.status);
    return {
      key,
      size: Number(res.headers.get('content-length') ?? 0),
      checksum: res.headers.get('x-amz-meta-sha256') ?? '',
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
      finalized: res.headers.get('x-amz-meta-finalized') === 'true',
    };
  }

  async verifyChecksum(key: string, checksum: string): Promise<boolean> {
    return (await this.retrieveMetadata(key)).checksum === checksum;
  }

  // Finalization authority is the DB (the saga marks the photo finalized). At the
  // storage layer, finalize is an idempotent existence verification — safe to
  // call more than once (a lost response never creates a duplicate object).
  async markFinalized(key: string): Promise<void> {
    const res = await this.signedFetch('HEAD', key);
    if (!res.ok) this.classify(res.status);
  }

  async deleteUnfinalized(key: string): Promise<void> {
    const res = await this.signedFetch('DELETE', key);
    // S3 DELETE is idempotent (204/404 both mean "gone").
    if (!res.ok && res.status !== 404) this.classify(res.status);
  }

  // Client-facing signed read = the FarmOS internal route (ownership re-checked;
  // bytes streamed server-side). No raw S3 URL/key is ever exposed to a client.
  async generateShortLivedDownloadUrl(photoId: string, expiresSeconds: number): Promise<string> {
    const t = signPhotoRead(photoId, expiresSeconds);
    return `/api/scouting/photos/${photoId}?exp=${t.exp}&signature=${t.signature}`;
  }
}
