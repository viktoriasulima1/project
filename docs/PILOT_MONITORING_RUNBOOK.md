# Pilot Monitoring Runbook

Monitor the stable `/api/health` for availability and database status without storing response secrets. Alert on sustained 5xx, database degradation, offline-sync failures, authentication failure spikes and migration mismatch. Correlate logs using safe correlation IDs, route, app version, timestamp and pseudonymous farm/user references.

Never log tokens, database URLs, certificate numbers, notes, exact locations or raw form payloads. Escalation order: confirm health, identify release, inspect safe category/correlation, pause mutations if integrity is at risk, preserve local drafts, rollback only to a schema-compatible application, otherwise forward-fix.
