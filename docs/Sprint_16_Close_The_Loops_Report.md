# Sprint 16 — Close the Half-Built Product Loops — Report

Builds directly on `docs/Sprint_16_Half_Built_Loops_Audit.md` (Part 1). This report covers Parts 2–14: what was actually built, what was tested, what still isn't real, and whether readiness genuinely moved.

---

## 1. Half-built workflows found

Restated from the audit doc, now with each one's disposition:

| Workflow | Found state | Disposition this sprint |
|---|---|---|
| Spray suitability engine vs. activity flow | Real 0–100 engine existed, called only from `/weather` in advisory mode with zero real context | **Closed** — new `evaluateSpraySuitability` action wires field/product/operator/machine/crop/stock/weather into the same engine in `planned-application` mode, shown before submission |
| Planned vs. completed activities | No such distinction existed at all | **Closed** — new `Activity.status` field, dual save paths, `completeActivity` transition action |
| Finance page | Unconditional empty stub | **Closed** — real cost computed live from Activity + InventoryItem |
| AI Cockpit page | Unconditional empty stub, mislabeled "AI" | **Closed** — renamed in substance to Farm Insights, 10 real rule-based sources, honestly labeled |
| Dashboard/module consistency | Dashboard computed its own Finance/briefing logic independently of any dedicated page | **Closed** — dashboard now calls the same `getFinanceData`/`getFarmInsights` resolvers |
| **Weather integration itself** (not in the original audit) | **Discovered this sprint**: every real call to Open-Meteo was silently failing (see §11) | **Closed** — root cause fixed |

---

## 2. Spray flow integration

`src/lib/actions/spray-suitability.ts` (`evaluateSpraySuitability`) is a new server action called directly from `ActivityDialog.tsx` (debounced, 500ms) whenever a spray activity has a field and area entered. It:

- Verifies the field, product, and machine belong to the current farm (cross-farm protection, same pattern as `createActivity`).
- Builds a best-effort `OperatorContext` by case-insensitive name match against the farm's `Employee` records (no FK exists between `Activity.operatorName` and `Employee` — inventing one was out of scope; an honest name match is used where available, and the engine's existing "not verified" path covers the rest).
- Maps `nozzleType === 'air_inclusion'` to `isDriftReductionNozzle: true`.
- Always runs in `'planned-application'` mode — the fail-closed mode where missing context is a hard blocker, not a soft warning.
- Always uses `MOCK_DEFAULT_PRODUCT_PROFILE` (no real per-product CTGB thresholds exist in the data model, and none were invented — this is an explicit, documented scope decision, not an oversight).

**Known consequence, stated plainly:** because no real product-specific profile exists, *every* planned-application evaluation currently returns `status: 'blocked'` with "No verified product registration selected for this application" as a hard blocker — the engine cannot yet tell one product from another. This is the correct, honest behavior per the brief ("no invented CTGB values," "no silent recommendation when required information is missing") — it is not a bug, but it does mean the suitability review is, today, more of an honest disclosure panel than a differentiated go/no-go signal. This is called out again in §11 and §12.

The suitability panel appears in the activity form before either save button and shows score, status, hard blockers, warnings, positive factors, best window, confidence, weather data age, and the disclaimer. It does **not** gate submission — see the design rationale in §3.

---

## 3. Planned/completed behavior

`prisma/schema.prisma` gained `enum ActivityStatus { planned, completed }` and `Activity.status @default(completed)` (migration `20260713150414_add_activity_status`, applied to both the dev and E2E databases). Backward-compatible by default — every pre-Sprint-16 test and E2E flow keeps its original meaning without modification.

- **Planned**: `createActivity` with `status=planned` skips the stock pre-check, skips the atomic stock deduction, and skips compliance record creation. The Activity row is created immediately (visible in history, tagged "Planned").
- **Completed** (default, unchanged): stock deducted, compliance record created — exactly as before Sprint 16.
- **`completeActivity(id)`** (new): transitions a planned activity to completed. Re-fetches weather at the moment of completion (not the estimate from when it was planned), deducts stock against *current* stock (re-checked, not assumed), and creates the compliance record using the fresh data. Rejects if the activity isn't in `planned` status or doesn't belong to the current farm.

UI: `ActivityDialog.tsx` has a "Save as planned" secondary button (spray only, since planned-vs-completed matters most for spraying) alongside the unchanged "Save activity" primary button — deliberately kept first in DOM order so it stays the browser's default submit target. `ActivitiesClient.tsx` shows a "Planned" badge and a "Mark as completed" action for planned rows.

**Deliberate non-decision:** the suitability panel's hard blockers do **not** disable either save button. Unlike insufficient stock (deterministic, safe to hard-block), spray-window results depend on live weather, which is inherently variable — hard-blocking submission on it would risk flaky behavior in exactly the moment (a real spray decision) where a false "you can't save this" would be worst. The blocker is shown prominently; the choice to proceed is the farmer's, same as the "check suitability" link already worked on the Weather page.

---

## 4. Finance implementation

`src/lib/finance-data.ts` (`getFinanceData`) computes cost live from `Activity` (completed only, with a `productId` and `dosePerHa`) joined to `InventoryItem.purchasePricePerUnit`, grouped by field and by crop for the active season. It deliberately does **not** read `FinancialSnapshot`/`CropFinancial` — nothing in this codebase populates those from real usage (seed data only), so building the real page on top of them would have meant either fabricating a population job or inheriting permanently-zeroed numbers.

`src/app/(farm)/finance/page.tsx` shows, for a farm with real completed spray/fertilise history: total recorded cost, cost by field, cost by crop, cost per hectare, and completeness. For a farm with none, it shows exactly the required message: *"Cost tracking is active. Profitability becomes available after income and harvest revenue are recorded."*

No revenue, margin, or profit figure appears anywhere in this page or its data layer — confirmed by a unit test that greps the entire serialized result for those words (§9).

---

## 5. Finance completeness rules

Every number on the Finance page is qualified:

- The summary line states total cost, field count, season/date range, and completeness percentage in one sentence (matching the brief's example format).
- When `completenessPercent < 100`, a distinct warning names exactly which products are missing a price and states that totals are undercounted, not silently wrong.
- `lastCalculatedAt` and the source line ("N activity product lines, M priced") appear at the bottom of the page.
- The dashboard's Finance Snapshot card was rewritten to call the same resolver (§8) rather than showing a second, differently-computed number.

---

## 6. Farm Insights implementation

`src/lib/farm-insights.ts` (`getFarmInsights`) replaces the `/ai` stub's substance (route path kept at `/ai`, nav label and page title renamed to "Farm Insights" — changing the route itself risked breaking bookmarks/links for no real benefit). Ten real sources, each with title, explanation, why-it-matters, evidence string, confidence, related module, and action link:

overdue tasks, upcoming tasks (7 days), low stock, expiring stock (30 days), missing purchase price, compliance gaps, operator spray-certificate expiry, fields with no crop assigned this season, unconfirmed spray-diary records, and a live spray-window read (open now / currently blocked).

Every insight is returned with `kind: 'rule-based'` and every card on the page states "Rule-based insight (no AI/ML model involved)" — the word "AI" appears nowhere an insight itself is displayed. Deliberately **not** built: a general AI chatbot (explicitly out of scope per the brief) and "dashboard setup state"/"activity cost anomalies" as insight sources — the former is already handled honestly by the existing first-run dashboard state, and the latter needs a statistical baseline this product doesn't have yet; inventing one felt worse than omitting it.

---

## 7. Priority engine

`resolveInsightPriority` in `farm-insights.ts` scores every insight on seven 0–10 dimensions (urgency, compliance impact, financial impact, agronomic risk, time sensitivity, confidence, actionability), weighted (compliance and urgency weighted highest), and buckets the result into critical/high/medium/low with a plain-language explanation naming the top two driving dimensions. The page shows at most 3 critical/high insights "above the fold," with everything else (including all medium/low insights) in a second section — verified by a unit test that seeds 4 simultaneous high-severity conditions and asserts the fold never exceeds 3.

---

## 8. False-completeness cleanup

The exact `StubPage`-always-empty defect pattern named in Sprint 13 and Sprint 15 (three prior instances: Compliance, Finance, AI) is now closed for all three known instances. The dashboard's Finance Snapshot card was also rewritten — it previously showed a confident "Revenue YTD / Projected season margin / On track" readout sourced from `FinancialSnapshot`, which is **never populated by real usage** in this product; for any real (non-seeded) farm this meant a false "€0, on track" verdict, not an honest absence. It now shows the same real, resolver-computed cost data as the dedicated Finance page, or the same honest "Cost tracking is active" message when there's nothing yet.

`src/lib/__tests__/dashboard-shared-resolvers.test.ts` statically enforces (by reading the dashboard's own source) that it imports and calls `getFinanceData`/`getFarmInsights` rather than recomputing a second version.

**Not touched, and explicitly out of scope for this sprint** (per its own brief, which named Finance/AI/spray-flow/planned-completed as the confirmed gaps): Inventory item edit/correction, a dedicated machine management page, Task/SoilAnalysis UI. These remain real, previously-documented gaps (see `FarmOS_False_Completeness_Audit.md` #3–#6) — adding them here would have been scope creep beyond what was asked.

---

## 9. Tests added

20 unit tests were required; more were added where a specific finding warranted it. All listed below pass.

1. **Spray engine called from real spray flow** — `spray-suitability.test.ts`
2. **Hard blocker prevents positive recommendation** — `spray-suitability.test.ts`
3. **Missing product profile is visible** — `spray-suitability.test.ts`
4. **Planned spray does not deduct stock** — `activities.test.ts`
5. **Completed spray deducts stock** — `activities.test.ts`
6. **Planned spray does not create final compliance record** — `activities.test.ts`
7. **Completed spray creates compliance record** — `activities.test.ts`
8. **Finance page reads real activity costs** — `finance-data.test.ts`
9. **Missing purchase price reduces completeness** — `finance-data.test.ts`
10. **Finance page does not fabricate revenue** — `finance-data.test.ts` (serializes the whole result, asserts no "revenue"/"margin"/"profit" substring)
11. **AI/Farm Insights page shows real rule-based insights** — `farm-insights.test.ts`
12. **Insights state clearly whether rule-based** — `farm-insights.test.ts`
13. **Priority engine ranks compliance blocker above low-stock warning** — `farm-insights.test.ts`
14. **Dashboard uses shared finance resolver** — `dashboard-shared-resolvers.test.ts` (source-level check — see note below)
15. **Dashboard uses shared insight resolver** — `dashboard-shared-resolvers.test.ts`
16. **Empty AI state is shown only when no source data exists** — `farm-insights.test.ts`
17. **Raw internal errors do not reach UI** — `spray-suitability.test.ts` (also caught and fixed a real gap — see §11)
18. **Stub pages are not presented as complete** — covered by `finance-data.test.ts`'s and `farm-insights.test.ts`'s `hasActivityData`/`hasAnySourceData` honesty tests
19. **Cross-farm finance access is rejected** — `finance-data.test.ts`
20. **Cross-farm insight access is rejected** — `farm-insights.test.ts`

Plus: `complete-activity.test.ts` (4 tests for the new transition action) and `weather.test.ts` (3 regression tests for the bug found in §11).

**Note on tests 14/15:** this project has no component-rendering test harness (no `@testing-library/react` in `devDependencies` — the entire suite is Node-environment logic tests). Rather than skip the requirement, these two are enforced by reading the dashboard page's own source and asserting it imports and calls the shared resolvers — a legitimate, if unusual, way to hold the "don't duplicate business logic" rule to an automated check given the stack's actual testing capabilities.

Full unit suite: **211 passed, 0 failed** (`npx vitest run`).

---

## 10. E2E results

New file `e2e/sprint16-close-the-loops.spec.ts`, 6 tests:

- **Golden flow 1** (2 tests): real suitability review appears before save (asserts the honest "blocked" state and disclaimer), then the completed activity is confirmed in Activities, Compliance, and the dashboard.
- **Golden flow 2**: a freshly-priced product's activity produces the exact expected recorded cost (€500,00 for 10ha × 2L/ha × €25/L) and 100% completeness on the real Finance page.
- **Golden flow 3**: a real low-stock condition (created by an activity that consumes 480 of 500L) produces a real Farm Insights card, correctly labeled rule-based, whose action link reaches Inventory.
- **Failure flow**: a genuine (not mocked) Open-Meteo 400 — the server action runs server-side, so browser-level `page.route()` interception can't reach it; an out-of-range coordinate produces a real failure instead — surfaces the honest fallback message, not a raw error or crash.

Two new test-only DB helpers were added (`e2e/setup/adjust-inventory.ts`, `e2e/setup/adjust-farm.ts`), following the existing `seed-farms.ts` convention of bypassing the UI only for setup, never for the thing under test.

**Results:**
- New spec alone, dev target: **6/6 passed**.
- New spec alone, production build target (`E2E_TARGET=build`): **6/6 passed**.
- Full existing suite (44 tests: accessibility, failure-paths, founder-walkthrough, golden-path, isolation, the new Sprint 16 spec, and both mobile projects), dev target: **44/44 passed** — no regressions from any Sprint 16 change.

---

## 11. Remaining limitations

- **A significant pre-existing bug was found and fixed, not introduced this sprint**: `src/lib/weather.ts` requested an Open-Meteo hourly parameter, `leaf_wetness_index`, that does not exist in Open-Meteo's real API (confirmed directly against the live API — the correct name is `leaf_wetness_probability`). Open-Meteo rejects the **entire** request with HTTP 400 when any unknown parameter is included, meaning every real call to `fetchWeather` — from the Weather page, the dashboard, the activity form's weather snapshot, and now the new suitability check — has been silently failing and falling back to defaults/nulls this whole time, for any real (non-mocked, non-seeded) farm. This was masked because every call site already had a `.catch(() => null)`-style fallback, so nothing crashed — it just never showed real weather. Fixed with a one-parameter-name change plus 3 regression tests (`weather.test.ts`) that assert the request never regresses to the invalid name.
- The spray suitability engine still always uses the mock product profile (§2) — this is an explicit, documented scope decision (Sprint 16's own audit doc), not something this sprint solved. Until real per-product spray-condition thresholds exist (Next-30 item #8, tier C), a planned-application evaluation will always carry a "no verified product registration" hard blocker.
- Operator certification matching is a best-effort name string match, not a real link — an `Employee`/`Activity.operatorName` FK still doesn't exist. Documented as an intentional trade-off, not an oversight.
- Farm Insights omits two of the twelve sources named in the brief (dashboard setup state, activity cost anomalies) — reasoned explicitly in §6, not silently dropped.
- Inventory edit/correction, machine management, Task/SoilAnalysis UI remain real, previously-documented gaps — out of this sprint's stated scope.

---

## 12. Beta blockers

Unchanged from Sprint 12–14: **no real farmer has piloted the product.** This remains the single blocking condition for a beta go/no-go decision, and nothing in this sprint changes that fact — see §13.

Newly surfaced by this sprint, worth flagging for the next real farmer session specifically:
- The suitability check will show "blocked" for essentially every real spray a pilot farmer logs, because no real product profiles exist yet. A pilot farmer needs to be told this upfront (or it will read as a broken feature) until Next-30 item #8 is built.
- Now that real weather data actually flows (§11), the Weather page and dashboard weather card should be re-checked by a human against a real forecast — they were, in effect, never really exercised with live data before.

---

## 13. Updated readiness score

**9/10 pilot-readiness gate — unchanged from Sprint 12–14.** No real farmer used the product this sprint either; that is the one thing that moves this specific number, and it didn't happen.

Per the brief's own final instruction — *"do not increase readiness only because more tests pass; readiness can increase only if real user-visible workflows become complete"* — this sprint is evaluated separately on that basis, and real workflows *did* become complete:

- Finance: went from a page that always said "no financial records" regardless of reality, to a page that computes and shows real recorded cost for any farm with real spray/fertilise history.
- Farm Insights: went from a page that always said "no AI insights" regardless of reality, to ten real, evidenced, honestly-labeled rule-based checks.
- The spray-window engine went from disconnected (never used at the moment of logging a real spray) to genuinely wired into that moment.
- A previously-invisible, whole-product weather-integration failure (§11) was found and fixed — every downstream consumer of real weather data (Weather page, dashboard, activity form, and the new suitability check) now has a real chance of actually receiving real data for the first time.

These are real, user-visible workflow completions, not test-count inflation — the pilot-readiness score doesn't move because no pilot happened, but the domains Sprint 15 scored lowest specifically because "no sprint's real attention" had touched them (Finance: 5/100, AI: 10/100) are the ones this sprint actually built. A future audit re-scoring domain coverage would be expected to move both of those numbers materially — that re-scoring is left to whichever sprint next runs a full competitor/coverage audit, consistent with this project's practice of not grading its own homework across document types.
