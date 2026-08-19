# Sprint 23 — Field Map, Season Planning and Work Orders

Date: 2026-07-15

## Result

Sprint 23 introduces a field-operations command layer without changing the meaning of existing records:

- `SeasonPlanItem` is strategic intent inside a field season.
- `WorkOrder` is an operational instruction and assignment.
- `Activity` remains the actual, immutable/audited record of work performed.
- `Task` remains a generic reminder and is not reused as a work order.

The implementation is production-buildable and the existing automated regression suite is clean. This report does not claim that every new Sprint 23 interaction has dedicated E2E coverage; those gaps are listed below.

## Data model and migration

Migrations:

- `20260715104141_sprint23_field_operations`
- `20260715105000_sprint23_plan_conversion_unique`

New persisted domain objects are `OperationTemplate`, `SeasonPlanItem`, `WorkOrder`, `WorkOrderEmployee`, and `InventoryReservation`. Work orders are farm-scoped, field-season scoped, may have multiple assigned employees, a machine, one source plan item, reservations, and exactly one completed activity. A unique database constraint prevents two work orders from being created from the same plan item and another unique constraint prevents one activity link from satisfying multiple work orders.

All mutations verify the active farm and ownership of field season, employee, machine and inventory IDs. Creation, status changes, conversion and completion emit structured `AuditEvent` records.

## Operational map and shared decisions

`/fields/map` renders stored GeoJSON lazily through Leaflet and provides an equivalent keyboard-readable field list and detail panel. A missing or malformed legacy geometry does not hide the field from the list.

The shared resolver in `src/lib/field-operations.ts` is used by the map and operational queue. Its precedence is:

1. critical priority
2. blocked
3. overdue
4. due within three days
5. in progress
6. planned
7. completed
8. unplanned
9. no active season

The same module owns the due-date priority engine, inventory/machine/operator readiness result, and plan-versus-actual variance calculation. Forty table-driven unit scenarios cover precedence, dates, resource blockers, reserved inventory and missing/positive/negative variances.

## Planning and work orders

- `/planning` creates season plan items with operation, work window, area, product, quantity, expected cost and agronomic reason.
- Converting a plan item is idempotent and creates at most one work order.
- `/work-orders` provides the operational queue, direct creation, assignments, resource reservations, readiness, status actions and links to record actual work.
- `/work-orders?view=today` is the focused Today queue.
- Active reservations are subtracted before a second reservation is accepted. The check and insert use a serializable transaction, preventing concurrent double allocation.
- Cancelling releases active reservations.
- Completion is atomic with successful creation of a completed `Activity`; it marks reservations consumed and the source plan item completed. Merely changing work-order status never creates an Activity.
- The Activity form carries `workOrderId` through the existing offline draft payload. Imported recovery data retains Sprint 21's `needs_review` rule and is never auto-submitted.

## Offline and safety

Work-order-linked actual activity entry uses the existing offline draft queue, user/farm namespace, idempotency keys, Web Locks/Safari lease fallback, and recovery import safeguards. `workOrderId` is a normal string field inside the draft form payload, so it survives local save and synchronization. The server re-verifies farm and field-season ownership before linking it.

The service worker was not changed in Sprint 23. Existing Sprint 20/21 tests for cross-tab locking, user isolation, recovery import and service-worker preservation remain in the full regression run.

## Automated validation

| Check | Result |
| --- | --- |
| `npx prisma generate` | PASS |
| `npx prisma migrate status` | PASS — 10 migrations, schema up to date |
| `npx tsc --noEmit` | PASS |
| `npx vitest run` | PASS — 47 files, 450/450 tests, 30.50 s |
| Sprint 23 resolver tests | PASS — 40/40 |
| `npm run build` | PASS — Next.js 16.2.9, Sprint 23 routes emitted |

### Playwright

First full run: 62 collected, one failure in the pre-existing accessibility “activity success dialog” test after the browser saved a local draft but a single sync attempt failed. The remaining suite completed. Classification: transient offline/network test infrastructure; no repeatable application assertion or Sprint 23 code failure was found.

Focused reproduction: setup plus the failing test, 2/2 passed in 55.4 s without a code change.

Clean full rerun: exit code 0, 62 collected, no failures, duration 367 s. The authenticated pilot smoke case is intentionally skipped unless its separate pilot storage state is configured; all executed Chromium and iPhone-emulation projects passed.

Development-mode CSP warnings about `eval()` and Clerk development-key warnings were present in server logs. They are expected for the development E2E target and were not test failures; the production build passed.

## Evidence and remaining validation

Automated evidence now covers the shared status/priority/readiness algorithms, existing authorization/isolation paths, activity offline queue, mobile emulation and the full regression suite. Database constraints and serializable reservation transactions provide the concurrency guard for plan conversion and inventory allocation.

The following still need dedicated Sprint 23 E2E or physical-field evidence before calling the entire field-operations workflow pilot-proven:

- draw/select a real imported field polygon and inspect every operational color/status on a physical phone;
- create a plan item, convert it, execute the work order offline, reconnect, and verify its single Activity and consumed reservation end to end;
- concurrent reservation attempts from two real tabs against the same inventory row;
- machine scheduling conflicts and multi-employee availability across overlapping work windows;
- persistent user-authored operation-template management (the current UI exposes the canonical operation structure, not a template editor);
- dependency editing and a full calendar drag/reschedule interaction (the current planning view is an ordered work-window timeline);
- dedicated dashboard insight cards and full cost/yield plan-versus-actual presentation;
- physical iPhone/Android map pan, offline tile failure, sync and authentication.

## Release statement

The migrations, shared engines, map, planning, work-order lifecycle, reservations and Activity linkage are implemented and regression-clean. Sprint 23 should remain **CONDITIONAL / NOT YET PILOT-PROVEN** until the dedicated new-workflow E2E scenarios and physical-phone field checks above pass. Automated regression success alone is not evidence of real-device field readiness.
