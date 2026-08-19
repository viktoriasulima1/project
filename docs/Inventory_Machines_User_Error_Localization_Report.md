# Inventory and Machines User Error Localization Report — Stage 14 U2

Date: 2026-08-01

## Decision

**Inventory + Machines user-error migration — full bounded batch GO.**

**Application-wide user-error migration — still PARTIAL / NO-GO.**

The confirmed next batch is Activities / Quick Log core (9 findings). The two activity-parse API findings remain a separate later API-boundary batch.

## Exact scope and findings

The pre-change audit identified four active user-error findings: two in `src/lib/actions/inventory.ts` and two in `src/lib/actions/machines.ts`. Six resolver findings overlapped the same action boundary. The filtered post-change audit is zero for both U2 sets.

| Audit | Before | After | Delta |
|---|---:|---:|---:|
| U2 user-error target | 4 | 0 | -4 |
| U2 resolver overlap | 6 | 0 | -6 |
| Global active user-error | 135 | 131 | -4 |
| Global resolver | 379 | 373 | -6 |

The actual actions create InventoryItem and Machine records. They do not implement stock deduction, StockMovement, reservations, incompatible-unit conversion, machine availability, scheduling conflicts, MachineUsage, usage duration, or machine rates. Those hypothetical branches were not invented, migrated, or claimed as covered.

## Contract and consumers

- Inventory schema failures now return field-specific `UserFacingError` values. Canonical category/unit/date/quantity distinctions are retained.
- Inventory search authentication, rate limiting, provider unavailability and Ctgb re-verification use stable safe codes.
- Machine name/type validation, authentication and unexpected database failures use the shared contract.
- Unknown failures expose no caught message, Prisma text, Zod prose, SQL detail, constraint name or stack. The safe generic contract carries a correlation ID.
- `AddInventoryItemDialog` and the existing inline sprayer creator consume the shared display adapter. No Activities action, Quick Log action or activity-parse API was migrated.
- Rejected Inventory submissions preserve submitted values. The accessible summary receives focus, field messages are linked with `aria-describedby`, and errors are not communicated by colour alone.

All added codes have `en-GB`, `nl-NL`, `pl-PL` and `de-DE` messages with matching placeholders. Canonical option values and units were not localized or changed.

## Compatibility and security

No persistence schema, farm scoping, transaction boundary, stock total, reservation, Work Order lifecycle, exact-one completion, idempotency, MachineUsage, audit event, correction or reversal behavior changed. The create actions continue deriving `farmId` from the authenticated farm and accept no submitted farm identity. No foreign-farm identifiers or names are included in error metadata.

Stage 13 remains authoritative for stock and reservation errors. The Sprint 23 lifecycle regression proves reservation creation/release/consumption and exact-one Activity completion remain unchanged.

## Automated validation

| Gate | Result |
|---|---|
| Prisma generate/status | PASS; 22 migrations, database current |
| i18n validate | PASS; 4 locales, 9 namespaces; one pre-existing Dutch economics warning |
| canonical option audit | PASS |
| TypeScript | PASS |
| Unit tests | 1011/1011 PASS across 93 files |
| Production build | PASS; existing NFT tracing warning only |
| Focused U2 E2E | 7/7 PASS including setup (6/6 U2 browser scenarios), 1.3 min, retries=0 |
| Relevant regression | 36/36 PASS, 4.9 min, retries=0 |
| Budget-timeout classification rerun | 10/10 PASS; former Flow C completed in 6.7 s |
| Final full E2E | 190 collected; 189 passed; 1 documented conditional skip; 0 failed; 0 flaky; 25 min 18 s; exit 0; workers=1; retries=0 |

Focused coverage proves localized Inventory quantity errors in all four locales, preserved values, focused/associated errors, absence of raw codes/technical text, localized Polish machine validation with no created option, and German 390×844 wrapping without horizontal overflow. Existing Sprint 18 covers official-product/manual fallback, while the regression set covers stock rejection, Work Order reservations/exact-one behavior, cross-farm protection, locale hydration, golden and failure paths.

The first full dev attempt collected 190 tests and had one unrelated `i18n-budget-variance` Flow C test-level timeout alongside a Turbopack dev HMR chunk-load error. The complete focused spec then passed 10/10 without code changes. A diagnostic production-target attempt was not a valid replacement because the intentional production photo-storage guard rejects the E2E local provider and caused downstream auth/scouting failures. The required standard dev-harness rerun then passed cleanly as recorded above.

Clerk remained `5 total / 4 fixed-pool` before and after; no user was created. The clean unrestricted run showed no IndexedDB or Service Worker leakage, duplicate StockMovement, duplicate reservation, duplicate MachineUsage, changed inventory totals, or changed Work Order lifecycle.

## Physical-device status

No physical iPhone or Android validation was performed in this stage. The affected responsive error flow has browser coverage at 390×844, but real touch, keyboard, assistive-technology and network-transition behavior remains unverified on physical devices. Physical-device validation is not required to close this bounded non-offline U2 migration, and it must not be inferred from Playwright emulation.

## Remaining debt

The global audits remain non-zero: 131 active user-error findings and 373 resolver findings. Activities / Quick Log core is next (9), followed separately by activity-parse API (2). This report does not claim full Inventory UI localization or application-wide localization completion.
