# Sprint 25 Finalization — Remaining-Gap Re-Audit

Date: 2026-07-15
Status: **NO-GO** (unchanged). This is an evidence-based gap audit, produced by reading the actual code on disk — not a completion claim.

## Method

Read against current source, not prior reports: `src/lib/actions/economics.ts`, `src/lib/economics.ts`, `src/lib/operational-costing.ts`, `src/lib/finance-data.ts`, `src/lib/economics-recording.ts`, `src/lib/farm-insights.ts`, `src/app/(farm)/finance/page.tsx`, `src/app/(farm)/fields/**`, `src/lib/economics-export/**`, and the `e2e/**` spec inventory. Where a claim below says "absent" it means no such symbol/route/spec exists on disk today.

## Summary of true state

The **data + server-action layer is largely built and unit-tested** (report claims 520/520). The genuine remaining work is concentrated in: (a) **one missing server action** — financial *correction*; (b) the **UI layer** for correction/reversal/reallocation and Field Detail economics; (c) the **economics Insights set** (only 1 of 12 exists); and (d) **dedicated Sprint 23/24/25 Playwright coverage** (absent). Two parts (13, 14) are gated on resources outside this codebase.

---

## Part 2 — Financial correction

**Exists:** Nothing for correction specifically. `economics.ts` has `reverseInventoryPurchase`, `reverseFinancialRecord` (expense/harvest/revenue), and `allocateEconomicEntry`, but **no `correctFinancialRecord` / `correctPurchase` / `correctExpense` / `correctRevenue` / `correctHarvest` action of any kind.** The only "new effective version on correction" machinery in the repo is Sprint 19's spray-activity flow (`compliance-corrections.ts` + `activity-versions.ts`), which is not wired to any financial record.

**Incomplete:** The entire correction concept for the 7 financial record types (purchase, expense, harvest, revenue, labour, machinery, contractor) — both the server action and the UI.

**User currently sees:** On `/finance`, recent purchases/entries render as read-only text lines; there is no "Correct" affordance anywhere.

**Acceptance criteria:**
- A server action per financial type that: preserves the original (append-only), creates a new effective version referencing it, requires a ≥10-char reason, is idempotent (idempotencyKey), rejects stale-version submissions (expectedVersion), writes an `AuditEvent` (`corrected`), and re-derives the affected `economicEntry` rows exactly once (no double count).
- A correction dialog showing old→new diff and a preview of the effect on field economics before submit.
- Records display one of: Original / Corrected / Current effective / Reversed.
- Unit tests for original-preserved, effective-version, idempotency, stale-version-rejected, economics-recalculated-once; a Playwright Flow E.

## Part 3 — Financial reversal

**Exists:** `reverseInventoryPurchase(id, reason)` and `reverseFinancialRecord({type, id, reason})` — both append-only, both write compensating `economicEntry` rows and an `AuditEvent` (`reversed`), both farm-scoped, both require a ≥10-char reason. `finance-data.ts`/`economics.ts` treat `status: 'reversed'` rows as excluded from effective totals (needs confirmation in the resolver during build).

**Incomplete:** **No UI.** There is no reverse button, no confirmation dialog, no economic-impact preview, and no stock-impact preview on `/finance`. The append-only history is not surfaced.

**User currently sees:** No way to reverse a finalized economic record from the UI at all.

**Acceptance criteria:** A reversal dialog (reason required, confirmation, economic-impact preview, stock-impact where relevant); reversed record stays visible in history and is excluded from effective totals; audit preserved; Playwright Flow F.

## Part 4 — Reallocation

**Exists:** `allocateEconomicEntry({economicEntryId, allocations[], reason})` — versions prior allocations to `status:'corrected'`, bumps `version`, writes new `economicAllocation` rows via `percentageAllocations()` (deterministic cent rounding in `operational-costing.ts`), farm+season scoped, requires ≥10-char reason.

**Incomplete:** (1) **No UI.** (2) The action hard-codes `method:'per_hectare'` on the persisted rows regardless of intent, and does not implement the full method set the brief requires (direct field, selected fields, proportional-by-hectares, proportional-by-yield, crop-level, farm-level unallocated). (3) No preview of total %, rounding difference, remaining unallocated, or affected field economics.

**Acceptance criteria:** A reallocation dialog supporting each method, showing original amount, per-destination %/amount, total, rounding difference, remaining unallocated, and a field-economics preview; full-allocation must total 100%; deterministic rounding; new effective allocation version; original allocation history retained; Playwright Flow G.

## Part 5 — Field Detail economics

**Exists:** Field economics appear only as one **row** in the `/finance` "Field profitability" table (cost, revenue, gross margin, cost/ha, yield, cost/unit, budget variance, completeness). The underlying resolver (`finance-data.ts`) computes these per field-season.

**Incomplete:** **There is no field detail page** — `src/app/(farm)/fields/` contains only `page.tsx`, `map/`, and `import/brp/`; no `[id]/page.tsx`. So none of the required Field Detail surface exists: no per-category breakdown (labour/machinery/fuel/contractor/overhead), no break-even, no missing-category display, no source-record links, and none of the actions (Add expense/harvest/revenue, Correct, Reallocate, Export field report).

**Acceptance criteria:** A `fields/[id]` (or field-season detail) route rendering every metric in Part 5, every metric linking to its source records, never showing missing data as zero, with the listed actions wired in.

## Part 6 — Economics Insights

**Exists:** `farm-insights.ts` implements exactly **one** of the requested economics insights: `missing-price` (products missing a purchase price). All other insights present are operational (tasks, stock, compliance, spray window).

**Incomplete:** 11 of 12 requested economics insights are absent: missing employee rate, missing machine rate, unallocated expense, unallocated revenue, field over budget, yield below plan, cost/ha increased, repeated-activity cost increase, break-even above sale price, field-profitability-incomplete, contractor-cost-above-plan.

**Acceptance criteria:** Each new insight is rule-based with title, evidence, affected field/crop, completeness, why-it-matters, confidence, next action, and an explicit rule-based label; no causal claim without evidence; unit tests.

## Part 7 — Dashboard economic signals

**Exists (to verify during build):** dashboard reads shared resolvers (`dashboard-shared-resolvers.test.ts` exists). Whether any economic signal is surfaced needs confirmation in `dashboard-data.ts`.

**Incomplete:** The specific actionable economic signals (most-important missing input, largest budget variance, highest cost/ha risk, unallocated record, break-even warning, strongest complete-field margin) are not confirmed present and must not rank incomplete fields.

**Acceptance criteria:** Only actionable, evidence-backed signals; no profitability ranking for incomplete fields.

## Part 8 — Dedicated Sprint 23 E2E

**Exists:** `e2e/` has golden-path, failure-paths, isolation, accessibility, mobile/critical-flow, sprint16/18/19/20 specs, founder-walkthrough, pilot/smoke. **No sprint23 spec.**

**Incomplete:** All 12 Sprint 23 scenarios (field map/detail, season plan, plan→WorkOrder, reservation, WorkOrder→Activity, stock deduction, WO completion, plan-vs-actual, resource blocker, cross-farm WO attack, offline WO completion, mobile WO) lack dedicated coverage.

## Part 9 — Dedicated Sprint 24/25 E2E

**Exists:** None dedicated. **No sprint24 or sprint25 spec.**

**Incomplete:** Flows A–J (purchase/weighted-valuation, labour/machinery, harvest/revenue, missing-data, correction, reversal, reallocation, offline finance, reports, mobile) absent. Must reuse the fixed Clerk pool; create no new Clerk users.

## Part 10 — Skipped E2E

**Exists:** `e2e/pilot/smoke.spec.ts` — the intentionally-skipped pilot-auth smoke (no configured pilot storage-state).

**Incomplete:** It must either be made deterministic and enabled, or moved to a clearly named non-blocking contract-test suite with the external dependency documented. Core local suite target: zero unexplained skips.

## Part 11 — Offline optional-field regression

**Exists:** The report states the payload serializer now omits blank optional values, with a regression **unit** test. `activities.ts` `submissionHash`/`clean()` and `economics.ts` `clean()` strip empty strings.

**Incomplete:** No **Playwright** coverage that an offline draft with empty optional fields restores and syncs without converting blanks into invalid enum/number values.

## Part 12 — Security (cross-farm)

**Exists:** Every economics action verifies farm ownership (`getActiveFarmOrThrow` + `where:{...farmId:farm.id}` on every lookup, confirmed by reading `economics.ts`). Export resolver is ownership-scoped per report.

**Incomplete:** No dedicated cross-farm E2E for economic record detail, correction, reversal, allocation, Field Detail economics, insights, PDF/CSV export, or offline finance queue item. Needed as explicit server-side-rejection tests.

## Part 13 — Full validation

Gated on external execution approval. Requires: prisma generate/migrate status, tsc, vitest, build, then `test:e2e` **twice** clean, Clerk count stable (4 fixed-pool users, no new), no SW/IndexedDB leakage. Record duration/collected/passed/skipped/failed + Clerk before/after.

## Part 14 — Physical mobile gate

`docs/BETA_ACCEPTANCE_CHECKLIST.md` already carries a Sprint-25 device matrix (all rows **NO-GO / Not run**). Must be expanded to the full Part-14 action list and must not be marked passed without real device evidence.

## Part 15 — Final report

`docs/Sprint_25_Complete_Farm_Economics_Report.md` to be updated only after the above; must retain honesty guarantees (missing ≠ zero; gross margin ≠ net/statutory profit) and give a GO/NO-GO gated on two clean consecutive E2E runs.

---

## Build order recommendation

1. **Server action first** — financial `correctFinancialRecord` (Part 2 backend), the one true missing primitive; reuse Sprint 19's version-chain pattern (`activity-versions.ts`) adapted to financial records.
2. **UI on the existing `/finance` surface** — reversal + correction + reallocation dialogs (Parts 2–4 frontend), reusing Sprint 19 dialog patterns (`CorrectionDialog`/`ReversalDialog`).
3. **Field Detail route** (Part 5) reusing `finance-data.ts` per-field resolver.
4. **Insights** (Part 6) + dashboard signals (Part 7) in `farm-insights.ts`/`dashboard-data.ts`.
5. **E2E** (Parts 8–12) reusing the fixed Clerk pool and `resetNamedE2eUser`.
6. **Validation + report** (Parts 13–15), gated on execution approval and physical devices.

This is a multi-session effort; several parts (13 double-run, 14 physical devices) cannot be closed from code alone.
