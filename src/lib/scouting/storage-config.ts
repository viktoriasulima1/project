export type PhotoStorageProvider = 'local' | 'unavailable' | 'object_gateway' | 's3_compatible';
export type PhotoStorageConfig = {
  provider: PhotoStorageProvider;
  endpoint?: string; region?: string; bucket?: string; accessKey?: string; secretKey?: string;
  forcePathStyle?: boolean; maxUploadBytes?: number; contractPrefix?: string;
  signedSeconds: number; retentionDays: number;
};

// Default max upload, in bytes — mirrors PHOTO_LIMITS.maxOriginalBytes (8 MB).
const DEFAULT_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export function validatePhotoStorageConfig(env: NodeJS.ProcessEnv = process.env): PhotoStorageConfig {
  const provider = (env.SCOUTING_PHOTO_STORAGE_PROVIDER ?? (env.NODE_ENV === 'production' ? 'unavailable' : 'local')) as PhotoStorageProvider;
  if (!['local', 'unavailable', 'object_gateway', 's3_compatible'].includes(provider)) throw new Error('Unsupported scouting photo storage provider.');
  // Both object_gateway and s3_compatible are shared, multi-node production
  // adapters; local/in-memory/unavailable are rejected in production.
  const shared = provider === 'object_gateway' || provider === 's3_compatible';
  if (env.NODE_ENV === 'production' && !shared) throw new Error('Production requires a shared object_gateway or s3_compatible photo provider; local/in-memory/unavailable adapters are rejected.');

  const signedSeconds = Number(env.SCOUTING_PHOTO_SIGNED_SECONDS ?? 300), retentionDays = Number(env.SCOUTING_PHOTO_RETENTION_DAYS ?? 365);
  if (!Number.isFinite(signedSeconds) || signedSeconds < 60 || signedSeconds > 900) throw new Error('Signed photo lifetime must be 60–900 seconds.');
  if (!Number.isFinite(retentionDays) || retentionDays < 1) throw new Error('Photo retention policy must be configured.');

  if (shared) {
    for (const key of ['SCOUTING_PHOTO_ENDPOINT', 'SCOUTING_PHOTO_REGION', 'SCOUTING_PHOTO_BUCKET', 'SCOUTING_PHOTO_ACCESS_KEY', 'SCOUTING_PHOTO_SECRET_KEY'] as const)
      if (!env[key] || /placeholder|change-?me|example/i.test(env[key]!)) throw new Error(`${key} is required and may not use placeholder credentials.`);
    if (env.SCOUTING_PHOTO_BUCKET_PUBLIC === 'true') throw new Error('Public scouting photo buckets are forbidden.');
    const endpoint = new URL(env.SCOUTING_PHOTO_ENDPOINT!); if (endpoint.protocol !== 'https:') throw new Error('Production photo endpoint must use HTTPS.');
    const maxUploadBytes = Number(env.SCOUTING_PHOTO_MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES);
    if (!Number.isFinite(maxUploadBytes) || maxUploadBytes <= 0) throw new Error('Maximum upload size must be a positive number of bytes.');
    return {
      provider, endpoint: endpoint.origin, region: env.SCOUTING_PHOTO_REGION, bucket: env.SCOUTING_PHOTO_BUCKET,
      accessKey: env.SCOUTING_PHOTO_ACCESS_KEY, secretKey: env.SCOUTING_PHOTO_SECRET_KEY,
      forcePathStyle: env.SCOUTING_PHOTO_FORCE_PATH_STYLE === 'true', maxUploadBytes,
      contractPrefix: env.SCOUTING_PHOTO_CONTRACT_PREFIX ?? 'synthetic-contract', signedSeconds, retentionDays,
    };
  }
  return { provider, signedSeconds, retentionDays };
}
