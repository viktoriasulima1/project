# Financial Version History UI

How FarmOS presents the append-only history of a financial record — corrections,
reversals, reallocations, and purchase reversal/replacement — on the Field
Detail page. Sprint 25.

## Principle

Nothing is ever edited in place. Every change writes a **new version**; the old
one stays queryable. The UI's job is to make the *effective* (current) version
unambiguous and the whole chain visible and explainable, **without ever offering
an edit control inside the timeline**.

## Components

- **`FinancialVersionTimeline`** (`src/components/fields/FinancialVersionTimeline.tsx`)
  — a reusable, presentational client component. It takes a title and a list of
  server-computed `TimelineVersion`s and renders an ordered list with a status
  badge, actor, reason, and an expandable before/after diff per version. It is
  used for expense/revenue/harvest correction chains **and** allocation history.
  It has no mutation affordance.
- **`FieldEconomicsHistory`** (`src/components/fields/FieldEconomicsHistory.tsx`)
  — three tabs: **Timeline** (unified event feed), **Corrections** (version
  chains), **Allocations** (allocation version chains). Empty states are
  explicit ("No corrections or reversals on this field.").

## Status vocabulary (badges)

Badges carry a **text label**, never colour alone (accessibility, Part 17):

| Badge | Meaning |
| --- | --- |
| Original | The first recorded version (version 1). |
| Corrected | A superseded version that was corrected into a newer one. |
| Reversed | The record was reversed — excluded from active totals, kept in history. |
| Reallocated | A superseded allocation version. |
| Replacement | A replacement purchase after a reversal. |
| Current effective | The version that counts toward active totals right now. |

## Data source

All history is server-computed by the farm-scoped query layer
(`src/lib/field-economics-detail.ts`):

- `getFinancialRecordVersionHistory(farm, type, id)` — walks the
  `correctionOfId` chain (up to the root, then breadth-first through
  corrections), attaches actor + reason from `AuditEvent`, computes a
  field-by-field diff between consecutive versions, and marks the
  `status: active` row as current-effective.
- `getAllocationHistory(farm, economicEntryId)` — groups `EconomicAllocation`
  rows by `version`; the active version is current-effective; each version lists
  its destinations, percentages, amounts, and the remaining unallocated amount.
- `getFieldEconomicTimeline(farm, fieldSeasonId)` — a unified feed built from
  the field's **append-only audit events** (created / corrected / reversed /
  allocation_created / allocation_changed / allocation_reversed), newest-first
  by default, with an optional chronological mode. Raw audit JSON is never shown.

## Before/after comparison (Part 11)

The pure `compareVersions()` helper (`src/lib/field-economics.ts`, unit-tested)
produces the amount delta, per-field allocation impact, and a margin impact —
**only when revenue is recorded**. Otherwise it returns a null margin and the
explicit note *"Gross margin impact cannot be calculated because revenue is not
recorded."* Missing values are never invented.

## Purchase reversal/replacement (Part 12)

Purchases are **reversal-only**. The Field Detail purchase section states:
*"This purchase was reversed and replaced. Historical activity costs remain
based on the price known at completion."* Reversing a purchase re-values live
inventory but never rewrites a past activity's recorded cost — the historical
snapshot is immutable. There is no Edit-purchase action anywhere.

## Security

Every history query is scoped to the requesting farm. A record belonging to
another farm resolves to `null` / not-found — its existence is never revealed
(Part 19). Actor is shown as the stored user reference only where an audit event
recorded it; no emails are surfaced.
