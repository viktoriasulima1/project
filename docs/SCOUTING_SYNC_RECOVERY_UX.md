# Scouting sync and recovery UX

## Stage 18 shared Sync Center behavior

The shared queue now localizes structured `safeError` values and masks legacy raw messages. Invalid recovery JSON is atomic and associated with an accessible alert; it creates no local records. Existing selected-item retry, idempotency and review-before-submit behavior remains unchanged. Automated regression passed, but physical iPhone/Android recovery remains NOT RUN / NO-GO.

The Offline & Sync page has a dedicated scouting center showing local visits, pending/failed photos, per-visit `done/total` progress, errors and whether the Blob remains safe. Actions are pause, resume, retry all, retry/open visit, export photo, export metadata and remove a reviewed local copy. A visit is not synchronized while any photo remains pending.

Failures are classified as offline, timeout, provider unavailable, signed-link expired, invalid MIME, oversized, checksum mismatch, authorization, changed farm/session, quota, DB finalization, unknown transient or permanent validation. Only transient categories are eligible for automatic retry. JSON recovery explicitly excludes binaries; per-photo export and retained IndexedDB Blob are the safe binary path.
# Direct item retry

`Retry this item` now executes the selected photo only. It preserves the idempotency key, increments retry count, retains the last safe error, creates missing visit/observation dependencies and skips already synchronized siblings/checkpoints. The row and aggregate visit status update after the result. Forced interrupted-upload browser proof remains pending.

Local photos can now be opened in the touch editor directly from Sync Center. Annotation Save updates only the matching namespaced IndexedDB draft and explicitly says that no server synchronization is claimed. Reload/reopen and the following exact-one retry are covered by focused Flow L.
