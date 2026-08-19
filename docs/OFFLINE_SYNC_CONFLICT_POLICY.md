# Offline Synchronization and Conflict Policy

The server is authoritative for farm ownership, field/season existence, machine and product ownership, current inventory, and compliance creation. A local stock preview is labelled as last-synced data and never changes confirmed stock.

Each queued operation sends stable `localDraftId` and `idempotencyKey`. The server computes a canonical SHA-256 payload hash. Same key plus same payload returns the original activity. Same key plus different payload is a conflict. The activity, stock movement, compliance snapshot, and correlated audit events are one PostgreSQL transaction. Offline-origin audit events use `offline_sync`.

Automatic retry is limited to network, timeout, and temporary server failures. Deleted/changed fields, farm mismatch, missing/archived products or machines, insufficient stock, validation errors, changed official status, and unknown schemas require review. Regulated conflicts are never silently rewritten. Corrections and reversals are online-only.

For an offline completed spray, UI says that synchronization is pending and compliance is not finalized. No local state is presented as confirmed stock or legal/compliance truth. Ctgb conclusions are captured only by the authoritative server transaction; an unavailable or changed official reference must be surfaced for review rather than silently backfilled.
