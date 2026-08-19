# Onboarding i18n E2E — Triage & Fix

Date: 2026-07-24. `e2e/i18n-onboarding.spec.ts` Flow A + Flow B failing; the
locale-hydration spec was 5/5 (unaffected). This is a **test-harness + test-design**
fix — the locale architecture and DB-over-cookie precedence are correct and
unchanged.

## 1. Why hydration was not the problem
`locale-hydration.spec.ts` passed 5/5 (nl/en/pl/de survive hydration, correct
`<html lang>`, no raw-script warning). The single server locale snapshot →
LocaleProvider/html-lang/Clerk pipeline is intact. The onboarding failures are in
the spec, not in rendering.

## 2. Exact Flow A cause — **Case C** (+ latent Case B)
The spec filled the farm form but **did not submit it**, set the cookie to
`de-DE`, then `reload()`ed and expected the farm heading `"Ihr Betrieb"`.

- On reload the URL was bare `/onboarding` (no `?step=`) and the farm was never
  persisted, so `setupState` was still `no_farm` → the wizard **correctly**
  resolved to the **welcome** step (`"Willkommen bei FarmOS"`), not the farm step.
  So `"Ihr Betrieb"` was legitimately absent — the test asserted a step the
  wizard had rightly left, and the unsaved in-memory farm name was gone. (**C**)
- The expected German string itself is correct (`onboarding.farm.title` = "Ihr
  Betrieb"), so this was **not** a catalog mismatch (not D).
- Latent confound (**B**): `resetE2eUserFarmData` deleted the farm + children but
  **never deleted `UserLocalePreference`** (added after that harness). A stale DB
  preference from an earlier spec would, per the correct DB-over-cookie
  precedence, override the test's cookie — making the locale non-deterministic.

## 3. Exact Flow B cause — harness bug
`context.addCookies([{ name, value, url: '/' }])` — Playwright rejects a relative
URL with `TypeError: browserContext.addCookies: Invalid URL`. It threw before any
assertion ran. A cookie URL must be absolute.

## 4. DB-vs-cookie precedence (unchanged)
user DB preference → cookie → Accept-Language → nl-NL → en-GB message fallback.
The fix does **not** make the cookie override the DB. Authenticated tests now set
locale by **seeding the DB preference** (the authoritative source) + mirroring the
cookie — which *exercises* the precedence rather than fighting it.

## 5. E2E reset change (Part 2/8)
`resetE2eUserFarmData` now clears the user's `UserLocalePreference` on every reset
(even with no farm), user-scoped, behind the same E2E-DB safety guard. New
guarded, user-scoped helpers in `reset-user-data.ts`:
`resetE2eUserLocalePreference`, `setE2eUserLocalePreference`,
`getE2eUserLocalePreference`. Pure logic in `locale-preference-core.ts`
(unit-tested with a mock delegate to prove only the target user is touched).

## 6. Language-switch helpers (Parts 3/4)
- `setAnonymousLocaleCookie(context, baseURL, locale)` — builds a **valid absolute
  URL** from `baseURL` (`new URL('/', baseURL)`), never `url: '/'` (`cookie-url.ts`,
  unit-tested).
- `setLocaleThroughUi(page, locale)` — real switcher flow: select endonym → wait
  for `setUserLocale` + `router.refresh()` → assert `<html lang>` → assert pathname
  preserved. (For routes that render the switcher; onboarding has none, so its
  spec seeds the DB preference instead.)
- `loadTestMessages(locale)` — expected UI text comes from the real catalog, not a
  hardcoded phrase.

## 7. Current-step semantics
The rewritten Flow A **persists** the farm step (submits it), so the wizard
legitimately advances to **Season**; after switching to German it asserts the
German **Season** heading (`"Aktive Saison"`) with the route + `?step=season`
preserved — not `"Ihr Betrieb"`. Unsaved in-memory data is never called
"persisted".

## 8. Unit results
`src/i18n/__tests__/e2e-locale-harness.test.ts` — 6 tests: reset is user-scoped
(others untouched), write validates + rejects unsupported, missing-delegate no-op,
absolute cookie URL (rejects `/`), DB-over-cookie precedence, catalog-sourced
expected text. Full suite: **870 passed**. `tsc` 0, `npm run build` 0.

## 9–12. Flow A / Flow B / full onboarding spec / hydration results
**NOT executed in this environment** — Playwright needs a live server + Postgres +
Clerk pool, none available here. The harness + spec are fixed at the code level;
running the four focused commands (Part 11) is the developer's gate.

## 13. Remaining limitations
- Playwright specs were **not run** here → **no Onboarding E2E GO claim** yet.
- `prisma generate` could not run here (Windows EPERM); the E2E helpers use a
  defensive structural delegate so they compile/run regardless, but the E2E DB
  must have the `UserLocalePreference` table migrated for the reset/seed to have
  effect (it degrades to a no-op otherwise).
