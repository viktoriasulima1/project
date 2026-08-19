# Sprint 25 — Economics Completion Audit

Date: 2026-07-15

Classification is based on executable schema, server actions, shared resolvers, UI, and tests. Documentation or a database column alone is not counted as a complete workflow.

| Feature | Classification | Evidence / gap |
|---|---|---|
| Weighted-average inventory valuation | Complete | Atomic purchase transaction, stock movement, valuation update, unit tests. |
| Historical input price snapshot | Complete | `ActivityCostSnapshot` is frozen at activity completion; corrections create economic adjustments. |
| Purchase entry | Partial | Create and reversal exist. No correction version, offline exact-one identifiers, duplicate invoice conflict, or dedicated E2E. |
| Expense entry | Partial | Direct/unallocated create exists. No correction/reversal lineage, offline sync, or multi-field allocation. |
| Harvest entry | Partial | Create exists. No correction/reversal lineage or offline sync. |
| Revenue entry | Partial | Expected/approved/received separation exists. No correction/reversal lineage, offline sync, or completed multi-field allocation. |
| Labour rate fields | Schema-only | Employee has one current rate/effective date/type. No historical rate table, Activity worker join, hours snapshot, costing action, or complete UI. |
| Owner labour | Schema-only | Enum value exists; explicit configuration workflow and snapshot do not. |
| Multiple employees per WorkOrder | Partial | Assignment join exists, but planned/actual hours per employee and Activity linkage do not. |
| Labour cost snapshot | Missing | Input snapshots cannot represent employee/version/hour evidence completely. |
| Machine rate fields | Schema-only | One current rate/effective date/policy exists; no historical versions or completion snapshot. |
| Fuel costing | Schema-only | Activity litres, machine consumption/policy, and fuel inventory category exist independently. No authoritative snapshot/calculation/double-count guard. |
| Contractor costing | UI-only / partial | Generic contractor expense can be entered. No contractor entity/rate types, WorkOrder/Activity attachment, or duplicate guard. |
| Direct field allocation | Complete for single field | Ownership and field-season checks exist. |
| Multi-field allocation | Missing | Enum methods exist but current action creates one unallocated or one field entry; percentages/versions/audit do not exist. |
| Crop/ha/yield allocation | Misleadingly complete | Method labels and allocation math helper exist, but persisted allocation children and editing/versioning do not. |
| Farm overhead choice | Partial | Explicit included/excluded note exists; allocation records and versions do not. |
| Financial corrections/reversals | Partial | Purchase reversal and regulated Activity compensation exist. Expense/revenue/harvest corrections and reversals are missing; purchase correction is missing. |
| Field economics resolver | Partial | Inputs/direct expenses/revenue/harvest/completeness exist. Category output, labour/machine/fuel snapshot totals, overhead, and explicit unallocated output are incomplete. |
| Crop aggregate | Partial | Field rows aggregate by crop with null propagation. Category and unallocated breakdown absent. |
| Season/farm aggregate | Partial | Active-season totals exist. Included fields/category/unallocated evidence incomplete. |
| Budget versus actual | Partial | Overall cost variance and planned component fields exist. Category/yield/price/revenue/margin variance and evidence-backed drivers are incomplete. |
| Finance UI | Partial | Summary, field/crop tables, forms, completeness, unallocated summary exist. Drill-down, rate setup, category totals, reports, corrections, and allocation review absent. |
| Field detail economics | Missing | No field economics route/detail view. |
| Economics insights | Partial | Existing generic Finance/missing-price signals reuse shared data; complete requested actionable set absent. |
| Activity offline queue | Complete for current scope | IndexedDB, exact-one activity identifiers, locking, conflict state, recovery, isolation, and E2E exist. |
| Finance offline queue | Missing | Draft union, finance sync endpoint, server idempotency constraints, autosave forms, and finance conflicts absent. |
| Compliance PDF/CSV infrastructure | Complete for compliance only | A4 PDF, Unicode strategy, CSV protection and provenance exist. |
| Economics PDF reports | Missing | No economics report resolver/templates/endpoints. |
| Economics CSV exports | Missing | No stable economics datasets/endpoints. |
| Reports hub | Missing for economics | Compliance export is embedded in Compliance; no economics report center. |
| Cross-farm action security | Partial | Current create actions validate farm ownership. Rate/allocation/report/offline-finance actions do not yet exist to verify. |
| Dedicated Sprint 23 E2E | Missing | No field-map/WorkOrder/offline WorkOrder dedicated spec. |
| Dedicated Sprint 24/25 E2E | Missing | Full regression exists, but requested finance flows do not. |
| Physical mobile validation | Missing | No physical iPhone or Android finance validation has been performed. |

## Audit conclusion

Sprint 24 correctly delivered a trustworthy foundation, but labour, machinery/fuel, multi-field allocation, financial versioning, finance offline exact-one sync, and economics reports are not end-to-end. Sprint 25 remains **NO-GO** until those paths have executable server invariants, user-visible workflows, dedicated tests, and physical-phone validation. Missing values must continue to propagate as unknown rather than zero.
