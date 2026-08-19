# Sprint 11 — First Activity, Quick Log and Beta UX Completion

**Scope of this pass:** the activity flow audit (Part 1), a genuine type-first progressive-disclosure rework of the activity dialog with safe prefilling (Parts 2–6), Quick Log as a thin reuse of the same dialog/action (Part 7), repeat-last-activity with strict field-safety rules (Part 8), client-side stock and compliance previews (Part 9), a three-action success screen (Part 10), the full empty-state copy rewrite across seven modules (Part 11), mobile CSS for the dialog and Quick Log FAB (Part 12), wider adoption of the standardized error model (Part 13), new product events (Part 14), 25 new automated tests (Part 15), an expanded manual E2E checklist (Part 16), and a full validation pass (Part 17). **Deferred, per the brief's own exclusions:** real voice input, GPS, offline queue, and photo upload — the dialog's architecture leaves room for them (a single `formAction` entry point, a single context-fetch function) but none are implemented.

---

## 1. Audit findings

Full detail: `docs/Sprint_11_Activity_Flow_Audit.md`. Headline finding: the previous `SprayDiaryDialog` hardcoded `type="spray"` as a hidden input — every activity ever logged through the UI was recorded as spray regardless of what actually happened in the field, and there was no way to log fertilising, sowing, tillage, scouting, or harvest at all, despite the schema and `createActivity` already supporting all nine `ActivityType` values. This was the single biggest gap closed this sprint.

## 2. Type-first redesign

`ActivityDialog.tsx` replaces `SprayDiaryDialog.tsx` with a 3-mode flow: **type-select → form → success**. The first screen is "What did you do?" with 7 tiles (Spraying, Fertilising, Sowing, Tillage, Scouting, Harvesting, Other — the last revealing a sub-select for the schema's `irrigate`/`soil_sample`/`other` values so they aren't orphaned). Only the fields relevant to the chosen type render — a spray activity shows operator/machine/nozzle/water volume/weather; a sowing activity shows none of that.

## 3. Safe prefilling

`getActivityFormContext()` (`src/lib/activity-form-context.ts`) resolves, in one query batch: field seasons (with hectares), products, machines, the most recent activity's operator/machine, and a current weather snapshot. In the dialog: date defaults to today (not copied from history), treated area auto-fills from the selected field's hectares (editable, marked "prefilled from field"), operator/machine show the most recent values marked "· suggested" (editable, not locked), and weather auto-injects via hidden inputs with an explicit "Weather data is unavailable" fallback when the farm has no coordinates or the fetch fails. **Never prefilled:** dose, water volume, BBCH, certificate/registration numbers — these have no history-based default anywhere in the code.

## 4–6. Per-type flows

Enforced server-side, not just in the UI, via a `.superRefine()` block on `CreateActivitySchema` (`src/lib/actions/activities.ts`): spray requires operator/machine/nozzle type/product/dose/dose unit/water volume; fertilise requires product/dose/dose unit; all other types need only field/date/area. Scouting has no dedicated schema columns for observation category/severity/affected area (adding them would need a real migration — not done this sprint, consistent with the standing "don't invent regulatory/schema data" rule) — these compose into the existing `notes` field via `composeScoutingNotes()` (`src/lib/activity-form-logic.ts`), e.g. `"Category: Disease · Severity: Moderate · Affected: 2 ha · <user text>"`.

## 7. Quick Log

`getQuickLogOptions()` (`src/lib/actions/quick-log.ts`) is a read-only, on-demand server action — fetched only when Quick Log is opened, not on every page load — that calls the exact same `getActivityFormContext()` the full Activities page uses, then renders the exact same `ActivityDialog` component backed by the exact same `createActivity` action. `QuickLogButton` lives once in `AppShell` (not duplicated per-page) so every farm page gets the entry point without each one paying for an eager data fetch; it renders as a fixed button below the topbar on desktop and a 56px circular FAB bottom-right on mobile (hidden ≥768px). **This is one business-logic path with two entry points, not two.**

## 8. Repeat similar activity

A "Repeat" button per Activities-table row constructs a `RecentActivityContext` from data already on the row (no extra round-trip) and opens the dialog pre-set to **type, field, operator, machine, product** only. Date, dose, area, water volume, weather, and any legal/compliance confirmation always start blank and must be re-entered — verified structurally (`getRecentActivityForRepeat()`'s return type has no fields for any of them) and by test (`activity-form-context.test.ts`).

## 9. Stock and compliance previews

`computeStockPreview()` (extracted to `src/lib/activity-form-logic.ts` for testability) projects dose × area against the selected product's current stock entirely client-side — no server round-trip needed just to show it. When the projection would go negative, the Save button disables and an inline warning replaces the normal "stock after this activity" line. A compliance note ("A spray diary record ... will be created automatically and retained for 3 years") shows only for spray, matching what `createActivity` actually does.

## 10. Success experience

Three actions on the success screen: **Add another** (resets to the type picker inside the same dialog session — verified via a `lastHandledActivityId` ref that only reacts to a genuinely new `activityId`, so repeated submissions in one session each correctly re-trigger success), **View activity history** (calls `onSuccess`), **Return to dashboard** (`Link` to `/dashboard`).

## 11. Empty states

Rewritten to the brief's exact copy across all seven modules:

| Module | Title | Description |
|---|---|---|
| Fields | (unchanged) | "Add your first field to begin planning crops and recording work." |
| Activities | (unchanged) | "Record field work to build history, update stock and create compliance records." |
| Inventory | "No products yet" | "Add products to track stock, costs and activity usage." |
| Finance | "No financial records yet" | "Financial insights appear after costs and income are recorded." |
| Weather | "No local weather yet" | "Add farm coordinates to receive local forecasts and indicative spray conditions." |
| Compliance | "No compliance records yet" | "Records are created automatically after regulated activities." |
| AI | "No AI insights yet" | "Insights improve as you add fields, activities, inventory and costs." |

## 12. Mobile UX

`ActivityDialog.module.css` sets 44px-tall inputs/selects below 768px (34px above); `QuickLogButton.module.css` positions the FAB bottom-right, hidden ≥768px, with the desktop trigger positioned below the topbar so it never collides with the per-page user menu. **Not independently verified in a real browser this sprint** — see §16 and the beta-blockers list.

## 13. Standardized error model — wider adoption

Extended from `createActivity`/`deleteActivity` (Sprint 10) to `fields.ts` (`createField`, `updateField`, `deleteField`), `seasons.ts` (`createSeason`, `addFieldToSeason` — both now distinguish a real Prisma conflict via `.code` from other failures, replacing message-string-matching), and `onboarding.ts` (`createFarm`, `addOnboardingInventoryItem`, `addOnboardingEmployee`). Cross-checked against the brief's own list ("activity page, Quick Log, inventory lookup, weather snapshot, compliance creation, stock deduction") — all of these live inside `createActivity`'s single transaction or `getActivityFormContext`'s read path, both already covered; there is no separate inventory-lookup or compliance-creation action file to touch. **Still not covered:** `dev-demo-farm.ts` (a dev-only seed script, not farmer-facing — lower priority, noted below).

## 14. Product events

`ProductEventName` extended with `quick_log_opened`, `activity_type_selected`, `activity_review_opened`, `activity_created`, `activity_failed`, `repeat_activity_used` (alongside Sprint 10's milestone-gated `first_activity_*` events, which still fire only once). All go through the same narrow `ProductEventInput` type that structurally cannot carry notes, certificate numbers, or exact locations.

## 15. Tests added — 172/172 passing (148 pre-existing + 25 new before extraction, net +24 new test cases after the seasons duplicate-test rewrite is counted once)

- `seasons.test.ts` (+1): `addFieldToSeason` now has a dedicated conflict-case test (Prisma `P2002` → "already added", never the raw constraint message) — closes the one gap left after extending the error model to that file.
- `activity-form-context.test.ts` (new file, 10 tests): field/product/machine mapping from Decimal/db shape, recent-operator/machine resolution (present and absent), weather snapshot construction, weather-unavailable paths (no coordinates, fetch failure, no matching hour), and `getRecentActivityForRepeat`'s safe-fields-only contract (present, absent-for-foreign-activity, and farm-scoping of the query itself).
- `quick-log.test.ts` (new file, 3 tests): returns the identical context shape the full page uses, keyed by farm; returns a safe generic error (never a raw exception) when there's no active farm or the context fetch throws.
- `activity-form-logic.test.ts` (new file, 10 tests): `computeStockPreview` — null on missing/invalid inputs, correct arithmetic, insufficient-stock flagging, and the boundary case of exactly zero remaining stock counted as sufficient; `composeScoutingNotes` — category/severity always present, affected-area and user-notes only appended when provided.
- `activities.test.ts` (updated): the `fd()` helper and its default mocks now represent a fully-valid spray (superRefine's new required fields), with a corrected non-spray case for the "no product" test.

**Why no component-rendering tests for `ActivityDialog` itself** (type-switching visibility, prefill rendering in the DOM): this project has no component-testing infrastructure — `vitest.config.ts` runs `environment: 'node'`, and neither `jsdom` nor `@testing-library/react` are dependencies. Adding that infrastructure is a real scope decision (new dependencies, a new test environment) that wasn't made unilaterally under this sprint's time pressure. Instead, the two genuine pieces of business logic that were trapped inside the component (`computeStockPreview`, `composeScoutingNotes`) were extracted to a plain module and are now fully unit-tested; the per-type required-field logic itself was already server-enforced and tested via `activities.test.ts`'s `superRefine` coverage. The remaining gap — confirming the actual rendered DOM behaves as coded — is a real, named limitation, not a silently skipped requirement.

## 16. Manual browser checks

`docs/Sprint_9_Manual_E2E_Checklist.md` gets a new "Sprint 11 additions" section (rows 33–54): timing checks for spraying (<60s), fertilising (<45s), and scouting (<20s); type-switching mid-flow; prefill behavior for area/operator/machine, explicitly confirming date/dose/water volume are never prefilled; Repeat's field-safety contract; weather auto-fill and its unavailable fallback; validation-error visibility; the three-action success screen; Quick Log from both desktop and mobile FAB; mobile tap-target and horizontal-scroll checks; empty-state copy across all seven modules; and second-user data isolation for Quick Log/Repeat specifically. **None of this has been executed in an actual browser this session** — no browser automation tool is available here, and the document says so explicitly rather than implying otherwise.

## 17. Validation results

- `npx prisma migrate status` — **up to date**, 3 migrations, no schema changes this sprint (scouting fields deliberately folded into `notes` rather than adding columns).
- `npx prisma generate` — **succeeded** (146ms). The Windows DLL-lock issue seen in prior sprints only occurs while a dev server holds the file open; no dev server was running during this run.
- `npx tsc --noEmit` — **clean**, no errors.
- `npx vitest run` — **172/172 passing** across 18 test files.
- `npx next build` — **succeeded**, Turbopack compiled in 3.0s, all 13 routes generated without error.

## Remaining beta blockers

1. **No component-rendering test harness** — `ActivityDialog`'s actual DOM behavior (type-switching, prefill display, mobile tap targets) is verified by code review and extracted-logic unit tests, not by rendering it. Same limitation as Sprint 10, still unresolved.
2. **Mobile CSS is unverified in a real browser** — 44px targets and FAB positioning exist in the stylesheets but haven't been visually confirmed on an actual device/viewport.
3. **`dev-demo-farm.ts` still bypasses the standardized error model** — low priority since it's a dev-only seed script, not farmer-facing, but noted for completeness.
4. **No offline queue, GPS, voice input, or photo upload** — explicitly out of scope per the brief, but still the gap between this dialog and the brief's longer-term vision for it. The architecture (single form action, single context-fetch function) was kept deliberately simple so these could be added later without a rewrite.
5. **Manual E2E checklist has grown to 54 rows and none of it has ever been run** — the automated suite (172 tests) covers everything scriptable from here, but the actual human-in-a-browser experience remains unconfirmed sprint over sprint.

## Updated beta readiness score: **8 / 10** (up from 6/10 in Sprint 10)

**What moved the needle:** Sprint 10's own report named the activity-recording experience — "the thing this whole sprint is nominally named after" — as the single largest remaining gap, unchanged from Sprint 9. That gap is now closed: a Dutch arable farmer can pick what they did first, see only the fields that activity type actually needs, get safe non-destructive prefills, see a stock warning before committing, and land on a success screen with a clear next action — all through one code path reachable from anywhere via Quick Log. The error model now covers every farmer-facing write path the brief named. Empty states no longer read as generic placeholders.

**What holds it at 8, not higher:** every UI-level claim in this report is still verified by code reading and logic-level unit tests, never by an actual rendered browser — there is still no component-test harness and still no browser automation tool available in this environment. The sub-60-second spray / sub-45-second fertilise / sub-20-second scout targets are design intentions backed by field-count arithmetic, not measured human time. Until a real person runs the manual checklist end to end, "beta ready" describes the code's correctness, not the confirmed lived experience.
