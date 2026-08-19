# Economics Signal Rules

The rules behind FarmOS's economic decision signals. One shared resolver,
`buildEconomicSignals(finance)` in `src/lib/farm-economic-signals.ts`, is the
**single source**; `getFarmEconomicSignals` wraps it for the Dashboard and
`resolveEconomicsInsights` adapts it for Farm Insights. No signal math lives
anywhere else. Sprint 25.

## Honesty rules (always enforced)

- **Missing is never €0.** A null metric never becomes zero; the signal simply
  is not emitted, or reads "Not recorded".
- **Incomplete fields are never ranked** as strongest/weakest profitability. The
  strongest-margin and break-even signals only consider `profitability_ready`
  fields.
- **No peer/market benchmarking**, no invented causal explanation, and **no
  net-profit language** — every margin is "operational gross margin".
- Every signal is **rule-based** (there is no ML model), names its **evidence**,
  and routes to a **real destination** (Part 6 — no dead CTAs).

## Signals emitted (derivable from FinanceData today)

| id | Type | Role | Route |
| --- | --- | --- | --- |
| `econ-field-over-budget` | Largest negative budget variance / cost-per-ha risk | alert | `/fields/[id]` (worst) |
| `econ-missing-price` | Product used without a recorded price | alert | `/inventory` |
| `econ-missing-labour-rate` | Labour rate missing on completed work | alert | `/finance` |
| `econ-missing-machine-rate` | Machine rate missing on completed work | alert | `/finance` |
| `econ-unallocated-cost` | Cost not allocated to a field | alert | `/finance` |
| `econ-unallocated-revenue` | Revenue not allocated to a field | alert | `/finance` |
| `econ-breakeven-above-sale` | Break-even price above recorded sale price (complete fields only) | alert | `/fields/[id]` |
| `econ-profitability-incomplete` | Field profitability incomplete | alert | `/fields/[id]` |
| `econ-margin-incomplete-data` | A margin resting on <100% complete data | alert | `/fields/[id]` |
| `econ-missing-harvest` | Cost recorded but no harvest | alert | `/fields/[id]` |
| `econ-missing-revenue` | Harvested field with no received revenue | alert | `/fields/[id]` |
| `econ-strongest-margin` | Field with the strongest **complete** gross margin | positive | `/fields/[id]` |

## Signals NOT emitted yet (inputs not in FinanceData)

These are intentionally deferred until the resolver exposes their inputs — never
faked:

- **Yield below plan** — needs planned yield per field-season.
- **Repeated activity increased recorded cost** — needs activity-level cost
  deltas across repeats.
- **Contractor cost above plan** — needs planned contractor cost per field.
- **Margin improved after correction/reallocation** — needs a before/after
  economics comparison across version chains.

## Priority (Part 4)

Each signal scores itself on the seven-dimension `InsightPriorityInputs`
(urgency, financialImpact, complianceImpact, agronomicRisk, timeSensitivity,
confidence, actionability); the shared `resolveInsightPriority` maps the weighted
score to `critical | high | medium | low`. Incomplete data is not marked critical
unless the missing data itself blocks a major decision (e.g. a break-even below
sale price on complete data is high-impact; an unallocated €120 of revenue is
low). The Dashboard shows the **top 3** by score above the fold; Farm Insights
shows the full list.

## Ranking exclusions

- Strongest-margin: only `profitability_ready` fields with a non-null gross
  margin per hectare are eligible; the best is chosen by `grossMarginPerHaEur`.
- Break-even-above-sale: only `profitability_ready` fields with a non-null
  break-even price and a positive recorded yield are evaluated.

## Consistency

Because the Dashboard (`getFarmEconomicSignals`) and Farm Insights
(`resolveEconomicsInsights`) both derive from `buildEconomicSignals`, a signal
that appears in one cannot contradict the other. Unit test 13 asserts the
Dashboard signal id set equals the raw source set.
# Stage 8 canonical signal inventory

The implemented canonical codes are `BUDGET_OVER_LIMIT`, `MISSING_PURCHASE_PRICE`, `MISSING_LABOUR_RATE`, `MISSING_MACHINE_RATE`, `UNALLOCATED_COST`, `UNALLOCATED_REVENUE`, `BREAK_EVEN_ABOVE_SALE_PRICE`, `INCOMPLETE_PROFITABILITY`, `MARGIN_ON_INCOMPLETE_DATA`, `MISSING_HARVEST`, `MISSING_REVENUE`, and `STRONGEST_COMPLETE_MARGIN`.

Triggers, selected fields and priority inputs are unchanged. Budget chooses the largest positive canonical variance. Rate signals use ordered Financial Completeness reasons. Allocation signals require a positive farm-level unallocated amount. Break-even requires profitability-ready data and break-even above recorded sale price. Strongest margin ranks only profitability-ready fields by canonical margin per hectare. Dashboard still shows the first three after the unchanged seven-dimension priority score; Insights uses the same ordered source and excludes the positive highlight from alerts.

Routes remain `/inventory`, `/finance`, or the exact selected `/fields/<id>`. Evidence is structured and farm-scoped. No category labels, translated strings or financial calculations participate in selection or sorting.
