# FarmOS Localization Audit

## Stage 18 verified delta — 2026-08-08

Offline Sync Center targeted user errors moved 10 → 0. Global user-error findings moved 120 → 110; resolver findings remain 367. Four-locale validation passes. This is a bounded GO only; application-wide localization remains PARTIAL / NO-GO.

## Stage 16 evidence

Activity Parse API reached target zero with existing four-locale codes. Global audits remain 120 user-error / 367 resolver, so application-wide localization is NO-GO.

## Stage 15 evidence

Activities / Quick Log core reached targeted zero with four-locale structured errors. Global audits remain non-zero at 122 user-error / 367 resolver findings; application-wide localization remains NO-GO.

## Stage 13 addendum (2026-08-01)

Work Order action errors now resolve through four-locale catalogs and accessible alerts. Targeted audit 15 → 0; global user errors 150 → 135; resolvers 402 → 379. Full application localization remains NO-GO while measured debt remains.

# Stage 12 update — Remaining debt inventory

All 402 resolver and 150 user-error findings now have structured reachability/module/family evidence. Resolver debt contains 349 active targets and 53 fixture/development/internal findings; user-error debt contains 146 active and four development-only findings. Counts are unchanged and global localization remains NO-GO.

# Stage 11 update — User Error contracts

The shared canonical error contract and Onboarding presentation are localized in four locales. Global resolver debt moved 415 → 402, but the focused active user-error audit moved only 158 → 150. Application-wide migration and global localization remain NO-GO.

# Stage 10 update — Spray Window

Spray Window blockers, warnings, positive factors, summary, confidence and disclaimer now use canonical codes and structured metadata with one four-locale adapter. Targeted audit: 16 → 0; global resolver audit: 431 → 415. Existing general page copy and unrelated resolvers remain outside scope; global localization remains NO-GO.

## Financial Completeness full-stage closure — 2026-07-28

Scoped completeness UI/resolver audit is zero in Field Detail, Finance and the
shared adapter. Module totals remain fields 66 and finance 102; global resolver
debt is 486. These unrelated findings are not hidden. Automated gates: 927 unit
tests, 11/11 completeness E2E, 25/25 regression, and final unrestricted E2E
152 pass + 1 documented conditional skip / 153 collected.

## Field Detail top sections — 2026-07-24 (NOT complete)

`i18n:audit -- fields`: **88 → 73**. Field Detail header/crop-health/growth-stage/
scouting sections + `FieldActionsBar` localized via `fields.detail`. Remaining in
Field Detail: economics/completeness/breakdown/break-even/budget/source/history
(43 page strings) + `FieldEconomicsHistory`/`FinancialVersionTimeline`, and the
domain-resolver prose (needs pure-lib code-refactor). Field Detail = NO-GO.

## Fields list localized — 2026-07-24 (module NOT complete)

`i18n:audit -- fields`: **109 → 88**. The `/fields` list surface (list page +
`FieldsListClient` + `NewFieldDialog`) is localized via the new `fields`
namespace + `enums.fieldStatus`. Remaining 88: Field Detail `fields/[id]` (56),
BRP import, economics-history, and dashboard field cards. Onboarding action
error-code wiring still deferred (shared actions). Fields = NO-GO.

## Onboarding complete — 2026-07-24

`i18n:audit -- onboarding`: **86 → 0**. The whole Onboarding wizard (all 9 steps
+ progress/review/complete) is localized via the new `onboarding` namespace, with
soil/crop/category/unit selects bound to canonical tokens (new `enums.soilType`/
`crop`/`inventoryCategory`/`unit`). Remaining hardcoded modules: dashboard 14,
fields 109, scouting 32 (see report). Full-app localization remains NO-GO.

## Phase 4A update — 2026-07-23

New `npm run i18n:audit [-- <module>]` measures unexplained farmer-facing strings.
**Baselines:** scouting 50→**32** (Scouting page + form labels now localized via
the new `scouting` namespace), dashboard **14**, fields **109**, onboarding **86**.
Scouting dynamic messages (GPS/condition libs, feedback), the photo/annotation/sync
sub-components, and the Dashboard/Onboarding/Fields modules remain hardcoded —
Phase 4A is **NOT complete** (see `FarmOS_Multilingual_Report.md`).

## Phase 3 update — 2026-07-23

**Now fully localized (visible translation):** app shell — Sidebar nav labels +
toggle aria, Quick Log (desktop + mobile) — and the entire `/work-orders` route
(page, create form, readiness, queue, lifecycle actions) via the new
`workOrders` namespace + `enums.operationType`/`workOrderStatus`. New
`npm run i18n:audit-options` gate passes (fixed 4 value-less options in
`EconomicsForms.tsx`). **Still hardcoded:** the other ~20 routes (dashboard,
onboarding, fields, scouting chrome, activities, inventory, planning, finance,
compliance, weather, insights, offline, reports). The per-module table below
still reflects the pre-extraction state for those.

## Phase 2 update — 2026-07-23

Infrastructure now global: one `LocaleProvider` wraps the whole app, `<html lang>`
+ `dir` follow the active locale, `getActiveLocale()` composes DB preference →
cookie → Accept-Language → nl-NL, and `setUserLocale` persists DB+cookie. Clerk is
localized via `@clerk/localizations` (nlNL/enGB/plPL/deDE). Error codes extended to
19 stable codes across 4 locales. **Still hardcoded (English):** Onboarding,
Dashboard/Today, Fields/Detail/Map body copy, Activities/Quick Log, Offline Center
chrome, Topbar — the bulk of the ~700-string backlog is unchanged. The per-module
table below still reflects the pre-extraction state for those modules.

---

## Break-even browser closure — 2026-07-27

Focused Break-even Playwright is **6/6 PASS**. Stable codes may remain in RSC
payloads/catalogs but not visible or accessible UI. Remaining English debt:
Total recorded cost, Cost/hectare, Data completeness, Cost breakdown, Direct vs
allocated, Budget vs actual, Source records, Economic history, Purchase history.
Global resolver debt remains **505**.

Date: 2026-07-23. Inventory of user-visible text ahead of native multilingual
support (nl-NL default, en-GB fallback, pl-PL, de-DE). Counts are representative
(based on module inspection), not a line-by-line census; the remaining
extraction is tracked in `FarmOS_Translation_Review_Backlog.md`.

## Classification legend

- **L** localized (routed through the i18n message system in this stage)
- **H** hardcoded user-visible string (still English literal — extraction pending)
- **C** canonical domain value (never translated; stored/validated as-is)
- **DB** database enum (never depends on rendered text)
- **ID** audit/event/report identifier (never translated)
- **X** external provider text (Clerk, OpenStreetMap, weather API)
- **R** report-only text (PDF/CSV — localized via export locale, pending)
- **M** missing translation
- **U** intentionally untranslated (Ctgb, BRP, BBCH, product reg. numbers)

## Per-module status (this stage)

| Module | Approx. user-visible strings | Localized now | Hardcoded (pending) | Notes |
| --- | ---: | ---: | ---: | --- |
| Root layout / `<html lang>` | 4 | partial | some | lang wiring pending global provider |
| Top bar | ~8 | 0 | ~8 (H) | pending |
| Sidebar / mobile nav | 16 | **16 (L)** | 0 | navigation.json wired |
| Language switcher | 6 | **6 (L)** | 0 | common.language.* |
| Dashboard / Today | ~40 | 0 | ~40 (H) | pending |
| Fields / Field detail | ~35 | 0 | ~35 (H) | pending |
| Field map | ~14 | partial | most (H) | GPS accuracy strings still literal |
| Scouting | ~30 | **enum labels (L)** | ~24 (H) | condition/severity localized; form chrome pending |
| Activities / Quick Log | ~70 | 0 | ~70 (H) | largest surface; pending |
| Inventory | ~30 | 0 | ~30 (H) | pending |
| Planning | ~20 | 0 | ~20 (H) | pending |
| Work Orders | ~25 | 0 | ~25 (H) | pending |
| Finance | ~40 | 0 | ~40 (H) | number/currency formatters ready |
| Compliance | ~35 | 0 | ~35 (H) | disclaimers need legal review |
| Weather | ~20 | 0 | ~20 (H) | provider text is X |
| Farm Insights / Daily Briefing | ~30 | 0 | ~30 (H) | AI directive helper ready (Part 14) |
| AI Activity review | ~25 | 0 | ~25 (H) | pending |
| Offline / Sync Center | ~35 | partial | most (H) | error codes mappable via errors.json |
| Reports (PDF/CSV) | ~40 | 0 | ~40 (R) | export locale + provenance helper ready |
| Onboarding | ~30 | 0 | ~30 (H) | pending |
| Sign-in/up wrappers | ~4 | switcher (L) | Clerk = X | Clerk localized separately (Part 12) |
| Error boundaries | ~10 | 0 | ~10 (H) | FarmFlowError copy pending |
| Toasts / validation | ~40 | **scouting validation (L)** | rest (H) | validation.json + errors.json seeded |
| Empty / loading states | ~25 | common.states (L, available) | most (H) | keys exist, wiring pending |
| Service-worker/offline msgs | ~12 | 0 | ~12 (H) | pending |

**Localized in this stage:** navigation (16), language switcher (6), scouting
condition + severity enum labels, scouting validation messages, and the seeded
`common`/`errors` namespaces available for reuse.

**Hardcoded remaining (approx.):** ~700 user-visible strings across the modules
above — the bulk of the extraction backlog.

## Canonical values confirmed as C/DB (never translated)

`good | satisfactory | poor | critical` (condition); `low | moderate | high |
critical` (severity); observation status, work-order status, priority, activity
type, compliance status, sync state — all localized only as **labels** via
`messages/*/enums.json`, keyed by the canonical token.

## Intentionally untranslated (U)

Ctgb, BRP, BBCH codes, product registration numbers, audit-event action names,
report identifiers, API names, database IDs.
# Stage 5 update — Budget Variance (2026-07-31)

Budget Variance is localized in nl-NL, en-GB, pl-PL and de-DE across Field Detail, Finance, Dashboard, Farm Insights and its existing exports. Global resolver findings moved from 486 to 473; global resolver localization remains NO-GO.
# Stage 6 — Cost Categories (2026-07-31)

Full stage GO: 11 existing categories preserve classification and canonical order; four locales are complete; targeted audit is zero. Global resolver debt is 460 and global localization remains NO-GO.
# Stage 7 update — Gross Margin

The Gross Margin resolver and Field Detail/Finance presentation now use stable status, reason and action codes with four-locale labels. Targeted audit: 3 → 0. Global resolver debt: 460 → 457.

# Stage 8 update — Economic Signals

Dashboard economics, economics-related Farm Insights and deterministic Daily Briefing items now share a presentation-free 12-code contract and four-locale adapter. Targeted findings: 20 → 0; global resolver debt: 457 → 437. Current module audits remain 14 Dashboard and 26 AI findings outside this stage; global localization remains NO-GO.

# Stage 9 update — Weather Risk

Weather Risk domain prose was replaced by four reason codes, three action codes and structured evidence with a four-locale adapter. Targeted audit: 6 → 0; global resolver audit: 437 → 431. Weather-page localization (12 findings), Fields (45), Scouting (32) and Dashboard (14) remain outside Stage 9. Global localization remains NO-GO.
# Stage 14 U2 update (2026-08-01)

Inventory/Machines user-error target is zero across four locales. Global audits remain 131 active user-error and 373 resolver findings, so complete application localization remains NO-GO.
