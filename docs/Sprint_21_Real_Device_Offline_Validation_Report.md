# Sprint 21 Real Device Offline Validation Report

## Decision

- Online desktop pilot: retains the prior separate readiness decision; Sprint 21 made no claim about production deployment.
- Offline field pilot: **NO-GO pending physical validation**.
- Reason: the mandatory Android/iPhone real-phone golden flow, production-like deployment, session-expiry recovery and comprehension test have not been physically executed. Automated tests cannot satisfy this gate.

## Devices and network scenarios

Physically tested devices: none recorded. Android Chrome/PWA and iPhone Safari/Add to Home Screen remain unverified. All ten network scenarios and app lifecycle cases remain pending in `Sprint_21_Real_Device_Results.md`.

## Hardening implemented

- Cross-tab queue lock uses Web Locks where available and a short localStorage lease fallback; server idempotency remains the exact-once boundary.
- `/offline` exposes IndexedDB availability, persistence request/grant, browser quota estimate, local counts, last sync and service-worker version.
- Denied persistence produces an explicit durability warning.
- Local recovery export is versioned and contains no auth token. Import validates schema and namespace and always becomes `needs_review`; it never auto-submits.
- Queue items show position, type, field reference, timestamps, attempts, status, safe error, recovery export and explicit discard confirmation.
- Support diagnostics contain a random per-tab device session ID, app/SW/schema versions, storage and counts, but no notes, certificates, product payload, token or location.
- `verify:offline-sync` reports farm-scoped exact-one effects and refuses production unless explicitly authorized.

## Golden flow, lifecycle, session and comprehension

Unverified on physical devices. Expected wording distinguishes “Saved on this device”, “Waiting to synchronize”, “Synchronizing”, “Synced with FarmOS”, conflict and retry states. Authentication failures preserve local drafts; physical expired-Clerk-session behavior must still be recorded.

## Bugs and regression tests

Pre-device audit found a P1-class multi-tab processing gap and storage/recovery visibility gaps. Hardening was added before physical testing. Automated coverage includes versioned recovery, mandatory needs-review import, namespace rejection, malformed import and persistence denial. Device-specific failures discovered during the matrix must receive additional tests.

## Remaining limitations

Safari storage eviction/private mode, OS process killing, actual PWA installation/update, Wi-Fi/mobile handoff, long background suspension, production Clerk configuration and human comprehension cannot be established from this machine alone.

## Readiness score

Offline-field readiness is deliberately capped at **60/100** until the physical golden flow and exact-one database evidence pass on the supported target(s). GO requires zero open P0/P1 plus every Part 21 criterion in the sprint specification.

## Automated validation — 15 July 2026

Final validation results:

| Check | Result |
|---|---|
| `prisma generate` | Pass; Prisma Client 5.22.0 generated after stopping the process that held the Windows query-engine DLL |
| `prisma migrate status` | Pass; 8 migrations, database schema up to date |
| `tsc --noEmit` | Pass |
| `vitest run` | **401/401 pass**, 44 files, 34.62 s final run |
| `npm run build` | Pass; Next.js 16.2.9 production build and build-time TypeScript pass |
| First clean full E2E | **57/57 pass**, exit 0, 435.7 s |
| Consecutive stability run A | **57/57 pass**, exit 0 |
| Consecutive stability run B | **57/57 pass**, exit 0 |
| Stability pair duration | **933.9 s combined**, uninterrupted in one command with no source/config change between runs |

The command transport retained the exact combined duration but truncated the two individual duration marker lines because Playwright/Clerk emitted more than 10,000 output tokens. No individual duration is invented here; both individual exit codes and test counts were successful.

### Failure classification before the clean runs

- `Failed to fetch testing token from Clerk API`: Clerk/network infrastructure; application tests did not start.
- Two `net::ERR_NETWORK_CHANGED` navigation failures: host/network infrastructure; application assertions were not reached.
- Cross-farm machine test temporarily saved locally instead of reaching its server assertion while the browser reported unstable connectivity: network infrastructure; offline behavior was correct.
- Two mobile failures expected the old button name “Delete all drafts on this device”: test defect after intentional clarity wording changed to “Delete all local drafts”. Only the stale accessible-name assertion was fixed.
- `verify:offline-sync` initially used top-level await under CJS `tsx`: validation-script defect; wrapped in `main()` and retested.
- No application defect was identified by these failed attempts.

### Clerk pool and repeat-run isolation

Read-only Clerk counts immediately before and after the clean/stability sequence were identical: **5 total users, 4/4 configured fixed-pool users**. New users created: **0**. The global setup reused and reset the fixed identities.

Both consecutive runs passed the service-worker test and the offline draft test from a clean Playwright browser lifecycle. The offline test asserted exactly one IndexedDB draft after creation on every run; a leaked prior draft would have failed that assertion. No service-worker state or IndexedDB data leaked across runs. This is browser-automation evidence, not physical Safari/Chrome storage evidence.

### Targeted safety evidence

- Cross-tab locking: unit test 36 simulates an unavailable Web Lock and proves the second context cannot execute queue work. Server action idempotency tests prove a repeated `localDraftId`/idempotency key returns the original activity without duplicate effects. The three clean full-suite runs include the offline sync path. A physical two-tab mobile retest remains required.
- Safari fallback: unit test 37 proves an expired localStorage lease is replaced, queue work resumes and the lease is released.
- Recovery JSON: tests 31–34 cover version/local ID retention, namespace rejection and malformed input. Test 32 explicitly proves an imported regulated item becomes `needs_review` and `canAttempt()` is false, so it cannot auto-submit.
- Account isolation: storage test 6 proves a signed-out namespace cannot read the prior namespace; sync tests 28–29 prove a different user cannot send the queued item. Full E2E also passes sign-out and cross-farm isolation flows.
- Persistence denial: test 35 proves denied persistence is represented as `persistenceGranted: false`; `/offline` conditionally renders the durability warning and the production build validates that UI. Physical browser wording/comprehension remains unverified.
- Service-worker update safety: `sw.js` changes only named static caches and never opens/deletes IndexedDB; authenticated HTML/API data remains uncached. The repeated service-worker/offline tests passed without draft loss. Actual installed-PWA update on Android/iPhone remains unverified.
- Unsafe production verification: with `NODE_ENV=production` and no override, `verify:offline-sync` exits non-zero with “Refusing production diagnostics without ALLOW_PRODUCTION_OFFLINE_VERIFY=true.” Farm scoping is also mandatory through `OFFLINE_VERIFY_FARM_ID`.

### Remaining physical-device gate

Still unverified: Android Chrome browser and installed PWA; iPhone Safari and Add to Home Screen; airplane-mode launch; connection loss during entry/after Save; committed-response loss; alternating networks; Wi-Fi/mobile handoff; slow/DNS timeout; hours-offline reopen; 1/30-minute lock; background/OS kill/force-close/restart/low power/storage pressure; real Clerk session expiry; installed-PWA update with an unsynced draft; human comprehension and trust; production-like pilot deployment.

Therefore the offline field pilot remains an explicit **NO-GO** until the mandatory golden flow passes on a physical phone with exact-one Activity, StockMovement, ComplianceRecord and correlated AuditEvent evidence and no unresolved P0/P1 issues. Sprint 21 is not marked complete from automation alone.
