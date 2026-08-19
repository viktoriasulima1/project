# Compliance Export Data Dictionary

Defines every field in the PDF and CSV compliance exports, and where it comes from. Both formats are built from the exact same source — `getEffectiveComplianceRecords()` (`src/lib/compliance-data.ts`) — so a value that appears in one appears, in the same form, in the other (the CSV's `total_quantity` is the one exception: a genuinely CSV-specific computed column; see below).

## Shared source

Every exported record is one member of an `Activity` correction chain (the effective version by default, or every version when "include correction history" is selected), joined to its own `ComplianceRecord.data` JSON snapshot — the same denormalized facts captured at the moment that specific version was created (Sprint 18/19's compliance-snapshot pattern). Nothing in the export re-reads live `InventoryItem`/`CtgbProductReference`/`Field` data — an export always reflects what was true when the record (or correction) was made, never what happens to be true right now.

## CSV columns

| Column | Source | Notes |
|---|---|---|
| `export_id` | Freshly generated per export request (`ExportContext.exportId`) | Same value across every row in one export; also the file's own name and its `ComplianceExport.id`-linked audit event. |
| `record_id` | `Activity.id` of this specific version | The effective version's own id, or a specific historical version's id when correction history is included. |
| `original_record_id` | The chain's root `Activity.id` | Equal to `record_id` for a never-corrected record. |
| `effective_version` | `Activity.version` | 1 for an original; incremented by each correction/reversal. |
| `correction_count` | Count of non-null `correctionOfId` rows in the chain | Excludes the original itself. |
| `record_status` | Derived: `reversed` / `corrected` / `original` | Not the same axis as `completeness_status` below — this describes the chain state, that describes data completeness. |
| `activity_date` | `Activity.date`, ISO 8601 | The activity's own recorded date, in UTC. |
| `farm` | `Farm.name` | The exporting farm's own name — never another farm's. |
| `field` | `ComplianceRecord.data.fieldName` | Denormalized at record-creation time; survives a later field rename. |
| `crop` | `ComplianceRecord.data.crop` | |
| `field_area_ha` | `ComplianceRecord.data.fieldHectares` | The field's total area, not the treated area. |
| `treated_area_ha` | `ComplianceRecord.data.areaHa` | |
| `product_name` | `ComplianceRecord.data.productName` | Null for a non-product activity (e.g. scouting). |
| `authorisation_number` | `ComplianceRecord.data.productRegistrationNumber` | The Ctgb authorisation number, when the product is Ctgb-linked. |
| `ctgb_verification_status` | `ComplianceRecord.data.ctgbComplianceStatus` | `verified` \| `incomplete` \| `manual_unverified` \| `expired` \| `use_not_found` \| `unavailable` — see `src/lib/ctgb-compliance-check.ts`. |
| `intended_use` | `ComplianceRecord.data.ctgbSelectedUse.cropOrUseTarget` | The official Ctgb use FarmOS matched this application against. |
| `dose` | `ComplianceRecord.data.dosePerHa` | |
| `dose_unit` | `ComplianceRecord.data.doseUnit` | |
| `total_quantity` | **Computed**: `dose × treated_area_ha` | Not separately stored — derived at export time from the same two fields, so it can never drift from them. |
| `quantity_unit` | Same as `dose_unit` | |
| `water_volume_l_ha` | `ComplianceRecord.data.waterVolumePerHa` | |
| `operator` | `ComplianceRecord.data.operatorName` | |
| `machine` | `ComplianceRecord.data.machineName` | |
| `nozzle` | `ComplianceRecord.data.nozzleType` | |
| `bbch` | `ComplianceRecord.data.bbchStage` | The growth stage at the time of THIS application, not the field's current stage. |
| `weather_temperature_c` / `weather_wind_kmh` / `weather_humidity_pct` | `ComplianceRecord.data.weatherTempC`/`weatherWindKmh`/`weatherHumidity` | Frozen at completion time — a fresh snapshot fetched then, never re-fetched later. |
| `completeness_status` | `resolveComplianceCompleteness().status` | `complete` \| `incomplete` \| `verification_unavailable` \| `corrected` \| `reversed`. |
| `missing_fields` | `resolveComplianceCompleteness().missingFields`, `; `-joined | Empty string when nothing is missing. |
| `created_at` | The chain ROOT's own `createdAt`, ISO 8601 | Immutable — never changes even after a correction. |
| `corrected_at` | The effective version's own `createdAt`, ISO 8601 | Empty string when `correction_count` is 0. |

**Deliberately absent from the CSV**: a certificate-number column. Employee/operator certificate numbers are sensitive enough (Part 15) that they are not included in the machine-readable export at all — only in the PDF, and there only masked.

**CSV formatting rules**: UTF-8 with a BOM (Dutch Excel compatibility); every decimal uses `.`, never a locale `,`; any cell whose value starts with `=`, `+`, `-`, or `@` is prefixed with a `'` to prevent spreadsheet formula injection (OWASP's standard mitigation); one row per exported record.

## PDF fields

The PDF renders one bordered block per record (see `src/lib/compliance-export/pdf.ts` for why: ~17 fields per application don't fit as readable table columns on A4 without clipping something). Each block shows: Field (with total field area), Crop, Treated area, Product, Authorisation number, Ctgb verification, Intended use, Dose, Total quantity (computed the same way as the CSV), Water volume, Operator, Certificate (masked — see Part 15), Machine, Nozzle, BBCH stage, Weather (temperature/wind/humidity combined into one readable line), and Record status (with a `CORRECTED`/`REVERSED` marker in the block's top-right corner when applicable).

**Header** (every page): farm name, legal name (if set), location, "EU Spray Diary", season and date-range label, generation timestamp, FarmOS version, export id.

**Footer** (every page): the same disclaimer as the CSV/plain-text export (see `EXPORT_DISCLAIMER`, `src/lib/compliance-export/types.ts`) — generated from user-entered and integrated source data, verify against the product label, FarmOS does not certify legal compliance, reversed records excluded by default, corrections represented by the current effective version — plus the export id and "Page X of Y".

**Accessible plain-text fallback**: `buildComplianceDiaryPlainText()` produces the same facts as the PDF in a plain-text form, field by field, for a screen reader or simple text viewer — available via the export route's `plaintext` request option.

## Export provenance (`ComplianceExport`)

Every export (PDF or CSV) writes one `ComplianceExport` row and one `exported` `AuditEvent`, in the same request, before the file streams to the browser: `farmId`, `requestedByUserId`, `format`, `filtersJson` (the exact filter selection used), `recordCount`, `checksum` (see below), `generatedAt`. **The generated file itself is never stored** — `storageReference` stays `null` this sprint; only its provenance is kept.

**Checksum**: a SHA-256 hash of a canonical, sorted view of the exported records' own data — deliberately *not* a hash of the final PDF/CSV bytes, since those always embed a fresh export id and generation timestamp by design (making byte-level hashing non-deterministic for identical underlying data). The checksum answers "did the underlying compliance data change between these two exports," not "are these two files byte-identical."
