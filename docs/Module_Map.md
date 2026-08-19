# FarmOS Module Map — MVP Scope

## Stage 16 contract note (2026-08-03)

`/api/ai/activity-parse` owns validation/rate limiting and returns shared errors; `ActivityDialog` localizes them. Parser, provider, transcription and persistence were not redesigned.

## Stage 13 Work Order user-error boundary (2026-08-01)

`src/lib/actions/field-operations.ts` owns canonical Work Order action failures; `OperationForms.tsx` and `OperationActions.tsx` are the direct localized presentation consumers. Shared definitions remain in `src/lib/user-error.ts`, `src/i18n/error-codes.ts`, and the four `messages/*/errors.json` catalogs. No second Work Order error system was introduced.

# Stage 10 Spray Window components

# Stage 11 User Error components

# Stage 12 localization inventory components

- Tooling: `scripts/i18n-audit.ts` plus `scripts/i18n-audit-json.ts`.
- Evidence: `docs/evidence/localization-resolver-findings.json` and `localization-user-error-findings.json`.
- Planning: `Remaining_Resolver_Debt_Inventory.md` and `Remaining_Localization_Batch_Roadmap.md`.
- Runtime boundary: no application component, action, route, resolver, persistence or provider behaviour changed.

- Domain: `src/lib/user-error.ts` canonical contract and safe classifier.
- Presentation: `src/i18n/adapters/user-error.ts` and four `errors` catalogs.
- Migrated consumer: Onboarding farm, optional inventory and employee actions/UI.
- Audit: `npm run i18n:audit -- user-errors` scans actions, API routes, offline paths and client rendering.
- Boundary: 150 active legacy findings remain; Activities, Finance, Work Orders, offline/sync, photos/providers and error boundaries are not claimed complete.

- Domain: `src/lib/spray-window.ts` (canonical status, summary, confidence, disclaimer and 32 structured signal codes).
- Presentation: `src/i18n/adapters/spray-window.ts` plus `sprayWindow` keys in all four `fields` catalogs.
- Consumers: Weather page, Activity suitability dialog/action and Spray Window Farm Insights on the AI page.
- Tests: resolver/action characterization, exhaustive four-locale adapter coverage and the existing real Activity browser flow.
- Boundary: the Dashboard simplified weather status is separate; Work Orders do not call this resolver; no new provider, cache, persistence or workflow was added.

> Financial Completeness localization closure (2026-07-28): `/fields/[id]`
> and `/finance` render the same canonical eight-check completeness result
> through one exhaustive nl/en/pl/de adapter. Deterministic missing-price,
> labour-rate, machinery-rate, combined-rate and missing-harvest E2E fixtures
> pass; allocation integrity is verified without adding unsupported reason
> codes. Final unrestricted E2E is 152 passed + 1 documented skip from 153
> collected. This module slice is GO; global resolver localization (486 debt)
> and physical-device review remain separate NO-GO/pending gates.

> Sprint 24 status (2026-07-15): Finance foundation implemented with normalized field-season entries, weighted-average valuation, immutable activity snapshots, explicit allocations, harvest/revenue, completeness, and budgets. Exports, full rate capture, field-detail economics, financial offline queues, and phone validation remain NO-GO. See `Sprint_24_Field_Economics_Report.md`.

> Sprint 25 economics update: effective-dated labour/machine rates, activity cost snapshots, separate fuel policy, contractor rates, versioned allocation records, exact-one financial draft identifiers, economics CSV/PDF exports, and a Reports route are implemented. Full corrections UI, field-detail economics, dedicated E2E, and physical mobile validation remain NO-GO; see `Sprint_25_Complete_Farm_Economics_Report.md`.

> Sprint 25 dashboard/reports + field-detail update (2026-07-16): **Field Detail economics** (`/fields/[id]`) and **Dashboard economics signals** (an "Economics decisions" section) are implemented. Both draw from shared farm-scoped resolvers — `getFieldEconomicsDetail`/`getFinancialRecordVersionHistory`/`getAllocationHistory`/`getFieldEconomicTimeline` (field detail) and `getFarmEconomicSignals`→`buildEconomicSignals` (signals, also feeding Farm Insights). Economics reports gained an `unallocated_records` CSV and export checksum provenance. Signals never rank incomplete fields and never treat missing as €0. Dedicated Sprint 23–25 E2E are written but **not executed**, and physical mobile validation is pending — economics pilot remains NO-GO. See `Sprint_25_Dashboard_Reports_Audit.md` and `Sprint_25_Field_Detail_Economics_Audit.md`.

## Module Overview

Sprint 27 adds a partial Field Scouting and Crop Health module at `/scouting`, `/fields/[id]` and `/fields/map`: ScoutingVisit, ScoutingObservation, private ScoutingPhoto metadata, versioned CropStageRecord, observation-linked WorkOrder and review-only PhotoSuggestion. Shared health/weather rules never claim diagnosis; Ctgb remains authoritative. Private photo delivery, offline graph, reports/integrations and physical phones remain pilot gates.

| # | Module | Route | Sprint 1 | Sprint 2 | Sprint 3 |
|---|---|---|---|---|---|
| 1 | **Dashboard** | `/dashboard` | ✅ Full 7-card layout | — | — |
| 2 | **Fields** | `/fields` | Stub | Field CRUD, NDVI view | Soil maps, GPS boundaries |
| 3 | **Activities** | `/activities` | Stub | Spray/fert/harvest log | Batch entry, offline mode |
| 4 | **Inventory** | `/inventory` | Stub | Stock CRUD, stock alerts | Supplier integration, EDI |
| 5 | **Finance** | `/finance` | Stub | Season P&L, crop margins | Subsidy tracking, invoicing |
| 6 | **Weather** | `/weather` | Stub | 10-day forecast API | GDD, frost, wind alerts |
| 7 | **Compliance** | `/compliance` | Stub | Spray diary export, CAP | Certifications, audit log |
| 8 | **Farm Insights / grounded assistance** | `/ai`, Dashboard, Activity dialog | Partial | Deterministic insights; optional grounded language and reviewed Activity draft | Persisted briefing history, feedback, full evaluation/E2E |

## Module Detail

### 1. Dashboard
**Purpose:** Morning briefing — highest-priority actions for the day.

**Cards (Sprint 1):**
- AI Daily Briefing (featured, full width) — deterministic rule engine
- Weather + Spray Window — 5-day forecast strip
- Today's Tasks — sorted by priority, overdue flagged
- Fields Overview — NDVI status + attention count
- Inventory Alerts — low stock + expiring products
- Finance Snapshot — YTD costs, margin/ha, budget
- Compliance — missing/expiring items

**Data flow:** `DashboardData` → `generateDailyBriefing()` → cards

---

### 2. Fields
**Purpose:** The farm's geographic and agronomic backbone.

**Core entities:** Field, Season, Crop

**Key features (Sprint 2):**
- Field list with sort/filter by crop, status, hectares
- NDVI score history chart (7-day trend)
- Field detail: crop rotation history, activity log
- Status management: healthy / attention / critical / fallow

**Compliance link:** Each field's activities feed into the spray diary.

---

### 3. Activities
**Purpose:** EU-compliant farm operations log (Gewasregistratie).

**Tracked activity types:** spray, fertilize, harvest, tillage, sow, irrigate, scout, soil_sample, other

**EU compliance requirements logged:**
- Product name + registration number (toelatingsnummer)
- Active ingredient + dose (L/ha or kg/ha)
- Area treated (ha)
- Date, operator, weather at time of application
- Buffer zone confirmation

**Spray diary:** Must be submitted monthly to RVO via this module.

---

### 4. Inventory
**Purpose:** Track inputs (crop protection, fertilizer, seed, fuel).

**Key features:**
- Stock levels with minimum threshold alerts
- EU product registration number (toelatingsnummer) per product
- Expiry date tracking
- Usage linked to Activities (auto-deduct on spray log)
- Supplier and purchase price history

---

### 5. Finance
**Purpose:** Season-level P&L with crop-level margin breakdown.

**Tracked metrics:**
- Revenue per crop (sale price × yield × ha)
- Direct costs: seed, crop protection, fertilizer per crop
- Indirect costs: machinery, labour, land rent allocated by ha
- Cost/ha and margin/ha per crop
- CAP subsidy tracking (area payment + eco-scheme bonuses)
- Budget vs actual variance

---

### 6. Weather
**Purpose:** Operational weather layer with spray-window intelligence.

**Data sources (Sprint 2):** Open-Meteo API (free, EU-hosted, GDPR-safe)

**Key features:**
- 10-day forecast with hourly data
- Spray window calculator: wind < 15 km/h, no rain < 4h, temp 5–25°C, humidity < 80%
- Growing Degree Day (GDD) accumulation per crop
- Frost alert for sensitive crops
- Historical comparison (wet/dry vs. normal)

---

### 7. Compliance
**Purpose:** Keep the farmer out of trouble with RVO, EU, and certification bodies.

**Modules:**
- **Spray Diary (RVO):** Monthly PDF/XML export in Dutch regulatory format
- **CAP Eco-scheme:** Activity tracker for qualifying interventions (B-scheme = €45/ha bonus for NL)
- **Certifications:** GlobalG.A.P., Milieukeur expiry + renewal calendar
- **Nitrates Directive:** N-application limit tracking per field
- **Audit Log:** Immutable activity record (Databankenwet compliance)

---

### 8. AI Cockpit
**Purpose:** Natural-language interface over all farm data.

**Sprint 2 queries (examples):**
- "What is my cheapest-margin crop this season?"
- "When was the last time I sprayed Amistar on Field 4?"
- "What tasks are overdue and who is assigned?"
- "Is my CAP eco-scheme B on track for full payment?"

**Architecture:** Claude API with farm data as context (function calling + retrieval)

**Sprint 3:** Predictive recommendations (spray timing, optimal harvest window)

---

## Internationalization (`src/i18n/`)

Native, dependency-free localization (nl-NL default, en-GB fallback, pl-PL,
de-DE). Message catalogs in `messages/<locale>/<namespace>.json`. Core:
`locales`, `resolve`, `catalog`, `translator`, `format`, `enum-labels`,
`error-codes`, `server`, `actions`, `LocaleProvider`, `clerk-locale`,
`export-locale`, `ai-locale`, `validate-core`. Locale = user preference → cookie
→ Accept-Language → nl-NL. Canonical enum values are never translated; labels are
localized via `getEnumLabel`. `npm run i18n:validate` gates message consistency.
See `FarmOS_Localization_Architecture.md`.
# Budget Variance canonical flow (2026-07-31)

`getFinanceData` → `resolveBudgetVariance` → shared `FieldEconomicsRow.costVariance` → Field Detail / Finance / `buildEconomicSignals` → Dashboard and Farm Insights. `buildBudgetVarianceDisplayModel` owns translation and formatting. CSV keeps canonical codes/numbers; Budget PDF uses the active locale.
# Stage 6 module note

- `src/lib/field-economics.ts`: canonical category classification and order; no display labels.
- `src/lib/field-economics-detail.ts`: canonical source/category/attribution/version codes.
- `src/i18n/adapters/financial-categories.ts`: shared presentation adapter.
- `messages/*/enums.json`: four-locale labels.
- `e2e/i18n-cost-categories.spec.ts`: locale, totals/order, contract and mobile validation.
# Stage 7 Gross Margin components

- Domain: `src/lib/economics.ts` (`resolveGrossMargin`, canonical result).
- Data assembly: `src/lib/finance-data.ts`.
- Presentation: `src/i18n/adapters/gross-margin.ts` and four `fields` catalogs.
- Consumers: Field Detail and Finance; existing Dashboard/Insights ranking and export calculations remain unchanged.

# Stage 8 Economic Signals components

- Domain: `src/lib/farm-economic-signals.ts` (12 canonical signal codes, stable actions, evidence, priority and top-three selection).
- Compatibility: `src/lib/economics-insights.ts` and canonical economics payloads in `src/lib/farm-insights.ts` / Daily Briefing facts.
- Presentation: `src/i18n/adapters/economic-signals.ts` and `economics.signals` in all four `fields` catalogs.
- Consumers: Dashboard `EconomicsDecisionsCard`, economics-related Farm Insights and deterministic Daily Briefing; legacy persisted prose stays readable.
- Validation: `e2e/i18n-economic-signals.spec.ts`, canonical unit tests and the full serial browser suite.

# Stage 9 Weather Risk components

- Domain: `src/lib/scouting/weather-risk.ts` (`scouting-weather-v1`, canonical status/reason/action/metadata/evidence and explicit non-diagnostic flags).
- Presentation: `src/i18n/adapters/weather-risk.ts` plus `weatherRisk` keys in all four `fields` catalogs.
- Tests: threshold characterization and exhaustive four-locale adapter coverage.
- Current boundary: no production caller in Field Detail, Map, Scouting, Dashboard, Insights, Briefing, Work Orders, Weather or exports; no UI feature or provider integration was invented.
# Stage 14 U2 contract note (2026-08-01)

`actions/inventory.ts` and `actions/machines.ts` emit `UserFacingError`; `AddInventoryItemDialog` and the existing inline machine consumer render through the shared i18n adapter. Activities/Quick Log action migration remains the next separate batch.

# Stage 15 contract note (2026-08-02)

`activities.ts` and `quick-log.ts` emit structured safe errors; ActivityDialog, ActivitiesClient and QuickLogButton own locale rendering. `/api/offline/sync` safely adapts the result for the established wire contract. `/api/ai/activity-parse` remains the next separate two-finding boundary.
