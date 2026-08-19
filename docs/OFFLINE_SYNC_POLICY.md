# FarmOS offline synchronization policy

## Stage 18 structured-error boundary

Offline Activity and finance synchronization return allow-listed `UserFacingError` values. IndexedDB may persist `safeError`, but never trusts server, parser, framework or caught prose. Legacy message fields are migration-only and render through a safe generic localization. Ownership failures do not reveal whether another user's or farm's draft exists; imported regulated records require review and never auto-submit.

## Stage 15 error presentation

Activity idempotency and review states are unchanged. Authorization maps to `NOT_FOUND`, inventory conflict to `INSUFFICIENT_STOCK`, validation/schema to `INVALID_VALUE`, and replay conflict to `SYNC_CONFLICT`; rejected drafts retain their data.

## Stage 13 compatibility note (2026-08-01)

No offline schema, queue, service-worker or sync policy changed. Sprint 23 offline Work Order completion still syncs exactly once; full E2E reported no IndexedDB or Service Worker leakage. Idempotent completion retries do not duplicate Activity linkage, reservation consumption or completion AuditEvent.

## User-error contract boundary (Stage 11)

Stage 11 did not change localDraftId, idempotency keys, queue state, retry/backoff, user/farm namespace isolation, exact-one synchronization, IndexedDB storage or Service Worker behaviour. Offline/sync user-facing error migration remains pending; existing recovery and historical records were not rewritten. The clean 58-test regression and final full E2E reported no storage-isolation leakage.
