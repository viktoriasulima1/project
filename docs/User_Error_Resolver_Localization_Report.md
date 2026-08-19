# User Error Resolver Localization Report

## Stage 16 addendum (2026-08-03)

Bounded GO: target 2 → 0; user errors 122 → 120; resolvers 367 → 367; unit 1022/1022; focused 9/9; regression 35/35; full E2E 203 collected / 202 passed / one conditional skip / zero failed or flaky. Application-wide migration remains NO-GO.

## Stage 15 addendum (2026-08-02)

Activities / Quick Log core is bounded GO: target 9 → 0; user errors 131 → 122; resolvers 373 → 367; unit 1014/1014; focused 6/6; regression 38/38; full E2E 195 collected / 194 passed / one conditional skip / zero failed or flaky. Application-wide migration remains NO-GO.

## Stage 13 addendum (2026-08-01)

Work Order user-error batch: GO. Unit 1002/1002; focused E2E 7/7; Sprint 23 13/13; related 8/8; full E2E 184 collected / 183 passed / one conditional skip / zero failed or flaky. Clerk remained 5 total / 4 fixed-pool. Global user-error migration remains PARTIAL / NO-GO at 135 findings.

## Stage 12 inventory update

No production error contract changed. All 150 residual findings are classified and grouped into bounded batches; 146 remain active. Browser tests were not rerun for this tooling/docs-only stage. Last clean evidence remains 178 collected / 177 passed / one conditional skip / zero failed.

Date: 2026-08-01

## Status

- Shared canonical User Error contract: GO.
- Onboarding error migration: GO.
- Application-wide User Error migration: PARTIAL / NO-GO.
- Global resolver localization: NO-GO.

The stage cannot honestly be called full GO because the focused active audit ends at 150 rather than zero.

## Delivered scope

- Canonical code/category/retryability/field/metadata/correlation contract.
- Safe Prisma and unknown-error mapping without raw canonical payload leakage.
- Shared React-free four-locale display adapter with accessible announcement and localized actions.
- Onboarding farm/inventory/employee actions return codes rather than English or raw Zod field messages.
- Dutch and Polish Onboarding field errors use `aria-describedby`; 390×844 Polish layout has no overflow.
- Focused `user-errors` audit mode now measures actions, APIs, offline paths and client raw-message rendering.

## Validation

| Gate | Result |
|---|---|
| Prisma | 22 migrations; schema current |
| TypeScript | PASS |
| Unit tests | 984/984 PASS, 90 files |
| Focused contract/localization unit | 11/11 PASS |
| i18n / option audit | PASS / PASS; one pre-existing Dutch economics review warning |
| Production build | PASS; pre-existing NFT tracing warning |
| Focused User Error E2E | 4/4 PASS, retries 0, 1 min 11 s |
| Focused regression | 58/58 PASS, retries 0, 8 min 24 s |
| First full E2E | 178 collected; one `page.goto` timeout in isolation; no assertion/application failure |
| Timeout rerun | affected cross-farm machine test PASS (2/2 including setup) |
| Final full E2E | 178 collected; 177 passed; 1 documented conditional skip; 0 failed/flaky; retries 0; 19 min 54 s |
| Clerk | 5 total / 4 fixed-pool before and after; 0 created |
| Browser isolation | no reported IndexedDB or Service Worker leakage; exact-one/offline regression green |
| Audits | active user errors 158 → 150; global resolvers 415 → 402 |

## Remaining scope

Activities, Work Orders, Finance, allocations, offline/sync, scouting photos, AI/transcription, API error shapes and the farm error boundary still contain active legacy contracts. Provider outage, rate-limit, unknown-error, photo and offline Playwright flows were not claimed because those consumers were not migrated in this bounded slice.

No physical-device validation was performed for Stage 11.
# Stage 14 U2 addendum (2026-08-01)

The exact Inventory/Machines batch is GO: user-error 4 → 0 and overlapping resolver prose 6 → 0. Four-locale messages, safe fallback, direct consumer rendering, accessibility and full E2E are verified. Application-wide migration remains NO-GO at 131 user-error / 373 resolver findings.
