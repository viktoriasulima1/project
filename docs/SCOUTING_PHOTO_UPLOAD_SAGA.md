# Scouting photo upload saga

The server persists these checkpoints: `authorization_created` -> `binary_uploaded` -> `checksum_verified` -> `db_attached` -> `finalized`. `localPhotoId` is the stable idempotency key. A retry first reads the existing DB row and provider metadata, skips completed stages, verifies the original checksum and finalizes exactly once. A lost response after finalization returns the existing finalized photo.

Failures retain the DB checkpoint and the client Blob. The Sync Center retries only the selected item and creates missing visit/observation dependencies first. Permanent validation failures are not automatically retried. Temporary objects are reported by the dry-run cleanup utility; production deletion remains provider lifecycle/runbook controlled.
