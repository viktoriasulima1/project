# Sprint 24 — Field Economics Report

Date: 2026-07-15

## Delivered foundation

- Normalized farm/season/field economic entries and purchase, expense, harvest, and revenue records.
- Atomic weighted-average inventory purchases with stock movement, valuation update, and audit event.
- Immutable activity input-price snapshots; later inventory prices do not rewrite history.
- Append-only economic compensation for regulated activity correction and reversal.
- Explicit expense/revenue allocation, field/crop aggregation, completeness, budgets, and break-even resolvers.
- Finance operational center and shared dashboard snapshot.

## Honesty guarantees

Missing cost or revenue is `null` and rendered as “Not recorded”, never as zero. This includes old input activities without a valuation snapshot and absent unallocated/expected/approved values. Gross margin appears only when recorded field cost and received revenue exist. Break-even is blocked at low completeness or unit mismatch. Purchases affect inventory value but are not double-counted as field expense. Gross margin is not net profit or statutory profit.

## Automated validation

| Check | Result |
|---|---|
| `npx prisma generate` | PASS |
| `npx prisma migrate status` | PASS — current, 13 migrations |
| `npx tsc --noEmit` | PASS |
| `npx vitest run` | PASS — 496/496 in 48 files, 31.15 s |
| Economics resolver | PASS — 46 table-driven tests |
| `npm run build` | PASS — Next.js 16.2.9, 24.6 s |

The first full Playwright attempt exposed one stale Sprint 16 assertion after the intentional Finance redesign. It was classified as a **test defect**, updated for the new field-economics UI and honest missing-data state, and passed its focused rerun 2/2 in 50.8 s. No application, Clerk/network, or timeout defect remained.

| Clean full E2E run | Collected | Failed | Exit | Duration |
|---|---:|---:|---:|---:|
| Run 1 | 62 | 0 | 0 | 377.6 s |
| Run 2 | 62 | 0 | 0 | 374.9 s |

The pilot smoke test remains intentionally skipped without a configured pilot storage-state file. The fixed Clerk pool contained 4 named users before and after both runs; no new users were created. No service-worker state leaked between runs, and IndexedDB reset remained isolated per test/user context.

## Evidence

- Existing full E2E regression covers cross-tab Web Locks, lease fallback, ownership/sign-out isolation, recovery import review state, storage diagnostics, service-worker preservation, and the production guard. Both consecutive runs passed without duplicate sync or leaked state.
- Activity completion freezes quantity, unit cost, source, and valuation time. Correction/reversal creates compensating entries rather than rewriting history.
- Imported regulated recovery data remains `needs_review` and cannot be treated as submitted.
- Persistence denied remains an honest, distinct diagnostic state.
- Weighted-average math, allocation, missing-versus-zero, unit mismatch, completeness, yield/ha, cost/unit, gross margin, break-even, and budget variance are unit-tested.

## Remaining limitations / NO-GO

- Dedicated Sprint 23 browser scenarios remain absent.
- Dedicated Sprint 24 purchase-to-margin, correction, cross-farm, and mobile Playwright flows are absent.
- Employee/machine rate editing and per-worker actual-hours capture lack a complete UI/snapshot workflow.
- WorkOrder-specific contractor attachment and multi-field reallocation UI are absent.
- CSV/PDF economics exports, field-detail economics, and the full financial Insights set are absent.
- Expense/harvest/revenue offline queue types are absent; the server remains authoritative.
- Physical iPhone and Android finance, offline/reconnect, auth, service-worker update, and cross-tab scenarios remain unverified.

Sprint 24 is **FOUNDATION IMPLEMENTED / NO-GO FOR FINANCIAL FIELD PILOT COMPLETION**. Automated success alone does not complete the sprint; physical-phone validation and the listed workflow gaps must close first.
