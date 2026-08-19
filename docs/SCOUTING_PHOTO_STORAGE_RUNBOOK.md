# Scouting photo storage runbook

How the private scouting-photo storage is configured, preflighted, contract-
tested, and kept production-safe. Sprint 27 certification prep (2026-07-21).

## 1. Environment contract

Server-only variables (never exposed to the client, never printed):

| Variable | Meaning | Rule (enforced by `validatePhotoStorageConfig`) |
| --- | --- | --- |
| `SCOUTING_PHOTO_STORAGE_PROVIDER` | `local` \| `unavailable` \| `object_gateway` \| `s3_compatible` | Production **must** be `object_gateway` or `s3_compatible`; `local`/`in_memory`/`unavailable` rejected |
| `SCOUTING_PHOTO_ENDPOINT` | S3/gateway base URL | Required; **HTTPS only** |
| `SCOUTING_PHOTO_FORCE_PATH_STYLE` | `true`/`false` (s3_compatible) | Path-style addressing (MinIO/Ceph); default false |
| `SCOUTING_PHOTO_MAX_UPLOAD_BYTES` | Max per-photo bytes | Positive; default 8 MB |
| `SCOUTING_PHOTO_CONTRACT_PREFIX` | Synthetic contract scope | Default `synthetic-contract`; distinct from real photos |
| `SCOUTING_PHOTO_REGION` | Region | Required |
| `SCOUTING_PHOTO_BUCKET` | Private bucket/container | Required |
| `SCOUTING_PHOTO_BUCKET_PUBLIC` | Public-read flag | `true` is **forbidden** |
| `SCOUTING_PHOTO_ACCESS_KEY` / `SCOUTING_PHOTO_SECRET_KEY` | Credentials | Required; **placeholder/`example`/`change-me` rejected** |
| `SCOUTING_PHOTO_SIGNED_SECONDS` | Signed-read lifetime | **60–900 s** (default 300) |
| `SCOUTING_PHOTO_RETENTION_DAYS` | Retention policy | ≥ 1 (default 365) |
| `SCOUTING_PHOTO_SIGNING_SECRET` | Private-read signing secret | Required in production |
| `STORAGE_CONTRACT_TEST` | Contract-test opt-in | Must be `true` to run the contract |

Non-env limits (enforced in code, `photo-policy.ts`): **8 MB** max per photo,
byte-level MIME detection (JPEG/PNG/WebP), max 5 photos/observation, 20/visit,
100 MB local budget, 6000 px max dimension, 300 s signed read.

## 1a. Supported provider paths (Part 2)

Two shared production providers implement the **same** `PrivatePhotoStorage`
domain interface, so scouting domain services never change to switch providers:

**`s3_compatible` (direct — new, Sprint 27).**
`src/lib/scouting/s3-compatible-storage.ts` is a **direct S3 client with a
self-contained AWS Signature V4 signer** (`node:crypto`, no SDK). It works
against AWS S3, MinIO, Ceph RGW, Cloudflare R2, Backblaze B2 as the shared
multi-node backing store. It provides: `createUploadAuthorization` (deterministic
key), signed `PUT`/`GET`/`HEAD`/`DELETE`, SHA-256 stored as `x-amz-meta-sha256`
for checksum verification, **idempotent finalize** (HEAD-verify; the DB is the
finalization authority), idempotent delete (404-tolerant), a direct **presigned
GET** URL (contract only), and 503/500→"provider unavailable" outage
classification. **All vendor config (endpoint, region, `forcePathStyle`, SigV4)
lives in this adapter** — no vendor logic leaks into domain services.

**`object_gateway` (indirect).** `object-gateway-storage.ts` is a FarmOS
gateway-protocol client (`/v1/private/{bucket}/objects/{key}`, bearer auth) for a
deployment that fronts the bucket with a FarmOS gateway service.

**Private-access model (both):** the client-facing `generateShortLivedDownloadUrl`
returns the **FarmOS internal route** `/api/scouting/photos/{id}?exp&signature`
(HMAC-signed, ownership re-checked in the route), which streams bytes server-side
via `readObject`. A raw S3 URL, presigned URL, or storage key is **never** handed
to a client and never appears in a report. The direct presigned URL exists only
inside the storage contract.

`.env.storage-contract.example` lists every variable with placeholders (and the
canonical `PHOTO_STORAGE_*` names in brackets); copy it to a git-ignored
`.env.storage-contract` for a local contract run.

## 2. Preflight (read-only) — `npm run test:storage:preflight`

`scripts/storage-preflight.ts` verifies readiness **without uploading anything**
and **without printing any secret** (endpoint host + booleans + policy numbers
only). It reuses the same `validatePhotoStorageConfig` guard the runtime uses, so
preflight and runtime never diverge. Checks:

- `STORAGE_CONTRACT_TEST` set (WARN if not — needed to run the contract);
- shared `object_gateway` adapter selected (local/in-memory ⇒ FAIL);
- HTTPS endpoint present (host only shown); bucket + region configured;
- credentials present (boolean only, never the value); bucket is private;
- signed lifetime within 60–900 s; retention configured;
- max upload size configured (8 MB, byte-level MIME);
- dedicated synthetic test prefix (`synthetic-contract`);
- cleanup capability exists (contract DELETE + `scouting:storage:cleanup`).

Exit 0 = ready to run the contract; exit 1 = not ready. **In this environment
the preflight exits 1** because no `object_gateway` provider is configured (the
honest, correct read-only result). The PASS path was verified with simulated
non-secret dummy config (all checks PASS, exit 0, endpoint host only shown).

## 3. Contract test — `STORAGE_CONTRACT_TEST=true npm run test:storage:contract`

`scripts/storage-provider-contract.ts` — **gated, synthetic-only, not in normal
CI.** Uses one generated valid PNG under the `synthetic-contract` prefix — no
real farmer data, no real `ScoutingVisit`, no user photo. Steps:

1. Create upload authorization · 2. Upload synthetic image · 3. **Byte-level
MIME** (`validatePhoto`) · 4. Checksum match + verify · 5. Finalize once ·
6. Finalize again (idempotent) · 7. Short-lived signed read · 8. Read exact bytes
· 9. Unauthorized direct read rejected · 10. Expired access rejected (best-effort
/ where deterministic) · 11. Delete the synthetic object · 12. Verify cleanup ·
13. Verify **no orphan** remains.

**Failure classification** (printed as machine-readable JSON `{status,category,
message}`): `configuration`, `authentication`, `authorization`,
`endpoint_unavailable`, `bucket_unavailable`, `checksum_mismatch`,
`signing_failure`, `cleanup_failure`, `provider_timeout`, `unknown`.

**Status: NOT RUN against a real provider** (none configured here). Ready to run
once a real object gateway is provisioned and the preflight passes.

## 4. Production storage safety (enforced + unit-tested)

`validatePhotoStorageConfig` rejects, at startup, every unsafe configuration:

| Rejected | Enforcement | Unit test (`final-closure.test.ts`) |
| --- | --- | --- |
| Local filesystem adapter (prod) | provider must be `object_gateway` | ✓ "rejects local adapter in production" |
| In-memory / `unavailable` adapter (prod) | same guard | ✓ (same guard) |
| Public-read bucket | `SCOUTING_PHOTO_BUCKET_PUBLIC=true` forbidden | ✓ "rejects a detectably public bucket" |
| Insecure HTTP endpoint | `protocol !== 'https:'` | enforced in code |
| Placeholder credentials | `/placeholder\|change-me\|example/i` rejected | ✓ "rejects placeholders" |
| Excessive signed lifetime | > 900 s rejected | enforced (bounds 60–900) |
| Non-finite signed lifetime | rejected | ✓ "rejects non-finite signed lifetime" |
| Missing region / bucket | required keys checked | enforced in code |
| Missing retention policy | `retentionDays ≥ 1` required | enforced in code |

The `s3_compatible` adapter enforces the same at the request layer (503/500 →
"provider unavailable"), and its selection/rejection/idempotency/outage/cleanup
behaviour is unit-tested in `src/lib/scouting/__tests__/s3-storage.test.ts` (16
tests). Config validation for both shared providers is tested in
`final-closure.test.ts`.

**Graceful degradation:** `configuredPhotoStorage()` returns
`UnavailablePhotoStorage` when the provider is `unavailable`, so a provider
outage yields a **safe unavailable state** rather than crashing scouting or
unrelated modules. `classifyPhotoFailure` marks a 503 as
`provider_unavailable, retryable` and an invalid-MIME 400 as **not** retryable —
unit-tested. A provider failure never deletes stock, compliance, or economics
data.

## 5. Pilot pre-checks (before any real photos)

Configure a dedicated private prefix; confirm encryption at rest + public-access
blocking at the provider; `npm run test:storage:preflight` (exit 0); then
`STORAGE_CONTRACT_TEST=true npm run test:storage:contract` (JSON `status:passed`);
inspect the authenticated storage diagnostic; `npm run scouting:storage:cleanup`
dry-run; perform a restore drill; record provider / lifecycle / encryption
evidence. **None of these have been run against a real provider yet.**
