# Sprint 25 — Financial Reallocation Audit

Date: 2026-07-15. Evidence-based, read against current source. Status: **NO-GO** (unchanged).

## What exists

- **`allocateEconomicEntry`** (`src/lib/actions/economics.ts`): versions prior allocations (`status active → corrected`, bumps `version`), writes new `EconomicAllocation` rows via `percentageAllocations`, farm+season scoped, requires a ≥10-char reason.
- **`percentageAllocations`** (`src/lib/operational-costing.ts`): largest-remainder (Hamilton) rounding in integer cents; rejects totals ≠ 100%; sum of children equals parent exactly; deterministic tie-break by descending fractional part then ascending index. **3 unit tests** already cover it.
- **`EconomicAllocation`** model: `version`, `status` (`active|corrected|reversed`), `correctionOfId`, `reason`, `originalAmount`, `method`, self-relation `corrections` — full versioning scaffolding present.
- **`EconomicEntry`** carries `status`; reversal (`reverseFinancialRecord`) marks entries `reversed` and writes compensating entries.
- **`finance-data.ts`** exposes per-field/per-crop economics filtered to `status:'active'`, plus `unallocatedCostEur`/`unallocatedRevenueEur`.

## Findings per audit question

| Question | Finding |
|---|---|
| Which record types can be allocated | Any `EconomicEntry` (cost/revenue) via `allocateEconomicEntry`. No type gating — labour/machinery/inventory_input entries (activity-linked) are **not** blocked today. **Gap.** |
| Is allocation versioned | Yes — prior rows → `corrected`, new rows at `version+1`. |
| Does old allocation survive changes | Yes — old rows retained with `status:'corrected'`, never deleted. |
| Rounding | Deterministic, exact (`percentageAllocations`). Sound. |
| Can totals be duplicated | Low risk in the action (it supersedes prior active rows in one transaction), but there is **no stale-version / idempotency guard**, so two concurrent submissions could both create a `version+1` set. **Gap.** |
| Cross-farm destinations validated | Yes — `fieldSeason.findMany({ seasonId: entry.seasonId, field:{farmId} })` and a count check reject foreign/last-season fields. |
| Do reversed records remain allocated | **Gap** — `allocateEconomicEntry` filters the source entry to `status:'active'`, so a reversed entry can't be re-allocated, but existing allocations on a since-reversed entry are not explicitly cleared. Needs confirmation/handling. |
| Field/crop totals update | Yes — resolvers read live; no stored duplicate totals. |
| Method support | `allocateEconomicEntry` **hard-codes `method:'per_hectare'`** on persisted rows regardless of intent, and takes only explicit percentages — per-hectare/per-yield/crop-level/direct/selected are **not** actually resolved server-side. **Major gap.** |
| UI | **None.** No reallocation entry point on `/finance`. |
| Data-integrity risks | No stale-version guard; no idempotency; method not honored; no directly-linked gating; no offline block. |

## Gaps this sprint targets (and what landed this session)

- **This session:** a pure **preview/resolution engine** (`reallocation-preview.ts`) that resolves all supported methods, enforces the integrity rules (100%/no-dup/no-negative/no-zero, missing-yield block, missing-revenue → no fabricated margin), computes deterministic cents, and projects before/after field & crop economics — the foundation the dialog renders and the action must validate against. Plus the rounding-policy doc and comprehensive unit tests.
- **Deferred (documented):** the `ReallocationDialog` + Finance integration + filters, offline read-only block, and the Playwright flows. These are scoped in `docs/Sprint_25_Complete_Farm_Economics_Report.md`.

## Update — persisted write path built (2026-07-15)

The write action `reallocateEconomicRecord` (`src/lib/actions/reallocation.ts`) now closes the write-path gaps. Exact current behavior:

| Question | Current behavior |
|---|---|
| Which method is persisted | The **selected** method (mapped to `CostAllocationMethod`: `selected_fields`/`direct_field`/`per_hectare`/`yield_proportional`/`per_crop_area`/`unallocated`) — no longer hard-coded. |
| Which record version is used | The current **effective allocation** version (max active), passed as `expectedVersion`; source `EconomicEntry` is re-read from DB, never trusted from the client. |
| Can source amount change during review | If the underlying record was corrected, the old entry is `corrected` and the client's stale entry id resolves as `record_not_found`; a live version change is caught by the stale-version guard. |
| Is existing allocation overwritten | No — prior active rows → `status:'corrected'`; a new `version+1` set is inserted. |
| Do old allocations survive | Yes — retained, queryable, `correctionOfId` links the chain. |
| Duplicate submission possible | No — idempotency key + `submissionHash`; same key/same payload returns the existing result, same key/different payload → `idempotency_conflict`. |
| Can reversed records be allocated | No — `record_reversed`. |
| Can directly-linked records be reallocated | No — `directly_linked_cost` for `inventory_input/labour/machinery/fuel` source types. |
| Can another farm's field be submitted | No — destinations validated against `farmId` + `seasonId`; mismatch → `invalid_destination`. Source is farm-scoped → `record_not_found`. |
| Audit correlation | Yes — one `correlationId` across the allocation rows + the `allocation_created`/`allocation_changed` audit event. |
| Math source | `previewReallocation()` only — the action never recomputes a formula; it asserts the engine's parent==children reconciliation before persisting. |

Remaining gap: **no UI entry point** — a farmer cannot reach this action yet (ReallocationDialog + Finance integration deferred).
