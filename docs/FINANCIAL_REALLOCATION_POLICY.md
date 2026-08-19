# Financial Reallocation Policy

How FarmOS moves a recorded cost or revenue onto fields, and the integrity rules
that protect field/crop economics. Implemented state as of this Sprint 25
iteration; see the "Status" section for what is built vs. deferred.

## Supported record types

Reallocation applies to **`EconomicEntry` rows sourced from**: expenses,
revenue, subsidies, contractor costs, and overhead costs.

## Unsupported record types (and why)

These are **not** reallocatable and the UI explains why:

- **Inventory usage already linked to a field activity**, **labour snapshots**,
  and **machinery snapshots** — *"This cost is already assigned through the
  completed activity."* They are direct-field by construction.
- **Finalized purchases** — reversal-only (see the safe-purchase policy); an
  in-place change can corrupt weighted-average valuation.
- **Already-reversed records** — a reversed record is out of effective totals.
- **Compliance records** — not a financial allocation surface.

## Allocation methods

1. **Direct field** — 100% to one FieldSeason.
2. **Selected fields** — manual percentage or manual amount per field.
3. **Proportional by hectares** — split by active field area.
4. **Proportional by recorded yield** — split by recorded saleable yield;
   **blocked** when yield is missing or incompatible.
5. **Crop level** — stays at the crop aggregate, not distributed to fields; may
   be distributed later.
6. **Unallocated** — stays visible and excluded from field-level profitability.

Each method states its assumption in the dialog.

## Integrity rules (enforced by the pure preview engine)

- Full allocation must total **exactly 100%** after cent rounding; a partial
  allocation leaves a **visible** remainder — no hidden remainder.
- No duplicate destination; no negative or zero-value destination.
- All destinations must belong to the farm and the record's season.
- Reversed / directly-linked / cross-currency records are blocked.
- Money is split in **integer cents** with a deterministic largest-remainder
  algorithm — see `FINANCIAL_ALLOCATION_ROUNDING_POLICY.md`. Parent equals
  children exactly.
- Margin impact is shown only when both cost and revenue are recorded;
  otherwise the preview says *"Margin impact cannot be calculated because
  revenue is not recorded"* — missing values are never invented.

## Versioning & audit

Reallocation never overwrites the previous allocation invisibly: prior
`EconomicAllocation` rows move to `status:'corrected'` and a new effective
version (`version+1`) is written, with a required reason, actor, timestamp, and
an audit event. Statuses: `original`, `reallocated/corrected`, `reversed`,
`current_effective`. Audit history is append-only.

## Offline

Reallocation **requires an online connection** — multiple field totals update
atomically. Offline, the last-synced allocation is read-only and Save is
disabled: *"Reallocation requires an internet connection because multiple field
totals must be updated atomically."* Reallocation is never queued offline.

## Security

Source record, destination fields, crops/FieldSeasons, and any submitted
allocation IDs are all validated against the requesting farm server-side;
cross-farm IDs are rejected and no cross-farm economics appear in previews or
errors.

## Status

**Built and unit-tested:**
- The pure preview/resolution engine (`reallocation-preview.ts`) — method
  resolution, all integrity rules, deterministic cents, before/after field &
  crop impact, honest missing-margin. **23 tests.**
- The **persisted write action** `reallocateEconomicRecord`
  (`src/lib/actions/reallocation.ts`) — strict Zod contract, DB-authoritative
  source resolution (never trusts client amounts/farm IDs), destination
  ownership validation, uses `previewReallocation()` as the sole math source,
  versioned append-only persistence (prior rows → `corrected`, new effective
  `version+1`), **row-lock + optimistic stale-version guard**, **idempotency**
  (shared key + `submissionHash`; same key/different payload → conflict),
  `allocation_created`/`allocation_changed` audit events with a correlation id,
  and a **16-category safe error model** (never exposes Prisma/SQL). **25 tests.**
- Migration `sprint25_reallocation_write_path`: added `selected_fields` to
  `CostAllocationMethod`, `allocation_*` to `AuditAction`, and idempotency /
  correlation / createdBy columns to `EconomicAllocation` (idempotency key is
  **indexed, not unique** — one reallocation writes many destination rows).

**UI now built (this iteration):**
- `previewReallocationForRecord` — authoritative read-only server preview that
  loads per-field economics via `getFinanceData` and runs the shared engine, so
  the dialog never computes math and cannot disagree with what is persisted.
- `getAllocatableRecords` — bounded (≤100) loader of allocatable records with
  their allocation status (`unallocated`/`partially_allocated`/`fully_allocated`/
  `reallocated`) and effective version; excludes activity-derived source types.
- `ReallocationDialog` (`src/components/finance/reallocation/`) — a 4-step flow
  (method → destinations → server preview → confirm) with before/after field
  impact, honest missing-margin, rounding difference, remaining unallocated,
  blocked-preview gating, reason-required-on-change, a stable idempotency key,
  loading state, stale-version error UX (with "Reload current allocation"),
  offline read-only banner (online-only, never queued), and a success result.
  The four steps are modeled as internal stages of one cohesive dialog rather
  than six separate files.
- `AllocationSection` on `/finance` — Unallocated / Partially allocated /
  Recently reallocated sections with Allocate/Reallocate actions and empty
  states.

**Still deferred:** per-status filters/pagination beyond the current bounded
list, a standalone allocation-details/history view, component interaction tests
(no React Testing Library harness exists; not adding one just for this dialog),
and **executing** the Playwright flows (`e2e/sprint25-reallocation.spec.ts` is
**written but not executed** — runner gated; no pass claimed). Physical mobile
validation is pending. **Sprint 25 remains NO-GO** until the E2E runs clean
twice and physical devices are verified.
