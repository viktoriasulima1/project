# Sprint 20 — Offline Drafts, Local Queue and Safe Synchronization — Report

## 1. Previous connectivity risks

Activity and Quick Log values previously existed only in DOM/React memory until a Server Action returned. Refresh or browser close lost them. The critical ambiguity was a dropped response after a successful database commit: repeating the form could duplicate an activity and therefore duplicate stock, compliance, and audit effects. Full findings are in `Sprint_20_Offline_Risk_Audit.md`.

## 2. Offline scope

Supported: versioned activity/Quick Log drafts; scouting, planned activities, and completed submissions queued for later sync. The shared ActivityDialog means these workflows use one path. Inventory/field forms, corrections, reversals, compliance exports, BRP import, live Ctgb verification, account changes, destructive actions, and complex finance changes remain online-only.

## 3. IndexedDB model

`src/offline/` contains typed records, logical schema migration, native IndexedDB repository, deterministic memory repository, 256 KB per-draft limit, namespace indexes, receipts, cleanup, queue, conflict, network, sync, and safe observability. Namespace is a server-derived SHA-256 user reference plus farm id; no Clerk token or secret is stored. Unknown/corrupt schemas fail to `needs_review` when recovery is possible.

## 4. Draft autosave

ActivityDialog debounces meaningful changes for 600 ms, says “Saving on this device”/“Saved on this device,” restores the newest unfinished draft after reload, shows age, and offers explicit discard. Validation errors remain outside business `formData`. Detailed payload is cleared only after the API confirms synchronization.

## 5. Queue architecture

The queue processes oldest first at startup, after a verified connectivity restoration, every 30 seconds in the foreground, or on Retry. It uses health checks in addition to browser online/offline events, a 4-second timeout, exponential backoff capped at 60 seconds, six automatic attempts, and no uncontrolled loop. The persistent bar and `/offline` UI expose drafts, waiting/syncing/conflict/failed/recently synced states, attempts, safe error, retry/review/discard/open actions, local storage usage, and cleanup controls.

## 6. Idempotency

Migration `20260715000000_sprint20_offline_idempotency` adds unique `offlineDraftId` and `idempotencyKey`, canonical `submissionHash`, and stored correlation id to Activity, plus `offline_sync` audit source. Same key + same server-computed hash returns the original activity. Same key + changed payload returns conflict. A unique-index race is re-read as the original receipt. Activity, stock movement, compliance snapshot, and audit chain remain one PostgreSQL transaction.

## 7. Conflict handling

Authorization/farm mismatch, validation, schema, insufficient stock, stale reference, and server ownership failures stop automatic retry and become review states. The UI preserves the original local payload and shows the safe server reason. It never silently rewrites a regulated submission. Retry and discard are available; review reopens the Activities workflow. Rich per-field server-current-value comparison remains a future enhancement for conflict categories where the API currently returns only a safe reason.

## 8. Stock safety

Offline stock is labelled “based on last synced stock.” No local deduction is claimed. Sync revalidates current product/farm and uses the existing atomic `UPDATE ... currentStock >= required` predicate. Insufficient current stock rolls back the full transaction and requires review; negative stock is never silently accepted.

## 9. Compliance safety

A queued completed spray says “Pending synchronization — compliance record not yet finalized” and explicitly says server stock was not deducted. Only confirmed server sync creates the compliance snapshot and correlated audit events. The original entered facts stay in the queued payload until success. Corrections and reversals are not available offline.

## 10. Weather limitations

Offline form display uses only the already-downloaded weather snapshot, shows its download age, and says current suitability cannot be confirmed. Online spray suitability requests are disabled while connectivity is not verified online, so stale weather cannot yield a new strong positive recommendation. Final sync remains server-authoritative.

## 11. Authentication isolation

The authenticated farm layout supplies a hashed user reference and farm id. Sign-out unmounts the provider and stops timers/synchronization immediately. A different account gets a different IndexedDB namespace and cannot list or submit prior drafts. Sync independently rechecks current server farm ownership. Drafts are retained for the original account unless explicitly deleted.

## 12. PWA foundation

`manifest.webmanifest`, service-worker registration, `sw.js`, and `offline.html` are present. Cache-first applies only to explicit public assets and `/_next/static/`. Authenticated HTML, RSC/Server Action requests, APIs, and business payloads are never persisted in the service-worker cache. IndexedDB exclusively owns offline business drafts.

## 13. Tests and E2E

- Prisma Client generation: passed after stopping the old dev server that held the Windows query-engine DLL.
- Migrations: 8/8 applied; schema up to date.
- TypeScript: clean.
- Unit tests: **394/394** across 44 files (32 net-new Sprint 20 tests, including storage/namespace/schema/queue/backoff/conflicts, server idempotency, and safe logs).
- Production build: passed on Next.js 16.2.9; `/api/offline/sync` and `/offline` included.
- Targeted regression run after fixes: **25/25**.
- Full Playwright: **57/57 passed twice consecutively**, including Chromium offline scouting sync, manifest/service-worker cache safety, and mobile Offline & Sync UI at 390×844 and 430×932.
- Fixed Clerk pool: reused; no new test-user creation path was added.

One full pre-fix run found accessibility contrast/link semantics, no-farm layout, cross-farm error presentation, and one timing-sensitive sync test issue. These were fixed; the relevant scenario then passed three consecutive isolated repeats before both clean full runs.

## 14. Manual field checks still required

`BETA_ACCEPTANCE_CHECKLIST.md` now requires real phone testing with Wi-Fi loss, browser restart, reconnection, one-record verification, inventory/compliance inspection, account switching, flapping signal, stale weather wording, and conflict recovery. Automated browser emulation is not evidence of real radio/network field reliability.

## 15. Remaining risks

- IndexedDB is not encrypted; a person with the same unlocked OS/browser profile may inspect it.
- Clearing site data deletes unsynchronized work.
- Quick Log must have loaded its server context before the connection disappears; cold-starting a never-loaded authenticated workflow fully offline is not supported.
- Rich conflict comparison (offline value versus fetched current server value) is currently reason-level rather than field-by-field.
- Offline inventory adjustment was optional and was not implemented.
- Only current Chromium is fully automated. The implementation uses standard IndexedDB, Service Worker, Fetch, and Web Crypto APIs and should work in current Edge/Firefox/Safari, but Firefox and Safari/iOS require manual validation. Private browsing persistence varies.
- The manifest currently uses the existing SVG asset; platform-specific install artwork is not part of this sprint.

## 16. Exact readiness for pilot use

The code is ready for a controlled browser pilot of offline activity drafts and queued synchronization: local/server wording is explicit, server effects are atomic and idempotent, authenticated cache leakage is excluded by construction, and automated validation is green. It is **not yet ready to be claimed as proven field-reliable** until the real-device checklist passes, especially unstable mobile connectivity, browser termination/restart, Safari/iOS behavior, and human review of regulated conflict wording.
