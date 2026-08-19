# Inventory Valuation Policy

FarmOS uses weighted-average cost for the Sprint 24 operational economics MVP.

After a purchase:

`new average = (existing quantity × existing average + purchase total) / (existing quantity + purchase quantity)`

Rules:

- The purchase unit must equal the inventory item's stored unit.
- VAT is informational and excluded from the operational unit valuation entered as purchase total.
- Zero opening stock takes the purchase unit cost directly.
- Existing positive stock without a valuation blocks a new weighted-average calculation; FarmOS will not invent its opening value.
- Every purchase creates purchase history and an inbound stock movement. Stock is incremented, never overwritten.
- Completed input use freezes the then-current weighted-average rate in `ActivityCostSnapshot`; later purchases never rewrite it.
- A purchase reversal is allowed only while its quantity is still available and the remaining value is deterministic. Otherwise an auditable correction is required.
- FIFO and LIFO are not implemented.

This is an operational valuation policy, not tax inventory accounting advice.
