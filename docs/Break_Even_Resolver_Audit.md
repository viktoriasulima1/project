# Break-even Resolver Audit (Stage 3)

Date: 2026-07-27. Precondition for localizing the Break-even resolver. Scope:
**Break-even only** — not general completeness, budget variance, cost categories or
the other economic signals.

## Two distinct "break-even" surfaces (only one is prose)

1. **`breakEvenExplanation(input)`** in `src/lib/field-economics.ts` — the DISPLAY
   resolver: break-even **price** (cost ÷ yield) and break-even **yield**
   (cost ÷ price), each available only when its inputs are complete, otherwise a
   list of English **blocking reasons**. This is the prose target.
2. **`resolveFieldEconomics(...).breakEvenPrice/breakEvenYield`** in
   `src/lib/economics.ts` — NUMERIC only, no prose. Consumed by finance-data,
   `farm-economic-signals` (the `econ-breakeven-above-sale` signal) and CSV/exports.
   **Already code/numeric — unchanged this iteration.**

## Targeted prose (in scope) — all in `breakEvenExplanation`

| File | Line | Current English | Kind | Proposed code |
|---|---|---|---|---|
| field-economics.ts | 183 | "Material costs are incomplete." | blocking reason | `INCOMPLETE_COST` |
| field-economics.ts | 184 | "Harvest is not recorded." | blocking reason | `MISSING_HARVEST` |
| field-economics.ts | 185 | "Sale price is missing." | blocking reason | `MISSING_SALE_PRICE` |
| field-economics.ts | 186 | "Yield and revenue units do not match." | blocking reason | `INCOMPATIBLE_UNITS` |
| field-economics.ts | 187 | "Unallocated cost remains on this field." | blocking reason | `UNALLOCATED_COSTS` |
| field-economics.ts | 204/213 | "total recorded cost ÷ saleable yield" / "…÷ recorded sale price" | formula label (not audit-flagged but English) | `formulaCode: COST_PER_YIELD` / `COST_PER_PRICE` |
| field-economics.ts | 204 | `unit: \`€/${unit}\`` | formatted unit string | store `yieldUnit`, adapter renders |
| fields/[id]/page.tsx | 147,150,156 | "Break-even", "Break-even price", "Break-even yield" headings | display | `fields.economics.breakEven.{title,price,yield}` |
| fields/[id]/page.tsx | 153,159 | "Unavailable — {reasons.join}" | display | adapter reason text |

**Audit-flagged break-even prose in resolver files: 5** (the `REASON` map, L183–187).
The formula/unit strings are English but the heuristic does not flag them (they
contain `÷`/`€`); they are removed anyway for a clean contract.

## Eligibility decisions (must not change)

- **price** available ⇔ costs complete AND `saleableYield > 0` AND units compatible
  AND no unallocated remainder. Value = `round2(totalRecordedCost / saleableYield)`.
- **yield** available ⇔ costs complete AND `recordedPricePerUnit > 0` AND units
  compatible AND no unallocated remainder. Value = `round2(totalRecordedCost / recordedPricePerUnit)`.
- Reasons accumulate (a computation can list several). Missing inputs stay absent —
  never coerced to 0.

## Consumers

| Consumer | Uses | Change |
|---|---|---|
| `field-economics-detail.ts` (`getFieldEconomicsDetail`) | wraps `breakEvenExplanation` into `detail.breakEven` | pass-through; type update only |
| Field Detail `fields/[id]/page.tsx` | `detail.breakEven.price/yieldValue/*Reasons` | **rewired** to the presentation adapter (Part 10) |
| Finance `finance/page.tsx` | only a warning sentence ("…margin and break-even may be hidden") + shares the numeric `breakEvenPrice` via finance-data | numeric consistency test (Part 11); the warning sentence is finance-page English debt, out of the break-even resolver |
| `farm-economic-signals.ts` `econ-breakeven-above-sale` | numeric `breakEvenPrice` (code) | unchanged — belongs to the economic-signals resolver (out of scope) |
| CSV/exports | numeric `breakEvenPrice/Yield` columns | unchanged (canonical numeric) |

## Persistence (Part 13/14)

No break-even prose is persisted. `breakEvenExplanation` is computed on read; CSV
exports carry the numeric `breakEvenPrice/breakEvenYield` only. No Prisma migration.
No historical rewrite.

## Baselines

- Global resolver prose **before: 510**.
- Targeted Break-even resolver prose **before: 5** (audit-flagged) → target **0**.
