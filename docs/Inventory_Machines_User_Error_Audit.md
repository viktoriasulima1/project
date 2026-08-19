# Inventory and Machines User Error Audit — Stage 14 U2

Date: 2026-08-01. This audit was completed before runtime-contract changes.

## Exact roadmap scope

U2 is exactly four active user-error findings across two server-action files:

| File / old line | Function | Existing outward behavior | Origin / shape | Direct consumer | Proposed contract |
|---|---|---|---|---|---|
| `actions/inventory.ts:63` | `createInventoryItem` | raw Zod `flatten().fieldErrors` | validation; `Record<string,string[]>` | `AddInventoryItemDialog` | safe field-specific `UserFacingError` objects using existing/new validation codes; non-retryable |
| `actions/inventory.ts:70` | same | `Set up your farm before adding inventory.` | caught farm lookup; `error: string` | inventory dialog global alert | existing `AUTH_REQUIRED`; authentication; non-retryable; no metadata |
| `actions/machines.ts:26` | `createMachine` | `Enter a name for the machine.` for any schema failure | manual validation string | ActivityDialog inline sprayer creator | safe validation code with field; non-retryable |
| `actions/machines.ts:33` | same | `Farm not found.` | caught farm lookup string | ActivityDialog machine alert | existing `AUTH_REQUIRED`; authentication; non-retryable; no metadata |

There is one raw-technical U2 finding: inventory Zod flattening. The two catch blocks at the end of these actions also use the deprecated shared `.message` compatibility field but are not detected separately by the narrow user-error regex; they are part of the same action boundary and must be removed to prevent Prisma/database prose forwarding.

## Resolver overlap

Six resolver findings overlap these files:

- Inventory search authentication and rate-limit prose at old lines 26 and 29.
- Inventory farm/auth prose at line 70.
- Ctgb re-verification failure prose at line 90.
- Machine validation and farm/auth prose at lines 26 and 33.

The four user-error findings are the exact U2 completion gate. The additional three inventory-only resolver messages in the same direct action/consumer boundary will also move to stable safe errors so no parallel authoritative English error remains. Upstream Ctgb provider bodies stay masked; Ctgb authority and manual-entry fallback remain unchanged.

## Actual behavior, not hypothetical behavior

These two actions only create an InventoryItem or a Machine. They contain no stock deduction, StockMovement, reservation, machine availability, scheduling conflict, MachineUsage, rate, stale-version, adjustment, unit conversion, or insufficient-stock branch. No codes or tests will be invented for those absent conditions.

Inventory validates name, canonical category, canonical unit, non-negative stock/minimum/price ranges, optional supplier and ISO date. It always derives `farmId` from the authenticated farm. A selected official product is re-verified before creation; failure creates nothing and directs the user to retry search/manual entry. The database write is a single create, with no transaction or AuditEvent.

Machine validates name and the canonical machine-type enum, derives `farmId` from authentication, then performs one create. There is no transaction, booking or AuditEvent.

## Consumers, tests and dependencies

- Direct consumers: `AddInventoryItemDialog.tsx` and the inline sprayer creator in `ActivityDialog.tsx`.
- Existing unit coverage: `src/lib/actions/__tests__/inventory.test.ts`; no dedicated machine action test existed at baseline.
- Existing browser coverage: `golden-path.spec.ts`, `failure-paths.spec.ts`, `sprint18-ctgb-brp.spec.ts`, founder walkthrough, Sprint 23 stock lifecycle, Work Order user errors and locale hydration.
- Shared dependencies: Stage 11 `UserFacingError`/display adapter; Stage 13 `NOT_FOUND`, `INSUFFICIENT_STOCK` and Work Order contracts remain authoritative but these two create actions do not execute reservation/stock-consumption logic.
- Later Activities dependency: canonical machine validation/auth/database errors can be rendered by ActivityDialog without migrating `actions/activities.ts`, Quick Log or activity-parse API.

Security recovery is deliberately generic: authentication requires sign-in/setup; validation requires correcting the associated field; Ctgb verification offers retry/manual entry; database failures are retryable and expose only a correlation ID.

## Verified closure

The filtered U2 user-error audit is 4 → 0 and the same-boundary resolver overlap is 6 → 0. Global totals moved 135 → 131 and 379 → 373 respectively. See `Inventory_Machines_User_Error_Localization_Report.md` for validation evidence and the bounded GO decision.
