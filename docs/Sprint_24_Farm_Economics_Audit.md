# Sprint 24 Farm Economics Audit

Date: 2026-07-15

## Previous state

The previous Finance resolver read completed `Activity` rows and multiplied `dosePerHa × areaHa × InventoryItem.purchasePricePerUnit`. Stock use and the activity were real, but the price was the current mutable inventory price. A later price edit therefore silently rewrote historical field cost.

`StockMovement` preserved quantities but usually had no `unitCost`. `FinancialSnapshot` and `CropFinancial` were seed/demo structures and were not populated by real operational workflows. No persisted revenue existed, so the previous Finance correctly refused to show revenue or margin.

## Cost-source findings

- Real: completed activity quantities, stock movements, current inventory stock, manually entered current purchase price, WorkOrder expected cost.
- Manual: inventory price, supplier, plan budgets, employee/machine configuration.
- Estimates: WorkOrder expected costs and all plan values. They are budgets, never actuals.
- Previously unpriceable: product use without purchase price, all labour, machinery, fuel, contractor, rent, utilities and overhead.
- Historical price-at-use: not preserved before Sprint 24.
- Corrections/reversals: stock-safe and append-only, but previously absent from economics.
- Scope: activity cost was field/crop/active-season scoped, but read through mutable inventory price.
- Double-count risk: future expense recording could duplicate activity input use unless normalized source types were authoritative.

## Sprint 24 remediation

`ActivityCostSnapshot` freezes quantity, unit, weighted-average unit cost, effective date, total and confidence. `EconomicEntry` is the normalized aggregation ledger for operational economics. Purchases do not become an expense merely because stock was acquired; input cost enters field economics when the input is actually consumed. Correction and reversal paths add compensating entries rather than deleting original economics.

Records created before Sprint 24 do not have a historical price snapshot. They remain incomplete; the system does not backfill a guessed historical cost from today's price.
