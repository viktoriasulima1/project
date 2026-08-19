# Sprint 20 — Offline Risk Audit

## Before Sprint 20

`ActivityDialog` and Quick Log posted directly to `createActivity`. If connectivity disappeared before submit, typed values existed only in React/DOM memory and were lost on refresh or browser close. During submit there was no durable client receipt. A connection loss after the PostgreSQL transaction committed but before the Server Action response arrived left the browser unable to know whether the activity existed; a manual resubmit could create another activity, stock movement, compliance record, and audit chain.

The database transaction did protect each individual completed activity: activity, stock deduction, compliance snapshot, and audit events committed or rolled back together, and the stock update used an atomic `currentStock >= required` predicate. It did not make two independent submissions idempotent. Planned activities differed: they created no stock or compliance effect until completion, but duplicate planned records were still possible. Completed spray duplicates were the highest-risk failure.

Inventory and field forms also posted directly and did not survive refresh. They remain outside Sprint 20 offline write scope. Corrections, reversals, exports, BRP import, Ctgb verification, account changes, destructive actions, and finance edits require an online connection.

There was no IndexedDB activity model, queue, connectivity resolver, service worker, offline fallback, or browser-storage privacy control. `localStorage` contained only UI preferences such as theme, never full activity payloads. `navigator.onLine` was not used. Router refreshes occurred only after a response, so an ambiguous commit produced no reliable recovery signal.

## Risks and controls added

| Failure point | Previous result | Sprint 20 control |
| --- | --- | --- |
| Drop before submit | Form lost on refresh | Debounced, versioned IndexedDB draft |
| Drop during submit | Unknown; user sees failure | Submission remains queued with stable IDs |
| Commit succeeds, response lost | Resubmit could duplicate effects | Unique idempotency key + payload hash returns original activity |
| Accidental double submit | Two transactions possible | Stable draft/key and database unique indexes |
| Refresh/browser restart | Values lost | Restore unfinished namespace-scoped draft |
| Concurrent stock use | Friendly precheck could become stale | Existing atomic server stock predicate remains authoritative |
| Duplicate compliance/audit | Possible through duplicate activity | All effects remain in the same idempotent transaction |
| Another signed-in user | Shared browser data could be exposed without namespacing | Hashed user reference + farm namespace; provider exposes only current namespace |

## Remaining risks

IndexedDB is device-local and is not encrypted. Anyone with the same unlocked OS/browser profile may inspect browser storage. FarmOS stores no Clerk token, password, API credential, or certificate document there, but activity notes may contain personal/business information. Clearing browser data deletes unsynchronized drafts. Incognito/private-mode persistence varies by browser. Actual weak-signal field reliability still requires the manual phone test in the beta checklist.
