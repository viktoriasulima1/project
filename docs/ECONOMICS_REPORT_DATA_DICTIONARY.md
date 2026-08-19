# Economics report data dictionary

All monetary columns use the farm currency and a `.` decimal separator. Empty numeric CSV cells mean “Not recorded”, not zero. Dates are ISO `YYYY-MM-DD`.

| Dataset | Grain | Key measures |
|---|---|---|
| `field_economics.csv` | One active field-season | hectares, recorded cost/revenue, gross margin, cost/ha, yield, cost/yield unit, break-even, completeness |
| `crop_economics.csv` | One crop/season | included field count, hectares, cost, revenue, margin, per-ha values, completeness |
| `purchases.csv` | One effective purchase | quantity/unit, unit cost, ex-VAT total, informational VAT, reference, status |
| `expenses.csv` | One effective expense | source, field, quantity/unit, amount, allocation, reference |
| `harvest.csv` | One effective harvest | field, area, gross/saleable quantity and unit, moisture, quality, batch |
| `revenue.csv` | One effective revenue record | type/status, field, quantity/unit, unit price, total, allocation |
| `budget_vs_actual.csv` | One active field-season | planned and recorded cost/revenue, amount/percentage variance, completeness |

PDF exports include farm, season, generated timestamp, export ID, completeness evidence, page numbers, and “Operational economics, not statutory accounting”. Effective records are the default; CSV history is opt-in. Text beginning with `=`, `+`, `-`, or `@` is neutralized against spreadsheet formula injection.

## Sprint 25 additions (2026-07-16)

| Dataset | Grain | Key measures |
|---|---|---|
| `unallocated_records.csv` | One allocatable cost/revenue record with a remaining unallocated amount | date, label, kind, source type, amount, allocated, remaining unallocated, allocation status, reference |

`unallocated_records` reuses `getAllocatableRecords`, so **directly-linked
activity costs** (`inventory_input`/`labour`/`machinery`/`fuel`) are excluded by
construction, and only records with `remaining_unallocated > 0` are listed.

**Provenance (Part 16):** every export now records, in its `AuditEvent`
metadata, a **SHA-256 checksum of the exact served bytes**, the record count, and
the app version, in addition to the export ID / filters / format already stored;
the response carries `x-export-id` and `x-export-checksum` headers. Filenames are
sanitised to `[A-Za-z0-9_-]`. Files are generated on demand and never persisted.

**Security (Part 17):** `getEconomicsExportData` rejects a season that does not
belong to the requesting farm (→ HTTP 403). Field/crop values in every report
come only from that farm's `getFinanceData`.

**Filters (Part 15):** season + `includeHistory` are live today. Date-range /
field / crop / cost-category / completeness / allocation-status filters and a
filtered pre-export count are **deferred** (need a filtered variant of the export
data resolver) — documented, not faked.

**Offline (Part 18):** report generation requires a connection and is never
queued offline; the Reports page states this.
