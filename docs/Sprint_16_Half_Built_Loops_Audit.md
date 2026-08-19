# Sprint 16 — Half-Built Loops Audit

Part 1 deliverable. Read-only inspection of every workflow named in the Sprint 16 brief, plus a correction to a Sprint 15 claim. No code changed in this document.

---

## Correction to Sprint 15's False Completeness Audit (finding #7)

`FarmOS_False_Completeness_Audit.md` §7 stated Employee records have "no certificate number field, no expiry date." Re-reading `prisma/schema.prisma`'s `Employee` model shows this is wrong:

```
certNumber  String?   @db.VarChar(50)
certExpiry  DateTime? @db.Date
```

Both fields exist and are collected during onboarding's employee step. The real, narrower gap: nothing anywhere reads or validates `certExpiry`, and `Activity.operatorName` is a free-text string with no foreign key to `Employee` — so even if a spray validation step wanted to check certification, it has no reliable way to know which `Employee` record a given `operatorName` refers to. This corrected framing is what Part 2 below is scoped against.

---

## Workflow 1 — Spray suitability engine vs. the activity flow

**What appears implemented:** `/weather` shows an hour-by-hour spray suitability forecast with a 0–100 score, status pill, and explanation text. A well-designed engine (`src/lib/spray-window.ts`) exists with hard-blocker/warning separation, confidence scoring, a fail-closed `'planned-application'` mode, and typed context for operator/inventory/machine/crop.

**What is actually implemented:** `computeSprayWindows` is called from exactly one place — `src/app/(farm)/weather/page.tsx` — with only `weatherFetchedAt` passed as context. No product profile, no operator, no inventory, no machine, no crop, and the default `'advisory'` mode (which treats missing context as a soft warning, not a hard blocker). `src/lib/actions/activities.ts` never imports the module at all; a grep confirms the only match there is a code comment.

**What the user currently experiences:** Logging a real spray activity in `ActivityDialog.tsx` shows a raw weather snapshot (temperature/wind/humidity as three numbers) with no score, no blockers, no confidence, no disclaimer, and no connection to the exact same engine one click away on the Weather page. A farmer could log a spray in genuinely unsuitable conditions (high wind, expired product registration, no operator on file) and the form would never say so.

**Missing connection:** No suitability evaluation happens at the one moment — the point of logging a specific spray, for a specific field/product/operator — where it would matter. There is also no server action that assembles real inputs (FieldSeason crop/BBCH, current stock, operator name/cert lookup, machine nozzle type, planned datetime, farm coordinates) and passes them into `computeSprayWindows` in `'planned-application'` mode.

**Acceptance condition for a real end-to-end flow:** Opening the spray form for a real field/product/date shows a suitability result (score, status, blockers, warnings, positive factors, best window, confidence, weather data age, disclaimer) computed from real farm data before the user can submit. A hard blocker (e.g. insufficient stock, no verified product profile in planned-application mode) is visibly different from a low score, and the result updates when the user changes product, field, or date.

---

## Workflow 2 — Planned vs. completed activities

**What appears implemented:** Nothing — there is no UI concept of "planned" today. Every activity, once saved, is treated identically.

**What is actually implemented:** `createActivity` always (a) atomically deducts stock via `$executeRaw` guarded by `currentStock >= totalUsed`, (b) creates a `StockMovement`, and (c) creates a `ComplianceRecord` for `type: 'spray'`. There is no `Activity.status` field in the schema — every row is implicitly "this already happened."

**What the user currently experiences:** A farmer who wants to log that they *intend* to spray tomorrow (to get a suitability check on a future weather window) has no way to do that without it being recorded as a completed, stock-deducting, compliance-generating event today. The only way to represent a future spray is to not log it at all until it's done.

**Missing connection:** No `Activity.status` field, no `'Save as planned'` action distinct from `'Save activity'`, no transition action to mark a planned activity completed later (with a fresh weather snapshot and only-then stock deduction/compliance creation).

**Acceptance condition for a real end-to-end flow:** A user can save an activity as "planned" — no stock deducted, no compliance record created — and later mark it "completed," at which point stock is deducted and a compliance record is created using data captured at completion time (not back-dated to the planning moment). Existing completed-activity behavior (the current default) is unchanged for anyone who doesn't use the new planned path.

---

## Workflow 3 — Finance page

**What appears implemented:** A `/finance` route with a title ("Season P&L, crop margins, and budget tracking") that implies real financial reporting exists.

**What is actually implemented:** `src/app/(farm)/finance/page.tsx` renders a hardcoded `StubPage` unconditionally — it does not query anything, not even the already-real `FinancialSnapshot`/`CropFinancial` models the dashboard's `FinanceSnapshotCard` reads. Separately, and more fundamentally: nothing in the codebase ever *writes* a `FinancialSnapshot` row outside of seed data — so even the dashboard's finance card only ever shows real numbers for a seeded demo farm, and honestly zeroes out (`seasonId: 'N/A'`, all values 0) for every real farm, which is arguably correct behavior for an unpopulated table but means the "real data" path has never actually been exercised by genuine usage.

**What the user currently experiences:** `/finance` always shows "No financial records yet," regardless of how much real activity, product cost, or treated-hectare data exists for the farm.

**Missing connection:** No computation path exists from real, already-recorded data (`Activity.productId`/`dosePerHa`/`doseUnit`/`areaHa` joined to `InventoryItem.purchasePricePerUnit`, grouped by `FieldSeason.field`/`crop`) to any cost figure show to the user. The `FinancialSnapshot` table is the wrong foundation for this fix — nothing populates it from real usage, and inventing a population job for it would mean either fabricating revenue/margin (explicitly forbidden) or building a snapshot the same day as the page that reads it, which is more machinery than the data supports honestly.

**Acceptance condition for a real end-to-end flow:** `/finance` computes and shows real recorded input cost, broken down by field and by crop, cost per hectare, and a completeness indicator (% of activity-linked products with a purchase price on file), computed live from `Activity`+`InventoryItem`, for any farm with real spray/fertilise history — not just a seeded one. No revenue or margin number appears unless a real, explicit income model exists (it does not today, so none appears).

---

## Workflow 4 — AI Cockpit / Farm Insights

**What appears implemented:** A `/ai` route titled "AI Cockpit," subtitled "Your personal farm intelligence assistant."

**What is actually implemented:** `src/app/(farm)/ai/page.tsx` is the identical stub pattern as Finance — unconditional `StubPage`, no query. The dashboard already has a real, working rule-based briefing generator (`generateDailyBriefing`, `src/modules/ai/generateDailyBriefing.ts`) that reads real dashboard data — the dedicated `/ai` page doesn't call it or anything like it.

**What the user currently experiences:** `/ai` always shows "No AI insights yet," even on a farm whose dashboard is simultaneously showing real rule-based briefing items one click away.

**Missing connection:** No page-level use of `generateDailyBriefing` (or a richer superset of it), and no honest labeling anywhere that these are deterministic rules, not a machine-learned model — the page's own title ("AI Cockpit") currently overclaims relative to what exists.

**Acceptance condition for a real end-to-end flow:** A renamed "Farm Insights" page shows real, rule-based insights (overdue tasks, low/expiring stock, spray-window state, missing compliance data, upcoming cert expiry, fields without a crop, missing product prices, incomplete spray records) sourced from the same real data as the dashboard, each labeled with its evidence and explicitly marked as rule-based — never called "AI" unless a real model is involved (none is, today).

---

## Workflow 5 — Dashboard consistency

**What appears implemented:** A dashboard that already looks feature-complete — briefing, weather, tasks, inventory alerts, fields, finance snapshot, compliance, all in one grid.

**What is actually implemented:** `getRealDashboardData` already contains real, working queries for Task/InventoryItem/ComplianceItem/FinancialSnapshot/weather run in parallel, with an honest zeroed fallback for Finance. This is a legitimately good shared-resolver pattern.

**What the user currently experiences:** The dashboard's Finance card and the dedicated Finance page can, in principle, disagree — the card uses real query logic, the page uses none at all. Once a live Finance/Insights computation exists, the dashboard must call the *same* resolver functions, not reimplement the arithmetic a second time.

**Missing connection:** No shared `getFinanceData`/`getFarmInsights` resolver yet exists for either the dashboard or the dedicated pages to call — this needs to be built once and used by both.

**Acceptance condition for a real end-to-end flow:** Dashboard finance/insight cards and their dedicated full pages are always numerically consistent because both call the same resolver function.

---

## Workflow 6 — Error handling for new surfaces

**What appears implemented:** `src/lib/user-error.ts` already has a working `ErrorCategory`/`classifyError`/`handleActionError` mechanism, used by `activities.ts` and `quick-log.ts` today (confirmed by their tests — raw Prisma/DB error text never reaches a user-facing string).

**What is actually implemented:** Same as above — this is a real, working, tested mechanism, not a gap. The gap is only that it hasn't been applied yet to the code that doesn't exist yet (Finance/Insights/spray-evaluation).

**Acceptance condition:** All new Part 2–7 code paths route failures through this same mechanism, with messages matching the Sprint 16 brief's examples where applicable (e.g. "Financial totals are incomplete because 2 products have no purchase price" is a completeness *message*, not an error — genuine errors stay in the classify/handle path; completeness gaps are surfaced as normal UI state, not thrown errors).

---

## Test/E2E baseline before this sprint's changes

- `src/lib/actions/__tests__/activities.test.ts` — 17 tests, all against the current always-completed `createActivity` behavior. These must keep passing unchanged once `status` defaults to `'completed'` (backward-compatible schema default).
- `src/lib/actions/__tests__/quick-log.test.ts` — 3 tests, unaffected by this sprint (context-fetching only, no activity creation).
- `e2e/golden-path.spec.ts` — drives a full spray activity through today's flow ("Save activity" → "Activity recorded" / "Stock updated" / "Compliance record created"). This exact language must keep working for the default (completed) path once suitability review and planned/completed UI are added.
- `e2e/failure-paths.spec.ts` — covers insufficient-stock and missing-required-field cases already. New failure cases (missing weather, missing product constraints, cross-farm submitted IDs) are additive.

---

## Design decisions this audit settles before implementation

1. **Schema change needed:** add `ActivityStatus` enum (`planned`, `completed`) and `Activity.status ActivityStatus @default(completed)`. Backward-compatible — every existing test and E2E flow keeps its current meaning.
2. **Schema change NOT needed:** no per-product spray-constraint fields (wind/temp/rainfast thresholds) on `InventoryItem`. `spray-window.ts`'s existing `MOCK_DEFAULT_PRODUCT_PROFILE` fallback, with its `isMockDefault: true` disclosure, already satisfies "no invented CTGB values" and "missing product profile must be clearly stated" without new schema. Adding fake thresholds would be worse than admitting they don't exist yet.
3. **Operator certification context:** best-effort case-insensitive match of `Activity.operatorName` against the farm's `Employee.name` records, using `certExpiry`/`hasSpraying` when a match is found, and falling back to the engine's existing "not verified" warning path when no match exists. No new FK — a real name match is real data; a missing match is honestly reported as missing, not blocked on a schema change.
4. **Finance data source:** compute directly from `Activity`+`InventoryItem`+`FieldSeason`/`Field`, not from `FinancialSnapshot`/`CropFinancial` (nothing populates those from real usage — they are seed-only). The dashboard's existing `FinancialSnapshot`-based card is left as-is (still correct behavior for a farm that happens to have a snapshot); the new resolver adds a second, real-usage-derived view, and Part 9 confirms the dedicated Finance page uses only the new resolver.
5. **Nozzle-to-drift-reduction mapping:** `'air_inclusion'` nozzle type maps to `isDriftReductionNozzle: true` for `MachineContext`; all other nozzle types map to `false`.
