# AI briefing persistence policy

One `AiBriefing` stores bounded JSON snapshots of the validated primary and
secondary items, grounded facts and factual diff. It does not store raw records,
prompts, credentials or audio. `farmId + generatedForDate + contextChecksum` is
unique, preventing duplicate persisted advice for concurrent identical reads.

Unchanged context is reused for two hours. Explicit refresh has a two-minute
cooldown. Context changes create a new current record and mark the prior current
record historical. Historical text is read-only and explicitly not current
advice. Pagination is bounded to 25 rows per request.

Provider use is skipped after the daily farm generation limit, monthly cost
ceiling or three recent provider/validation failures. The deterministic result
is still persisted with its fallback reason; Dashboard never depends on a model.
# Stage 8 economic signal compatibility

New economic facts include stable signal/action codes, severity, field scope, canonical metadata and structured evidence. Requested locale is separate context. Existing briefing rows are not rewritten; legacy snapshots remain readable through the existing schema, while new deterministic economic wording is produced from catalogs.
