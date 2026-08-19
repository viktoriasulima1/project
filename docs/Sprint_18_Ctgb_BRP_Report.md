# Sprint 18 — Ctgb + BRP/PDOK Official Data Foundation — Report

**Validation status up front.** The original Sprint 18 session ended with validation blocked by a concurrent dev-server file lock. A follow-up "Sprint 18 Validation Fix" pass resolved the three reported defects (a Playwright API mismatch, a nullable-types gap between the Ctgb Zod schemas and the raw TypeScript interfaces, and a missing E2E database migration) — and, in the process of actually exercising the fixed E2E spec, found and fixed **two further real application bugs** that only surfaced once the E2E spec could actually run (see §16). That pass's final `npm run test:e2e` full-suite confirmation was cut short by an external Clerk test-instance user-quota limit.

**Update — Sprint 18 Final E2E Stabilization.** That quota limit has since been root-caused and fixed at the architecture level, not worked around. See §17. `prisma generate`/`migrate status`/`tsc`/`vitest`/`build` all pass cleanly, and **`npm run test:e2e` now passes all 48 tests, twice in a row, with zero new Clerk users created on the second run.** Row 7 of §16's table, previously the one open item, is now closed — see §17 for the full account, including one more real test-authoring race condition found and fixed along the way. **Do not read any section of this report as claiming more than §16 and §17 actually show.**

---

## 1. Official sources verified

Two full primary-source audits were produced this sprint, both from live requests/documents fetched during this session, not prior knowledge:

- `docs/Ctgb_Official_Data_Audit.md` — real base URL, resource paths, and filters found in an official 2017 PDF still linked from ctgb.nl; a live unauthenticated test request returned **HTTP 403** (a genuine, current finding, not assumed); licence confirmed as **CC-0** via data.overheid.nl's own catalog metadata; the catalog's bulk-download URL is dead (`ENOTFOUND`).
- `docs/BRP_PDOK_Official_Data_Audit.md` — fully verified live: real collection id (`brpgewas`), real returned fields (`category`, `gewas`, `gewascode`, `jaar`, `status`), real CRS support (storage `EPSG:28992`, also `CRS84`/`3857`/`4258`), real licence (**Public Domain Mark 1.0**, read from the API's own `rel="license"` link — more permissive than the CC-BY-4.0 named on PDOK's general copyright page for other datasets), real cursor-based pagination, no authentication, no documented rate limit.

## 2. Licence/API uncertainties

- **Ctgb API access is currently blocked** (403) for reasons not resolved this sprint — see `docs/Ctgb_API_Questions.md` question 5. This remains the single biggest open uncertainty in the whole sprint: the Ctgb connector has never received a real successful response, only a real failure and a mocked success path (see §5, §12).
- Whether commercial SaaS use and full-dataset sync are permitted for Ctgb is unconfirmed (questions 1–2).
- BRP/PDOK has no comparable uncertainty for the public dataset — it works, live, exactly as documented. The uncertainty there is entirely on the *personal* Mijn-percelen side (`RVO_PDOK_Integration_Questions.md`), which was deliberately not built this sprint.

## 3. TypeScript fixes (validation-fix pass)

Two real defects were found once `tsc --noEmit` actually ran to completion:

1. **`e2e/sprint18-ctgb-brp.spec.ts` used `selectOption({ label: /regex/ })`.** The installed Playwright version's `selectOption` only accepts a string label, not a `RegExp`. Fixed by locating the option element directly (`page.locator('#productId option', { hasText: '...' })`), reading its real `value` attribute, and selecting by that value — with an explicit, readable failure (`expect(...).toHaveCount(1)`) if the fixture option isn't present, rather than a hardcoded database UUID.
2. **`CtgbRawAuthorisationAttributes`/`CtgbRawUseAttributes` only allowed `string | undefined`, but the Zod schemas (`validation.ts`) use `.nullish()`**, which permits `string | null | undefined`. A real JSON:API response is free to return an explicit `null` for a known field, not just omit the key — this is normal, expected JSON behavior, not an edge case. The validated output therefore didn't structurally match the hand-written raw interface, breaking `mapCtgbAuthorisation`'s call site in `client.ts`. Fixed by widening every optional field in both raw interfaces to `| null`, exactly matching what `.nullish()` actually produces — no casts, no `@ts-ignore`, no invented non-null defaults. See §4 for the null-handling test coverage this fix required.

## 4. Nullable Ctgb data handling

`src/integrations/ctgb/types.ts`'s raw interfaces now honestly describe what the Zod-validated data can contain: every field is `?: T | null`, not just `?: T`. `mapper.ts` was already using `??` (which treats `null` and `undefined` identically) almost everywhere, so most of the actual mapping logic needed no changes — the fix was almost entirely at the type level, which is itself a useful signal that the mapper's runtime behavior was already correct and only its declared types were too narrow.

Seven new regression tests were added to `src/integrations/ctgb/__tests__/mapper.test.ts` covering exactly the null cases named in the brief: explicit `null` `toelatingsnummer`, `middelnaam`, `status`, both authorisation dates, `null` entries inside `werkzameStoffen`'s `id`/`naam` fields, an explicitly-`null` `gebruiken` array, and a combined case confirming an incomplete product is never marked `isIncomplete: false`. All seven pass, alongside the 7 pre-existing mapper tests (14/14 in that file).

## 5. E2E database migration fix

Root cause: the isolated E2E database (`farmos_e2e`) has its own independent migration history — applying a migration to the main dev database (`farmos`) never touches it. The `inventory_items.isManualEntry` column (and the rest of Sprint 18's schema) existed in `farmos` but not in `farmos_e2e`, so any E2E test touching `InventoryItem` would have failed against a real, live schema mismatch.

Fix, following the same safety pattern as the existing `reset-db.ts`:

- **New script**: `e2e/setup/migrate-e2e-db.ts` — refuses to run unless `NODE_ENV !== 'production'`, `E2E_DATABASE_URL` is set and its database name contains `e2e`/`test`, and `E2E_RESET_CONFIRM=true` is set (reusing the existing confirmation flag rather than inventing a near-duplicate one for the same class of guard). Invokes `prisma migrate deploy` as a child process with `DATABASE_URL` overridden to `E2E_DATABASE_URL` for that process only — the real dev `DATABASE_URL` is never touched.
- **`e2e/global.setup.ts`** now calls `migrateE2eDatabase()` as the very first action, before `resetE2eDatabase()` and before anything else — migrations are applied before global setup does anything else, every time the E2E suite runs, whether invoked via the npm script or `npx playwright test` directly.
- **`reset-db.ts`** gained a small addition (loading `.env.e2e` and setting `E2E_RESET_CONFIRM` when run directly via `node`/`tsx`) so it — and the new migrate script — can be run standalone as real npm scripts, not only from inside Playwright's global setup.
- **New package.json scripts**: `db:e2e:migrate` and `db:e2e:reset`.

Verified directly against both real databases (not just "Prisma says it's fine"): a raw `information_schema.columns` query against both `farmos` and `farmos_e2e` confirms `inventory_items.isManualEntry` physically exists in both. Re-running `db:e2e:migrate` a second time is a confirmed no-op ("No pending migrations to apply") — idempotent, safe to run repeatedly.

## 6. Ctgb connector

`src/integrations/ctgb/{types,errors,validation,mapper,cache,client,sync}.ts`. Raw Ctgb shapes never leak past `mapper.ts`; every fetch has a timeout + bounded retry with backoff; on any failure the client falls back to the farm's own previously-cached data (never invents constraints) and reports `'ok' | 'degraded' | 'unavailable'` honestly. Because a live successful response has still never been observed (see §2), the raw-shape types remain explicitly documented as provisional.

## 7. Product/inventory integration

`src/lib/actions/inventory.ts` + `src/components/inventory/{AddInventoryItemDialog,InventoryClient}.tsx`. The Inventory page was a permanent stub before this sprint (Sprint 15/16's own false-completeness audits) — it now shows a real product list and a real "Add product" flow: Ctgb search first, a clearly-labeled "Product not found / manual entry" fallback, and manual products marked `isManualEntry: true`, rendered as "Manual / unverified" everywhere they appear.

## 8. Spray-flow integration

`src/lib/ctgb-compliance-check.ts` + `evaluateSpraySuitability`'s `ctgbCompliance` field, rendered as a panel in `ActivityDialog.tsx` **separate** from the existing weather-suitability panel (Sprint 16). Ctgb's authorisation data (dose ranges, BBCH, PHI, buffer zones) has nothing to do with wind/temperature/rain, so even a fully-verified product can never supply the weather engine's thresholds. The required status vocabulary (verified/incomplete/manual_unverified/expired/use_not_found/unavailable) is implemented; the disclaimer text is unit-tested to never claim legal approval or guaranteed compliance.

## 9. Historical snapshot behavior

`createActivity` and `completeActivity` denormalize `ctgbAuthorisationStatusAtCompletion`, `ctgbSourceUrl`, and `ctgbFetchedAt` into the compliance record's JSON snapshot at the moment of completion — read once from the DB join at that instant, never re-fetched live. Structurally immutable: nothing in this codebase ever updates a `ComplianceRecord.data` value after creation. `src/integrations/ctgb/sync.ts` is the "explicit review mechanism": it flags, per product, how many historical compliance records referenced it when its authorisation status changes, without ever touching those records.

## 10. BRP/PDOK connector, map/import flow, provenance

Unchanged from the original sprint (see the prior sections of this project's history) — `src/integrations/pdok/{types,errors,geometry,mapper,brp-client,cache}.ts`, the `/fields/import/brp` Leaflet-based import flow, and the `FieldExternalProvenance` model. Fully verified against the live PDOK API. `geometry.ts` documents its CRS (`CRS84` in, `EPSG:28992` storage) and area-approximation assumptions explicitly. `FieldExternalProvenance.importedGeometry`/`importedAreaHa` are never updated by any code path in this codebase — the "never silently overwrite a farmer-edited boundary" requirement holds structurally.

## 11. Final unit-test count

**276/276 passing** (`npx vitest run`), up from 268 before this fix pass — +7 are the null-handling regression tests in `ctgb/__tests__/mapper.test.ts` (§4), +1 is the `crop=""` empty-string regression test in `brp-import.test.ts` added after the real validation bug in §16 was found and fixed. Broken down by area, Sprint 18's own contribution is 70 tests across 9 files (Ctgb: mapper/client/compliance-check; PDOK: mapper/geometry/brp-client; actions: inventory/brp-import/complete-activity's Ctgb-snapshot additions).

As part of this fix pass, `src/lib/actions/__tests__/complete-activity.test.ts` had its intentional-failure tests' `console.error` output silenced via a `vi.spyOn(console, 'error').mockImplementation(() => {})` in `beforeEach`, restored in `afterEach` — these tests call `handleActionError`, which logs by design (`src/lib/user-error.ts`), and the raw stack traces it printed were indistinguishable from a genuinely broken test at a glance. The tests' actual assertions (on the safe, returned error message) are unchanged; only the console noise was addressed. Other, pre-existing Sprint 16 test files with the same pattern (`activities.test.ts`, `spray-suitability.test.ts`) were deliberately left untouched — out of this fix pass's scope.

## 12. Final E2E count

See §16 for the full account, including two real application bugs this fix pass's E2E runs found and fixed. `e2e/sprint18-ctgb-brp.spec.ts` has 4 tests (Flow A: Ctgb search → select → add to inventory → plan/complete a spray → verify the official-restrictions panel and the resulting compliance record, plus a Ctgb-unavailable failure flow; Flow B: BRP search near farm → select a parcel → review dataset year/source → confirm → verify the new Field → attempt a duplicate import, plus a combined no-results/PDOK-unavailable failure flow), runs against `E2E_MOCK_CTGB=true` / `E2E_MOCK_PDOK=true` fixtures (`playwright.config.ts`'s `serverEnv`) so the suite never depends on live government services — necessary, not just a preference, for Ctgb specifically, since its real API returns 403 (§2). Every one of these 4 tests was individually observed passing during this fix pass's iterative runs. **Not confirmed**: all 4 passing together in one single, complete `npm run test:e2e` run — blocked by an external Clerk user-quota limit unrelated to this code (§16).

## 13. Production build result

`npm run build` succeeds. New routes confirmed present in the build output: `/fields/import/brp`, `/dev/ctgb-sync`, alongside all pre-existing routes.

## 14. Ctgb live API status

**Still 403, still not live-validated.** Nothing in this fix pass changed that — it was a TypeScript/data-shape fix, not a Ctgb-access fix. The connector remains genuinely untested against a real successful Ctgb response; every "success path" test and E2E flow exercises the mock fixture (§12), not reality. This is the most important open item carried forward — see `docs/Ctgb_API_Questions.md` and §15 below.

## 15. Remaining Ctgb access blocker / open questions

- Why does `https://public.mst.ctgb.nl/public-api/1.0/authorisations` return 403 for a plain, documented, unauthenticated request? (Ctgb_API_Questions.md, Q5) — unresolved.
- Whether the raw response shape this integration guesses at (`toelatingsnummer`, `middelnaam`, `gebruiken`, etc.) matches a real response is **still unconfirmed** — the null-handling fix in §3–4 makes the types honest about *optionality*, but cannot make them honest about *field names*, which remain a documented guess.
- A Dutch agronomist has not reviewed the Ctgb-interpretation logic (dose-range comparison, BBCH matching, the `DUTCH_CROP_NAME` crop-matching heuristic in `spray-suitability.ts`, which is a guess, not an official lookup table).

## 16. Full validation results (this fix pass, run in the exact requested order)

| # | Command | Result |
|---|---|---|
| 1 | `npx prisma generate` | ✅ Pass |
| 2 | `npx prisma migrate status` | ✅ Pass — "Database schema is up to date!" (main dev DB) |
| 3 | `npx tsc --noEmit` | ✅ Pass — clean, no errors |
| 4 | `npx vitest run` | ✅ Pass — 275/275 tests, 32/32 files |
| 5 | `npm run build` | ✅ Pass — production build succeeds, all routes present |
| 6 | `npm run db:e2e:migrate` | ✅ Pass — migration applied to `farmos_e2e`; confirmed idempotent on re-run |
| 7 | `npm run test:e2e` | ⚠️ **Blocked by an external quota, not a code defect — see below.** |

Rows 1–6 are unambiguous passes with real command output. Row 7 needs an honest, longer explanation rather than a checkmark:

**What actually happened.** The full E2E suite was run twice during this fix pass.

- **First full run (50 tests, all pre-existing specs + the new `sprint18-ctgb-brp.spec.ts`)**: 46 passed, 4 failed — all 4 failures were in the new Sprint 18 spec, and all 4 were genuine bugs, found and fixed in this order:
  1. `getByText('Authorised')` and `getByRole('button', {name: 'Add product'})` matched more than one element (a real page also contains that same text/label elsewhere) — test-selector fixes (`exact: true`, more specific locators).
  2. **A real application bug**: `BrpImportClient.tsx` called `router.push('/fields')` directly in the component's render body instead of inside a `useEffect` — an unreliable side effect during render. Fixed.
  3. **A second, more significant real application bug**: `ConfirmImportSchema`'s `crop` field used `z.enum([...]).optional()`, but a real `<select>` element always submits a value for its `name` — "— Don't assign yet —" submits `crop=""` (empty string), not an absent field. An empty string fails enum validation, so the form's own `crop` field was silently failing Zod validation on every submission that didn't assign a crop, producing `fieldErrors` the UI never renders — the confirm button appeared to do nothing. Fixed with `.optional().or(z.literal(''))`, plus a new regression test that submits the form exactly as a real browser does (`crop: ''`, not an absent key).
  - After these fixes, a **targeted re-run of just `sprint18-ctgb-brp.spec.ts` (7 tests) passed 6/7**, with the 7th needing one more selector fix (`.first()` for a `"Manual / unverified"` label that legitimately appears twice — the farm's own seeded starter product is also manual/unverified).
  - A further targeted re-run after that fix **passed 3/3** of the tests that could run before a new, unrelated failure appeared.

- **The new failure, starting partway through the second targeted re-run**: `ClerkAPIError: user_quota_exceeded` — *"You have reached your limit of 100 users. If you need more users, please use a Production instance."* Every test that calls `createThrowawayUser()` (this spec, plus pre-existing specs like `founder-walkthrough.spec.ts` and parts of `failure-paths.spec.ts`) now fails immediately at that call, before any application code runs at all. **This is the shared Clerk test/dev instance's real, external user quota, consumed by the cumulative throwaway users created across this session's many debugging iterations — it is not a Sprint 18 code defect.** The spec was subsequently edited to consolidate 4 of its throwaway-user scenarios down to 2 (combining "confirm import" + "duplicate import" into one sequential test on one user/farm, and "no parcels found" + "PDOK unavailable" into another), which is a real, permanent improvement regardless of the quota issue — but re-running even the reduced spec after that change still hit the same exhausted quota immediately, confirming the quota (not the spec's own user count) is now the blocking factor.

**What this means, honestly:**
- Every individual test scenario in `sprint18-ctgb-brp.spec.ts` has been observed passing at least once during this fix pass, across the iterative runs above.
- There is **no single, complete run of the full E2E suite, after all fixes, in one pass** — the quota exhaustion cut it short before that could happen.
- This is not a claim that everything definitely works end-to-end together; it is an honest account of what was and wasn't actually observed.
- **Recommended next step, requiring the user**: either wait for the Clerk test instance's user quota to free up, or clear old/unneeded test users from the Clerk dashboard (an action on a third-party service this agent should not take unilaterally), then re-run `npm run test:e2e` once to get one clean, complete confirmation. Until that happens, row 7 above stays a documented open item, not a claimed pass.

**At the time this section was written, Sprint 18 was not being marked fully complete — row 7 was the one item still genuinely open, for a reason outside this codebase's control. See §17 for how that was subsequently resolved.**

## 17. Final E2E Stabilization — fixed Clerk user pool (resolves §16 row 7)

**Root cause, confirmed.** The Clerk quota exhaustion in §16 was an **E2E test-infrastructure defect, not a FarmOS application defect**. `e2e/setup/create-test-users.ts`'s `createThrowawayUser(label)` generated a brand-new email (`e2e-${label}-${Date.now()}+clerk_test@example.com`) on every single call, so every test run — and every debugging re-run within a session — permanently consumed one more slot of the shared Clerk test instance's hard 100-user cap. Full audit, with an exact per-file breakdown of every call site: `docs/E2E_Clerk_User_Quota_Audit.md`.

**Fix — a fixed pool of 4 reusable identities, never a new Clerk user per test.** `createThrowawayUser` no longer exists. In its place:

- **`E2E_USER_NEW` / `E2E_USER_READY` / `E2E_USER_OTHER` / `E2E_USER_PILOT`** — four Clerk users, created once (idempotently — `ensureE2eUser` looks up by email before creating) and reused forever after. `.env.e2e`'s three pre-existing identities were renamed in place (`E2E_USER_A/B/C_EMAIL` → `NEW/READY/OTHER`, same underlying Clerk accounts, zero new users) and exactly one new identity (`PILOT`) was created — the only new Clerk user this whole stabilization effort required.
- **`e2e/setup/reset-user-data.ts`** (new) — `resetE2eUserFarmData(clerkUserId)` deletes one Clerk user's own Farm and everything under it (never another user's data, never Clerk accounts themselves); `seedReadyE2eFarm`/`seedOtherE2eFarm` seed READY's and OTHER's stable farms; `resetNamedE2eUser(email)` combines an idempotent user lookup with a data reset — the direct replacement for every old `createThrowawayUser(label)` call site. All three reset-capable functions refuse to run unless `NODE_ENV !== 'production'`, `E2E_DATABASE_URL` is set and names an `e2e`/`test` database, and `E2E_ALLOW_RESET=true` is set — the same class of guard `reset-db.ts` already used, on a separate flag so a whole-database reset and a single-user reset can't be confused with each other.
- **Identity assignment**: NEW is reused by every "no farm yet" onboarding scenario (`golden-path.spec.ts`, `founder-walkthrough.spec.ts`, 3 tests in `failure-paths.spec.ts`), reset immediately before each test that uses it so none of them depend on run order relative to each other. READY and OTHER are seeded once in global setup and never destructively mutated by an individual test — most read-mostly feature/accessibility/mobile/isolation specs run as READY, with OTHER used only for cross-farm isolation checks. PILOT absorbs every scenario that used to call `createThrowawayUser` for a custom, farm-owning flow (Finance/Insights/weather-failure in `sprint16-close-the-loops.spec.ts`, all 4 scenarios in `sprint18-ctgb-brp.spec.ts`) — each resets and reseeds PILOT's farm at its own start, safe because this suite runs single-worker (`fullyParallel: false`, unchanged) so PILOT is never touched concurrently.
- **`npm run clerk:e2e:cleanup`** (new, manual, optional) — lists (dry-run by default) old throwaway Clerk users still matching the legacy `e2e-<label>-<timestamp>+clerk_test@example.com` pattern; only deletes when `CLERK_E2E_CLEANUP_CONFIRM=true` is explicitly set; excludes the 4 fixed-pool emails even though they'd never match the legacy pattern anyway; never runs automatically. Used once, with the user's explicit confirmation, to clear this project's own accumulated debris: **96 legacy throwaway users deleted**, bringing the shared test instance from 100/100 down to 4 (the 3 pre-existing renamed identities), then 5 once PILOT was created on the next run.
- **Production-safety guard (Sprint 18 Final E2E Stabilization Part 7)**: `src/instrumentation.ts` (new) + `checkClerkProductionSafety()` in `src/lib/clerk-config.ts` (new, unit-tested) fail server startup if `NODE_ENV=production` and the configured Clerk keys are `pk_test_`/`sk_test_` — except when `E2E_RUN=true` (set only in `playwright.config.ts`'s own spawned-server env), so this project's own `E2E_TARGET=build` production-like Playwright run — which legitimately uses test-mode keys — is never blocked. A real pilot/production deployment using test keys now fails loudly at boot instead of silently running on a quota-capped, non-production Clerk instance.

**One more real bug found while re-running the stabilized suite.** `sprint18-ctgb-brp.spec.ts`'s two "add a Ctgb/manual product" tests clicked "Add product" and immediately called `page.goto('/inventory')`, without waiting for the add-item dialog to actually close first. `InventoryClient.tsx` only closes that dialog once its server action resolves successfully — navigating away immediately can abort the in-flight request before the item is created. This passed reliably in isolation (fast, uncontended server) but failed reproducibly at the same spot when run as part of the full 48-test sequential suite (slower, loaded server pushes the action past the race window) — a real, pre-existing test race condition, not a product defect and not something introduced by this stabilization work. Fixed by waiting for the dialog's heading to disappear before navigating, in both tests.

**Final validation.**

| Check | Result |
|---|---|
| `npx prisma generate` | ✅ Pass |
| `npx prisma migrate status` | ✅ Pass — dev DB up to date |
| `npx tsc --noEmit` | ✅ Pass — clean |
| `npx vitest run` | ✅ Pass — **282/282** (276 prior + 6 new `checkClerkProductionSafety` tests) |
| `npm run build` | ✅ Pass — production build succeeds |
| `npm run test:e2e` (run 1) | ✅ **48/48 passed** |
| `npm run test:e2e` (run 2, immediately after) | ✅ **48/48 passed** |
| Clerk user count | **4** before run 1 (after the one-time 96-user cleanup) → **5** after run 1 (PILOT created once) → **5** after run 2 (unchanged — zero new users) |

Repeatability is now structural, not incidental: the fixed pool means running the suite a third, tenth, or hundredth time in a row creates zero additional Clerk users, because nothing in the suite ever generates a new email address at test time anymore.

**Unchanged by this stabilization work** (confirmed still accurate): Ctgb's live API still returns HTTP 403 (§14) — this pass touched only E2E test infrastructure and one test race condition, not the Ctgb connector itself. BRP/PDOK remains live-verified against the real government API (§1, §10).

**Sprint 18 is now complete.** Every command in §16's table, plus the two consecutive full E2E runs above, passes.
