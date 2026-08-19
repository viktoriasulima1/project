# FarmOS Translation Review Backlog

## Stage 16 update

No new keys were needed; both reused codes already have four-locale coverage and placeholder parity. The Dutch economics warning remains unrelated.

## Stage 15 update

No new translation-review exception was introduced. Reused Activity/Quick Log error codes are present in nl-NL, en-GB, pl-PL and de-DE. The existing Dutch economics identical-to-English warning remains unchanged.

## Stage 13 update (2026-08-01)

Remove the migrated Work Order error codes from active review: four-locale key/placeholder validation passes. One pre-existing Dutch economics explanation identical to English remains a review warning and is outside this batch.

# Stage 12 update

The backlog is now split into 349 active resolver targets, 53 resolver fixture/dev/internal findings, 146 active user-error targets and four development-only user errors. Thirty-four raw-forwarding findings are P0. Work Order operational errors are the selected next bounded batch.

# Stage 11 update

Canonical User Error titles/actions and the migrated Onboarding errors are complete for nl-NL, en-GB, pl-PL and de-DE. Remaining priority debt is 150 active error paths across Activities, Work Orders, Finance, offline/sync, scouting photos, providers/APIs and error boundaries. Native wording review remains requested.

# Stage 10 update

Spray Window resolver wording is complete in four locales and raw signal codes are no longer user-visible in its real Weather, Activity suitability or Farm Insights consumers. Native agronomic review of product/weather wording remains requested. Remaining unrelated global resolver debt is 415, including User Error and other groups.

## Financial Completeness native review — automated stage closed 2026-07-28

Automated coverage is complete for
`fields.economics.completeness.{status,recorded,reasons,actions}` in nl-NL,
en-GB, pl-PL and de-DE, including long-text mobile rendering and no raw codes.
Native agricultural-finance review of Dutch/Polish/German terminology remains
a human editorial item; it is not a code or resolver blocker. Physical
iPhone/Android review is still pending.

Date: 2026-07-23. Uncertain translations and pending extraction, so no crude
literal string is shipped to beta unreviewed. Translations in this stage were
produced from the glossary; the items below need human sign-off.

## Break-even (added 2026-07-27, Stage 3) — need native financial review
- `fields.economics.breakEven.{reasons,actions,formula}` in nl/pl/de — native agricultural-finance register. Confirm "break-even" term choice: nl keeps "Break-even" (common in NL agri-finance); pl "Próg rentowności"; de keeps "Break-even" — verify these read naturally vs. alternatives ("kostendekkend punt", "Gewinnschwelle").
- de/nl/pl `formula.*` use the "÷" glyph with translated cost terms — confirm the phrasing ("erfasste Gesamtkosten ÷ verkaufsfähiger Ertrag" etc.) reads correctly to a farmer.
- pl `actions.ALIGN_UNITS` ("Ujednolić jednostki plonu i przychodu") — confirm imperative aspect.

## Field Health status/reasons/actions/evidence (added 2026-07-27, Stage 2B) — need native review
- `fields.health.status/reasons/actions/evidence` in nl/pl/de — native fluency + agronomy pass. Confirm the weather-risk caution reads as *indicative, not a diagnosis* in each language, and that `insufficient_data` never reads as "healthy".
- pl `RECENT_SEVERE_OBSERVATION` / `MULTIPLE_OPEN_OBSERVATIONS` use a plural genitive with `{count}`; verify grammatical number for 1 vs 2–4 vs 5+ (Polish plural rules) — current wording is deliberately count-agnostic ("{count} … obserwacji") and may need a native plural form.
- de `evidence.overdueScouting` ("{count} überfällige Monitoring-Aufträge") — confirm singular/plural handling for count=1.
- `evidence.weatherRisk` ("Explainable weather-risk signal" / equivalents) — confirm the agronomic term is natural in each language.

## Field Detail slice (added 2026-07-24) — need native review + remaining work
- nl/pl/de `fields.detail.*` (health/growth/scouting/actions) — native fluency + agronomy pass.
- `actionsDisclaimer` (compliance/accounting wording) all locales — legal review.
- REMAINING (not localized): Field Detail economics/completeness/breakdown/break-even/budget/source/history sections (43 page strings) + FieldEconomicsHistory + FinancialVersionTimeline.
- Part 8 lib refactor pending: field-health explanations, break-even/completeness/budget reason strings, COST_CATEGORY_LABEL, FIELD_HEALTH_LABELS, field-action reasons — return stable codes instead of English.

## Fields list + fieldStatus (added 2026-07-24) — need native review
- de "Schläge" (fields) / "Brache" (fallow) — confirm agronomic register.
- pl "Ugór" (fallow) / soil types — confirm with a Polish agronomist.
- `fields.archiveConfirm` (compliance wording) all locales — legal review.
- Remaining Fields surfaces (Field Detail, BRP, economics) not yet extracted (88 strings).
- Onboarding 6 Server Actions still return English strings (shared-action refactor pending).

## Onboarding + soil/crop enums (added 2026-07-24) — need native review
- pl soil types (Ilasta/Piaszczysta/Gliniasta/Torfowa/Pylasta) — confirm with a Polish agronomist.
- de "Moor" (peat) vs. "Torf" — confirm regional preference.
- nl/pl/de coordsHint, welcome.desc, employee.desc (longer procedural copy) — native fluency pass.
- "z. B." / "bijv." / "np." placeholder prefixes — confirm house style.
- Deferred: wiring the 6 onboarding Server Actions (createFarm/createSeason/createField/addFieldToSeason/addOnboardingInventoryItem/addOnboardingEmployee) to RETURN the new stable error codes instead of English strings.

## Scouting (added 2026-07-23) — need native review
- nl "Gewasinspectie" (scouting page) vs. earlier nav "Scouten" — align the house term.
- de "Feldmonitoring" / "Bestandesgesundheit" — confirm agronomic register.
- pl "Lustracja pól" / "priorytet zdrowia upraw" — confirm field usage.
- `form.privacyNotice` (Ctgb legal wording) in all locales — needs legal/compliance review.
- Deferred (still English): scouting GPS/condition dynamic messages, offline feedback strings, photo/annotation/sync components.

## Work Orders + operation enums (added 2026-07-23) — need native review
- nl: "Zaaibedbereiding" (soil_preparation) vs. "Grondbewerking" (tillage) — confirm the pair reads clearly to Dutch farmers.
- pl: "Zlecenia pracy" (page) vs. nav "Zlecenia" — confirm the short/long forms.
- de: "Saatbettbereitung"/"Bodenbearbeitung", "Betriebswarteschlange" (operational queue) — confirm agronomic register.
- All: readiness `explanation` paragraph (long, procedural) needs a native fluency pass.
- Blocker tokens inside "Blocked: {blockers}" are still shown as canonical humanized text — not yet translated (needs a `workOrders.blockers` map once the tokens are enumerated).

## needs native Dutch review
- `navigation.scouting` "Scouten" vs. "Gewasinspectie" (choose one house term).
- `enums.activityType.*` verb vs. noun forms (Spuiten/Bemesten) — confirm register.
- Spuitlicentie (operator certificate) — confirm RVO/Ctgb wording.

## needs Polish native review
- `navigation.scouting` "Lustracja" vs. "Monitoring" — confirm field usage.
- Grouping/decimal rendering ("1 234,5") depends on runtime ICU; confirm on target.
- Operator certificate / gross margin terminology.

## needs German native review
- `navigation.fields` "Schläge" (agronomic) vs. "Felder" (general) — confirm audience.
- "Spritzfenster", "Rohertrag" — confirm agronomic/finance register.

## needs agronomist review
- Spray window, drift reduction, growth-stage phrasing across all locales.
- Scouting/observation/severity labels for field-operator clarity.

## needs legal/compliance review
- Compliance disclaimers, operator certificate, Ctgb/RVO phrasing (all locales).
- Report/PDF disclaimers (not yet localized — Part 13 pending).

## pending extraction (hardcoded → messages)
- Dashboard, Activities/Quick Log, Inventory, Planning, Work Orders, Finance,
  Compliance, Weather, Insights/Briefing, AI review, Offline Center, Onboarding,
  Reports, error boundaries, remaining toasts/empty/loading states, service-worker
  messages. ~700 strings (see audit).

## pending wiring
- Global `LocaleProvider` mount + `<html lang>` from active locale.
- `UserLocalePreference` Prisma model for cross-device persistence.
- Clerk `@clerk/localizations` packs (nlNL/plPL/deDE; enUS fallback) via ClerkProvider.
- PDF/CSV export locale selector + localized headings/disclaimers.
- Full Playwright execution (Flows A–H) against a live server.
# Stage 5 update — Budget Variance (2026-07-31)

Budget Variance resolver wording is closed. Remaining global resolver debt is 473 findings, including Cost Categories, Gross Margin, remaining Economic Signals and other resolver groups. Finance (102), Fields (61) and Dashboard (14) general page debt stays explicitly out of this stage.
# Stage 6 closure

- [x] Replace `COST_CATEGORY_LABEL` with canonical codes and a shared four-locale adapter.
- [x] Separate financial source, attribution, and version-state presentation contracts.
- [ ] Gross Margin resolver prose.
- [ ] Remaining Economic Signals and resolver groups (global count: 460).
# Stage 7 update

Gross Margin status/reason/action labels are complete for `nl-NL`, `en-GB`, `pl-PL` and `de-DE`. Remaining resolver backlog excludes this targeted group and remains 457 findings, led by Economic Signals, Weather Risk, Spray Window and User Error.

# Stage 8 update

Economic Signals codes, actions, evidence and explanations are complete for all four locales and removed from the resolver backlog. One non-blocking review item remains: Dutch `STRONGEST_COMPLETE_MARGIN.explanation` is identical to English (`{field} ({crop}): {amount} per hectare.`). Remaining unrelated resolver debt is 437, led by Weather Risk, Spray Window and User Error.

# Stage 9 update

Weather Risk resolver wording is complete in four locales. Native agronomic review remains requested for the non-diagnostic “may favour crop-health risk” wording. No UI review is possible until a production Weather Risk surface exists. Remaining global resolver debt is 431, including Spray Window and User Error.
# Stage 14 U2 update (2026-08-01)

The new Inventory/Machines error messages have four-locale coverage and placeholder parity. Physical iPhone/Android review of long error text remains open; the next runtime translation batch is Activities / Quick Log core (9), then activity-parse API (2) separately.
