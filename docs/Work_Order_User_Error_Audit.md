# Work Order User Error Audit — Stage 13

Date: 2026-08-01. Scope is intentionally limited to `src/lib/actions/field-operations.ts` and its direct UI consumers.

## Frozen baseline

- Resolver audit: 402 findings.
- User-error audit: 150 findings; 15 in the targeted action file.
- Prisma: 22 migrations, schema current.
- TypeScript and production build: PASS.
- Unit tests: 994/994 PASS before the batch.
- Browser baseline: 178 collected, 177 passed, one documented conditional skip.
- Git commit was unavailable because this workspace has no readable Git HEAD/executable metadata.

## Exact targeted inventory

| Old line | Function | Existing condition / old outward text | Old shape | Caller / surface | Transaction and security | Canonical result |
|---:|---|---|---|---|---|---|
| 45 | `createSeasonPlanItem` | raw first Zod issue / `Invalid plan item.` | `error: string` | `PlanItemForm`, Planning | no write begun | `INVALID_PLAN_ITEM`, validation, non-retryable, safe field |
| 46 | same | end before start / `The end ... after its start.` | string | Planning alert | no write begun | `WORK_WINDOW_INVALID`, validation, `windowEnd` |
| 49 | same | farm-scoped season missing | string | Planning alert | no mutation; hides ownership | existing `NOT_FOUND` |
| 50 | same | farm-scoped expected product missing | string | Planning alert | no mutation; hides ownership | existing `NOT_FOUND` |
| 84 | `convertPlanItemToWorkOrder` | raw caught error / fallback | raw `error.message` | `ConvertPlanButton` | Serializable transaction | explicit expected codes; unknown → `GENERIC` with correlation ID |
| 89 | `createWorkOrder` | raw first Zod issue / invalid order | string | `WorkOrderForm` | no write begun | `INVALID_WORK_ORDER`, validation, safe field |
| 99 | same | farm-scoped season missing | string | Work Orders alert | no mutation; hides ownership | `NOT_FOUND` |
| 100 | same | farm-scoped machine missing | string | Work Orders alert | no mutation; hides ownership | `NOT_FOUND` |
| 101 | same | farm-scoped active employee missing | string | Work Orders alert | no mutation; hides ownership | `NOT_FOUND` |
| 102 | same | farm-scoped inventory item missing | string | Work Orders alert | no mutation; hides ownership | `NOT_FOUND` |
| 103 | same | quantity entered without inventory selection | string | Work Orders alert | no transaction | `INVENTORY_SELECTION_REQUIRED`, validation, field `inventoryItemId` |
| 122 | same | raw caught transaction error / fallback | raw `error.message` | Work Orders alert | Serializable rollback | expected stock code; unknown → `GENERIC` |
| 128 | `setWorkOrderStatus` | farm-scoped order missing | string | `WorkOrderStatusActions` | no transaction; hides ownership | `NOT_FOUND` |
| 129 | same | completed order is immutable | string | status-action alert | no mutation | existing `WORK_ORDER_COMPLETED`, conflict, non-retryable |
| 155 | `completeWorkOrderWithActivity` | raw caught error / fallback | raw `error.message` | action boundary | atomic completion transaction | expected codes; unknown → `GENERIC` |

The original JSON evidence is retained in `docs/evidence/localization-user-error-findings.json`; regenerated evidence now contains zero findings for this file.

## Real transition and reservation model

The audited action has no general invalid-transition matrix, already-cancelled rejection, missing-reservation rejection, or reservation-conflict branch. Status updates are intentionally last-write-wins except that `completed` is immutable. No codes were invented for absent scenarios. Cancellation still releases active reservations; `in_progress` retains them; successful Activity completion consumes them.

## Exact-one and transaction findings

- Plan conversion returns an already-linked Work Order idempotently. A retry now skips duplicate reservation, status update, and `created` AuditEvent.
- Completion returns success when the Work Order already links an Activity. A retry skips Activity lookup/link, reservation consumption, plan update, and duplicate `completed` AuditEvent.
- Insufficient available stock still aborts the Serializable transaction. Safe metadata contains only requested and calculated available quantities—never row IDs or foreign-farm data.
- Nonexistent and foreign-farm identifiers share `NOT_FOUND`, identical metadata, and identical visible wording.

## Audit conclusion

Targeted findings: **15 → 0**. Global user errors: **150 → 135**. Global resolver findings: **402 → 379**. No suppressions were added.
