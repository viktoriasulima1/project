# Offline Data Model

FarmOS stores activity drafts in IndexedDB database `farmos-offline`, never in `localStorage`. Store `drafts` is keyed by stable `localDraftId`; store `receipts` retains a minimal confirmed-sync receipt. Both records carry a namespace composed from a server-generated SHA-256-derived user reference and the authenticated farm id.

Schema version 1 includes activity type, state, string-only form data, timestamps, attempts, stable idempotency key, safe error category, optional conflict metadata, and optional server activity id. Draft payloads are limited to 256 KB. Unknown future schemas, corrupt values, and missing required identity fields are not silently discarded: recoverable records become `needs_review`.

State machine:

`draft → ready_to_sync → syncing → synced`

Retryable failures return to `ready_to_sync` with exponential backoff and stop after six attempts. Authorization, validation, stale-reference, changed-farm, and stock conflicts become `conflict`. Users may review, retry, or discard. After confirmed sync, detailed `formData` is removed immediately and a minimal receipt is retained. Synced receipts can be cleared from Offline & Sync settings.
