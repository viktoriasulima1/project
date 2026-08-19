# Offline Privacy and Retention

IndexedDB data is isolated by hashed user reference and farm. Sign-out unmounts the authenticated provider immediately, stopping synchronization and hiding its namespace. A different user receives a different namespace and cannot list or submit the previous queue. Returning to the original account restores it, subject to current server farm ownership checks.

FarmOS does not store passwords, Clerk tokens, cookies, secret/API keys, certificate files, external credentials, or raw API responses in offline drafts. Safe logs contain identifiers, activity type, attempt number, duration, and error category only—never form data or notes.

Detailed synchronized payloads are removed immediately after server confirmation. Minimal receipts remain until the user selects “Clear synced local data.” Failed/conflict/draft records remain until resolved or explicitly deleted. “Delete all drafts on this device” is namespace-scoped and requires confirmation. Clearing browser/site data outside FarmOS permanently removes unsynchronized drafts.

IndexedDB is not encrypted. Use a locked device/browser profile for sensitive farm data. Shared-device and physical-access risk must be explained during pilot onboarding.
