# Offline Sync Center User Error Audit — Stage 18

Date: 2026-08-06

## Verified pre-change scope

Fresh machine filtering confirms exactly 10 active `user-errors` findings across four production files and zero resolver overlap.

| # | File / branch | Current result/path | Origin | Proposed canonical contract | Recovery / safety |
|---:|---|---|---|---|---|
| 1 | `src/app/api/offline/sync/route.ts:24`, `POST` untrusted origin | HTTP 403 `{ error: "Untrusted request origin.", category: "authorization" }`; consumed by activity queue | sync request authorization | `REQUEST_NOT_ALLOWED`, authorization, not retryable, correlation ID only | return to trusted FarmOS page; never echo origin |
| 2 | same:27, JSON parse catch | HTTP 400 English error/category | sync payload | `INVALID_VALUE`, validation, not retryable, `field: formData` | review local draft; no body/schema metadata |
| 3 | same:30, absent `formData` | HTTP 400 English error/category | sync payload | `REQUIRED_FIELD`, validation, not retryable, `field: formData` | review draft; preserve it |
| 4 | `src/app/api/offline/finance-sync/route.ts:19`, untrusted origin | HTTP 403 English error/category; finance queue caller | sync authorization | `REQUEST_NOT_ALLOWED`, authorization, not retryable, correlation ID only | trusted page only; no origin detail |
| 5 | same:21, invalid record type/form data | HTTP 400 English error/category | finance draft validation | `INVALID_VALUE`, validation, not retryable, `field: formData` | review/export draft; no payload echo |
| 6 | same:23, missing stable IDs | HTTP 400 English error/category | draft persistence/exact-one | `REQUIRED_FIELD`, validation, not retryable, safe field names only | review draft; never synthesize IDs during retry |
| 7 | `src/offline/db.ts:59`, `getDraft` migration catch | `error.message` enters `markUnmigratableDraft`, is persisted as `safeErrorMessage`, then shown in queue | IndexedDB/malformed or unsupported local schema | `SYNC_CONFLICT`, conflict, not retryable until review; safe canonical reason only | mark `needs_review`; retain record/data |
| 8 | same:74, `listDrafts` migration catch | same raw persisted-text path for list | IndexedDB/draft persistence | same | isolate bad neighbour; preserve queue order and valid drafts |
| 9 | `src/components/offline/OfflineQueueClient.tsx:20`, recovery import catch | `error.message` assigned to component message | recovery import/unknown parser error | `INVALID_VALUE`, validation, not retryable, `field: recoveryFile` | select corrected file; import remains atomic |
| 10 | same expression, rendered-UI audit rule | raw message rendered in `role=status` | recovery import visible UI | display #9 with `buildUserErrorDisplayModel` | accessible error; no parser/DOMException prose |

Records 9 and 10 are distinct audit findings for one direct leak expression. Current calls can persist/show raw migration or parser detail. The migration may change only error representation and presentation—not IndexedDB schema/store keys, queue state transitions, retries, recovery mutations, exact-one semantics, user/farm namespace, or Service Worker behavior.

## Production callers and exclusions

The two API routes are called by the offline Activity/finance synchronization engine. `IndexedDbOfflineRepository` supplies `OfflineProvider`; `OfflineQueueClient` renders `/offline`. Adjacent scouting/photo sync, Activity and finance business rules, lock/lease implementation, storage schema, and Service Worker code are excluded unless a test demonstrates a direct typed compatibility requirement.

## Characterization requirement

Before runtime edits, tests must freeze HTTP statuses and success payloads, invalid import atomicity, malformed-draft `needs_review`, exact-one/idempotent replay, namespace isolation, queue ordering, failed-draft retention, and absence of automatic destructive recovery. Tests use deterministic browser/storage failures only and create no external users or paid calls.
