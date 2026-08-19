# Stage 18 — Offline Sync Center user-error localization report

Date: 2026-08-08

## Decision

- **Offline Sync Center user-error migration — full bounded batch GO.**
- **Application-wide user-error migration — still PARTIAL / NO-GO.**
- **Automated offline browser gate — GO.**
- **Physical iPhone/Android offline field pilot — NOT RUN / NO-GO.**

Stage 18 closes only the frozen Offline Sync Center batch. It does not claim that the whole application is localized or that physical-device offline behavior has been validated.

## Verified scope and audit delta

The pre-change machine audit found exactly 10 active user-error findings in four files: three in the Activity offline-sync route, three in the finance-sync route, two in the IndexedDB repository, and two in `OfflineQueueClient`. The targeted result is **10 → 0**. The global user-error inventory is **120 → 110**. Resolver debt remains **367**; Stage 18 introduced no resolver expansion.

Evidence snapshots are `docs/evidence/localization-user-error-findings.json`, `docs/evidence/localization-resolver-findings.json`, and `docs/Offline_Sync_Center_User_Error_Audit.md`.

## Implemented contract

Both offline POST routes now return the canonical `UserFacingError` envelope rather than final English prose. Invalid JSON and missing form data map to `INVALID_VALUE` or `REQUIRED_FIELD`; cross-user/cross-farm access maps to the deliberately non-revealing authorization boundary. `REQUEST_NOT_ALLOWED` was added to the shared allow-list and translated in nl-NL, en-GB, pl-PL and de-DE.

IndexedDB drafts gained the additive `safeError` field without a database-version or Prisma-schema change. The legacy `safeErrorMessage` field remains readable for compatibility, but legacy/server/caught prose is never rendered or persisted as trusted UI text. Unknown legacy values localize through `GENERIC`; authorization and validation failures are non-retryable, conflicts require review, and transient network failures remain retryable.

Recovery import stays atomic: invalid JSON creates no drafts and exposes no parser text. Imported regulated records retain the existing review requirement and are never auto-submitted. Successful sync clears structured error state. Existing exact-one/idempotency, user/farm ownership, cross-tab locking, Service Worker lifecycle and recovery behavior were preserved.

## Automated evidence

### Focused gate

`npx playwright test e2e/i18n-offline-sync-center-errors.spec.ts --workers=1 --retries=0`

- 8 collected and passed (global setup plus 7 browser tests)
- 0 skipped / failed / flaky; retries 0
- 1.5 minutes; exit code 0

An earlier focused attempt exposed a test-only alert-selector ambiguity and an IndexedDB inspection helper that could create an empty database. The test was corrected to target the owned alert and avoid database creation; application behavior was not weakened.

### Relevant offline regression gate

Actual files: `sprint20-offline-sync.spec.ts`, `i18n-activity-quick-log-core-errors.spec.ts`, `sprint23-workorder-lifecycle.spec.ts`, `sprint27-scouting.spec.ts`, and `locale-hydration.spec.ts`.

- 29 collected / 29 passed
- 0 skipped / failed / flaky; retries 0
- 284.5 seconds (summary 4.6 minutes); exit code 0

This covers Activity/Quick Log localization, offline exact-one behavior, Work Order offline completion, scouting queue/retry, Service Worker availability/no API caching, mobile layouts, and locale hydration. No IndexedDB cross-user/farm leakage or Service Worker state leakage was observed.

### Full E2E

Required clean run: `npx playwright test --workers=1 --retries=0`.

- collected: 210
- passed: 209
- skipped: 1 conditional skip
- failed / flaky / retries: 0 / 0 / 0
- duration: 1,393.6 seconds (23 minutes 13.6 seconds)
- exit code: 0

The immediately preceding full attempt collected 210 and exited 1 after 1,497.1 seconds. Its sole failure was infrastructure: WebKit exited during `browserType.launch` before the mobile critical-flow steps ran (`Target page, context or browser has been closed`, process exit `3236495362`). No code or test behavior was changed; the complete clean rerun passed.

The fixed pool remained the existing **5 Clerk tenant users / 4 configured test identities before and after**. Setup reused those identities; no throwaway-user creation path ran and no new user was created. End-of-test Clerk FAPI messages were cleanup infrastructure noise and did not fail a scenario.

The clean serial suite reset its isolated E2E database and browser state. No evidence of IndexedDB leakage between users/farms or Service Worker leakage between runs was found. Playwright's server shut down and left no listener on port 3100.

## Non-browser validation

- Prisma Client generation: PASS.
- Prisma status: PASS; 22 migrations, schema up to date.
- TypeScript: PASS.
- Unit: **1031/1031 PASS**, 96 files, 63.87 seconds.
- Production build: PASS on Next.js 16.2.9; one existing unrelated NFT trace warning remains.
- i18n validation: PASS for four locales and nine namespaces; one existing Dutch economics warning remains.
- Audit evidence regenerated: user errors 110; resolvers 367.

## Physical-device boundary

Not run on a physical iPhone or Android device: install/update behavior, background/foreground transitions, airplane-mode capture, OS eviction/storage pressure, real Safari storage/lease behavior, camera/photo recovery, prolonged offline queueing, sign-out/sign-in under unstable radio conditions, and recovery after an interrupted Service Worker update. The physical offline field pilot remains explicitly **NO-GO** until both phone classes pass the field checklist.

## Next bounded batch

The next candidate must be selected from fresh evidence. The current leading bounded alternative is Fields (seven findings), with Scouting action/sync another physical-device-relevant candidate. Neither is included in Stage 18.
