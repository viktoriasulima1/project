# Sprint 25 — Field Detail Economics Audit (Part 1)

Date: 2026-07-16. Evidence-based audit of what a farmer can and cannot see per
field *before* this slice, read from the real code (not assumed).

## What exists today

- **No `fields/[id]` route.** [src/app/(farm)/fields/page.tsx](../src/app/(farm)/fields/page.tsx)
  renders `FieldsListClient`, a flat table (name, area, soil, status, NDVI,
  Archive). A field name is **not** a link; there is no detail page at all.
- **A rich per-field economics resolver already exists but is only surfaced on
  the Finance page, not per field.** [src/lib/finance-data.ts](../src/lib/finance-data.ts)
  `getFinanceData()` returns a `FieldEconomicsRow[]` with recorded cost,
  revenue, gross margin, cost/ha, yield, cost/unit, break-even price/yield,
  completeness %, budget variance, and a `missing[]` list. The Finance page
  (`/finance`) renders these as one big "Field profitability" table row per
  field — no drill-down, no per-field page, no source records, no history.
- **The economic surface is `EconomicEntry`** ([schema](../prisma/schema.prisma)).
  Every cost and revenue is an `EconomicEntry` row (`status: active|corrected|
  reversed`). Activity-derived costs (`inventory_input`/`labour`/`machinery`/
  `fuel`, `sourceEntityId = activityId`, `allocationMethod: direct_field`) are
  written by [economics-recording.ts](../src/lib/economics-recording.ts);
  manual expenses/contractor/revenue point at their own tables.
- **Version chains exist per record type** but are invisible in the UI beyond a
  `· vN` suffix on the Finance "Recent financial entries" list. Expenses,
  revenue, harvest carry `version`/`correctionOfId`/`correctionReason`;
  contractor and purchase too; `EconomicAllocation` is versioned
  (`version`/`status`/`correctionOfId`/`reason`). The whole append-only chain is
  in the DB but there is **no timeline component** that reads it.
- **Audit events exist** (`AuditEvent`, append-only) with `created`/`corrected`/
  `reversed`/`allocation_created`/`allocation_changed`/`allocation_reversed` and
  a `correlationId`, but **nothing in the UI reads them** for a field.
- **Allocation reallocation is reachable from Finance** (Sprint 25 prior slice:
  `ReallocationDialog`, `getAllocatableRecords`) but there is **no allocation
  detail/history view** and no per-field allocation history.
- **Purchase reversal/replacement** is enforced server-side
  ([economics.ts](../src/lib/actions/economics.ts) `reverseInventoryPurchase`)
  and historical activity price snapshots are immutable, but there is **no UI**
  that shows a purchase's reversal/replacement lineage or states that snapshots
  stayed unchanged.

## Which field metrics are available (and how)

| Metric | Source | Direct / Allocated / Missing |
| --- | --- | --- |
| Recorded cost, cost/ha | `resolveFieldEconomics` (sum of active `EconomicEntry` costs) | direct + allocated, **null** if any cost source unpriced |
| Input/labour/machinery/fuel cost | `EconomicEntry` by `sourceType` (activity-derived) | direct on the field |
| Direct expenses, contractor | `EconomicEntry` (`manual_expense`/`field_rent`/… , `contractor`) | direct if `direct_field`, else allocated |
| Allocated overhead | `EconomicEntry` with non-`direct_field` `allocationMethod` + `EconomicAllocation` | allocated |
| Revenue, gross margin | active revenue `EconomicEntry` | **null** if no revenue — never €0 |
| Yield, yield/ha, cost/unit | `HarvestResult` (active) | missing → null |
| Break-even price/yield | `resolveFieldEconomics`, only when `profitability_ready` | otherwise **null** with a reason |
| Budget variance | `SeasonPlanItem.expected*` vs actual | null if no plan |

## What is missing / invisible before this slice

- **Invisible-in-UI history that exists in the DB:** correction chains
  (`correctionOfId`), reversal rows, allocation versions, audit events. Fully
  reconstructable server-side (all FK-linked, farm-scoped) — just never queried
  for a field.
- **No source-record drill-down:** a farmer sees "€4,650 cost" with no way to
  reach the individual expenses/activities/snapshots behind it.
- **No direct-vs-allocated separation on a field:** the Finance table sums them.
  Farm-level unallocated cost is shown only as a farm total, never risk-labelled
  against a field margin (it is correctly *excluded* from field cost by
  `resolveFieldEconomics`, but the UI never explains that).
- **No completeness explanation per field** beyond a bare percentage; the
  `missing[]` categories and their *effect* are computed but only shown as a
  comma-joined blob on `/finance`.
- **No per-field cost-category breakdown** (crop protection / fertiliser / seed
  / labour / machinery / fuel / contractor / field expenses / overhead).
  `EconomicSourceType` maps cleanly to most categories; `inventory_input` needs
  the product's `InventoryCategory` (reachable via `activity.product.category`).

## Can corrections / reversals / reallocations be reconstructed?

**Yes, from the DB, server-side** — every version row keeps `correctionOfId`
and a `correctionReason`; reversal writes a compensating `EconomicEntry` and
flips `status`; allocation versions supersede to `corrected` and insert
`version+1`; audit events carry actor/reason/correlation. Nothing is destroyed.
**No** — there is currently no query or component that surfaces any of it for a
field. That is precisely the gap this slice closes.

## Risk of misleading field totals (today)

- **Low risk of a fabricated number:** `resolveFieldEconomics` already returns
  `null` (rendered "Not recorded") whenever a cost source is unpriced or revenue
  is absent, and blocks break-even below `profitability_ready`. Gross margin is
  never invented.
- **Real risk of *incomplete-looking* totals reading as complete:** the Finance
  table shows a completeness % but not *what* is missing or its effect, so an
  82%-complete field's cost can be mistaken for the whole story. Farm-level
  unallocated cost is not visibly tied to the fields it could belong to.
- **History opacity risk:** because corrections/reversals are invisible, a
  farmer cannot see that a shown value is the *effective* version of a chain, or
  why it changed. This slice makes the effective version explicit and the chain
  visible.

## Conclusion / plan for this slice

Build (a) a farm-scoped economic-history **query layer** (Part 18), (b) a
**Field Detail economics** page reusing `resolveFieldEconomics` plus a new pure
category/break-even/diff layer, (c) a reusable **FinancialVersionTimeline** +
before/after comparison, and (d) source drill-down, completeness explanation,
and allocation history — all with honest missing-data handling and cross-farm
rejection. Purchases stay reversal-only. Sprint 25 stays **NO-GO**.
