import { describe, it, expect, vi, beforeEach } from 'vitest';
// The adapter + token modules are server-only; stub the marker for node tests.
vi.mock('server-only', () => ({}));

import { validatePhotoStorageConfig } from '../storage-config';
import { signPhotoRead, verifyPhotoRead } from '../photo-read-token';
import { S3CompatiblePhotoStorage } from '../s3-compatible-storage';

const base = {
  SCOUTING_PHOTO_STORAGE_PROVIDER: 's3_compatible',
  SCOUTING_PHOTO_ENDPOINT: 'https://s3.eu-west-1.provider.test',
  SCOUTING_PHOTO_REGION: 'eu-west-1',
  SCOUTING_PHOTO_BUCKET: 'farmos-scouting-private',
  SCOUTING_PHOTO_ACCESS_KEY: 'AKIAREALKEYID',
  SCOUTING_PHOTO_SECRET_KEY: 'realsecretaccesskey',
} as unknown as NodeJS.ProcessEnv;

// ─── Config validation (Parts 3-4; tests 1-6) ────────────────────────────────
describe('s3_compatible config validation', () => {
  it('1 — selects s3_compatible and parses the new vars', () => {
    const c = validatePhotoStorageConfig({ ...base, SCOUTING_PHOTO_FORCE_PATH_STYLE: 'true', SCOUTING_PHOTO_MAX_UPLOAD_BYTES: '5242880', SCOUTING_PHOTO_CONTRACT_PREFIX: 'synthetic-contract' });
    expect(c.provider).toBe('s3_compatible');
    expect(c.forcePathStyle).toBe(true);
    expect(c.maxUploadBytes).toBe(5242880);
    expect(c.contractPrefix).toBe('synthetic-contract');
    expect(c.endpoint).toBe('https://s3.eu-west-1.provider.test');
  });
  it('2 — production rejects local and any in_memory/unknown provider', () => {
    expect(() => validatePhotoStorageConfig({ NODE_ENV: 'production', SCOUTING_PHOTO_STORAGE_PROVIDER: 'local' } as NodeJS.ProcessEnv)).toThrow(/shared|requires/i);
    expect(() => validatePhotoStorageConfig({ NODE_ENV: 'production', SCOUTING_PHOTO_STORAGE_PROVIDER: 'in_memory' } as NodeJS.ProcessEnv)).toThrow(/Unsupported/i);
  });
  it('3 — missing credentials rejected', () => {
    const { SCOUTING_PHOTO_ACCESS_KEY: _omit, ...noKey } = base as Record<string, string>;
    expect(() => validatePhotoStorageConfig(noKey as NodeJS.ProcessEnv)).toThrow(/ACCESS_KEY is required/);
  });
  it('4 — placeholder credentials rejected', () => {
    expect(() => validatePhotoStorageConfig({ ...base, SCOUTING_PHOTO_SECRET_KEY: 'change-me' })).toThrow(/placeholder/i);
  });
  it('5 — insecure HTTP endpoint rejected', () => {
    expect(() => validatePhotoStorageConfig({ ...base, SCOUTING_PHOTO_ENDPOINT: 'http://s3.eu-west-1.provider.test' })).toThrow(/HTTPS/i);
  });
  it('6 — signed lifetime outside 60–900 rejected', () => {
    expect(() => validatePhotoStorageConfig({ ...base, SCOUTING_PHOTO_SIGNED_SECONDS: '1200' })).toThrow(/60–900|lifetime/);
    expect(() => validatePhotoStorageConfig({ ...base, SCOUTING_PHOTO_SIGNED_SECONDS: '30' })).toThrow(/60–900|lifetime/);
  });
});

// ─── FarmOS signed-read token (tests 7, 8, 14) ───────────────────────────────
describe('private signed-read token', () => {
  it('7 — private key generation produces a verifiable HMAC signature', () => {
    const t = signPhotoRead('photo-1', 300);
    expect(t.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyPhotoRead('photo-1', t.exp, t.signature)).toBe(true);
  });
  it('8 — tampered or expired access is rejected', () => {
    const t = signPhotoRead('photo-1', 300);
    const tampered = t.signature.slice(0, -1) + (t.signature.endsWith('0') ? '1' : '0'); // guaranteed different
    expect(verifyPhotoRead('photo-1', t.exp, tampered)).toBe(false); // tampered
    expect(verifyPhotoRead('photo-1', Math.floor(Date.now() / 1000) - 10, t.signature)).toBe(false); // expired
  });
  it('14 — a signature never authorizes a different photo; the storage key is not involved', () => {
    const t = signPhotoRead('photo-A', 300);
    expect(verifyPhotoRead('photo-B', t.exp, t.signature)).toBe(false); // per-photoId, not per storage key
  });
});

// ─── S3 adapter with mocked fetch (tests 9-13) ───────────────────────────────
type Call = { url: string; method: string; headers: Record<string, string> };
function mockResponse(status: number, opts: { headers?: Record<string, string>; body?: Uint8Array } = {}) {
  const body = opts.body ?? new Uint8Array();
  return {
    ok: status >= 200 && status < 300, status,
    headers: { get: (k: string) => opts.headers?.[k.toLowerCase()] ?? null },
    arrayBuffer: async () => new Uint8Array(body).buffer,
  };
}
function installFetch(handler: (call: Call) => ReturnType<typeof mockResponse>) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const call: Call = { url: String(url), method: init.method ?? 'GET', headers: (init.headers as Record<string, string>) ?? {} };
    calls.push(call); return handler(call);
  }));
  return calls;
}
const s3 = () => new S3CompatiblePhotoStorage({ endpoint: 'https://s3.test', region: 'eu-west-1', bucket: 'b', accessKeyId: 'AK', secretAccessKey: 'SK', forcePathStyle: true, signedUrlSeconds: 300 });

describe('S3CompatiblePhotoStorage', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('presignGetUrl is a SigV4 query-signed URL with a clamped expiry', () => {
    const url = new URL(s3().presignGetUrl('b-key/x.original', 5000));
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Credential')).toMatch(/^AK\/\d{8}\/eu-west-1\/s3\/aws4_request$/);
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(url.searchParams.get('X-Amz-Expires'))).toBe(900); // clamped from 5000
  });

  it('client-facing signed URL is the FarmOS route, never a raw S3 URL/key', async () => {
    const url = await s3().generateShortLivedDownloadUrl('photo-9', 300);
    expect(url).toMatch(/^\/api\/scouting\/photos\/photo-9\?exp=\d+&signature=[0-9a-f]{64}$/);
    expect(url).not.toContain('s3.test');
    expect(url).not.toContain('X-Amz');
  });

  it('10 — a lost-response retry re-PUTs the SAME deterministic key (exact-one object)', async () => {
    const calls = installFetch(() => mockResponse(200));
    const storage = s3();
    const { key } = await storage.createUploadAuthorization({ farmId: 'f', visitId: 'v', observationId: 'o', objectId: 'fixed-id' });
    const bytes = new Uint8Array([1, 2, 3]);
    await storage.uploadObject(key, bytes, 'image/png');
    await storage.uploadObject(key, bytes, 'image/png'); // retry after a "lost response"
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts[0].url).toBe(puts[1].url); // same object key → no duplicate
    expect(puts[0].url).toContain('/b/f/v/o/fixed-id.original');
  });

  it('9 — markFinalized is idempotent (HEAD verify, no duplicate write)', async () => {
    const calls = installFetch(() => mockResponse(200));
    const storage = s3();
    await storage.markFinalized('f/v/o/x.original');
    await storage.markFinalized('f/v/o/x.original');
    expect(calls.every((c) => c.method === 'HEAD')).toBe(true);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
  });

  it('11 — provider outage is classified as a safe unavailable error', async () => {
    installFetch(() => mockResponse(503));
    await expect(s3().uploadObject('k', new Uint8Array([1]), 'image/png')).rejects.toThrow(/unavailable/i);
  });

  it('12 — cleanup delete is idempotent (404 does not throw)', async () => {
    installFetch(() => mockResponse(404));
    await expect(s3().deleteUnfinalized('k')).resolves.toBeUndefined();
  });

  it('13 — finalized evidence is protected: cannot finalize a missing object; checksum verified from metadata', async () => {
    installFetch(() => mockResponse(404));
    await expect(s3().markFinalized('missing')).rejects.toThrow(/not found/i);
    // verifyChecksum reads the stored sha256 from HEAD metadata.
    installFetch(() => mockResponse(200, { headers: { 'x-amz-meta-sha256': 'abc123' } }));
    expect(await s3().verifyChecksum('k', 'abc123')).toBe(true);
    expect(await s3().verifyChecksum('k', 'wrong')).toBe(false);
  });
});
