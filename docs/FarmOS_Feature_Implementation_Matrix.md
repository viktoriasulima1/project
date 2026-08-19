# FarmOS Feature Implementation Matrix

## Stage 16 localization note

Natural-language parsing has a safe localized 400/429 contract and clean automated validation. Provider fallback/draft-only semantics are preserved; physical devices remain unverified.

## Stage 15 localization note

Activities / Quick Log core error presentation is implemented and verified in four locales. This does not mark full Activities UI or natural-language API localization complete; activity-parse API remains open (2 findings).

## Stage 13 update (2026-08-01)

Work Order transition, stock, cancellation and exact-one user-error presentation: implemented and automated GO. This changes presentation/containment only; the lifecycle, transaction, reservation and cross-farm rules remain the existing Sprint 23 implementation. Physical-device status is unchanged.

# Stage 12 localization inventory note

| Capability | Implementation | Validation | Status |
|---|---|---|---|
| Structured localization debt inventory | JSON evidence with module, reachability, visibility, family and source for 552 findings | Tooling tests and stable baseline counts | GO |
| Application-wide User Error migration | 146 active + 4 development-only findings remain | Audit 150 | PARTIAL / NO-GO |
| Global resolver localization | 349 active + 53 fixture/dev/internal findings remain | Audit 402 | NO-GO |
| Next migration | Work Order transitions/stock/exact-one errors | 15 findings in one action file; Sprint 23 E2E exists | SELECTED, NOT IMPLEMENTED |

# Stage 11 localization note

| Capability | Implementation | Validation | Status |
|---|---|---|---|
| Canonical User Error contract | Stable code/category/retryability/field/safe metadata/correlation plus four-locale React-free adapter | 984 unit; full 178 collected | GO |
| Onboarding user errors | Farm/inventory/employee code and field-code results; accessible localized rendering | 4 focused E2E | GO |
| Application-wide error migration | 150 active findings remain across actions/APIs/offline/photos/UI | Focused audit non-zero | PARTIAL / NO-GO |
| Global resolver localization | Other groups remain | Resolver audit 402 | NO-GO |

# Stage 10 localization note

| Capability | Implementation | Validation | Status |
|---|---|---|---|
| Spray Window resolver presentation | 32 existing canonical signal codes, structured metadata and shared four-locale adapter across Weather, Activity suitability and Farm Insights | 984 unit; 21 focused browser; full 175 collected | GO |
| Work Order Spray Window readiness | No production caller exists | Not claimed | NOT IMPLEMENTED |
| Global resolver localization | User Error and other groups remain | Resolver audit 415 | NO-GO |

## Financial Completeness localization — 2026-07-28

| Capability | Status | Evidence |
|---|---|---|
| Canonical completeness contract | GO | ordered 8-check status/reason/recorded/action result |
| Field Detail + Finance presentation | GO | one canonical result, four locales, stable selectors |
| Missing price/labour/machinery fixtures | GO | dedicated browser + DB evidence |
| Unallocated/partial completeness reasons | N/A | unsupported by frozen contract; integrity verified without invention |
| Reports/CSV slice | GO | canonical codes retained; missing values blank, provenance unchanged |
| Automated regression | GO | 927 unit; 11/11 focused; 25/25 regression; 152+1/153 full |
| Global resolver localization | NO-GO | 486 unrelated findings remain |
| Physical device localization | PENDING | no physical phone run in this closure |

## Native localization (multilingual sprint — 2026-07-23)

Foundation implemented (dependency-free i18n core; nl-NL default, en-GB fallback,
pl-PL, de-DE). Wired slice: navigation, language switcher, scouting condition +
severity enum labels, scouting validation. Canonical values never translated;
labels via `getEnumLabel`. `i18n:validate` / tsc / vitest (795) / build all green.
Full per-module extraction, DB preference, Clerk packs, report localization and
full E2E remain (see `FarmOS_Multilingual_Report.md`, GO/NO-GO = NO-GO).

| Sprint 27 final-integration capability | Status | Evidence / blocker |
|---|---|---|
| Persisted/versioned photo annotations | Implemented, browser proof pending | Real photo API/UI, effective-version transaction and audit; offline conflict E2E pending |
| Direct selected-photo retry | Implemented, interruption proof pending | IndexedDB item retry reuses localPhotoId and resolves missing dependencies |
| Checkpoint upload recovery | Implemented, forced-stage proof pending | Persistent server checkpoints and exact-one finalized response handling |
| Shared production storage | **Two adapters implemented** (direct `s3_compatible` SigV4 + `object_gateway`); contract provider-aware + unit-tested (16); deployment unverified | External contract vs a real provider, encryption/private policy/lifecycle/restore **NOT RUN** (no credentials) |
| Photo suggestion review | Deterministic flow implemented; derivative incomplete | Consent, persisted actions and consultation WorkOrder; safe resized derivative pending |
| Physical field pilot | NO-GO | iPhone and Android not tested |

Sprint 27 finalization adds private photo saga, mobile capture/previews, IndexedDB Blob graph, scouting export and shared Briefing/Insights evidence. It remains partial until production multi-node storage, complete touch annotation/retry UX, photo-suggestion review and physical phones pass.

## Sprint 27 implementation note (2026-07-18)

Structured visits, multi-observation evidence, versioned crop stages, deterministic Field Health priority and initial Field Detail/Map integration are implemented. Production private photo delivery, offline scouting graph, reports, Briefing/Insights integration and physical phones remain **partial / NO-GO**. Satellite/NDVI was deliberately not added.

**Implementation levels used throughout this document** (per the Sprint 15 brief — a feature is not "implemented" merely because a type, a stub page, a mock card, or a TODO exists):

| Level | Meaning |
|---|---|
| 0 | Absent — no code, no schema, no mention |
| 1 | Mentioned only — appears in a vision/strategy doc, nothing else |
| 2 | Type/schema stub — a Prisma model or TS type exists, no route/action reads or writes it meaningfully |
| 3 | UI mock — a page/card renders, backed by hardcoded or fabricated data |
| 4 | Partial working flow — real data, real server action, but missing validation, ownership checks, or key fields |
| 5 | Production-like end-to-end flow — real CRUD, real validation, ownership-checked, tested by unit tests |
| 6 | Validated by browser E2E — a Playwright test actually drives the flow in a real browser against a real database |
| 7 | Validated by a real farmer — a real pilot session confirmed it works for an actual user |

No FarmOS feature has reached level 7 as of Sprint 15 (`docs/Sprint_14_Real_Farmer_Results.md`: no real farmer session has occurred).

---

> Sprint 24 delta (2026-07-15): field-economics foundation is level 6. Normalized entries, purchase valuation, immutable snapshots, allocation, harvest/revenue, completeness, field/crop margin, and budgets exist. Exports, full labour/machine capture, field-detail/Insights, financial offline queues, dedicated Sprint 24 E2E, and phone validation remain open. Pilot is NO-GO.

> Sprint 25 economics delta: historical labour/machine/fuel snapshots, contractor workflow, allocation persistence, finance offline identifiers/sync, and economics reports moved from missing/schema-only to partial or implemented foundation. Dedicated E2E, complete correction/reallocation UI, field detail, and physical phones remain open; economics pilot is still NO-GO.

> Sprint 25 dashboard/reports delta (2026-07-16): **Dashboard economics signals** now exist — an "Economics decisions" section driven by a single shared resolver (`getFarmEconomicSignals` → `buildEconomicSignals`, also feeding Farm Insights, no duplicate logic): a season economics strip + the top 3 actionable signals with real CTA routes. Signals never rank incomplete fields, never treat missing as €0, and only emit what FinanceData supports (others documented as deferred). **Economics reports** gained an `unallocated_records` CSV and export provenance (SHA-256 content checksum + record count + app version, `x-export-checksum` header, sanitised filenames); the 7-CSV/6-PDF farm-scoped engine with formula-injection protection + disclaimer was already present. 28 new unit tests; dashboard/report + remaining field-detail Playwright flows **written but not executed**. Full report filter matrix and physical phones remain open; economics pilot is still NO-GO.

> Sprint 25 field-detail delta (2026-07-16): **Field Detail economics is now implemented** — a `/fields/[id]` page (field names on `/fields` link to it) with summary metrics, cost-category breakdown (share of *recorded* cost), direct-vs-allocated split (farm unallocated never folded into field margin), completeness + actions, break-even with exact blocking reasons, budget-vs-actual, source-record drill-down, a unified economic timeline, a reusable version-history component (corrections/reversals/reallocations, current-effective marked), and purchase reversal-only disclosure. Backed by a farm-scoped query layer (`field-economics-detail.ts`) + pure logic (`field-economics.ts`), 31 new unit tests, cross-farm rejection. Field-detail Playwright flows are **written but not executed**. Dashboard economics signals, economics-report completion, dedicated E2E (two clean runs), and physical phones remain open; economics pilot is still NO-GO.

## Part 3 — Master feature taxonomy (50 domains + additions found during this audit)

1. Dashboard · 2. Fields · 3. Seasons · 4. Crops · 5. Activities · 6. Spray diary · 7. Fertilising · 8. Scouting · 9. Harvest · 10. Inventory · 11. Machinery · 12. Employees · 13. Tasks · 14. Weather · 15. Spray windows · 16. Satellite/NDVI · 17. Soil · 18. Irrigation · 19. Finance · 20. Per-field P&L · 21. Accounting · 22. Compliance · 23. CAP/subsidies · 24. Carbon · 25. Reports · 26. Documents · 27. Mobile · 28. Offline · 29. GPS · 30. Voice · 31. AI · 32. Predictions · 33. Integrations · 34. APIs · 35. Advisor/agronomist collaboration · 36. Multi-farm · 37. Permissions · 38. Onboarding · 39. Notifications · 40. Data portability · 41. Security · 42. Audit trail · 43. Farm benchmarking · 44. Marketplace · 45. Livestock · 46. Horticulture · 47. Traceability · 48. Certification · 49. Seed batches · 50. Food-chain workflows

**Domains found during this audit not in the original 50, added here:**
- **51. Product registry validation** (CTB/pesticide-registry dose/legality checking) — distinct from Compliance (23) because it's a *pre-save block*, not a *record-keeping* function.
- **52. Government data import** (BRP/RVO field-registry auto-import) — distinct from Onboarding (38) because it's a specific data-source integration, not the general flow.
- **53. Bank/financial-transaction sync** (PSD2 or equivalent) — distinct from Accounting (21) because it's a data-ingestion mechanism, not the ledger itself.

---

## Part 5 — Implementation evidence, by domain (FarmOS only)

| # | Domain | Level | Evidence |
|---|---|---|---|
| 1 | Dashboard | 5 | `src/app/(farm)/dashboard/page.tsx`, `src/lib/dashboard-experience.ts`, `src/lib/dashboard-data.ts`, `src/lib/first-run-dashboard-data.ts`. Unit-tested (`dashboard-experience.test.ts`, `dashboard-data.test.ts`). E2E-covered via golden-path and mobile specs. |
| 2 | Fields | 5 | `src/app/(farm)/fields/page.tsx`, `src/lib/actions/fields.ts`, `Field` model. Unit-tested (`fields.test.ts`). E2E-covered (golden-path, founder-walkthrough, isolation). |
| 3 | Seasons | 5 | `src/lib/actions/seasons.ts`, `Season` model, one-active-season-per-farm enforced in a transaction. Unit-tested (`seasons.test.ts`). E2E-covered. |
| 4 | Crops | 5 | `FieldSeason.crop` (`CropName` enum: wheat/potato/onion/sugar_beet/barley/oilseed_rape/cover_crop/grass/other), assignable via onboarding or the Sprint 13 `UnassignedFieldsBanner`. E2E-covered (founder-walkthrough explicitly tests a 2nd/3rd field's crop assignment). |
| 5 | Activities | 6 | `src/lib/actions/activities.ts`, `ActivityDialog.tsx`, type-conditional `superRefine` validation. E2E-covered across golden-path, failure-paths, mobile, founder-walkthrough. |
| 6 | Spray diary | 6 | `ComplianceRecord` auto-created on spray-type `createActivity`; Compliance page lists real records (fixed Sprint 13). E2E-confirmed (founder-walkthrough task 14/16). |
| 7 | Fertilising | 6 | Same `createActivity` path, `fertilise` type, category-restricted product dropdown. E2E-covered. |
| 8 | Scouting | 6 | Same path, `scout` type, fields folded into `notes` (no dedicated schema columns — documented, deliberate). E2E-covered including mobile. |
| 9 | Harvest | 4 | `harvest` `ActivityType` exists and can be logged; no dedicated harvest-specific fields (yield, moisture, quality) beyond the generic Activity shape. Not distinguished from any other activity type in the UI beyond its label. |
| 10 | Inventory | 5 | `InventoryItem`/`StockMovement` models, category-specific onboarding form, stock deduction on activity save. Unit- and E2E-tested. Page itself (`/inventory`) is still a stub beyond the empty state — no list/detail view of individual products exists. |
| 11 | Machinery | 4 | `Machine` model, inline "add a sprayer" in the activity dialog (Sprint 12 fix). **No dedicated `/machines` route or management UI exists at all** — a machine can only ever be created from inside the spray-activity dialog. |
| 12 | Employees | 3 | Created during onboarding (name, role, spuitlicentie boolean checkbox). No expiry date field, no list/management page, no linkage to activity validation. This is closer to a UI mock than a working employee-management feature. |
| 13 | Tasks | 2 | `Task` model and all its enums (`TaskType`, `TaskPriority`, `TaskStatus`) exist in `prisma/schema.prisma`. **Zero routes, zero server actions, zero UI** read or write it. Pure schema stub. |
| 14 | Weather | 5 | `src/lib/weather.ts` — real Open-Meteo integration, cached, 7-day hourly+daily. Used in dashboard and activity dialog. No KNMI, no soil temperature. |
| 15 | Spray windows | 4 | `src/lib/spray-window.ts` — a genuinely sophisticated engine: real 0–100 score, 5-tier status (`blocked`/`poor`/`marginal`/`good`/`excellent`), hard-blocker vs. warning separation, fail-closed `'planned-application'` mode, typed operator/inventory/machine/crop context, explicit `SPRAY_SUITABILITY_DISCLAIMER`. Matches `FarmOS_Strategy_Lock.md`'s scorer concept closely on paper. **Capped at level 4** because it is only ever invoked from the standalone `/weather` page, in default advisory mode, always with `MOCK_DEFAULT_PRODUCT_PROFILE` — never from the activity-logging flow, never with real operator/inventory/machine context. See `FarmOS_False_Completeness_Audit.md` #8. |
| 16 | Satellite/NDVI | 0 | Absent. `Field.ndviScore` exists as a plain `Int?` column with no data source ever writing to it beyond seed/mock data. |
| 17 | Soil | 2 | `SoilAnalysis` model exists. No route, no UI, no action. |
| 18 | Irrigation | 2 | `irrigate` exists as an `ActivityType` value (loggable as a generic activity via the "Other" tile's sub-select) and as a `TaskType` value. No irrigation-specific fields, scheduling, or ET-based recommendation logic. |
| 19 | Finance | 3 | `FinancialSnapshot`/`CropFinancial` models exist. `/finance` page (`src/app/(farm)/finance/page.tsx`) **has no query at all** — hardcoded stub text regardless of real data. This is a live false-completeness bug, structurally identical to the Compliance-page bug fixed in Sprint 13, **not yet fixed**. |
| 20 | Per-field P&L | 1 | Mentioned extensively in `FarmOS_Master_Architecture.md` and `FarmOS_Strategy_Lock.md` as a core differentiator. No implementation of any kind. |
| 21 | Accounting | 0 | Absent. No ledger, no invoice handling, no accountant export. |
| 22 | Compliance | 6 | See Spray diary (6) above — same evidence. |
| 23 | CAP/subsidies | 1 | `ComplianceModule.cap` enum value exists. No CAP-specific workflow, eco-scheme tracking, or RVO export exists anywhere. |
| 24 | Carbon | 0 | Absent, and explicitly deferred by `FarmOS_Strategy_Lock.md` pending EU regulatory clarity — a correct decision, not a gap. |
| 25 | Reports | 0 | Absent. No report generation, export, or PDF/CSV output anywhere in the product. |
| 26 | Documents | 0 | Absent. No document storage/attachment feature. |
| 27 | Mobile | 6 | Responsive sidebar (Sprint 12 fix), Quick Log FAB, 44px touch targets, `inputmode="decimal"`. E2E-validated on iPhone 12 and iPhone 14 Pro Max viewports (`e2e/mobile/critical-flow.spec.ts`). |
| 28 | Offline | 0 | Absent. No service worker, no local-first storage, no sync queue. Directly contradicts `FarmOS_Strategy_Lock.md`'s "we are offline-first" claim. |
| 29 | GPS | 0 | Absent. No geolocation API usage anywhere in `src/`. |
| 30 | Voice | 0 | Absent. No audio input, no transcription, no LLM field-extraction. |
| 31 | AI | 3 | `src/modules/ai/generateDailyBriefing.ts` — deterministic rule-based generator, own code comment: `// Replace or augment with real Claude API calls in Sprint 2` (never done across 15 sprints). No LLM call anywhere in the codebase. This is the most consequential mismatch between stated identity ("AI-first... AI is the primary interface," `Product_Principles.md`) and reality. |
| 31a | Grounded AI assistance (Sprint 26) | Partial | Vendor-neutral structured provider, unavailable fallback, grounded contracts/context, deterministic priority guard and reviewed natural-language Activity candidates exist. Production history/feedback/cost accounting and full E2E remain pending; not a chatbot. |
| 31b | Sprint 26 finalization | Automated GO / physical pending | Persisted briefing/history/feedback, deterministic WorkOrder matcher + explicit link/version checks, bounded independent split drafts, voice memory-only contract and adversarial security are implemented. 691 unit tests and two 101-test full E2E runs pass; external provider contract and real iPhone/Android remain NO-GO. |
| 32 | Predictions | 0 | Absent. No yield model, no disease-pressure model, no forecasting beyond raw weather passthrough. |
| 33 | Integrations | 0 | Absent. No BRP, CTB, Meststoffen, KNMI, PSD2, or Kringloopwijzer integration exists. |
| 34 | APIs | 0 | Absent. FarmOS exposes no public API for third parties (only its own internal Next.js server actions). |
| 35 | Advisor/agronomist collaboration | 0 | Absent. No read-only account type, no sharing mechanism. Documented as a domain in `FarmOS_Master_Architecture.md`; zero implementation. |
| 36 | Multi-farm | 2 | `Farm.clerkUserId` is `@unique` — the schema structurally supports exactly one farm per Clerk user, not multiple. A user managing several farms is not a supported scenario at all, let alone a UI for switching between them. |
| 37 | Permissions | 3 | Single implicit role (farm owner). No employee login, no permission levels, no read-only/advisor roles. `Employee` records are farm metadata, not authenticated users. |
| 38 | Onboarding | 6 | `OnboardingWizard.tsx`, full step-by-step flow, E2E-tested extensively (golden-path, failure-paths, founder-walkthrough). The most thoroughly tested domain in the product. |
| 39 | Notifications | 0 | Absent. No push, email, or SMS notification system. |
| 40 | Data portability | 0 | Absent as a feature. `PILOT_ENVIRONMENT_RUNBOOK.md` documents a manual, ad-hoc export process for the pilot; no in-product export button exists. |
| 41 | Security | 5 | Clerk auth, farm-scoped ownership checks on every server action (fieldSeasonId/productId/machineId all verified — the machineId check was a real gap found and fixed in Sprint 12), cross-farm isolation E2E-tested. |
| 42 | Audit trail | 2 | Soft-delete (`deletedAt`) preserves history for fields/activities; no dedicated audit-log table, no "who changed what when" record beyond `createdAt`/`updatedAt` timestamps. |
| 43 | Farm benchmarking | 0 | Absent. |
| 44 | Marketplace | 0 | Absent, and explicitly deferred by design (`Product_Principles.md`, `FarmOS_Strategy_Lock.md`). |
| 45 | Livestock | 0 | Absent, and explicitly out of scope by design (`FarmType.livestock`/`FarmType.dairy` exist as enum values only — never used in any workflow). |
| 46 | Horticulture | 0 | Absent (`FarmType.horticulture` is an unused enum value, same as above). |
| 47 | Traceability | 0 | Absent beyond the generic Activity/Compliance record trail — no seed-to-sale or batch-level traceability. |
| 48 | Certification | 0 | Absent beyond the single "spuitlicentie" checkbox (a boolean, not a tracked certificate with an expiry). |
| 49 | Seed batches | 0 | Absent. |
| 50 | Food-chain workflows | 0 | Absent. |
| 51 | Product registry validation (CTB) | 0 | Absent — extensively documented as a differentiator in `FarmOS_Strategy_Lock.md`, never implemented. A dose can be entered and saved with no legality check whatsoever. |
| 52 | Government data import (BRP) | 0 | Absent — the single most-repeated claim in FarmOS's own strategy documents ("60 seconds vs. 4-6 hours"), never implemented. Fields are entered by hand, one at a time, exactly like the competitor it criticizes. |
| 53 | Bank/financial sync (PSD2) | 0 | Absent. |

---

## Part 4 — Competitor-by-competitor matrix (only domains with real signal — see Part 2 of the Coverage Audit for research-depth caveats)

| Competitor | Domain | Competitor strength | Competitor weakness | Relevant to FarmOS? | Documented in FarmOS docs? | Implemented in FarmOS? | Quality | Missing? | Priority | Decision | Evidence source |
|---|---|---|---|---|---|---|---|---|---|---|---|
| xFarm | Government data import | — | No BRP import (per FarmOS's own research) | Yes | Yes, extensively | No | — | Yes | High | Research deeper, then build | `docs/xfarm/`, `Strategy_Lock.md` |
| xFarm | Voice logging | — | Absent industry-wide per FarmOS's research | Yes | Yes | No | — | Yes | Medium | Build later | `Strategy_Lock.md` |
| xFarm | Offline mode | Has one, reportedly loses data | — | Yes | Yes | No | — | Yes | Medium | Research deeper before building | `Strategy_Lock.md` §3 item 5 |
| AGRIVI | Farm/season/field/activity structure | Clear, adopted-by-FarmOS structure | Complex UI, many clicks | Yes | Yes | **Yes** | Level 5-6 | No | — | Already better in FarmOS (activity flow specifically) | `AGRIVI_Sprint_Analysis.md`; `ActivityDialog.tsx` |
| AGRIVI | Cost/ha finance metric | Real, working cost/ha view | — | Yes | Yes | No (Finance is a stub) | — | Yes | **High** | Improve (fix the stub first) | `AGRIVI_Sprint_Analysis.md`; `finance/page.tsx` |
| AgroVision | Disease-pressure Meteo module | Real, working, Dutch-specific | Unknown (under-researched) | Yes | No | No | — | Yes | Medium | Research deeper | This sprint's search |
| Dacom | Validated disease-pressure model (320 crop/disease combos, claimed 3-4 fewer sprays/season) | Scientifically validated, real adoption evidence | Now folded into CropX, standalone identity unclear | Yes | No | No (FarmOS spray engine is weather-only) | — | Yes | **High** | Research deeper, then build | This sprint's search |
| CropX | Multi-depth soil sensors | Real hardware + software integration | Requires hardware purchase | No (FarmOS is deliberately software-only) | Partially (Product_Principles.md rules this out) | N/A by design | — | No | — | Reject (correct, existing decision) | This sprint's search; `Product_Principles.md` |
| Conservis | Grain marketing / settlement matching | Real, working financial-operations link | US-focused, may not map to NL grain contracts | Partially | No | No | — | Possibly | Low-medium | Research deeper | This sprint's search |
| Ambrook | Real-time bank-synced P&L by crop/field/enterprise | Real, shipped, modern UX | US-only (Schedule F, US banks) — pattern transfers, specifics don't | Yes (the pattern) | Documented as a vision (PSD2), not sourced from Ambrook specifically | No | — | Yes | **High** | Research deeper (this is the best real precedent found for FarmOS's own stated Finance vision) | This sprint's search |
| Agworld | Agronomist read-only recommendation-to-record handoff | Real, shipped, collaboration-native | Unknown UX depth | Yes | Yes (as a domain, not by name) | No | — | Yes | Medium | Research deeper, then build | This sprint's search; `FarmOS_Master_Architecture.md` domain 35 |
| eAgronom | Carbon MRV + pre-payment | Real, working, funded | Regulatory landscape unsettled | Deliberately deferred | Yes | No | — | No (by design) | — | Reject for now (correct, existing decision) | This sprint's search; `Strategy_Lock.md` §6 item 10 |
| Ekylibre | Open-source, inspectable, EU-compliance-focused | Real code available to study cheaply | Adoption/maintenance activity unverified | Low-medium | No | No | — | No | Low | Research deeper only if a specific EU-compliance workflow question arises | This sprint's search |
| Isagri | Multi-vertical breadth (crop+livestock+wine+payroll) | Large, established, French market leader | Exactly the "feature factory" shape FarmOS avoids | No | Partially (Strategy_Lock's anti-patterns) | N/A by design | — | No | — | Reject (correct, existing decision) | This sprint's search; `Strategy_Lock.md` §2 |

**Why this matrix is not 50×19:** most domain/competitor combinations have no real signal — either the competitor doesn't operate in that domain (AgriWebb × Compliance-for-arable-crops, for instance), or this sprint's single-search research depth didn't surface a specific enough claim to compare honestly. Padding the matrix with empty or speculative rows would be exactly the "fake completeness" this audit is meant to catch in FarmOS's own product — it is not repeated here as a research artifact either.
# 2026-07-31 — Budget Variance localization

Budget Variance is implemented as a shared canonical resolver with localized Field Detail, Finance, Dashboard, Farm Insights and export presentation. Formula/sign/allocation policies are unchanged. Stage status: GO; global resolver localization remains NO-GO.
# Stage 6 addition

| Capability | Implementation | Validation | Status |
|---|---|---|---|
| Localized cost categories | Canonical 11-code order + four-locale adapter | 944 unit; 4 category; 38 regression; full 165 collected | GO |
| Global resolver localization | Gross Margin and other groups remain | Resolver audit 460 | NO-GO |
# Stage 7 localization note

Gross Margin canonical resolver localization is implemented and browser-green across Field Detail and Finance. Formula, persistence, security and financial policy are unchanged. Global resolver localization remains incomplete.

# Stage 8 localization note

| Capability | Implementation | Validation | Status |
|---|---|---|---|
| Economic decision signals | 12 canonical codes/actions with structured cents, percentages and evidence; localized Dashboard, Farm Insights and deterministic Daily Briefing | 950 unit; 6 focused; 46 regression; full 175 collected | GO |
| Global resolver localization | Weather Risk, Spray Window, User Error and other groups remain | Resolver audit 437 | NO-GO |

# Stage 9 localization note

| Capability | Implementation | Validation | Status |
|---|---|---|---|
| Weather Risk domain resolver | Four reason codes, three actions, structured evidence, four locales, non-diagnostic trust flags | 975 unit; 40 regression; targeted audit 0 | GO |
| Weather Risk production UI integration | No production caller/surface currently exists | No UI E2E can honestly apply | NOT IMPLEMENTED / NO-GO |
| Global resolver localization | Spray Window, User Error and other groups remain | Resolver audit 431 | NO-GO |
# Stage 14 U2 localization status (2026-08-01)

Inventory/Machine create and official-product search errors: implemented and verified with the shared four-locale contract. Stock/reservation and machine scheduling capabilities were unchanged; no absent feature is implied by this localization status.
