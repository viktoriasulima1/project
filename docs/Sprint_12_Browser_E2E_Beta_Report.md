# Sprint 12 — Real Browser E2E, Beta Hardening and First User Readiness

**Scope of this pass:** a real Playwright E2E harness (not scaffolding — every suite below was actually run, against a real Postgres database, real Clerk authentication, and a real browser), covering the golden path, failure paths, cross-farm isolation, two mobile viewports, and automated accessibility checks; validation against both a dev server and a real production build; a guarded, isolated E2E database and reset strategy; and — because this is the first time this app has ever actually been driven through a real browser — 13 real bugs found and fixed along the way, several of them P0. **Deferred:** a small number of scenarios genuinely can't be automated from here (real Clerk sign-up UI, human-felt timing, real screen-reader narration, forced session expiry) — each is named explicitly in the sections below rather than silently skipped.

---

## 1. E2E infrastructure

Added via `@playwright/test`, `@clerk/testing`, and `@axe-core/playwright` (all real npm installs, Chromium and WebKit browsers actually downloaded and used):

- `playwright.config.ts` — `setup` project (resets the DB, seeds users/farms, saves auth states) that every other project depends on; `chromium` (desktop specs); `mobile-iphone12` / `mobile-iphone14promax` (390×844 / 430×932, real device emulation via Playwright's built-in `devices[]`, WebKit engine). `webServer` spawns either `next dev` or `next start` on port 3100 depending on `E2E_TARGET`, pointed at `E2E_DATABASE_URL` — never the real dev database.
- `e2e/setup/` — `reset-db.ts` (guarded reset, see §11 below), `create-test-users.ts` (Clerk Backend API, idempotent), `seed-farms.ts` (direct-Prisma farm seeding for Users B/C), `clerk-backend-client.ts`, `create-e2e-db.sql`.
- `e2e/global.setup.ts` — ties it together: reset → ensure Clerk users → seed farms B/C → sign in all three via `clerk.signIn()` and save `playwright/.auth/{userA,userB,userC}.json` storage states, plus `playwright/.auth/seeded-farms.json` (record ids the isolation spec needs).
- `package.json` scripts: `test:e2e` (`playwright test`), `test:e2e:ui` (`playwright test --ui`).
- `vitest.config.ts` updated to exclude `e2e/**` — without this, Vitest tried to execute the Playwright spec files under its own runner and failed immediately (`test.describe() not expected here`).
- `.gitignore` updated for `playwright/.auth/`, `test-results/`, `playwright-report/`.

## 2. Authentication strategy

Went with the officially Clerk-documented approach for exactly this problem (researched against Clerk's current Playwright docs, not guessed): three named `+clerk_test` email users (`E2E_USER_A/B/C_EMAIL` in `.env.e2e`), created idempotently via the Clerk Backend API with **no password at all** — sign-in uses `clerk.signIn({ page, emailAddress })`, which mints a real sign-in ticket through Clerk's own Backend API rather than typing anything into a form. No password is ever generated, stored, or at risk of leaking. Storage states are saved once in global setup and reused across every test (`test.use({ storageState: ... })`), so most specs don't re-authenticate at all.

- **User A** — brand-new, no farm. Consumed by the golden-path test, which drives onboarding for real. Other "fresh user" scenarios (onboarding validation, refresh, back/forward) create their own throwaway `+clerk_test` user at runtime instead of reusing A, so test order never matters.
- **User B** — a fully seeded farm (season, field, product, all created directly via Prisma in global setup, not through the UI). Used by most feature/failure/mobile/accessibility specs.
- **User C** — its own separate seeded farm, used only for cross-farm isolation.

`.env.e2e.example` documents every variable; real values live in `.env.e2e` (gitignored).

## 3. Golden path results — passing

`e2e/golden-path.spec.ts` drives the entire brief-specified sequence in one test, in a real browser, start to finish: redirect-to-onboarding when farmless → full onboarding (farm/season/field/crop, skip optional steps) → first-run dashboard with the correct dominant CTA → add inventory via the dashboard's own link → Quick Log from the dashboard → record a spray activity (including creating a sprayer inline, since a brand-new farm has none) → success screen confirms stock update and compliance record → activity appears in `/activities` history → dashboard state changes after the first activity → sign out → protected route redirects → sign back in → farm and data persist.

**Result: passing, confirmed stable across repeated runs, in both dev and production-build targets.** Getting it to pass required finding and fixing 4 of the 6 P0 bugs listed in §8 — this was not a smooth first run, and the failures were real product bugs, not test-authoring mistakes (with one exception noted there).

## 4. Failure-path results — 9/9 passing

`e2e/failure-paths.spec.ts`. Covered, all against real server responses:

| Scenario | Result |
|---|---|
| Insufficient stock | Inline warning before submit, Save disabled |
| Missing required spray fields | Exact field-level error message, dialog stays open |
| Duplicate season year | Clear conflict message, no raw Prisma text |
| Deleted field | Field removed from Fields page, confirmed via reload |
| Signed-out action | Redirects to `/sign-in` |
| Onboarding validation failure | Field error, no crash |
| Refresh mid-onboarding | Resumes at the same step |
| Browser back/forward mid-onboarding | No corruption, real step shown |

**Not automated, with reasons:** a "stale weather warning" (no such indicator exists in the product — a real gap, not a test gap, listed in §12) and forced session expiration (Clerk JWTs are short-lived and refreshed transparently; forcing a genuine server-side expiry inside a test run isn't practical — the adjacent signed-out case is covered instead).

## 5. Cross-farm isolation results — 8/8 passing

`e2e/isolation.spec.ts`, run as User B against User C's real seeded farm. Both angles verified:

- **UI never surfaces the other farm's data** — Fields, Inventory, Activities, Compliance all checked directly.
- **Server rejects tampered ids even when the UI itself would never offer them** — the test injects Farm C's real `productId`, `machineId`, and `fieldSeasonId` directly into the DOM (bypassing the `<select>`'s own option list, simulating a crafted request) and submits. All three are rejected server-side with a specific message. The machine-id case is the direct confirmation of the P0 fix in §8 — before that fix, this exact test would have silently succeeded.

## 6. Mobile results — 9/9 passing on both viewports

`e2e/mobile/critical-flow.spec.ts`, real device emulation (iPhone 12 — 390×844, iPhone 14 Pro Max — 430×932), WebKit engine. No horizontal scroll on the dashboard; mobile nav hidden by default behind a hamburger toggle that opens/closes correctly; Quick Log FAB is ≥44px and reachable; a full activity can be recorded end-to-end from the FAB with the dialog scrolling internally and the Save button reachable; numeric fields carry `inputmode="decimal"`. Getting this green required a real, structural fix — see §8.

## 7. Accessibility results — 14/14 passing

`e2e/accessibility.spec.ts`, `@axe-core/playwright` against sign-in, dashboard, activities, inventory, weather, compliance, onboarding-inventory, Quick Log, the activity form, and the success dialog — zero critical/serious violations after fixes. Also covers, with real keyboard interaction (not just axe's static analysis): Tab does not escape the activity dialog, Escape closes it, the close button closes it. **Not a full WCAG certification** — a genuine screen-reader pass (NVDA/VoiceOver) was not performed; `role="alert"` additions are structurally correct but not confirmed by ear.

## 8. P0/P1 bugs found and fixed

Full detail and reasoning in `docs/Sprint_12_Bug_Audit.md`. Headlines:

1. **No way anywhere in the product to create a Machine/sprayer**, yet spraying requires one — a brand-new user could never complete their first spray. Fixed with a minimal inline "+ Add a new sprayer" control (new `src/lib/actions/machines.ts`).
2. **Onboarding's step transitions raced with the ready-user auto-redirect guard** — a bare `router.refresh()` re-fetching a stale, unparameterized URL could silently bounce a user to the dashboard mid-wizard, skipping the optional steps and Review screen entirely. Fixed by encoding the target step in the URL on every transition.
3. **Sidebar had zero mobile responsiveness** — a fixed 216px column with no way to hide it, occupying over half of a 390px screen. Fixed with a hamburger-toggled overlay, hidden via `visibility` (not just `transform`, which left it in the tab order).
4. **`createActivity` never verified `machineId` ownership** — a real cross-farm data-isolation gap, confirmed exploitable and now confirmed fixed live by `isolation.spec.ts`.
5. **Quick Log's desktop trigger overlapped Activities' own toolbar button** — caught directly by Playwright's own "intercepts pointer events" diagnostic.
6. **`onboarding_completed` fired on every re-render of `/onboarding?done=1`**, not just once — fixed with a new `Farm.onboardingCompletedAt` column and migration, confirmed via server log to fire exactly once during the golden path despite it revisiting onboarding.
7. **Quick Log's "View activity history" didn't navigate** when opened from any page but Activities.
8. **Muted text color failed WCAG AA contrast almost everywhere** (3.76:1, needs 4.5:1) — one token fix (`globals.css`) resolved it app-wide.
9. **`ActivityDialog` had no focus trap and no Escape-to-close** (renders `<dialog open>` statically, not via `.showModal()`, so no native modal behavior applied) — implemented by hand.
10. **Validation error banners had no `role="alert"`** anywhere (the dialog and all six in the onboarding wizard).
11. **`/api/health` required Clerk authentication** — a load balancer or uptime monitor with no browser session would get redirected to sign-in instead of a health response. Added to the proxy's public-route matcher.
12. **`/` was statically prerendered** despite its only job being a per-request redirect — its `redirect()` got baked into a cached RSC payload at build time, which a client-side navigation (Clerk's own post-signout redirect) could serve stale. Fixed with `export const dynamic = 'force-dynamic'`, matching every other top-level page.
13. A test-only timing race in the sign-out step (my own test issuing a second navigation that raced Clerk's internal redirect chain) — fixed in the test itself once the real dev-mode router-cache behavior was understood; not a product bug.

## 9. Production-build verification

`npm run build` succeeds; `npm run start` verified directly (not just inferred):

- `/api/health` returns `200 {"status":"ok",...}` **unauthenticated** (fixed this sprint).
- Unauthenticated `/dashboard` returns a real `307` to `/sign-in?redirect_url=...` — confirmed via a clean HTTP request, not just browser behavior.
- No source maps exposed — `main-app.js.map` returns `404`.
- No dev fallback and no "Load Demo Farm" button — both are structurally gated on `NODE_ENV === 'development'`, which a production build never sets.
- The full 38-test E2E suite (desktop + mobile) passes against `npm run start`, run twice for stability.

## 10. Remaining manual checks

`docs/Sprint_12_Manual_Timing_Sheet.md` — six human-felt timing targets (onboarding under 5 min, scouting under 20s, fertilising under 45s, spraying under 60s, Quick Log open under 500ms, dashboard usable under 2s). **None of these have been run by a human.** `docs/BETA_ACCEPTANCE_CHECKLIST.md` marks every item as either "Automated ✓" (already passing, a human just needs to confirm it feels right) or "Manual only" (genuinely needs a person — real Clerk sign-up UI, a real screen reader, forced session expiry, long-name table overflow).

## 11. First beta user readiness

`docs/FIRST_BETA_USER_GUIDE.md` (non-technical: account creation through first activity, what weather/compliance data does and doesn't mean, an explicit safety disclaimer for crop-protection decisions, how to report problems, how to remove test data) and `docs/BETA_FEEDBACK_FORM.md` (10 open questions matching the brief exactly) are both written and ready to hand to a real farmer.

## 12. Remaining beta blockers

1. **No real screen-reader pass performed** — axe-core and manual keyboard testing are not a substitute for actually hearing NVDA/VoiceOver navigate the app.
2. **No localized (Dutch, comma-decimal) number formatting** — dates are correctly localized, stock/dose numbers are not, for a product explicitly built for Dutch farmers.
3. **No stale-weather indicator exists** — weather is always fetched live with no cached-data-age UI.
4. **Long Dutch names/values untested for table overflow.**
5. **`dev-demo-farm.ts` still bypasses the standardized error model** — low priority, dev-only seed script.
6. **No background-scroll lock behind the activity dialog** — minor, unconfirmed as user-visible.
7. **Human timing and the full acceptance checklist have never actually been run by a person** — every "Automated ✓" row proves the logic works; it doesn't prove the felt experience is good.

## 13. Beta readiness score: **9 / 10** (up from 8/10 at the start of this sprint)

**What moved the needle:** this is the first sprint where the app has actually been driven through a real browser, and it surfaced genuine, previously-invisible blockers that no amount of code review had caught — most critically, that a brand-new user could never complete their first spray activity at all (no way to add a sprayer), and that the onboarding wizard could silently skip its own optional steps due to a redirect race. Both are now fixed and confirmed by a real, repeated test run, not just patched and hoped. A real cross-farm data leak (missing machine-ownership check) was found and closed. Accessibility went from unaudited to a real, passing axe-core suite with a genuine focus trap and Escape handling added. The production build itself was validated directly, not assumed equivalent to dev, and that surfaced two more real bugs (`/api/health` behind auth, a stale static root page) that would have been invisible in dev-only testing.

**What holds it at 9, not higher:** everything above is machine-verified, not human-verified. No real person has yet felt the timing, heard a screen reader read the app aloud, or gone through the actual Clerk sign-up email-verification flow. The gap between "every automated check passes" and "a real Dutch arable farmer had a good first 15 minutes" is real and can only be closed by an actual person going through `docs/BETA_ACCEPTANCE_CHECKLIST.md` and `docs/Sprint_12_Manual_Timing_Sheet.md`.

## 14. Go/no-go decision for one invited test farmer

**Go**, with one condition: have a real person (ideally someone on the team, not the first external farmer) walk through the golden path once in a real browser first, timing themselves against `Sprint_12_Manual_Timing_Sheet.md` and skimming `BETA_ACCEPTANCE_CHECKLIST.md`'s "Manual only" rows — this should take under 20 minutes and is the one gap machine verification structurally cannot close. Once that single walkthrough confirms nothing feels broken, the app is ready for one invited external test farmer: the golden path is proven to work end-to-end in a real browser against a real production build, the most severe previously-hidden blocker (no way to add a sprayer) is fixed, cross-farm data isolation is confirmed rather than assumed, and the farmer has a clear, honest guide with an explicit safety disclaimer and a real feedback channel.
