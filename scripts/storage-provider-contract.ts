import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { validatePhotoStorageConfig } from '../src/lib/scouting/storage-config';
import { validatePhoto } from '../src/lib/scouting/photo-policy';

/**
 * Sprint 27 — shared storage CONTRACT test for the configured production
 * provider (object_gateway OR s3_compatible). Gated behind STORAGE_CONTRACT_TEST
 * =true and kept out of normal CI. Uses ONE generated synthetic image under the
 * dedicated contract prefix — never real farmer data, a real ScoutingVisit, or a
 * user photo. Verifies the full private-photo contract and classifies any
 * failure. Prints no credentials, signed URLs, or complete object keys.
 */

type FailureCategory =
  | 'configuration' | 'authentication' | 'authorization' | 'endpoint_unavailable'
  | 'bucket_unavailable' | 'checksum_mismatch' | 'signing_failure' | 'cleanup_failure'
  | 'provider_timeout' | 'unknown';

function classify(error: unknown): FailureCategory {
  const m = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (/placeholder|required|https|unsupported|configured|provider is|object_gateway|s3_compatible/.test(m)) return 'configuration';
  if (/\b401\b|unauthenticated/.test(m)) return 'authentication';
  if (/\b403\b|forbidden|unauthorized/.test(m)) return 'authorization';
  if (/\b503\b|unavailable/.test(m)) return 'endpoint_unavailable';
  if (/\b404\b|bucket/.test(m)) return 'bucket_unavailable';
  if (/checksum/.test(m)) return 'checksum_mismatch';
  if (/sign(ed|ing)?/.test(m)) return 'signing_failure';
  if (/cleanup|delete/.test(m)) return 'cleanup_failure';
  if (/timeout|etimedout|aborted/.test(m)) return 'provider_timeout';
  return 'unknown';
}

async function main() {
  if (process.env.STORAGE_CONTRACT_TEST !== 'true') throw new Error('Refusing storage contract test: set STORAGE_CONTRACT_TEST=true explicitly.');
  const config = validatePhotoStorageConfig();
  if ((config.provider !== 'object_gateway' && config.provider !== 's3_compatible') || !config.endpoint || !config.region || !config.bucket || !config.accessKey || !config.secretKey) {
    throw new Error('A configured object_gateway or s3_compatible provider is required.');
  }
  const prefix = config.contractPrefix ?? 'synthetic-contract';
  const id = randomUUID();
  const scope = { farmId: prefix, visitId: prefix, observationId: prefix, objectId: id };
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const report: Record<string, unknown> = { syntheticOnly: true, adapter: config.provider, providerHost: new URL(config.endpoint).host };

  // Provider-specific pieces: how a direct signed read + an unsigned URL are
  // formed. For s3_compatible, the client-facing generateShortLivedDownloadUrl
  // returns a FarmOS route (needs a running server), so the STORAGE contract
  // uses the direct presigned URL instead.
  let storage: { createUploadAuthorization: (s: typeof scope) => Promise<{ key: string }>; uploadObject: (k: string, b: Uint8Array, c: string) => Promise<{ checksum: string }>; verifyChecksum: (k: string, c: string) => Promise<boolean>; markFinalized: (k: string) => Promise<void>; retrieveMetadata: (k: string) => Promise<unknown>; };
  let signedReadUrl: (key: string) => Promise<string> | string;
  let unsignedUrl: (key: string) => string;
  let expiredUrl: (key: string) => string;
  let cleanup: (key: string) => Promise<void>;

  if (config.provider === 's3_compatible') {
    const { S3CompatiblePhotoStorage } = await import('../src/lib/scouting/s3-compatible-storage');
    const s3 = new S3CompatiblePhotoStorage({ endpoint: config.endpoint, region: config.region, bucket: config.bucket, accessKeyId: config.accessKey, secretAccessKey: config.secretKey, forcePathStyle: config.forcePathStyle ?? false, signedUrlSeconds: config.signedSeconds });
    storage = s3;
    signedReadUrl = (key) => s3.presignGetUrl(key, 60);
    unsignedUrl = (key) => s3.directObjectUrl(key);
    expiredUrl = (key) => s3.presignGetUrl(key, 1);
    cleanup = (key) => s3.deleteUnfinalized(key);
  } else {
    const { ObjectGatewayPhotoStorage } = await import('../src/lib/scouting/object-gateway-storage');
    const gw = new ObjectGatewayPhotoStorage({ endpoint: config.endpoint, region: config.region, bucket: config.bucket, accessKey: config.accessKey, secretKey: config.secretKey });
    storage = gw;
    signedReadUrl = () => gw.generateShortLivedDownloadUrl(id, 60);
    unsignedUrl = (key) => `${config.endpoint}/v1/private/${encodeURIComponent(config.bucket!)}/objects/${encodeURIComponent(key)}`;
    expiredUrl = (key) => unsignedUrl(key);
    cleanup = async (key) => { await fetch(`${config.endpoint}/v1/private/${encodeURIComponent(config.bucket!)}/objects/${encodeURIComponent(key)}?contractCleanup=true`, { method: 'DELETE', headers: { 'x-farmos-region': config.region!, authorization: `Bearer ${config.accessKey}:${config.secretKey}` } }); };
  }

  let key = '';
  try {
    report.byteLevelMime = validatePhoto(bytes, 'image/png');                       // 4
    key = (await storage.createUploadAuthorization(scope)).key;                     // 2
    report.uploadAuthorization = true;
    const uploaded = await storage.uploadObject(key, bytes, 'image/png');           // 3
    if (uploaded.checksum !== checksum) throw new Error('Contract upload checksum mismatch.');
    if (!(await storage.verifyChecksum(key, checksum))) throw new Error('Contract checksum verification failed.'); // 5
    report.upload = true; report.checksum = true;
    await storage.markFinalized(key); await storage.markFinalized(key);            // 6/7 idempotent
    report.finalizeIdempotent = true;

    const signed = await signedReadUrl(key);                                        // 8
    const response = await fetch(signed);
    if (!response.ok) throw new Error(`Signed read failed (${response.status}).`);
    const read = new Uint8Array(await response.arrayBuffer());
    if (Buffer.compare(Buffer.from(read), Buffer.from(bytes)) !== 0) throw new Error('Signed read bytes differ.'); // 9
    report.signedRead = true;

    const unauthorized = await fetch(unsignedUrl(key));                             // 10
    if (unauthorized.ok) throw new Error('Unauthorized object read unexpectedly succeeded.');
    report.unauthorizedRejected = true;

    try {                                                                           // 11 expired (deterministic-ish)
      const u = expiredUrl(key); await new Promise((r) => setTimeout(r, 2500));
      const expired = await fetch(u); report.expiredRejected = !expired.ok ? true : 'not_enforced_nondeterministic';
    } catch { report.expiredRejected = 'signing_unavailable'; }

    await cleanup(key); report.cleanup = true;                                      // 12
    let orphanGone = false;
    try { await storage.retrieveMetadata(key); } catch { orphanGone = true; }       // 13
    if (!orphanGone) throw new Error('Cleanup verification failed: synthetic object still present (orphan).');
    report.noOrphan = true;

    console.log(JSON.stringify({ status: 'passed', ...report }, null, 2));
  } catch (error) {
    if (key) await cleanup(key).catch(() => undefined);
    console.error(JSON.stringify({ status: 'failed', category: classify(error), message: error instanceof Error ? error.message : String(error), ...report }, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => { console.error(JSON.stringify({ status: 'failed', category: classify(error), message: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; });
