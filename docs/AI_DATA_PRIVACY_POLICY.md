# AI data privacy policy

## Stage 16 evidence

Parse errors contain no farmer text, prompt, provider body, entity/auth ID or stack. Observability keeps its checksum and timing metadata, not the description.

## Data that may be sent

For a briefing: bounded structured farm facts, source labels, timestamps,
freshness/confidence and opaque related-record IDs. For Activity parsing: the
text transcript the farmer explicitly submits. Only the active farm is in scope.

## Data never sent

Clerk tokens/secrets, database credentials, provider keys, full audit logs,
unrelated farms, raw database records, unnecessary employee personal data or
raw microphone audio. Provider payload construction is server-side.

Text is stored locally only to recover an unfinished Activity description.
Browser speech recognition is progressive enhancement; FarmOS stores only the
editable transcript and does not create or retain an audio Blob. Offline mode
never sends or queues audio and disables cloud parsing.

Farm opt-out uses `AI_DISABLED=true`; deterministic workflows remain available.
Operational logs should retain safe metadata (request kind, farm ID, checksum,
model/schema version, duration, token/cost estimate, outcome and feedback), not
raw prompts. Deletion must remove locally saved transcript text and bounded
product records according to the farm retention policy.

Before production use in the EU, the operator must document processor location,
DPA/subprocessors, transfer mechanism, retention, incident handling, provider
training opt-out and data-subject request handling. No production provider is
approved merely because an API adapter exists.
