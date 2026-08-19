# AI WorkOrder matching policy

`matchActivityDraftToWorkOrders()` is the only matcher. It ranks active-farm,
open WorkOrders from deterministic field, operation, date/window, product, area,
employee and machine comparisons. LLM text extraction never supplies trusted
WorkOrder IDs.

Field, operation and product differences are material conflicts. A conflict
cannot be linked. The farmer must open the comparison and explicitly choose a
non-conflicting candidate. On save, the server rechecks farm, FieldSeason,
operation, open status, optimistic version and absence of a completed Activity.
The existing transaction then performs exact-one Activity, WorkOrder,
reservation, stock, compliance and correlated audit effects.
