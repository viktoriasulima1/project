# FarmOS Multilingual Report

## Stage 16 — Activity Parse API

`INVALID_VALUE` and `RATE_LIMITED` render through the shared adapter in en-GB, nl-NL, pl-PL and de-DE. Focused coverage passed in all four locales and German mobile widths.

## Stage 15 — Activities / Quick Log core

The nine-finding batch is bounded GO: localized safe contracts, preserved form/offline state, 1014/1014 unit tests, 38/38 regression and clean 195-collected full E2E. Activity-parse API (2) is next; application-wide localization remains NO-GO.

## Stage 13 addendum (2026-08-01)

The real Work Order validation, not-found, stock and completed-state errors have nl-NL, en-GB, pl-PL and de-DE coverage. Focused four-locale browser validation passed 7/7 and locale hydration regression passed in all four locales.

## Stage 12 — Remaining debt inventory

Inventory/tooling is GO with 552 classified findings and executable bounded batches. No runtime code changed and E2E was not rerun; the Stage 11 clean 178-collected run remains the browser baseline. Application-wide localization remains NO-GO. Next batch is Work Order operational errors (15 active findings, one action file).

Final Stage 12 gates: 994/994 unit tests, TypeScript PASS, Prisma 22 current and production build PASS.

## Stage 11 — User Error contracts

Shared contract and Onboarding migration are GO: 984/984 unit, 4/4 focused E2E, 58/58 regression and a final clean 178-collected full E2E (177 pass, one documented skip) in 19 min 54 s. Application-wide user-error localization remains PARTIAL/NO-GO at 150 active findings; global resolver debt is 402.

## Stage 10 — Spray Window

Spray Window localization is GO: 32 existing signal codes, one shared four-locale adapter, 984/984 unit tests, 46/46 focused tests, 21/21 focused browser tests and a clean 175-collected full E2E (174 pass, one documented skip) in 20 min 7 s. Clerk remained 5 total / 4 fixed-pool with no new users. Targeted findings moved 16 → 0 and global debt 431 → 415; global localization remains NO-GO.

## Financial Completeness — full stage GO (2026-07-28)

Field Detail and Finance now share the canonical Financial Completeness result
and exhaustive four-locale adapter. Dedicated missing purchase-price, labour
rate, machinery rate, combined-rate, missing-harvest, allocation-integrity and
mobile fixtures pass. Unallocated/partial allocation reasons are not supported
by the current completeness contract and were honestly marked not applicable,
not invented. Final unrestricted E2E: 153 collected, 152 passed, 1 documented
conditional skip, 0 failed/flaky, retries=0. Global resolver localization
remains NO-GO (486 findings); physical device review remains separate.

## Resolver Stage 1 — Field Action reasons (2026-07-27) — GO

First domain-resolver refactored from English prose to stable codes. Extracted
`fieldActionAvailability` into `src/lib/field-actions.ts` returning a
discriminated `{ available; code; metadata }` (`AVAILABLE`/`OFFLINE_ONLY`/
`NO_ACTIVE_SEASON`) — no prose. Adapter `src/i18n/adapters/field-action.ts`
(exhaustive + safe fallback) translates codes to `fields.actions.reasons.*` (×4);
action labels → `fields.actions.labels.*`; offline banner date →
`fields.actions.lastSyncedAt`. `FieldActionsBar` fully localized; decisions,
security and offline gating **unchanged** (characterization tests incl. the full
truth table). **`field-actions.ts` resolver audit = 0**; global resolver
**527 → 522**; `field-economics.ts` 23 → 18 (break-even/completeness remain).
Gates: `i18n:validate` ✓ · `tsc` 0 · `vitest` **888/888** · `build` 0. Playwright
`i18n-field-action-reasons.spec.ts` written, **not executed here**.
**GO (code) for Field Action; global resolver localization still NO-GO** (health,
break-even, completeness, budget, economic signals ≈500 strings). See
`Field_Action_Reason_Localization_Report.md`.

---

## Field Detail — top sections localized (2026-07-24) — NOT complete

Honest scope: this iteration asked for Field Detail to audit zero. Field Detail
is exceptionally large — 56 dense literals across ~10 sections **plus** pure
domain resolvers (`health.explanation`, break-even reasons, completeness impacts,
budget drivers, `COST_CATEGORY_LABEL`, action reasons) that render English via
expressions and need a lib code-refactor (Part 8) to truly localize. To keep the
green 872-test build safe, this delivered a **coherent top-of-page slice**, not
the whole page.

1. **Fields audit: 88 → 73.** Localized the Field Detail **header** (back link,
   soil/status via `getEnumLabel`, completeness, calculated date),
   **crop-health**, **current growth stage**, **recent scouting** sections, and
   the **action bar** (`FieldActionsBar`) — via a new `fields.detail` namespace
   (×4, real nl/pl/de) with locale-aware date formatting. The `[id]` page dropped
   **56 → 43**; `FieldActionsBar` **2 → 0**.
2. **Still hardcoded in Field Detail (43 page strings):** the economics summary
   metrics, data-completeness, cost breakdown, direct-vs-allocated, break-even,
   budget-vs-actual, source-records and purchase-history sections; plus
   `FieldEconomicsHistory` (7) and `FinancialVersionTimeline` (1).
3. **Domain-resolver prose (Part 8): NOT done.** `health.explanation`,
   break-even/completeness/budget reason strings, `COST_CATEGORY_LABEL`,
   `FIELD_HEALTH_LABELS` and action reasons still render English through
   expressions (not audit-flagged). Localizing them means refactoring the pure
   libs to return stable codes — deferred.
4. **Tests:** +2 (fields.detail structure + real nl/pl/de labels + interpolation).

**Validation:** `i18n:validate` ✓ (9 namespaces) · `i18n:audit-options` ✓ ·
`i18n:audit -- fields` **73** (not 0) · `tsc` 0 · `vitest` **872/872** (+2) ·
`npm run build` 0. Playwright (`i18n-field-detail.spec.ts`) not written this turn;
existing specs unchanged; **not executed here**.

**GO/NO-GO: NO-GO for Field Detail** (audit ≠ 0; economics/history sections +
resolver prose remain) and NO-GO for the Fields module. The header/health/growth/
scouting/actions slice is a real green partial; the economics + history sections
and the resolver-code-refactor are the next targets.

---

## Onboarding i18n E2E — harness fixed (2026-07-24)

Fixed the two failing `e2e/i18n-onboarding.spec.ts` flows without weakening the
locale architecture. See `Onboarding_I18n_E2E_Triage.md`.

- **Flow A** was Case C: the spec expected the farm step after a `reload()` of an
  un-submitted form, but the wizard correctly returned to *welcome* (no farm
  persisted). Compounded by the reset never clearing `UserLocalePreference`, so a
  stale DB pref could override the cookie.
- **Flow B** was a harness bug: `addCookies({ url: '/' })` → Invalid URL.
- **Fixes:** `resetE2eUserFarmData` now clears the user's `UserLocalePreference`
  (user-scoped, guarded); new `resetE2eUserLocalePreference` /
  `setE2eUserLocalePreference` / `getE2eUserLocalePreference` helpers;
  `setAnonymousLocaleCookie` builds a valid absolute URL from `baseURL`;
  `setLocaleThroughUi` uses the real switcher; `loadTestMessages` sources expected
  text from the catalog. The rewritten Flow A **persists** the farm step and
  asserts the German **Season** heading with route/step preserved. Authenticated
  locale is set by seeding the **DB preference** (authoritative) — cookie never
  overrides DB.
- **Validation:** `tsc` 0 · `vitest` **870/870** (+6 harness unit tests) ·
  `npm run build` 0. **Playwright NOT executed here** (needs live server +
  Postgres + Clerk pool) → **no Onboarding E2E GO claim**; running the four
  focused specs is the developer gate.

---

## Fields — list surface localized (2026-07-24) — module NOT complete

Honest scope: this iteration asked for all of Fields (list, detail, map, BRP) to
audit zero **and** the onboarding Server-Action error-code wiring. Both are large;
this iteration delivered the **Fields list surface** only. **Fields is NOT at
zero and the onboarding action-code wiring was NOT done.**

1. **Fields audit: 109 → 88.** Localized the `/fields` list: page title, the
   summary (total fields / area / healthy / need-attention), table headers, empty
   state, Add-field / Import-from-BRP actions, the archive confirm dialog
   (`{name}` kept literal), and the New-field dialog — via a new `fields`
   namespace (×4, real nl/pl/de). Field `status`/`soilType` now render through
   `getEnumLabel` (new `enums.fieldStatus`; soil reuses `enums.soilType`), so
   labels localize while DB tokens stay canonical. `i18n:audit-options` passes.
2. **Still hardcoded (88 strings):** Field Detail page `fields/[id]` (**56** — the
   dominant surface, with economics/history/timeline), BRP import
   (`BrpImportClient` 8, `BrpImportMap` 1, brp page 2), `FieldEconomicsHistory`
   7, `FieldsOverviewCard` 6, `UnassignedFieldsBanner` 3, map page 2,
   `FieldActionsBar` 2, `FinancialVersionTimeline` 1.
3. **Onboarding Server-Action error codes (Part 2): NOT done.** The six actions
   still return English strings; `createSeason`/`createField` are shared with
   non-onboarding surfaces, so returning codes needs every consumer updated to
   translate — deferred to avoid a half-applied cross-consumer change. The UI
   translations + `errors.json` codes from the prior phase remain in place.

**Validation:** `i18n:validate` ✓ (9 namespaces) · `i18n:audit-options` ✓ ·
`i18n:audit -- fields` **88** (not 0) · `tsc` 0 · `vitest` **864/864** (+5) ·
`npm run build` 0. Onboarding/Work Orders/nav localization stay green. Playwright
(hydration/onboarding/fields) and physical iPhone **not executed here**.

**GO/NO-GO: NO-GO for Fields** (audit ≠ 0) and NO-GO for full-app localization.
The Fields list is a real, green partial; Field Detail (56) is the next and
largest target.

---

## Phase 4A — Onboarding complete (2026-07-24)

Onboarding is now **fully localized to audit zero**.

1. **Initial → final audit:** `i18n:audit -- onboarding` **86 → 0** unexplained
   farmer-facing strings.
2. **Namespace:** new `onboarding` (×4, real nl/pl/de) — every step: welcome,
   farm details + location, season, first field, crop, inventory (incl. advanced
   crop-protection / fertiliser fields), employee/licence, review, complete, plus
   progress label, buttons, hints, placeholders and empty/skip states.
3. **Canonical safety:** the wizard's soil/crop/category/unit selects now bind
   `option value={canonicalToken}` and show labels via new `enums.soilType`,
   `enums.crop`, `enums.inventoryCategory`, `enums.unit` (×4). `i18n:audit-options`
   passes. Farmer-entered names (farm/field), BRP/VAT, Ctgb reg. numbers, and
   coordinate placeholders stay untranslated.
4. **Error codes (Part 14):** added onboarding codes (FARM_NAME_REQUIRED,
   SEASON_ALREADY_EXISTS, INVALID_SOIL_TYPE, DATABASE_UNAVAILABLE, …) to
   `errors.json` ×4 and `SAFE_ERROR_CODES`; unknown/raw errors degrade to GENERIC.
   **Deferred:** wiring the six onboarding Server Actions to *return* these codes
   (they currently return their existing friendly strings, surfaced via
   expressions — not audit-flagged and not raw Zod/Prisma in the component).
5. **Tests:** 11 new (namespace structure, real nl/pl/de labels, English
   fallback, progress interpolation, canonical enum tokens, explicit option
   values, error-code translation + no-raw-Prisma, and a test that **executes**
   `i18n:audit -- onboarding` and asserts zero).

**Validation:** `i18n:validate` ✓ (8 namespaces) · `i18n:audit-options` ✓ ·
`i18n:audit -- onboarding` **0** · `tsc` 0 · `vitest` **859/859** (+11) ·
`npm run build` 0. Locale-hydration spec + `e2e/i18n-onboarding.spec.ts` written;
**Playwright not executed here** (needs live server + Postgres + Clerk pool); no
physical iPhone retest.

**Status:** *Onboarding localization — GO. Full FarmOS localization — still
NO-GO* pending Dashboard, Fields, Scouting completion, and the remaining modules
(Activities, Inventory, Planning, Finance, Compliance, Weather, Insights, Offline
Center, Reports). Current per-module audit baselines: dashboard 14, fields 109,
scouting 32.

---

## Phase 4A update — 2026-07-23 (broad audit tool + Scouting start)

Honest scope note: Phase 4A asked for four fully-localized modules (Dashboard,
Onboarding, Fields, Scouting) plus the broad audit. This iteration delivered the
**audit tool** and a **genuine start on Scouting**; the other three modules were
**not** started. Phase 4A is therefore **NOT complete**.

1. **Broad `i18n:audit` (Part 3):** new `npm run i18n:audit [-- <module>]` scans
   farmer-facing `.tsx` for hardcoded JSX text, label attributes
   (placeholder/aria-label/title/alt), and value-less `<option>`s, with
   `i18n-audit-ignore` suppression and module scoping. It established honest
   baselines: **scouting 50 · dashboard 14 · fields 109 · onboarding 86**
   unexplained strings — this is what "make every page translate" actually costs.
2. **Scouting (Part 11, partial):** new `scouting` namespace (×4, real
   nl/pl/de). The **Scouting page** (title, subtitle, health-priority + recent-
   visit headings, empty states) and the **visit form's visible labels** (field,
   date, condition, GPS buttons, growth-stage, observation fields, photo/annotation
   labels, notes, privacy notice, save) now translate. `i18n:audit -- scouting`
   dropped **50 → 32**.
3. **Still hardcoded in Scouting (deferred):** dynamic GPS/condition messages
   (they live in pure libs `gps-accuracy.ts` / `condition.ts` and return English —
   needs a code→key refactor), the offline feedback strings, the photo-card
   summary, and the photo/annotation/sync sub-components (`PhotoAnnotationEditor`,
   `LocalPhotoAnnotationEditor`, `PhotoSuggestionReview`, `ScoutingSyncCenter`) —
   Parts 12–14.
4. **Not started this iteration:** Dashboard/Today/Daily Briefing (Part 5),
   Onboarding (Part 6), Fields/Detail/Map/BRP (Parts 7–10), the scouting-specific
   error codes (Part 15), and formatter sweeps (Part 16). Playwright localization
   E2E and the physical iPhone retest were **not** run.

**Phase 4A validation:** `i18n:validate` ✓ (7 namespaces) · `i18n:audit-options`
✓ · `tsc` 0 · `vitest` **835/835** (+6) · `npm run build` 0. Work Orders + shell
localization remain green.

**GO/NO-GO:** **NO-GO** for Phase 4A ("Dashboard, Onboarding, Fields and Scouting
fully translate"). Delivered: the audit tool + measurable baselines + a real
Scouting start. The audit now makes each remaining module's work countable; the
pattern per module is "add namespace ×4 + replace literals with `t()`/`getEnumLabel`
+ drive `i18n:audit -- <module>` to zero".

---

## Phase 3 update — 2026-07-23 (make pages actually translate: shell + Work Orders)

Phase 2 wired the pipeline; this phase starts turning it into visible
translation, beginning with the app shell and the `/work-orders` route the brief
designated as the first complete proof.

1. **Why the selector worked while pages stayed English:** the message pipeline
   (locale resolution, `<html lang>`, LocaleProvider) was correct, but components
   still rendered **hardcoded English** — e.g. the Sidebar had
   `navItems = [{ label: 'Today' } … ]` instead of calling the translator. The
   catalogs existed but were not consumed.
2. **App shell now translates:** the Sidebar renders nav labels + toggle aria via
   `useTranslations('navigation')`, and the Quick Log FAB/desktop trigger via
   navigation keys. Selecting Polski/Nederlands/Deutsch immediately changes all
   navigation labels and Quick Log on every page (desktop + mobile).
3. **`/work-orders` fully localized (Part 5):** page title/subtitle, tabs
   (Today / All work / Season plan), Create-work-order form (every label +
   button + success/empty text), Readiness rules, operational queue, row status
   (Resources ready / Blocked: {blockers} / due {date}), and the Start / Block /
   Cancel lifecycle actions — via a new `workOrders` namespace with **real**
   nl/pl/de translations. Operation, status and priority render through
   `getEnumLabel`, so labels localize while `option.value` stays canonical
   (`soil_preparation`, `spray`, `in_progress`, `high`, …).
4. **Namespaces:** added `workOrders` (×4) and extended `enums` with
   `operationType`, `workOrderStatus`, and `priority.urgent` (×4). `i18n:validate`
   now covers 6 namespaces.
5. **`i18n:audit-options` (Part 15):** new `npm run i18n:audit-options` fails if a
   user-facing `<option>` lacks an explicit `value=`. It found and I fixed 4
   real defects (harvest "Unit" select in `EconomicsForms.tsx` submitted its
   visible text); the whole codebase now passes.
6. **Tests:** 11 new (namespaces exist + structure match across locales, real
   pl/nl/de Work Order labels, nav label per locale, interpolation, canonical
   enum tokens unchanged, Work Order selects bind explicit values, audit logic).

**Phase 3 validation:** `i18n:validate` ✓ · `i18n:audit-options` ✓ · `tsc` 0 ·
`vitest` **829/829** (+11) · `npm run build` 0.

**NOT done this phase (the bulk remains):** the other ~20 routes (dashboard,
onboarding, fields, scouting chrome, activities, inventory, planning, finance,
compliance, weather, insights, offline, reports, sign-in/up bodies) are still
largely hardcoded English; the module namespaces (`dashboard.json`,
`fields.json`, etc.) and `i18n:audit` (hardcoded-string scanner) are not yet
created; blocker tokens inside "Blocked: {blockers}" and server-action error
strings are not yet code-mapped; error-code localization of the field-operations
action is pending; Playwright localization E2E and the double full-E2E
certification were not executed here; no physical iPhone retest.

**GO/NO-GO: NO-GO** for "every page translates" — the shell + `/work-orders`
are a real, green, demonstrable proof, not full coverage. Completion needs the
remaining routes extracted, `i18n:audit` added, and the E2E + physical gates.

---

## Phase 2 update — 2026-07-23 (global wiring, DB preference, Clerk)

Adds the load-bearing infrastructure on top of the Phase 1 foundation. **Critical
farmer-workflow string extraction (Onboarding, Dashboard, Fields, Activities) is
NOT complete** — see "Remaining" and GO/NO-GO.

1. **Global wiring (Part 2):** the root layout resolves the active locale via
   `getActiveLocale()` (DB pref → cookie → Accept-Language → nl-NL), sets
   `<html lang>` + `dir` from it, and wraps the whole app in one `LocaleProvider`
   with the shared namespaces (common/navigation/validation/enums/errors). Server
   and client render the same locale (no hydration mismatch); switching language
   `router.refresh()`es without any URL change. `LOCALE_DIR` makes RTL a one-line
   future change.
2. **DB preference (Part 3):** `UserLocalePreference` Prisma model (Clerk-user
   scoped, unique `clerkUserId`) + migration
   `20260723000000_i18n_user_locale_preference`. Access is **defensive**
   (`src/i18n/preference.ts`): a pending migration or missing table degrades to
   the cookie, so nothing breaks before the migration is deployed. `prisma
   generate` could not run here (Windows EPERM lock on the query-engine DLL) — the
   preference layer is written against a structural delegate so it compiles and
   runs regardless; **`prisma migrate deploy` + `prisma generate` must be run in
   each environment.**
3. **Shared switch action (Part 4):** `setUserLocale(locale)` validates the
   locale, persists to DB when authenticated (best-effort) AND sets the cookie
   (fast rendering), returns a safe result. Anonymous = cookie only. No farmId
   from client; users only touch their own row.
4. **Clerk (Part 6):** installed `@clerk/localizations@4.13.6`; verified real
   exports `nlNL / enGB / plPL / deDE` (also `ukUA / ruRU` for planned locales).
   `clerkLocalization(locale)` is passed to `<ClerkProvider localization={…}>`, so
   Clerk UI follows the app language after refresh. English uses the real en-GB
   pack (not an en-US fallback). Keys are not exposed.
5. **Switcher (Part 5):** now calls `setUserLocale`; present in sidebar (desktop +
   mobile), sign-in and sign-up. Topbar user-menu + onboarding placements remain.
6. **Error codes (Part 14):** extended to 19 stable codes (required field, invalid
   enum, not-found/cross-farm, insufficient stock, completed WorkOrder, expired
   operator certificate, invalid Ctgb use, offline unavailable, provider
   unavailable, upload failed, sync conflict, low GPS, auth required, …) across all
   four locales; unknown/raw errors degrade to GENERIC.
7. **Scouting select safety (Part 11):** a source-audit test asserts every
   condition/severity/category `<option>` binds `value={canonical}` (never text
   content), plus a functional label-vs-value check.

**Phase 2 validation:** `i18n:validate` ✓ · `tsc` 0 · `vitest` **808/808** (+13)
· `npm run build` (see §16). **NOT done:** `prisma migrate`/`generate` here (env
lock), full string extraction of Onboarding/Dashboard/Fields/Activities, Clerk +
locale E2E execution, physical iPhone retest. **GO/NO-GO: NO-GO** — infrastructure
complete and green; critical-module extraction is the remaining gate.

---

Date: 2026-07-23. Native localization foundation + first wired slice. Companion
docs: `FarmOS_Localization_Audit.md`, `FarmOS_Localization_Architecture.md`,
`FarmOS_Agricultural_Localization_Glossary.md`, `FarmOS_Translation_Review_Backlog.md`,
and the updated `FARMOS_LOCALIZATION_AND_BROWSER_TRANSLATION_POLICY.md`.

## 1. Previous localization state
Predominantly English, hardcoded strings. The physical-iPhone incident showed
`<option>` text-as-value being submitted after browser translation. Canonical
enum handling was hardened; native localization did not yet exist.

## 2. Architecture
Dependency-free i18n core (`src/i18n/`): no runtime machine translation, no URL
locale prefix, framework-agnostic message files. Chosen over next-intl because it
isn't installed and this modified Next 16.2.9 build makes a framework's Next
integration risky; fully replaceable later. Decision confirmed with the user.

## 3. Supported languages
nl-NL (default), en-GB (fallback), pl-PL, de-DE. Adding uk-UA / ru-UA later =
add a locale + a `messages/<locale>/` folder; no component changes.

## 4. Locale resolution
user preference → `farmos-locale` cookie → Accept-Language → nl-NL; en-GB is the
per-key fallback. Playwright's en-US Accept-Language resolves to en-GB (identical
to the previous English UI), so existing E2E stays green.

## 5. User preference
Cookie-based this stage (`setLocalePreference`, server-validated, unsupported
rejected, no client farmId), surviving logout/login on a device. Cross-device DB
model (`UserLocalePreference`) deferred; the resolver already accepts a stored
preference.

## 6. Language switcher
`LanguageSwitcher` in the sidebar footer and on sign-in — endonyms (Nederlands /
English / Polski / Deutsch), accessible label, keyboard/mobile usable, persists +
`router.refresh()` (route preserved, no URL change), warns via `[data-unsaved="true"]`.

## 7. Canonical enum safety
`getEnumLabel(locale, kind, value)` derives labels FROM canonical values;
`option.value` is always the canonical token. Wired for scouting condition +
severity; maps exist for observation status, priority, activity type, compliance
status, sync state. Translated/mistranslated labels can never change the stored
value. Server normalization + friendly errors remain.

## 8. Clerk localization
Separate system (Part 12). `clerkLocaleFor` maps FarmOS locale → Clerk key
(nlNL/enUS/plPL/deDE). Pack install + ClerkProvider wiring is a follow-up; en-GB
maps to enUS as Clerk ships no en-GB pack.

## 9. Dates / numbers / currency
`Intl`-based `format.ts`, timezone-honouring. Verified in tests: nl `1.234,5` /
`23 juli 2026`; de `1.234,5` / `23. Juli 2026`; pl `…234,5` / `23 lipca 2026`
(grouping char is ICU-build dependent); currency EUR per locale. Values are never
converted because the language changes.

## 10. Agricultural glossary
`FarmOS_Agricultural_Localization_Glossary.md` — authoritative labels across
nl/pl/de; Ctgb/BRP/BBCH and registration numbers untranslated; ⚠ items flagged.

## 11. Validation errors
`validation.json` + a central safe error-code mapper (`error-codes.ts`): Server
Actions can return stable codes (`LOCATION_TOO_LOW`, `CONDITION_REQUIRED`, …)
translated in the UI. Unknown/raw errors degrade to GENERIC — no Zod/Prisma/enum
text reaches the farmer (unit-tested).

## 12. Reports
`export-locale.ts` provides export locale + provenance (locale recorded per
export; identifiers stay canonical). PDF/CSV heading/disclaimer localization and
the export-language selector are pending wiring.

## 13. AI and natural-language parsing
`ai-locale.ts` wraps the canonical facts with a requested output locale and a
"use canonical glossary" instruction; deterministic priorities/facts are passed
through untouched (unit-tested). Entity resolution stays ID/alias based — model
output never becomes a trusted ID.

## 14. Offline behavior
Drafts store canonical tokens only (verified: `overallCondition: "satisfactory"`,
never "Voldoende"); switching language changes labels, not stored data. Sync
error states can translate from stable codes. Recovery export is
locale-independent.

## 15. Browser-translation safety
Native localization + a clear switcher reduce the need for browser translation.
Canonical option values, no DOM-dependent business logic, and the post-iPhone
state-loop guards remain. Browser translation is not globally blocked; targeted
`translate="no"` only where proven unsafe (documented in the policy).

## 16. Unit tests
`src/i18n/__tests__/i18n.test.ts` — 24 cases (resolution, fallback, cookie/pref
precedence, canonical-enum safety, translated-text rejection, explicit option
values, missing-key + placeholder detection, English fallback, nl/pl/de
number/date, timezone, safe error translation, no raw enum leak, offline
canonical, route-independent resolution, Clerk mapping, export provenance, AI
directive, security rejection). All green.

## 17. E2E
`e2e/i18n-localization.spec.ts` — Flow A (switch nl→en→pl→de, route preserved,
persists on reload), Flow B (scouting label localizes, DB value stays
`satisfactory` across a locale switch), Flow H (mobile 390/430 switcher + no
overflow). Flows C/D/F/G depend on later wiring. **Not executed here** (needs
live server + Postgres + Clerk pool).

## 18. Physical iPhone retest status
**NOT retested on a physical iPhone.** Native localization removes the
translated-value defect at the source (canonical option values), but the
physical multilingual + translation retest remains the gate.

## 19. Translation-review backlog
See `FarmOS_Translation_Review_Backlog.md`: native nl/pl/de review, agronomist +
legal review, ~700 strings pending extraction, and pending wiring (global
provider, DB preference, Clerk packs, report localization).

## 20. GO / NO-GO
**NO-GO** for declaring FarmOS fully multilingual: this delivers a green,
non-breaking foundation + the canonical-enum/navigation/validation slice, not
full-app coverage. Automated gates green: `i18n:validate` ✓, `tsc` 0,
`vitest` 795/795, `npm run build` 0. Ship criteria for GO: complete string
extraction, DB preference model, Clerk packs, report localization, full E2E, and
native/agronomic/legal translation review.

### Rules honored
Dutch default; English fallback; labels translated, canonical values not; DB
enums never depend on rendered text; offline data locale-independent; no Google
Translate dependency; Clerk localized separately; IDs/Ctgb/BRP/BBCH/registration
numbers untranslated; no unrelated modules added.
# Stage 5 update — Budget Variance (2026-07-31)

Budget Variance now has a code-only canonical contract and exhaustive four-locale presentation adapter. Browser coverage verifies locale switching does not change canonical cents, percentage, selected field or priority.
# Stage 6 validation update

Cost Category localization passed 944 unit tests, 4/4 category E2E, 38/38 regression E2E, and a final 165-collected full run (164 pass, one documented skip, zero failure/flaky). Clerk stayed 5 total / 4 fixed with zero new users.
## Stage 7 — Gross Margin

Gross Margin localization is full-stage GO: 950 unit tests, 6/6 focused E2E, 41/41 regression E2E and 170-collected full E2E (169 pass, one documented skip, zero failure/flaky). Clerk remained 5 total / 4 fixed-pool. Global resolver localization remains incomplete at 457 findings.

## Stage 8 — Economic Signals

Economic Signals localization is stage GO: 12 canonical codes, one shared four-locale adapter, 950/950 unit tests, 6/6 focused E2E, 46/46 regression E2E and a final 175-collected full run (174 pass, one documented conditional skip, zero failed/flaky) in 20 min 12 s. Clerk remained 5 total / 4 fixed-pool with zero new users. Global resolver localization remains incomplete at 437 findings.

## Stage 9 — Weather Risk

Weather Risk domain localization is GO: 975/975 unit, 40/40 focused regression and a clean 175-collected full E2E (174 pass, one documented skip) in 19 min 54 s. Targeted findings moved 6 → 0 and global debt 437 → 431. A user-visible Weather Risk surface does not exist, so UI localization/E2E is not claimed and full-stage UI integration remains NO-GO.
# Stage 14 U2 update (2026-08-01)

Inventory and Machine action errors use the shared adapter for en-GB, nl-NL, pl-PL and de-DE. Canonical units, categories and machine types remain stable submitted values. Full application multilingual completion is not claimed.
