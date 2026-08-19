# Work Order User Error Localization Report — Stage 13

Date: 2026-08-01.

## Outcome

Work Order transition, stock, reservation and exact-one user-error migration is a **full bounded-batch GO**. Application-wide user-error migration remains **PARTIAL / NO-GO**.

The action boundary now returns the shared `UserFacingError` object. Direct consumers render it with `buildUserErrorDisplayModel`, the active locale, and accessible `role="alert"`. Raw Zod, Prisma, transaction, stack and caught `error.message` text no longer reaches these surfaces. Success payloads and routes remain unchanged.

## Canonical codes and localization

New genuine codes are `INVALID_PLAN_ITEM`, `INVALID_WORK_ORDER`, `WORK_WINDOW_INVALID`, and `INVENTORY_SELECTION_REQUIRED`. Existing `NOT_FOUND`, `INSUFFICIENT_STOCK`, `WORK_ORDER_COMPLETED`, and `GENERIC` are reused. Every code has catalog coverage in nl-NL, en-GB, pl-PL and de-DE; placeholder/key parity passes.

No general invalid-transition, already-cancelled, reservation-not-found or Activity-already-linked error was added because those rejection branches do not exist in this action. The safe idempotent repeat remains success.

## Preserved behavior and evidence

- Farm scoping and existence hiding: unchanged; foreign and nonexistent records both produce `NOT_FOUND` without IDs or ownership detail.
- Stock availability formula: physical stock minus active reservations; unchanged decimal comparisons and rejection.
- Cancellation: releases active reservation, creates no Activity or stock movement.
- Start/in-progress: retains reservation.
- Completion: one Activity link and one reservation-consumption path.
- Repeat convert/complete: idempotent success with no duplicate reservation, link, plan mutation or AuditEvent.
- Unknown infrastructure error: server-side diagnostic plus safe `GENERIC` with correlation ID.
- No Prisma migration or historical-data rewrite.

## Automated validation

| Gate | Verified result |
|---|---|
| Prisma | 22 migrations; schema current |
| i18n validation | PASS; four locales, nine namespaces; one pre-existing Dutch economics review warning |
| TypeScript | PASS |
| Unit | 1002/1002 PASS in 92 files (baseline 994; 8 new invariant tests) |
| Focused localization/unit | 54/54 PASS plus 8/8 action-invariant PASS |
| Production build | PASS in 28.6 s; pre-existing NFT tracing warning only |
| Targeted audit | field-operations 15 → 0 |
| Global audits | user errors 150 → 135; resolvers 402 → 379 |
| New focused E2E | 7/7 PASS, retries 0, 1 min 29 s |
| Sprint 23 lifecycle | 13/13 PASS, retries 0, 2 min 19 s |
| Related regression | 8/8 PASS, retries 0, 1 min 43 s |
| Full E2E | 184 collected; 183 passed; one documented conditional pilot-smoke skip; 0 failed/flaky; retries 0; exit 0; 21 min 20 s |
| Clerk | before 5 total / 4 fixed-pool; after 5 / 4; no user created |

The first focused attempt failed 6 tests by timeout because the new spec incorrectly selected `button[type="submit"]` while the existing forms use implicit submit buttons. This was a test defect; after correcting the locator, the whole focused file passed. The first Sprint 23 attempt was 12/13 because one assertion expected obsolete English prose; it was updated to catalog-derived text and the complete spec passed.

Full-suite results show no reported IndexedDB or Service Worker leakage. Offline exact-one, cross-farm, reservation, stock movement, compliance and completion assertions remained green. The documented skip is `e2e/pilot/smoke.spec.ts` when `PILOT_SMOKE_STORAGE_STATE` is absent.

## Accessibility and physical devices

Errors use live accessible alerts; focused Polish/German/Dutch/English UI and existing 390×844 / 430×932 Work Order mobile scenarios passed without hidden controls or horizontal overflow. No new physical-phone validation was performed in this localization batch; this report does not replace the separate physical-device pilot gate.

## Remaining debt and next batch

There are 135 active-audit user-error findings and 379 resolver findings globally. General Activities, Inventory, Finance, Offline Sync, Scouting/photo, AI/API and error-boundary migration remain out of scope. Select the next bounded batch from the regenerated roadmap; Activities/Quick Log is the closest lifecycle-adjacent candidate.
