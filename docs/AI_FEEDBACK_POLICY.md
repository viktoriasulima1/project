# AI feedback policy

Feedback is attached to one persisted briefing item and active farm. Supported
values are Helpful, Not useful, Incorrect and Already knew this. Incorrect can
carry a bounded reason/comment. The server verifies briefing ownership and that
the item exists in its immutable snapshot. One actor's response is upserted,
not duplicated.

Feedback stores checksum and prompt/model version for evaluation provenance.
It never changes deterministic priority, auto-edits a briefing, retrains a
provider or blocks the farmer's workflow.
