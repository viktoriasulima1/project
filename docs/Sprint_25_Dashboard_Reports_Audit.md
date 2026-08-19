# Sprint 25 — Dashboard Economics + Reports Audit (Part 1)

Date: 2026-07-16. Evidence-based audit read from the real code before building
this slice.

## Dashboard economics — what existed

- **`dashboard-data.ts` → `getRealDashboardData`** builds the dashboard from the
  legacy **`FinancialSnapshot`** table (a pre-computed per-season snapshot), NOT
  from the live `getFinanceData` resolver. When no snapshot exists it returns an
  all-**zero** `finance` object (`totalExpensesEur: 0`, `estimatedMarginEur: 0`,
  …) — a **latent "missing = €0" hazard**, though `FinanceSnapshotCard` is the
  only consumer and the live Finance page does not use it.
- **`FinanceSnapshotCard`** on the dashboard shows snapshot-derived totals. It is
  not the shared economics resolver and can disagree with `/finance`.
- **`getFarmInsights`** (Farm Insights) already reuses `getFinanceData` via
  `resolveEconomicsInsights` (Sprint 25 prior slice) — the one place economics
  signals were computed from live data. The dashboard surfaced these only
  indirectly, mixed into the generic `AIBriefingCard` (top-5 of *all* insights),
  with **no dedicated economics-decisions section** and no season economics
  strip.
- **No shared `getFarmEconomicSignals`**: the dashboard had no economics signal
  concept of its own; `resolveEconomicsInsights` was insight-shaped, not the
  richer signal shape (affected field, amount, completeness, route, calculatedAt).

### Findings

| Aspect | State |
| --- | --- |
| Live economics signals on Dashboard | **Missing** (only via generic briefing) |
| Mock/static economics | `FinanceSnapshotCard` uses `FinancialSnapshot`; zero-fallback risk |
| Incomplete data misused | Snapshot fallback returns €0 totals (isolated to one card) |
| Duplicate Finance logic | Insights already share `getFinanceData`; dashboard snapshot path is separate |
| Actionable | Insights carry an action route; not surfaced as focused CTAs |
| Should NOT appear | Peer benchmarking, net-profit language, ranking incomplete fields |

## Reports — what existed

Substantial infrastructure was already present and correct:

- **`/reports`** page: season selector + preview (field count, hectares,
  completeness, missing) + PDF and CSV report links.
- **`/api/economics/export`** route: farm-scoped (`getActiveFarmOrThrow` + season
  ownership check in `getEconomicsExportData`, which throws → 403 for a foreign
  season), writes an `AuditEvent` (`action: 'exported'`, `entityType:
  'EconomicsExport'`, export id, type/format metadata), returns `x-export-id`.
- **`economics-export/{data,csv,pdf}.ts`**:
  - CSV (`field_economics`, `crop_economics`, `purchases`, `expenses`,
    `harvest`, `revenue`, `budget_vs_actual`): BOM, `\r\n`, ISO dates, stable
    headers, **formula-injection protection** via `escapeCsvValue`, effective
    records only unless `includeHistory`.
  - PDF (`field_cost`, `crop_comparison`, `season_gross_margin`,
    `budget_vs_actual`, `purchase_history`, `cost_source_breakdown`): A4, page
    numbers, per-page **disclaimer** ("Operational economics, not statutory
    accounting"), export id + generated timestamp, `€→EUR`/dash sanitisation for
    the built-in Helvetica font.
  - All fed by `getFinanceData` — **no duplicate report engine**; missing values
    render "Not recorded", never €0.

### Gaps closed this slice

| Gap | Action |
| --- | --- |
| No **unallocated-records** report (Part 14) | Added `unallocated_records` CSV (reuses `getAllocatableRecords`, excludes activity-derived direct costs) |
| Export **provenance** lacked a checksum (Part 16) | Route now records a SHA-256 content checksum + record count + app version in the audit metadata and an `x-export-checksum` header; safe filename |
| Offline honesty on Reports (Part 18) | Reports page states generation requires a connection |

### Gaps honestly deferred

- Full **filter matrix** (Part 15): only season is a live filter today; the
  export layer already supports `includeHistory`. Date/field/crop/category/
  completeness/allocation-status filters + a pre-export record-count-by-filter
  are **not** built this slice (would need a filtered variant of the export data
  resolver). Documented in the report data dictionary.
- Signed download / persisted storage (Part 17): files are generated on demand
  and never stored, so no signed URL is needed today.
- Signals needing inputs `FinanceData` does not expose (yield-below-plan,
  repeated-activity-cost-increase, contractor-above-plan,
  margin-improved-after-correction) remain **not emitted** — see
  `docs/ECONOMICS_SIGNAL_RULES.md`.

## Plan for this slice

Build the shared `getFarmEconomicSignals` resolver as the single signal source
(consumed by both the new Dashboard **Economics decisions** section and Farm
Insights via `resolveEconomicsInsights`), add the unallocated-records report and
export checksum provenance, unit-test signals + reports, write (not execute) the
Playwright flows, and document. Sprint 25 stays **NO-GO**.
