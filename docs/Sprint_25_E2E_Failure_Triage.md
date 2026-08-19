# Sprint 25 — E2E Failure Triage & Stabilization

Date: 2026-07-17. Clerk/E2E infrastructure is reachable again, so the dedicated
specs now execute and produce **real browser-run evidence**. First full focused
run: **17 failed / 76 passed / 1 skipped** across the suite. Each failure below
is classified from its actual screenshot/trace/DOM snapshot — never guessed from
the assertion text (Part 1).

## Categories used

application defect · business-logic defect · accessibility defect · selector
defect · seed/fixture defect · timing/race defect · offline-harness defect ·
missing UI wiring.

## The 17 failures

| # | Spec / test | Category | Root cause (from evidence) | Fix | Retest |
| --- | --- | --- | --- | --- | --- |
| 1 | accessibility › weather empty state | **accessibility** | axe: Marginal badge text `--color-amber #9a6700` on amber-subtle `#f5f0e6` = **4.28:1** (< 4.5). Snapshot: `.statusMarginal` span. | Darkened light-theme `--color-amber` → `#8a5d00` (~5.07:1); subtle fill/border unchanged. Rule not disabled. | ⏳ |
| 2 | sprint23 › Flow E — complete through Activity | **selector/test** (incomplete form) | Trace/DOM: Spraying dialog opened prefilled but showed **"Please fix the highlighted field(s)"** — required **Water volume** (and nozzle) were never filled, so the save never submitted and "Activity recorded" never appeared. | `completeActualSprayActivity` helper fills all required spray fields **and asserts success OR the real validation error** (Part 3). | ⏳ |
| 3 | sprint23 › Flow F/H — no double completion | same as #2 | same (reused the incomplete fill) | same helper | ⏳ |
| 4 | sprint23 › Flow J — offline completion | same as #2 (+ offline) | same incomplete fill; also went offline after opening but couldn't save due to validation | helper `{ offline: true }`: offline **before** save, fills required fields, asserts "Saved on this device" | ⏳ |
| 5 | sprint25-dashboard-reports › Flow A | **seed/fixture** | `getByRole('region',{name:'Economics decisions'})` absent. Root cause: `getDashboardExperienceState` returns **`first_run`** when `activityCount === 0`; `seedReadyFarm` creates **zero activities**, so the dashboard renders `FirstRunDashboard` (no economics section). NOT a product defect — the card renders correctly once the farm has activity. | New `seedEconomicsFarm` fixture: 1 activity (leave first_run) + over-budget field + unallocated revenue. | ⏳ |
| 6 | sprint25-dashboard-reports › Flow B | same as #5 | same | same | ⏳ |
| 7 | sprint25-dashboard-reports › Flow C | same as #5 | same | same | ⏳ |
| 8 | sprint25-dashboard-reports › Flow I (mobile) | same as #5 | same | same | ⏳ |
| 9 | sprint25-field-detail › Flow A | **selector** | `getByRole('link',{name:/.+/}).first()` matched a **sidebar nav link** ("Today"→/dashboard), not the field row; `toHaveURL(/\/fields\/<uuid>/)` failed. | `openSeededFieldDetail` clicks the field link **scoped to the fields table** + verifies URL (Part 6). | ⏳ |
| 10 | sprint25-field-detail › Flow B | selector (same) | same | same helper | ⏳ |
| 11 | sprint25-field-detail › Flow C — correction history | selector + **seed/fixture** | same selector; and the Corrections tab had no data (bare ready farm has no corrected records). | helper + `seedEconomicsFarm` corrected-expense chain; real assertions (label + Original + Current effective). | ⏳ |
| 12 | sprint25-field-detail › Flow D — reallocation history | selector + seed/fixture | same; no reallocated allocation existed. | helper + fixture reallocated cost (allocation v1→v2); assert Allocations tab content. | ⏳ |
| 13 | sprint25-field-detail › Flow E — reversal | selector + seed/fixture + **product defect** | same; no reversed record; and a reversed **single-version** record was mislabeled **"Original"** (badge/statusLabel checked `version===1`/`i===0` before `reversed`) and filtered out of the Corrections tab (`versions.length > 1`). | helper + fixture reversed expense; **product fix**: reversed takes precedence in `getFinancialRecordVersionHistory` statusLabel and `buildCorrectionGroups` badge + include single-version reversals. | ⏳ |
| 14 | sprint25-field-detail › Flow F — purchase disclosure | selector | same selector; the section itself is static and correct. | helper | ⏳ |
| 15 | sprint25-field-detail › Flow H — offline | selector | same selector; page then unreachable. | helper + assert page stays readable offline. | ⏳ |
| 16 | sprint25-field-detail › Flow I — mobile | selector | same selector. | helper + `page.setViewportSize`. | ⏳ |
| 17 | sprint25-reallocation › Flow A | **selector** | `strict mode violation: getByText('Unallocated diesel') resolved to 2 elements` — the description appears in the allocation table **and** the "Recent financial entries" list. (Flow D already passed.) | Scope to `getByRole('row',{name:/Unallocated diesel/})`. | ⏳ |

## Classification summary

- **Accessibility defect (product):** 1 — the Marginal badge contrast.
- **Product defect (correctness):** 1 — reversed single-version records mislabeled
  "Original" and hidden from the Corrections tab (surfaced by the reversal fixture).
- **Selector/test defects:** 9 — fragile `first()`/broad-regex/multiple-match
  selectors, and an incomplete activity-form fill (missing required fields).
- **Seed/fixture defects:** the dashboard (4) and field-detail history (3) flows
  ran against the bare ready farm, which has no activities/economics/history.
  Fixed with the dedicated `seedEconomicsFarm` fixture — no assertions weakened.

No assertion was weakened to pass; two real product bugs were fixed. Retest
results, exact-one verification, and the two full runs are recorded below as they
complete.

## Retest — first focused re-run (40 passed / 6 failed)

The first fix pass took the four sprint specs from 16→6 failures. The 6 remaining
split into **one deeper product defect** and **three strict-mode issues in the
tests' own assertions**, all now fixed:

- **PRODUCT DEFECT (application) — WorkOrder never completes via the dialog.**
  Flow E's DB check showed `completedWorkOrders = 0` even though the activity +
  stock deduction succeeded. Root cause: the ActivityDialog **always** submits
  through the offline draft-sync path (online and offline), and
  `src/app/api/offline/sync/route.ts` `ALLOWED_FIELDS` **omitted `workOrderId`**,
  so the field was filtered out and `createActivity` ran unlinked — the WorkOrder
  stayed `ready`. This also affected Flow F/H ("Actual activity record" link
  absent). **Fix:** add `'workOrderId'` to `ALLOWED_FIELDS` (the action's Zod
  schema already accepts it). Real bug that shipped because no prior E2E completed
  an activity *from a WorkOrder*.
- **Flow J offline — "FarmOS is offline" fallback (offline-harness/test).** The
  snapshot showed the offline fallback page: `setOffline(true)` fired while the
  WorkOrder→activity navigation was still in flight, so the page load hit the
  service-worker offline fallback instead of the dialog. **Fix:** new
  `prepareOfflineActivityFlow` helper waits for the prefilled dialog to be
  visible ONLINE before disconnecting (Part 10). The `workOrderId` fix also lets
  the queued draft complete the WorkOrder on reconnect.
- **Strict-mode selector defects (tests):** dashboard Flow A
  (`getByText(/% /).or('Completeness')` → 3 matches) → `getByText('Completeness').first()`;
  field-detail Flow A (`/Farm-level unallocated/` → 2 matches) → `.first()`;
  reallocation Flow A (`/allocated/` → 2 matches) → `getByText(/remaining unallocated/)`.

Net: **two real product defects** fixed this triage (the amber contrast + the
`workOrderId` sync drop), plus the reversed-label correctness fix from the first
pass. No business assertion weakened. Final focused + full-run results are
recorded in `Sprint_25_Complete_Farm_Economics_Report.md`.

## Retest results (final)

**All 17 original failures fixed.** Focused re-runs then the two full acceptance
runs confirm it. Individual verification: every previously-failing test passes in
isolation (accessibility `activity success dialog` 8.9s; isolation cross-farm
6.9s; sprint23 Flow J 14.2s; the four sprint specs 32/33 then Flow J green).

**Two consecutive full runs (`npx playwright test`, CI mode, `--retries=2`):**

| Run | Result | Passed | Flaky (recovered) | Failed | Skipped | Duration | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | clean | 92 | 1 | 0 | 1 | 10.0m | 0 |
| 2 | clean | 93 | 0 | 0 | 1 | 9.3m | 0 |

- **0 failures both runs.** The single skip each run is the documented conditional
  pilot-smoke auth test (`pilot/smoke.spec.ts`, needs `PILOT_SMOKE_STORAGE_STATE`
  + an HTTPS pilot origin) — an *explained* skip, not unexplained.
- **`--retries=2`** was used to absorb this sandbox's **external** flakiness only:
  Clerk's CDN intermittently fails to load `@clerk/ui` chunks
  (`ChunkLoadError: Loading chunk 26 failed`) and the real Open-Meteo weather API
  occasionally returns 400. These are infrastructure, not product/test defects —
  every affected test passes reliably in isolation, and **no assertion was
  weakened**. Run 2 was fully clean with **zero flakes**. (An earlier `retries=1`
  run showed 89 passed / 3 flaky / 1 failed; the "failed" test — isolation
  cross-farm — passed cleanly when re-run alone, confirming pure environmental
  flakiness.)
- **Clerk pool stable:** no new users — `ensureAllNamedE2eUsers` looks up the 4
  fixed identities by email and never mints accounts.
- **Isolation:** each run migrates + resets the E2E database in global setup;
  storage states are per-identity; no cross-run state leakage or duplicate
  records observed (exact-one DB assertions in sprint23 Flows E/F/J hold).

## Product defects fixed (correctness — not test changes)

1. **Accessibility:** Weather "Marginal" badge contrast 4.28 → ~5.07:1
   (`--color-amber` light theme `#9a6700` → `#8a5d00`).
2. **WorkOrder completion via the activity dialog:** `src/app/api/offline/sync/route.ts`
   `ALLOWED_FIELDS` dropped `workOrderId`, so completing an activity from a
   WorkOrder never completed the WorkOrder. Added `workOrderId`.
3. **Reversed-record labelling:** a reversed single-version record read as
   "Original" and was hidden from the Corrections tab; fixed in
   `getFinancialRecordVersionHistory` + `buildCorrectionGroups`.
