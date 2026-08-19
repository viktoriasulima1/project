# Field Economics Data Dictionary

Every value shown on the Field Detail economics page (`/fields/[id]`), its
source, and its missing-data rule. Sprint 25. Gross margin is **recorded revenue
minus recorded operational cost** — never net or statutory profit. Missing data
is **unknown, never €0**.

## Summary metrics (Part 2)

| Field | Source | Missing rule |
| --- | --- | --- |
| Total recorded cost | `resolveFieldEconomics` over active cost `EconomicEntry` | null if any cost source is unpriced → "Not recorded" |
| Cost / hectare | recorded cost ÷ field hectares | null when cost is null |
| Recorded revenue | active revenue `EconomicEntry` | null when no revenue → never €0 |
| Gross margin | recorded revenue − recorded cost | null unless both are known |
| Gross margin / ha | gross margin ÷ hectares | null when margin is null |
| Harvest / yield / ha | active `HarvestResult` (saleable, else gross) | null when no harvest |
| Cost / unit | recorded cost ÷ saleable yield | null when either is missing |

## Cost breakdown categories (Part 3)

`categoryForSource(sourceType, { inventoryCategory, isAllocated })` maps each
cost to one category. Percentages are **"share of recorded cost"** — the sum of
*known* category amounts — never a share of an incomplete "true total". A
category with any unpriced record is **Partial** (null amount) and excluded from
the share denominator.

| Category | Sources |
| --- | --- |
| Crop protection | `inventory_input` where product is herbicide/fungicide/insecticide |
| Fertiliser | `inventory_input` where product is fertiliser |
| Seed/planting material | `inventory_input` where product is seed |
| Labour | `labour` (activity labour snapshot) |
| Machinery | `machinery` (activity machine snapshot) |
| Fuel | `fuel` (separately-tracked fuel) |
| Contractor | `contractor` |
| Irrigation/utilities | `utilities` |
| Field expenses | `field_rent`, `soil_lab`, direct `miscellaneous`/`manual_expense` |
| Allocated overhead | allocated `miscellaneous`/`manual_expense` |
| Other | anything unmapped |

## Direct vs allocated (Part 5)

`directVsAllocated()` separates:

- **Recorded directly** — `allocationMethod: direct_field` on this field.
- **Allocated to field** — a proportional/selected method landed a share here.
- **Crop level** — `per_crop_area` not yet distributed to a field.
- **Farm-level unallocated** — `unallocated`; **reported separately and never
  folded into the field's margin.**
- **Excluded (reversed)** — reversed amounts, shown but out of the total.

`Total recorded field cost = recorded directly + allocated to field`.

## Completeness (Part 6)

`resolveEconomicsCompleteness` yields a percentage + status
(`insufficient_data` → `cost_tracking_active` → `partial_profitability` →
`profitability_ready`) plus included categories, missing categories, their
effect, and — via `completenessActions()` — the concrete next action ("Add
missing purchase price", "Configure labour rate", "Record harvest", …).

## Break-even (Part 8)

`breakEvenExplanation()` shows a value **only** when its inputs are complete and
reconciled; otherwise it returns the exact blocking reasons and shows **no**
number:

- **Break-even price** = total recorded cost ÷ saleable yield. Blocked by:
  material costs incomplete, harvest not recorded, unit mismatch, unallocated
  cost remains.
- **Break-even yield** = total recorded cost ÷ recorded sale price. Blocked by:
  material costs incomplete, sale price missing, unit mismatch, unallocated cost
  remains.

## Budget vs actual (Part 7)

Planned components come from `SeasonPlanItem.expected*`; actuals from the field's
cost/revenue entries. Each line shows amount + % variance + a missing-data note.
Inferred causes are prefixed *"Likely driver based on recorded data"* via
`financialDrivers()` — never an invented explanation.

## Source records (Part 4)

`getFieldEconomicSourceRecords()` lists each active cost/revenue `EconomicEntry`
with a human description (activity type + product, expense description, revenue
name, contractor + operation), its source module, amount, allocation, and
version. Raw database ids are never the primary label.

## Effective-version rule

Resolvers filter `status: 'active'` for all active totals. Corrected/reversed
rows are excluded from totals but preserved and shown in history. The version
timeline marks the single active row as **Current effective**.
