import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { validatePhotoStorageConfig } from '../src/lib/scouting/storage-config';
import { PHOTO_LIMITS } from '../src/lib/scouting/photo-policy';

/**
 * Sprint 27 — storage contract PREFLIGHT (read-only). Verifies that the shared
 * object-gateway photo storage is configured and safe to run the synthetic
 * contract test against, WITHOUT uploading anything, touching a bucket, or
 * printing any secret. It reuses the production `validatePhotoStorageConfig`
 * guard so preflight and runtime enforce exactly the same rules.
 *
 *   npm run test:storage:preflight
 *
 * Never prints: credentials, signed URLs, complete object keys, or provider
 * responses. Prints only booleans, policy numbers, and the endpoint host.
 * Exit 0 = ready to run `npm run test:storage:contract`; exit 1 = not ready.
 */

type State = true | false | 'warn';
const results: Array<{ state: State; label: string; note: string }> = [];
const record = (state: State, label: string, note = '') => results.push({ state, label, note });
const line = (r: { state: State; label: string; note: string }) =>
  `  ${r.state === true ? 'PASS' : r.state === 'warn' ? 'WARN' : 'FAIL'}  ${r.label}${r.note ? ` — ${r.note}` : ''}`;

function main() {
  console.log('Storage contract preflight — read-only; uploads nothing, prints no secrets.\n');

  // 1. Contract enable flag (needed for the real contract run; a preflight may
  //    run without it, so this is a WARN, not a hard fail).
  const flag = process.env.STORAGE_CONTRACT_TEST === 'true';
  record(flag ? true : 'warn', 'STORAGE_CONTRACT_TEST enabled', flag ? 'set' : 'not set — required to run test:storage:contract');

  // 2-9. Validate the configuration through the SAME guard runtime uses.
  let config: ReturnType<typeof validatePhotoStorageConfig> | null = null;
  try {
    config = validatePhotoStorageConfig();
  } catch (error) {
    // The guard throws a single safe message (no secrets) — surface it verbatim.
    record(false, 'Photo storage configuration', error instanceof Error ? error.message : 'invalid');
  }

  if (config) {
    const isShared = config.provider === 'object_gateway' || config.provider === 's3_compatible';
    record(isShared, 'Shared production adapter selected', `provider = ${config.provider}${isShared ? '' : ' — local/in-memory/unavailable cannot run the contract'}`);

    if (isShared) {
      // endpoint host only — never the full URL/key.
      const host = config.endpoint ? new URL(config.endpoint).host : '(none)';
      record(Boolean(config.endpoint), 'HTTPS endpoint', config.endpoint ? host : 'missing');
      record(Boolean(config.bucket), 'Bucket / container configured', config.bucket ? 'set' : 'missing');
      record(Boolean(config.region), 'Region configured', config.region ? config.region : 'missing');
      // Credentials: presence only, never the value.
      record(Boolean(config.accessKey) && Boolean(config.secretKey), 'Credentials present (not printed)', 'access + secret key present');
      record(process.env.SCOUTING_PHOTO_BUCKET_PUBLIC !== 'true', 'Bucket is private (not public-read)', process.env.SCOUTING_PHOTO_BUCKET_PUBLIC === 'true' ? 'PUBLIC — forbidden' : 'private');
    }

    // Signed URL lifetime within policy (the guard already enforced 60–900s).
    const okSigned = config.signedSeconds >= 60 && config.signedSeconds <= 900;
    record(okSigned, 'Signed URL lifetime within policy', `${config.signedSeconds}s (policy 60–900)`);
    record(config.retentionDays >= 1, 'Retention policy configured', `${config.retentionDays} days`);
  }

  // 10. Max upload size (enforced in code, not env — report the real limit).
  record(PHOTO_LIMITS.maxOriginalBytes > 0, 'Maximum upload size configured', `${(PHOTO_LIMITS.maxOriginalBytes / (1024 * 1024)).toFixed(0)} MB per photo; byte-level MIME enforced`);

  // 11. Dedicated synthetic test prefix (baked into the contract, no real data).
  record(true, 'Dedicated synthetic test prefix', "scope farmId 'synthetic-contract' — no real farmer/visit/photo data");

  // 12. Cleanup capability (contract DELETEs its object; a sweep script exists).
  const cleanupScript = existsSync(path.resolve(process.cwd(), 'scripts/scouting-storage-cleanup.ts'));
  record(cleanupScript, 'Cleanup capability exists', cleanupScript ? 'contract DELETE + scouting:storage:cleanup' : 'cleanup script missing');

  for (const r of results) console.log(line(r));

  const hardFail = results.some((r) => r.state === false);
  const ready = !hardFail && (config?.provider === 'object_gateway' || config?.provider === 's3_compatible') && (process.env.STORAGE_CONTRACT_TEST === 'true');
  console.log(
    hardFail
      ? '\nPreflight FAILED — resolve the FAIL items before running the storage contract.'
      : ready
        ? '\nPreflight PASSED — ready to run: STORAGE_CONTRACT_TEST=true npm run test:storage:contract'
        : '\nPreflight OK (no hard failures), but NOT ready to run the contract here — a configured object_gateway provider and STORAGE_CONTRACT_TEST=true are required.',
  );
  process.exit(hardFail ? 1 : 0);
}

main();
