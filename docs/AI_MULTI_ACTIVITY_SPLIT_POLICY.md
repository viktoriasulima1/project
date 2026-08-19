# AI multi-activity split policy

Descriptions with multiple operations or the same operation over multiple
fields are never silently merged. Detection returns single, multiple or
ambiguous and at most five span-preserving candidates.

“Create separate drafts” creates local `draft`/`unreviewed` objects only. Each
has its own `localDraftId` and idempotency key plus shared split-group metadata.
There is no bulk-submit state or shared confirmation. Every draft must be
opened, resolved, validated and confirmed independently. Recovery JSON retains
the typed draft fields automatically; raw audio is absent because no audio is
stored in the offline repository.
