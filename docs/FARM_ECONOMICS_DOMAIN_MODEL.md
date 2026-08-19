# Farm Economics Domain Model

`InventoryPurchase` records acquisition and updates weighted-average inventory valuation. `StockMovement` records physical quantity movement. `ActivityCostSnapshot` freezes cost-at-use. `EconomicEntry` is the normalized append-only cost/revenue source used for aggregation. `FinancialExpense`, `HarvestResult` and `RevenueEntry` retain source-specific details.

Every economics record is farm- and season-owned. Direct allocations also carry FieldSeason, field and crop. Source entity IDs and correlation IDs connect economics to audit evidence without duplicating physical stock facts.

Received revenue creates an effective economic entry. Expected and approved subsidy/revenue remain separate and do not enter recorded revenue. Harvest preserves its unit; no implicit kg/tonne/box/piece conversion occurs.

Scope is operational expenses, recorded revenue, gross margin, budgets, break-even and completeness. Excluded: general ledger, VAT returns, bank reconciliation, payroll accounting, statutory depreciation, tax, balance sheet and legal statements.
