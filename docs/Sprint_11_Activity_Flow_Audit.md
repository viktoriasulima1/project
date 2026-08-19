# Sprint 11 — Activity Flow Audit

## Headline finding

**`SprayDiaryDialog.tsx` hardcodes `<input type="hidden" name="type" value="spray" />`.** Every activity logged through the current UI is recorded as a spray, regardless of what actually happened on the field — there is currently **no way to log fertilising, sowing, tillage, scouting, or harvesting through the app at all**, despite `createActivity` and the `Activity` schema fully supporting all 9 `ActivityType` enum values. This is the single most consequential finding in this audit and the direct reason Part 2's "what did you do?" redesign is the right starting point, not an incremental improvement.

## Per-activity-type measurement (current state)

Since only spray is reachable today, "measurement" for the other 5 types is "0 fields, 0 taps, impossible" — there's no form to measure.

| Type | Reachable today? | Visible fields | Required fields (schema) | Est. taps (thorough) | Time estimate |
|---|---|---|---|---|---|
| Spray | Yes (the only path) | 15 (16 with machine shown) | 4 user-facing (fieldSeasonId, date, operatorName, areaHa) | ~20+ (many are dropdowns needing open+select) | 90–150s for a farmer filling every field |
| Fertilise | **No** | — | — | — | — |
| Sow | **No** | — | — | — | — |
| Tillage | **No** | — | — | — | — |
| Scout | **No** | — | — | — | — |
| Harvest | **No** | — | — | — | — |

Both targets (spray < 60s, non-spray < 30s) are currently **unmet**: spray is roughly 2× over target, and non-spray types aren't just slow — they're unreachable.

## Confusion points identified

1. **Dialog is always titled "Log spray activity"** even though it's the only entry point for the whole Activities page — a farmer trying to log a fertiliser application has no obvious path and no error explaining why.
2. **All 15 fields render at once, regardless of relevance.** Water volume, nozzle type, and a full weather panel show even though (per the current wiring) they're always spray-context — there's no progressive disclosure at all.
3. **Weather is entered manually** — four separate number/select inputs (temp, wind speed, wind direction, humidity) — despite the app already having a fully working Weather module with real Open-Meteo data (`src/lib/weather.ts`, `src/app/(farm)/weather/page.tsx`) that is never consulted here. A farmer has to tab over to the Weather page, read the numbers, then hand-type them into this form.
4. **No stock or compliance preview.** A farmer selecting a product and dose has no idea whether there's enough stock, or what the resulting stock level will be, until after clicking submit — where it either silently succeeds or fails with an "Insufficient stock" error they could have avoided seeing entirely with a live preview.
5. **Nothing is prefilled except the date.** Operator name, machine, and treated area all start blank on every single entry, even for a farmer logging their third spray of the day on the same field with the same operator and sprayer.

## Fields shown too early (once type-specific forms exist)

For a hypothetical spray-specific form: product/dose/water-volume/nozzle are all "required" per Part 4, so they're not really "too early" — but weather and certificate number are compliance-adjacent fields that should sit in an auto-populated, visually distinct section rather than blend into the same flat field list as "date" and "area."

## Values that can be safely prefilled (not currently)

- **Weather snapshot** — real data exists (`fetchWeather`), currently never used here.
- **Treated area** — could default to the selected field's hectares (already known from `fieldSeasons`), remaining editable for partial-field applications.
- **Operator name** — the most recently used operator name for this farm is a reasonable, clearly-labelled suggestion.
- **Machine** — same, most recently used machine.
- **Date** — already defaults to today (the one thing already done right).

## Values that must never be silently prefilled (confirmed, none currently are — but worth stating as they're built)

Dose, water volume, BBCH stage, certificate number, nozzle type, any legal/registration data, compliance confirmations. None of these are safe to guess even from a "recent" value, since a wrong dose or an incorrectly-carried-over certificate number is a real compliance risk, not a convenience.

## Inventory / compliance / field integration review

- **Inventory integration** exists and is correct (verified, tested): atomic stock deduction via `$executeRaw` with a `WHERE currentStock >= totalUsed` guard, product farm-ownership check inside the transaction. Not exposed as a *preview* to the user before submit — only enforced after the fact.
- **Compliance integration** exists and is correct: a `ComplianceRecord` is auto-created for `type === 'spray'` only, denormalized snapshot, never for other types. Not surfaced to the user at all before or after save (no "compliance record created" confirmation).
- **Field/FieldSeason selection** is correct and farm-scoped (`fieldSeason.findFirst` inside the transaction re-verifies ownership). No visible crop/BBCH context shown at selection time beyond the crop name in the dropdown label.
- **Operator/machine selection**: machine dropdown is conditionally hidden entirely if the farm has zero machines (reasonable), but there's no recency memory.
- **Weather snapshot**: entirely manual, as above — the biggest concrete opportunity in this audit.
- **Validation and error UX**: the scroll-into-view fix (added in an earlier session) works structurally, and a guaranteed fallback banner exists for field-level-only errors. This part is in reasonably good shape already.

## What this sprint changes (see `Sprint_11_Activity_Quick_Log_Report.md` for what was actually shipped vs. deferred)

- Replace the spray-only dialog with a type-first, progressively-disclosed `ActivityDialog` covering all 6 named types (spray/fertilise/sow/tillage/scout/harvest), plus a 7th "other" path for the schema's remaining `irrigate`/`soil_sample`/`other` values so they're not orphaned from the UI entirely.
- Wire in real weather snapshot prefilling from the existing Weather module's data source.
- Add safe prefilling for operator/machine (most recent) and treated area (field hectares).
- Add a live, client-side stock/compliance preview before submit.
- Build Quick Log as the same dialog + same `createActivity` action, opened from more entry points — not a second business-logic path.
