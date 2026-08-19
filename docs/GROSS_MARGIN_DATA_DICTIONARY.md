# Gross Margin data dictionary

## Existing formula

`gross margin = recorded received field revenue - complete included field costs`

Revenue includes active, field-scoped received revenue records. Costs include active completed direct and allocated field costs. Farm-level unallocated cost and revenue are excluded. Partially allocated remainder remains unallocated. Reversed records are excluded and the effective corrected version is included. Multiple records are summed.

An unpriced input, missing labour rate or missing machinery rate keeps cost incomplete and therefore prevents a falsely precise margin. Missing revenue and missing cost remain `null`; explicit recorded zero remains zero. Margin per hectare uses the validated positive field area; zero or missing area yields no per-hectare value. Existing EUR and cent rounding behavior is unchanged.

## Canonical contract

Statuses: `positive`, `zero`, `negative`, `unavailable`, `partial`.

Reasons: `POSITIVE_MARGIN`, `ZERO_MARGIN`, `NEGATIVE_MARGIN`, `MISSING_REVENUE`, `MISSING_COST`, `INCOMPLETE_COST`.

Actions: `ADD_REVENUE`, `ADD_EXPENSE`, `REVIEW_UNPRICED_COSTS`, `NO_ACTION_REQUIRED`.

Metadata contains canonical cents for revenue, cost, margin and per-hectare margin, raw hectares, currency, unpriced record count, and the authoritative Financial Completeness status/percentage/reasons. It contains no localized prose or formatted money.

## Honesty rules

- Missing is never converted to zero.
- A recorded zero margin is available and distinct from unavailable.
- Category labels and ordering never affect calculation.
- Gross Margin does not replace or alter Break-even or Budget Variance.
- No schema or historical-data migration is required.

