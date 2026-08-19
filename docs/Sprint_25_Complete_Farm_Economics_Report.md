# Sprint 25 — Complete Farm Economics Report

Date: 2026-07-15

## Current delivery status

Sprint 25 is in implementation and remains **NO-GO**. This report must not be read as a completion claim.

## Implemented in this iteration

- Evidence-based Sprint 24 completion audit.
- Versioned employee and machine rates with effective periods.
- Immutable labour and machine/fuel activity snapshot models.
- Multiple WorkOrder employee planned/actual-hour fields.
- Fuel inventory link and included-versus-separate double-count prevention.
- Contractor rate types and activity/WorkOrder links with duplicate guard.
- Persisted, versioned percentage allocations with deterministic cent rounding.
- Exact-one database identifiers for expense, purchase, harvest, and revenue drafts.
- Finance offline sync route integrated with the existing lock/retry/isolation queue.
- Seven stable economics CSV datasets and six A4 economics PDF report types.
- Economics Reports page, ownership-scoped export resolver, export audit event, formula-injection protection, and disclaimer.
- Append-only reversal action for expense, harvest, and revenue with economic compensation.

## Validation recorded so far

- Prisma schema valid.
- 15 migrations applied; database current.
- TypeScript: PASS after final local changes.
- Unit tests: **520/520 PASS** in 50 files, 31.99 s.
- New operational-costing scenarios: 19/19 PASS.
- Prisma: generate PASS; 15 migrations applied; database current.
- Production build: PASS with Next.js 16.2.9, 26.3 s.
- First full Playwright attempt: 62 collected; 60 passed, 1 intentionally skipped pilot-auth smoke, 1 failed, 379.6 s. The failure was an activity offline payload validation conflict in an existing accessibility flow. It was classified as an **application defect**: blank optional operational inputs were serialized as empty strings. The payload serializer now omits blank optional values and has a regression unit test.
- A focused E2E rerun and the required second full run could not be executed because the external test-run approval quota was exhausted. They remain required; no clean E2E claim is made.

## Remaining completion blockers

- Rate configuration and per-worker actual-hours UI is not complete.
- Activity form does not yet expose every machine/fuel input cleanly.
- Finance autosave/restore/review UI for all four offline draft types is not complete.
- Full correction workflows and effective-version UI for every financial type are incomplete.
- Persisted allocation editing/review UI and all category/farm aggregate drill-downs are incomplete.
- Field-detail economics and the complete requested rule-based Insights set are incomplete.
- Report filters/preview need the full date/field/crop/category/completeness set and real Unicode-font verification.
- Dedicated Sprint 23–25 Playwright flows are not yet complete.
- The repaired Playwright scenario, a clean full run, and the required second consecutive full run remain outstanding.
- Physical iPhone/Android finance validation has not occurred.

Gross margin remains recorded revenue minus recorded operational cost, not net profit or statutory profit. Missing data remains unknown, never zero. The economics pilot remains **NO-GO** until the blockers above close and physical mobile validation passes.

## Reallocation iteration (2026-07-15)

Scope this iteration: the reallocation **integrity core**, plus the earlier financial-correction and economics-insights work.

1. **Reallocation model** — `EconomicAllocation` is fully versioned (`version`/`status`/`correctionOfId`/`reason`); the existing `allocateEconomicEntry` action versions prior allocations. Audited in `docs/Sprint_25_Reallocation_Audit.md`.
2. **Supported record types** — expenses, revenue, subsidies, contractor, overhead. Unsupported (activity-linked inventory/labour/machinery, finalized purchases, reversed, compliance) are enumerated and reasoned in `docs/FINANCIAL_REALLOCATION_POLICY.md`.
3. **Allocation methods** — direct, selected (%/amount), per-hectare, per-yield (blocked on missing yield), crop-level, unallocated — all resolved by the new pure engine.
4. **Rounding algorithm** — deterministic largest-remainder in integer cents (`percentageAllocations` + `distributeCents`); documented in `docs/FINANCIAL_ALLOCATION_ROUNDING_POLICY.md`; parent equals children exactly.
5. **UI workflow** — **NOT built this iteration** (ReallocationDialog + Finance sections/filters deferred).
6. **Preview behavior** — new pure `previewReallocation` (`src/lib/reallocation-preview.ts`, outside any `'use server'` file): method resolution, all integrity blocks, deterministic cents, before/after field & crop impact, honest missing-margin ("Margin impact cannot be calculated because revenue is not recorded").
7. **Versioning/audit** — model + existing action support it; write-action **hardening deferred** (stale-version, idempotency, `allocation_changed` event, directly-linked/reversed gating).
8. **Economics recalculation** — via shared resolvers (`finance-data.ts`); no duplicate stored totals.
9. **Security** — the engine computes only from farm-supplied data (no cross-farm leakage); server-side destination/source validation for the write path is **deferred** with the action hardening.
10. **Unit tests** — reallocation preview **23/23**; rounding covered in `operational-costing.test.ts`. Financial correction **9/9**; purchase reversal-only policy **5/5**; economics insights **11/11**. **Full suite: 568/568 PASS**, `tsc --noEmit` clean, production build PASS.
11. **E2E** — reallocation Playwright flows A–G **NOT yet written**; no E2E was executed this iteration (external runner gated). **No clean-E2E claim is made.**
12. **Remaining gaps** — ReallocationDialog + Finance integration; write-action hardening (concurrency/idempotency/security/audit); offline read-only block; Field Detail economics; version-history timeline; dashboard signals; remaining reports; dedicated E2E; physical mobile validation.
13. **GO/NO-GO** — **NO-GO.** Two clean consecutive E2E runs and physical-device validation remain outstanding.

## Reallocation write path (2026-07-15)

The persisted reallocation **server write path** now exists (the dialog/UI does not yet).

1. **Authoritative server preview** — `reallocateEconomicRecord` (`src/lib/actions/reallocation.ts`) resolves the source `EconomicEntry` and destinations from the DB and calls `previewReallocation()` as the **only** allocation-math source; it never recomputes a formula and asserts the engine's exact parent==children reconciliation before persisting.
2. **Versioning** — prior active `EconomicAllocation` rows → `status:'corrected'`; a new effective `version+1` set is inserted; `correctionOfId` links the chain; originals stay queryable.
3. **Idempotency** — a shared idempotency key + `submissionHash`: same key/same payload returns the existing result; same key/different payload → `idempotency_conflict`; the key is indexed (one reallocation writes many rows).
4. **Stale-version protection** — `SELECT … FOR UPDATE` row lock on the source entry plus an optimistic `expectedVersion` check → *"This financial record changed while you were reviewing it…"*.
5. **Directly-linked / reversed / currency** — `inventory_input/labour/machinery/fuel` source types are rejected (`directly_linked_cost`), reversed records `record_reversed`, cross-currency `currency_mismatch`.
6. **Audit** — `allocation_created` / `allocation_changed` with a correlation id and safe metadata (versions, method, cents, affected field-seasons); no notes/PII; no misleading recalculated event (totals are dynamic).
7. **Safe error model** — 16 explicit categories; raw Prisma/SQL errors are never exposed.
8. **Migration** `sprint25_reallocation_write_path` — `selected_fields` (method enum), `allocation_*` (audit enum), and `idempotencyKey`/`submissionHash`/`correlationId`/`createdBy`/`sourceRecordVersion` columns + index on `EconomicAllocation`.
9. **Unit tests** — reallocation write path **25/25**; preview engine **23/23**. **Full suite: 593/593 PASS**, `tsc` clean, `prisma migrate status` current (16 migrations), production build PASS.
10. **E2E** — reallocation Playwright flows A–J **NOT yet written/executed** (dialog + runner gated). **No clean-E2E claim.**
11. **Remaining for this slice** — the `ReallocationDialog` (4-step) + Finance page sections (unallocated / partial / reallocated) + filters + before/after impact UI + success experience (Parts 11–16), the offline read-only block, component tests, and the 10 Playwright flows. A farmer **cannot yet reach** reallocation through the UI.
12. **GO/NO-GO** — **NO-GO.** Next remaining slice: **ReallocationDialog + Finance integration**, then **Field Detail economics + version-history timeline**.

## Reallocation UI integration (2026-07-15)

The reallocation engine + write path is now **reachable and usable from Finance**.

1. **Authoritative server preview** — `previewReallocationForRecord` loads per-field economics (`getFinanceData`) and runs the shared `previewReallocation()` engine; the dialog renders it and never computes allocation math.
2. **Allocatable-records loader** — `getAllocatableRecords` (bounded ≤100) surfaces records with allocation status + effective version; activity-derived source types excluded.
3. **ReallocationDialog** (`src/components/finance/reallocation/`) — 4-step (method → destinations → preview → confirm → result): before/after field impact, honest missing-margin, rounding difference, remaining unallocated, blocked-preview gating, reason-required-on-change, stable idempotency key, loading state, **stale-version UX** ("Reload current allocation"), **offline read-only** banner, success result with effective version.
4. **Finance sections** — `AllocationSection` renders Unallocated / Partially allocated / Recently reallocated with Allocate/Reallocate actions and empty states; wired into `/finance`.
5. **Tests** — server preview action **6/6**, allocatable loader **6/6** (Part 16). Write path **25/25**, preview engine **23/23**. **Full suite: 605/605 PASS**, `tsc` clean, `prisma migrate status` current, production build PASS.
6. **E2E** — `e2e/sprint25-reallocation.spec.ts` **written (Flows A, D) but NOT executed** (runner gated). No pass claimed. Flows B/E/F/G/H/I/J still to add + run (need extra seeded data / offline harness).
7. **Deferred** — status filters/pagination, standalone allocation-details/history view, component interaction tests (no RTL harness — not adding one just for this dialog), physical mobile validation.
8. **Slice status** — a farmer **can now** reach allocation from Finance, get a server-generated preview, persist exactly the previewed allocation (old version preserved, new effective version), and see Finance recalc. Remaining for full sign-off: **execute the Playwright flows twice clean** + physical devices.
9. **GO/NO-GO** — **NO-GO** (E2E + physical devices outstanding). Next slice: **Field Detail economics + complete version-history timeline**.

## Field Detail economics + version history (2026-07-16)

Every field is now economically understandable and every financial change is
traceable from original record to current effective result, via a new
farm-scoped query layer and a full Field Detail page.

1. **Audit** — `docs/Sprint_25_Field_Detail_Economics_Audit.md`: before this
   slice there was **no `fields/[id]` route** at all; a rich per-field resolver
   existed but was only surfaced as one big Finance table row, with no
   drill-down, no source records and no visible history (all present in the DB,
   none queried for a field).
2. **Pure logic** — `src/lib/field-economics.ts` (outside any `'use server'`
   file, unit-tested): `categoryForSource` + `buildCostBreakdown` (share of
   *recorded* cost; unpriced → Partial, never €0), `directVsAllocated` (farm
   unallocated never folded into field margin), `breakEvenExplanation` (exact
   blocking reasons; no low-confidence number), `compareVersions` (before/after
   with honest missing-margin), `completenessActions`, and
   `fieldActionAvailability`/`lastSyncedLabel` (offline gating).
3. **Query layer (Part 18) + security (Part 19)** — `src/lib/field-economics-detail.ts`:
   `getFieldEconomicsDetail`, `getFieldEconomicSourceRecords`,
   `getFinancialRecordVersionHistory` (walks the `correctionOfId` chain),
   `getAllocationHistory`, `getFieldEconomicTimeline`. All farm-scoped (a
   foreign record resolves to null / not-found — never revealed), reversed rows
   excluded from active totals but preserved in history, bounded + paginated,
   Decimals normalized at the boundary, no N+1.
4. **UI (Parts 2–14)** — `src/app/(farm)/fields/[id]/page.tsx` plus
   `FieldEconomics.module.css`, the reusable **`FinancialVersionTimeline`**
   (Part 10, no edit affordance), `FieldEconomicsHistory` (Timeline /
   Corrections / Allocations tabs), and offline-aware `FieldActionsBar`. Field
   names on `/fields` now link to the detail page. Sections: header, summary
   metrics, completeness + actions, cost breakdown, direct-vs-allocated,
   break-even, budget-vs-actual, source records, unified history, purchase
   reversal-only disclosure, contextual actions.
5. **Tests** — `field-economics.test.ts` (pure helpers) + `field-economics-detail.test.ts`
   (resolvers, mocked db) = **31 new**, covering summary/direct/allocated,
   break-even 11–16, version history 17–24, allocation 19, timeline 25–30,
   cross-farm security 31–34, offline 35–36. **Full suite: 636/636 PASS**, `tsc`
   clean, `prisma migrate status` current, production build PASS.
6. **E2E** — `e2e/sprint25-field-detail.spec.ts` **written (Flows A, B, G, H)
   but NOT executed** (runner gated). No pass claimed. Flows C/D/E/F/I still to
   add + run (need seeded corrected/reallocated/reversed data + an offline
   harness).
7. **Deferred** — physical mobile validation; executing all Sprint 23–25
   Playwright flows twice clean; the mutation dialogs are reachable via the
   Finance page (the field actions link there) rather than duplicated on the
   field page this slice.
8. **GO/NO-GO** — **NO-GO.** Next remaining slices: dashboard economics signals,
   economics reports completion, all dedicated Sprint 23–25 E2E, two clean runs,
   physical mobile validation.

## Dashboard economics signals + reports (2026-07-16)

The farmer-facing financial decision layer: focused Dashboard signals plus the
completed economics report center — every signal/report traceable to real
recorded data, no incomplete field ranked as if complete.

1. **Audit** — `docs/Sprint_25_Dashboard_Reports_Audit.md`: the Dashboard had no
   dedicated economics signals (only the generic briefing); the `FinancialSnapshot`
   path had a €0-fallback hazard (isolated to one card). Reports were ~80% built
   (7 CSV + 6 PDF types, farm-scoped route, audit event, formula protection,
   disclaimer).
2. **Shared signal resolver (Parts 2-4)** — `src/lib/farm-economic-signals.ts`
   `buildEconomicSignals` is now the **single source**; `getFarmEconomicSignals`
   wraps it for the Dashboard and `resolveEconomicsInsights` adapts it for Farm
   Insights (Part 7 — no duplicate logic). Emits the derivable signals (budget
   variance, missing price/labour-rate/machine-rate, unallocated cost/revenue,
   break-even-above-sale on complete fields only, incomplete profitability,
   strongest **complete** margin); defers the ones needing inputs FinanceData
   lacks — see `docs/ECONOMICS_SIGNAL_RULES.md`.
3. **Dashboard UI (Parts 5-6)** — `EconomicsDecisionsCard`: a season economics
   strip ("Cost tracking active — profitability is incomplete." when not ready)
   plus the **top 3** signals with real CTA routes (no dead ends); a link to the
   full list in Farm Insights. Wired full-width into the dashboard.
4. **Reports (Parts 8-16)** — reused the existing engine; added the
   **`unallocated_records`** CSV (excludes activity-derived direct costs) and
   **export provenance**: a SHA-256 content checksum + record count + app version
   in the audit metadata, `x-export-checksum` header, and sanitised filenames.
   Reports page states offline generation is unavailable.
5. **Tests** — `farm-economic-signals.test.ts` + `economics-export.test.ts` +
   `economics-export-data.test.ts` = **28 new**, covering signals 1-14 (ranking
   exclusion, max-3, priority order, shared-source consistency, missing≠0) and
   reports 15-32 (headers, reversed-excluded, unallocated, purchase snapshots,
   formula injection, cross-farm rejection, PDF generation). Existing insights/
   dashboard tests still pass after the refactor. **Full suite: 660/660 PASS**,
   `tsc` clean, `prisma migrate status` current, production build PASS.
6. **E2E** — `e2e/sprint25-dashboard-reports.spec.ts` (Flows A–I) + finished
   `e2e/sprint25-field-detail.spec.ts` (Flows C–F, I). **Written, typechecked,
   NOT executed** — runner gated; no pass claimed.
7. **Deferred** — the full report filter matrix (Part 15), signals needing extra
   FinanceData inputs, and physical mobile validation.
8. **GO/NO-GO** — **NO-GO.** Remaining: full dedicated Sprint 23–25 E2E written
   AND executed, two clean consecutive runs, physical iPhone/Android validation.

## Final closure — E2E execution, stability runs, mobile gate (2026-07-16)

This iteration attempted to execute and close all Sprint 23–25 browser
validation. The honest outcome: **execution is externally blocked in this
environment; no E2E pass and no mobile evidence are claimed.**

1. **Dedicated Sprint 23 E2E results** — **NOT executed** (Clerk gated). The
   previously-missing spec now **exists**: `e2e/sprint23-workorder-lifecycle.spec.ts`
   (**WRITTEN / TYPECHECKED / NOT EXECUTED**) covers Flows A–K (plan→WorkOrder,
   reservation, blockers, start, complete-through-Activity, exact-one/no-double-
   completion, cancel, cross-farm, offline, mobile) with UI **and** read-only
   farm-scoped DB assertions (`e2e/setup/db-inspect.ts`). `playwright … --list`
   discovers **12 scenarios**; `tsc` clean. See `docs/Sprint_25_E2E_Inventory.md`
   for the exact-one verification points and the required-fixture follow-ups.
2. **Dedicated economics E2E results** — **NOT executed** (written + typechecked:
   `sprint25-reallocation`, `sprint25-field-detail` A–I, `sprint25-dashboard-reports` A–I).
3. **Dashboard signal E2E results** — **NOT executed** (flows written).
4. **Report E2E results** — **NOT executed** (flows written; the report logic
   itself is unit-tested: CSV headers / formula-injection / cross-farm-403 /
   PDF-generation).
5. **Failures found** — none from E2E (could not run). Executable validation
   surfaced no failures.
6. **Bugs fixed** — one real defect in this slice's own deliverable:
   `scripts/verify-exact-one.ts` disconnected a throwaway Prisma client instead
   of the working one (fixed). No product defects introduced; no assertions
   weakened.
7. **Exact-one database verification** — a **read-only** helper
   `scripts/verify-exact-one.ts` was added (WorkOrder completion → one Activity /
   released reservations / stock + compliance counts / correlated audit chain;
   reallocation → exactly one active allocation version with priors preserved +
   audit count; expense status-head counts). Ready to run against a farm after a
   flow executes; **not** run against live flow data because the flows could not
   execute.
8. **Full run 1** — Executable portion **PASS**: `prisma migrate status` current
   (16 migrations), `tsc --noEmit` clean, **vitest 660/660**, `npm run build`
   compiled. `npm run test:e2e` — **NOT executed**: the Playwright webServer
   could not start ("Another next dev server is already running") and, decisively,
   the Clerk backend is unreachable (`api.clerk.com`/`clerk.com` time out), so
   `global.setup.ts`'s sign-ins fail. **E2E collected/passed/skipped/failed:
   not applicable — no run.**
9. **Full run 2** — **NOT executed** (same blocker).
10. **Clerk user-count stability** — unchanged: no Clerk calls were made (the
    fixed pool was never touched); **no new Clerk users created.**
11. **IndexedDB / service-worker isolation** — not exercised (no browser run);
    the harness's `resetE2eDatabase` + per-identity storage state remain the
    isolation mechanism, unmodified.
12. **Physical iPhone status** — **NOT RUN** (no device). No success claimed.
13. **Physical Android status** — **NOT RUN** (no device). No success claimed.
14. **Remaining functional limitations** — the Sprint 23 spec's employee/
    machine/weather blocker sub-cases still need extra deterministic fixtures
    (documented); the full report filter matrix is deferred; advanced signals
    needing inputs FinanceData lacks are deferred; **E2E execution + physical
    mobile remain pending** (Clerk network).
15. **GO/NO-GO — economics pilot: NO-GO.** The dedicated Sprint 23–25 specs are
    now all **written + typechecked** (including the new WorkOrder lifecycle
    spec), but the "all pass" and "two consecutive clean full runs" conditions
    cannot be satisfied here because Clerk is unreachable. Cross-farm security,
    missing-data honesty, correction/reversal/reallocation traceability and
    exact-one behavior are covered by **unit tests + code**, but browser-level
    proof is outstanding.
16. **GO/NO-GO — offline mobile pilot: NO-GO.** No physical-device checks and no
    offline exact-one flow run. Blocked on real devices + a reachable Clerk
    backend for the automated pre-checks.

**How to close, once a Clerk-reachable runner + devices are available:** (a)
author the missing Sprint 23 WorkOrder-lifecycle spec; (b) `npm run test:e2e`
twice consecutively, recording collected/passed/skipped/failed/duration + Clerk
user-count before/after; (c) run `scripts/verify-exact-one.ts` against the seeded
farm; (d) complete the physical mobile checklist + offline golden flow in
`docs/BETA_ACCEPTANCE_CHECKLIST.md`. Only then may Sprint 25 be marked complete.

## Clerk preflight hardening (2026-07-16)

Follow-up on the closure attempt: the latest runs were **blocked inside global
setup** (`clerkSetup()` / `clerk.users.getUserList()` → `unexpected_error` /
`fetch failed`). **Zero application scenarios executed** — an external
Clerk/network blocker, not an app or test defect. To make that failure fast,
explicit and non-misleading (without ever bypassing auth or mocking Clerk):

1. **`e2e/setup/clerk-preflight.ts`** — env + `pk_test_`/`sk_test_` shape checks
   (refuses `*_live_`), DNS resolution, and one bounded (8s) authenticated probe
   with ≤3 exponential-backoff retries for transient errors only. Failure
   categories: `missing_env`, `invalid_key`, `dns_failure`,
   `network_unreachable`, `timeout`, `quota_exceeded`, `clerk_service_error`
   (credential/quota not retried). No secrets are ever printed.
2. **`e2e/global.setup.ts` reordered** — preflight → `clerkSetup` → migrate →
   reset → seed → storage states, so the E2E database is **not** reset when the
   auth backend is down. DB safety guards unchanged.
3. **`npm run test:e2e:preflight`** — read-only readiness check (safe DB target,
   pool config, browsers, port, Clerk). Resets no data, creates no users.
   Verified output here: everything PASS except **Clerk connectivity FAIL —
   `timeout`** (DNS resolves; HTTPS to `api.clerk.com` blocked at TCP/TLS).
4. **Validation (no Clerk needed):** `tsc` clean, `vitest 660/660`, `npm run
   build` compiled, `playwright … --list` discovers the specs. **No E2E pass is
   claimed.** Sprint 25 remains **NO-GO**.

## E2E execution, triage & stabilization (2026-07-17)

Clerk connectivity returned, so the dedicated specs **executed** and produced
real browser evidence. First full run: 76 passed / **17 failed** / 1 skipped.
All 17 were triaged from screenshots/traces/DOM (`docs/Sprint_25_E2E_Failure_Triage.md`)
and **fixed** — including three real correctness defects, not test edits:

1. **Accessibility (product):** Weather "Marginal" badge 4.28 → ~5.07:1
   (light-theme `--color-amber` `#9a6700` → `#8a5d00`; axe rule not disabled).
2. **WorkOrder completion (product):** the activity dialog always submits through
   the offline draft-sync route, whose `ALLOWED_FIELDS` **dropped `workOrderId`** —
   so completing an activity from a WorkOrder never completed the WorkOrder.
   Added `workOrderId` to the allowlist (`src/app/api/offline/sync/route.ts`).
3. **Reversed-record labelling (product):** a reversed single-version record read
   as "Original" and was hidden from the Corrections tab — fixed in
   `getFinancialRecordVersionHistory` + the field-detail `buildCorrectionGroups`.

Test/fixture fixes (no assertion weakened): a spray-completion helper that fills
all required fields **and surfaces the real validation error**; a dedicated
`seedEconomicsFarm` fixture (activity + over-budget field + unallocated revenue +
corrected/reversed/reallocated records) so the dashboard leaves `first_run` and
the history flows have real data; a table-scoped `openSeededFieldDetail`; a
`prepareOfflineActivityFlow` helper (load the dialog online before disconnecting;
don't navigate on reconnect — that aborted the sync); and three strict-mode
selector fixes.

**Exact-one verified at the DB level** (read-only `e2e/setup/db-inspect.ts`):
sprint23 Flow E — one Activity, one completed WorkOrder, one consumed
reservation, one stock deduction, `completed` audit; Flow F/H — no double
completion; Flow J — device-local while offline (server counts 0), exactly one
Activity + completed WorkOrder after reconnect sync.

**Two consecutive clean full runs** (`npx playwright test`, CI mode, `--retries=2`):

| Run | Passed | Flaky (recovered) | Failed | Skipped | Duration | Exit |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 92 | 1 | **0** | 1 | 10.0m | 0 |
| 2 | 93 | 0 | **0** | 1 | 9.3m | 0 |

- The one skip each run is the documented conditional pilot-smoke auth test —
  **explained**, not unexplained.
- `--retries=2` absorbs this sandbox's **external** flakiness only: Clerk's CDN
  intermittently failing to load `@clerk/ui` chunks and the real Open-Meteo API
  occasionally returning 400. Every affected test passes in isolation; **no
  assertion was weakened**. Run 2 was fully clean (zero flakes).
- **No new Clerk users** (fixed 4-identity pool, looked up by email). Each run
  migrates + resets the E2E database in global setup; no cross-run state leakage
  or duplicate records; exact-one DB assertions hold.

### GO / NO-GO

**Economics pilot automated gate — GO.** All six criteria met: all dedicated
Sprint 23–25 E2E pass; two full clean runs pass; no unresolved P0/P1 (the two
product defects are fixed); exact-one WorkOrder/Activity/Finance verified at the
DB level; cross-farm security passes (isolation + Flow I + cross-farm
export/field-detail); accessibility serious violations fixed.

**Offline mobile pilot — NO-GO.** Physical iPhone/Android testing and the
physical offline golden flow have **not** been performed (no device in this
environment). This gate stands per `docs/BETA_ACCEPTANCE_CHECKLIST.md`. Unit
tests remain **660/660**, `tsc` clean, production build passing.

## Final consecutive validation rerun (2026-07-17)

The repaired accessibility/offline activity path was first rerun in isolation
and passed. The complete Playwright suite was then run twice consecutively with
no source or test changes between runs:

| Run | Collected | Passed | Failed | Skipped | Playwright duration | Process duration | Exit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 94 | 93 | **0** | 1 | 9.3m | 560.8s | 0 |
| 2 | 94 | 93 | **0** | 1 | 9.6m | 579.8s | 0 |

The one skip in each run is the documented conditional pilot-auth smoke test.
Both runs completed the offline, service-worker, account-isolation, exact-one,
cross-farm, Sprint 23 lifecycle, Sprint 25 economics and mobile-emulation
projects. Identical counts and clean repeated assertions show no observed
service-worker state leak. Per-run database reset and the offline assertions'
exact IndexedDB counts show no observed IndexedDB leak between runs.

Clerk fixed-pool evidence: **5 total users and 4/4 configured fixed-pool users
before; 5 total and 4/4 after**. The setup resolves the same four email
identities idempotently; **0 new users were created**. Intermittent Clerk FAPI
warnings appeared after some tests had ended, but caused no failed or retried
test and are classified as external Clerk/network diagnostics.

Final executable checks after the E2E pair:

- `npx prisma generate`: PASS (Prisma Client 5.22.0).
- `npx prisma migrate status`: PASS; 16 migrations, schema current.
- `npx tsc --noEmit`: PASS.
- `npx vitest run`: **660/660 PASS**, 62 files, 40.53s.
- `npm run build`: PASS, Next.js 16.2.9, 27.4s. The first sandboxed
  attempt could not fetch Geist fonts; the network-enabled rerun passed without
  a code change, so this was classified as infrastructure rather than an
  application defect.

The earlier activity-success failure is closed as an application defect:
optional operational form values were serialized as empty strings and rejected
by offline validation. Blank optional values are now omitted, the regression
unit test passes, the focused browser test passes, and both full runs pass.

### Final gate

**Automated economics gate: GO. Offline field/mobile pilot: NO-GO.** Browser
automation and iPhone viewport emulation do not replace a physical device.
Real iPhone Safari/Add to Home Screen and Android Chrome/installed-PWA tests,
airplane-mode relaunch, Wi-Fi/mobile handoff, OS kill/background suspension,
storage pressure, real session expiry, service-worker update with an unsynced
draft, and the physical exact-one golden flow remain unverified. Sprint 25 and
the offline field pilot must not be marked fully complete until those physical
checks pass with no unresolved P0/P1 defect.
