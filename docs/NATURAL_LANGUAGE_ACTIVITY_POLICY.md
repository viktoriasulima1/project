# Natural-language Activity policy

## Stage 16 boundary

Invalid descriptions use `INVALID_VALUE`; limits use `RATE_LIMITED`. Provider failure still falls back deterministically. Suggestions remain editable draft-only review data.

## Stage 15 boundary

ActivityDialog no longer forwards parse response or caught text. Provider/network/status failures use localized canonical codes and remain draft-only. The two English `/api/ai/activity-parse` responses are explicitly deferred to the next batch.

Natural-language and voice input create candidate values only. They never save,
sync, complete a WorkOrder, deduct stock or create compliance/financial records.

Resolution confidence is `exact_match`, `high_confidence`, `ambiguous` or
`unresolved`. Ambiguous entities require a farmer choice. Unknown/foreign names
produce no ID. Suggested IDs are resolved again against the active farm on the
server. Multiple activities must be split into separate reviewed drafts.

For spraying, the normal Activity form remains authoritative: Ctgb use/crop,
dose, BBCH, product status, certificate, machine/nozzle, PHI, stock and weather
checks all run after parsing. Conflicting farmer text remains visible; it is not
silently rewritten. A matching WorkOrder is a suggestion and must be opened
through the existing completion flow to retain its exact-one chain.

Offline text may be saved locally. Parsing and cloud transcription are disabled
until online. The normal reviewed Activity can then use the existing queue.
