# FarmOS False Completeness Audit

Places where FarmOS *appears* complete — a route exists, a page renders, a card shows a number — but the underlying workflow is missing, fake, or broken. Ordered roughly by severity. Confirmed by direct file inspection, not inference.

---

## 1. Finance page always shows "no records," regardless of reality — **not yet fixed**

`src/app/(farm)/finance/page.tsx` renders a hardcoded `StubPage` unconditionally. It never queries `FinancialSnapshot` or `CropFinancial` — both of which exist as real Prisma models. A farm with a full season of real activity, real inventory cost, and real harvest revenue would see exactly the same "No financial records yet" message as a brand-new farm.

This is the identical bug class to the Compliance-page bug found and fixed in Sprint 13 (`docs/Sprint_13_First_Farmer_Pilot_Report.md` §2) — except this one is **still live**. Anyone doing a founder walkthrough or a real pilot session who checks "which fields made money" (the single most-repeated value proposition across `FarmOS_Master_Architecture.md`, `FarmOS_Strategy_Lock.md`, and `AGRIVI_Sprint_Analysis.md`) will find nothing, ever, no matter what they enter.

**Severity: high.** This sprint does not write code (per its own rules), so this is documented, not fixed, here — but it should be the first item addressed in the next sprint that touches product code.

## 2. AI Cockpit page always shows "no insights yet," regardless of reality

`src/app/(farm)/ai/page.tsx` is the same pattern as #1 — an unconditional stub, never queries anything. This is a second, independent instance of the exact bug class, in a page whose entire stated purpose ("Your personal farm intelligence assistant") is to synthesize existing farm data. Notably, the *dashboard* already has a working (if rule-based) briefing generator (`generateDailyBriefing.ts`) that reads real data — the dedicated `/ai` page simply never calls it or anything like it.

**Severity: medium-high.** Less critical than Finance (no farmer decision hinges on the AI page specifically), but it is a second confirmed occurrence of the same defect pattern, which suggests it's worth a systematic sweep of every `StubPage` usage rather than fixing instances one at a time as they're individually discovered.

## 3. Inventory items cannot be edited or corrected once created

There is no `updateInventoryItem` action anywhere in `src/lib/actions/`. Stock changes only ever happen automatically via activity-triggered deduction. If a farmer mis-typed a starting stock quantity, bought more product outside of an "activity," or needs to correct a supplier name — there is no way to do any of that. The data, once entered, is effectively write-once except through the side door of logging fake activities to nudge the number.

**Severity: medium.** A real pilot farmer would hit this quickly — correcting a typo in a product's starting stock is an extremely ordinary first-week action.

## 4. Inventory page has no per-product detail or list view

`/inventory` shows only an aggregate count ("N products on record... coming in Sprint 2" — a comment that has now been true for 14 sprints past when it was written). There is no way to see an individual product's full detail, purchase history, or stock-movement log through the UI at all, despite `StockMovement` records being created correctly on every activity.

**Severity: medium.** Combined with #3, this means Inventory is functionally write-only from the UI's perspective (data goes in via onboarding and activity logging; nothing meaningful comes back out except a single number on the Compliance-adjacent stock-preview hint inside the activity dialog).

## 5. Machinery has no management page at all

A `Machine` can only ever be created via the inline "+ Add a new sprayer" control inside the spray-activity dialog (Sprint 12). There is no `/machines` route, no way to view, edit, retire, or schedule maintenance for equipment — despite `Machine` having fields for exactly that (`hoursSinceService`, `nextServiceDueHours`, `isCertified`) that nothing in the UI ever reads or writes.

**Severity: medium.** The schema promises equipment lifecycle management; the product delivers a single-purpose creation shortcut and nothing else.

## 6. Tasks and Soil are pure schema stubs

`Task` and `SoilAnalysis` are fully modeled in `prisma/schema.prisma` (including a complete `TaskType`/`TaskPriority`/`TaskStatus` enum set for Task) with zero routes, zero server actions, and zero UI anywhere. These are Implementation Level 2 ("type/schema stub") per this audit's own scale — not partial features, not "coming soon" placeholders with any visible surface, just database tables nothing touches.

**Severity: low-medium.** Not misleading to a user (there's no page claiming Tasks exist), but worth naming because a future contributor reading the schema alone would reasonably assume these are live features.

## 7. Employee/operator records have no expiry tracking, despite a certification checkbox existing

Onboarding lets a farmer check "Has spuitlicentie" for an employee, but there is no certificate number field, no expiry date, and — critically — **no validation anywhere that checks operator certification status before allowing a spray activity to be logged**. `FarmOS_Strategy_Lock.md` names "spuitlicentie expiry tracking" as differentiator #15 and demo-feature #9; the actual product has a single unvalidated boolean checkbox.

**Severity: medium.** This is the kind of gap that matters specifically because the surrounding product (spray diary, compliance records) presents itself as a serious regulatory tool — an unenforced compliance checkbox next to a real compliance record is a mismatch in trustworthiness, not just a missing feature.

## 8. A genuinely sophisticated spray engine exists but is disconnected from the one moment it would matter

Correction while auditing this: `spray-window.ts` is more capable than a first pass suggested — it has a real 0–100 score, hard-blocker vs. warning separation, a fail-closed `'planned-application'` mode (vs. a softer `'advisory'` mode), and typed optional context for operator certification, inventory sufficiency, machine/nozzle, and crop/BBCH stage. This is a genuinely well-designed module, not a hollow one.

The false-completeness finding is more specific than "the engine is fake": **it is only ever called from the standalone `/weather` page** (`computeSprayWindows(weather.hourly, today, { weatherFetchedAt })` — no `productProfile`, no operator/inventory/machine/crop context, and always in the default `'advisory'` mode). It is never called from `src/lib/actions/activities.ts` at all (confirmed — the only match there is a code *comment* referencing the module, not an import). The one place this engine's fail-closed, context-aware `'planned-application'` mode would create real value — the moment a farmer is about to log a specific spray, with a specific product, operator, and field — doesn't use it. The activity dialog shows only a raw weather snapshot (temp/wind/humidity), disconnected from the scoring engine sitting one file away.

Separately, and correctly labelled: every evaluation on the weather page uses `MOCK_DEFAULT_PRODUCT_PROFILE` (explicitly marked `isMockDefault: true`, "Never a substitute for a real product label"), because no real per-product spray-condition thresholds exist anywhere in the data model — `InventoryItem` has no `maxWindSpeedKmh`/`rainfastHours`/`eligibleCrops` fields. So even where the engine *is* connected (the weather page), it cannot yet distinguish "Amistar Opti" from any other fungicide.

**Severity: medium-high.** This is a case worth naming precisely because the underlying engineering is good — the gap is integration, not competence, and it's a smaller, cheaper fix (wire the existing engine into the existing activity dialog) than building a new one.

## 9. `ndviScore` exists on Field with no real data source

`Field.ndviScore` is a plain nullable integer column. Nothing in the codebase ever writes to it outside of seed/demo data (`prisma/seed.ts`). Any dashboard card or field-list view that displays it is showing either `null` or a seeded placeholder number that will never update — a satellite-data feature with the appearance of a working number and no pipeline behind it.

**Severity: medium.** This is the most literal "dashboard card has no real data" example the brief asks to look for.

## 10. No mobile overflow testing for tables with long Dutch names

Documented as an open gap since Sprint 12 (`Sprint_12_Bug_Audit.md`): `ActivitiesClient.tsx`'s table has no verified `text-overflow`/wrapping behavior for genuinely long field or product names at mobile widths. Not re-tested this sprint; carried forward as still-open.

**Severity: low.** Cosmetic risk, not a data or trust issue.

## 11. No decimal/currency localization

Documented since Sprint 12: stock and dose values render via plain `.toFixed()` (e.g., `"500.000"`), not Dutch comma-decimal formatting, despite dates correctly using `toLocaleDateString('nl-NL', ...)`. Still open.

**Severity: low.** Polish gap, not a correctness gap — the underlying numbers are right, just formatted in a way a Dutch farmer wouldn't naturally write them.

## 12. Orphaned mock-data module

`src/lib/mock-data/farm-dashboard.ts` — a complete, realistic mock `DashboardData` object — is not imported anywhere in the current codebase. Confirmed via grep. Dead code, not a false-completeness risk to a user (nothing renders it), but worth flagging for cleanup: its continued presence could mislead a future contributor into thinking it's still wired to something.

**Severity: very low (housekeeping only).**

---

## Pattern summary

Three of the twelve findings above (#1, #2, and the already-fixed Compliance-page bug from Sprint 13) are the *exact same defect*: a page that unconditionally renders its empty state regardless of real data. This is not three unrelated bugs — it's one recurring pattern (`StubPage` used as a permanent placeholder rather than a genuine empty-state branch) that has now been found three separate times by three separate audits. A systematic check of every `StubPage` usage in `src/app/(farm)/` for the same defect would very likely be higher-value than continuing to find instances one at a time.
