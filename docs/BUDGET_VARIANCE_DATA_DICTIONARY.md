# Budget Variance data dictionary

## Frozen calculation policy

- Formula: `varianceCents = actualCents - budgetCents`.
- Positive: over budget. Negative: under budget. Zero: within budget.
- Percentage: `varianceCents / budgetCents * 100`.
- Percentage rounding is not performed by the resolver; UI formatting is presentation-only.
- Explicit zero budget is recorded zero and yields a `null` percentage (zero denominator).
- Explicit zero actual is recorded zero.
- Missing budget or actual remains `null`, never zero.
- Incomplete/unpriced actual cost blocks an available variance.
- No tolerance/band exists in current product behavior.
- Currency mismatch blocks comparison; no conversion is invented.

## Contract

Statuses: `within_budget`, `over_budget`, `under_budget`, `unavailable`.

Reason codes: `WITHIN_BUDGET`, `OVER_BUDGET`, `UNDER_BUDGET`, `BUDGET_NOT_RECORDED`, `ACTUAL_COST_NOT_RECORDED`, `BUDGET_AND_ACTUAL_NOT_RECORDED`, `ACTUAL_COST_INCOMPLETE`, `CURRENCY_MISMATCH`.

Action codes: `ADD_BUDGET`, `RECORD_ACTUAL_COST`, `REVIEW_COSTS`, `REVIEW_UNPRICED_COSTS`, `OPEN_FINANCE`, `NO_ACTION_REQUIRED`.

Metadata: `budgetCents`, `actualCents`, `varianceCents`, `variancePercent`, `currency`, `budgetRecorded`, `actualRecorded`, `actualCostComplete`, `unpricedRecordCount`. Cents are integer canonical values; no formatted or localized prose is present.

## Inclusion policy

The resolver consumes the existing field-season totals. Active effective economic entries are included. Reversed entries and farm-level unallocated entries are excluded. Corrected records contribute only their current effective entry. Missing prices leave actual cost incomplete. These policies are upstream and unchanged.

