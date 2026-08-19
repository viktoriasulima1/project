# Financial Allocation Rounding Policy

FarmOS splits a financial record across fields in **integer cents**, never in
floating-point euros, and guarantees the split reconciles exactly with the
parent amount. Two implementations share one algorithm:

- `percentageAllocations(amount, allocations)` — `src/lib/operational-costing.ts` (persisted full-allocation path).
- `distributeCents(totalCents, weights)` — inside `src/lib/reallocation-preview.ts` (preview + partial-allocation path).

## Algorithm — largest remainder (Hamilton) method

1. Convert the amount to cents: `cents = round(amount × 100)`. For a **partial**
   allocation the target is `round(cents × Σpercent ÷ 100)`; the rest stays
   unallocated.
2. Compute each destination's ideal cents: `raw_i = target × weight_i ÷ Σweight`
   (weight = percentage, hectares, or recorded yield depending on method).
3. Give each destination `floor(raw_i)` cents.
4. Compute the leftover: `remainder = target − Σ floor(raw_i)` (always `0 ≤ remainder < n`).
5. Sort destinations by **descending fractional part** (`raw_i − floor(raw_i)`),
   breaking ties by **ascending original index**, and add one cent to the first
   `remainder` destinations.

## Guarantees

- **Exact reconciliation:** `Σ child cents = target cents` by construction, so a
  full allocation's children sum to the parent to the cent.
- **Deterministic:** the ordering is total (fraction, then index), so identical
  input always yields identical output — no dependence on map/iteration order.
- **Predictable remainder placement:** extra cents go to the destinations with
  the largest fractional shares first — the fairest, and stable.
- **No floating-point money:** all splitting is done in integer cents; euros are
  only produced at the end (`cents ÷ 100`).
- **Negative values** are only produced where a method explicitly supports them
  (none of the current methods do); weights `≤ 0` yield all-zero, never NaN.
- **Multi-currency mixing is rejected** upstream (the preview blocks a record
  whose currency differs from the farm currency) before any rounding runs.

## Worked example

€10.00 split 33.3333 / 33.3333 / 33.3334 %:
- cents = 1000; raw = 333.333, 333.333, 333.334 → floors 333, 333, 333 (sum 999).
- remainder = 1; largest fraction is destination 3 (0.334) → it gets the extra cent.
- Result: **3.33, 3.33, 3.34** — sums to 10.00 exactly. (Unit-tested.)

## Rounding difference surfaced to the user

The preview reports `roundingDifference` = the number of remainder cents that
were redistributed (in euros). It is informational: the parent still equals the
children exactly, so this is never an unexplained discrepancy — it is how many
cents the fair-rounding step moved.
