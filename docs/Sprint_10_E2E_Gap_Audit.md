# Sprint 10 — E2E Gap Audit

**Method:** every row of `docs/Sprint_9_Manual_E2E_Checklist.md` checked against the actual current code, not assumption. Classified into four honest buckets:

- **Works (browser-verified)** — none. No browser tool exists in this environment, and no prior session recorded an actual browser run. Anything claiming this would be false.
- **Unit-test-covered** — the underlying server logic has an automated test proving it does the right thing, but the actual click-through has never been watched happen.
- **Code-review-only** — read the code, it looks correct, but nothing automated proves it and no test exists.
- **Not implemented / found a real gap** — the checklist's claim doesn't match the code.

---

## Per-step classification

| # | Step | Classification | Detail |
|---|---|---|---|
| 1 | Open `/` in incognito | **Gap found** | `src/app/page.tsx` is `redirect('/dashboard')` — there is no landing page. An anonymous visit to `/` chains: `/` → `/dashboard` (blocked, not a public route) → `/sign-in`. Net result is still "ends up at sign-in," but the checklist's claim "Landing page loads" is false. No landing page exists to load. |
| 2–3 | Clerk sign-up / email verification | **Code-review-only** | `ClerkProvider` mounts correctly when keys are valid (build output confirms). The actual hosted UI rendering and verification flow is entirely Clerk's, outside this codebase, and has never been watched run. |
| 4 | New user reaches `/dashboard`, sees `no_farm` state | **Unit-test-covered** | `farm-setup.test.ts` proves `getFarmSetupState()` returns `no_farm` correctly. `dashboard/page.tsx`'s branch on `setupState.state !== 'ready'` is code-review-verified, not rendered in a test. |
| 5 | Lands on Welcome step | **Code-review-only** | `stepFromSetupState('no_farm')` returns `'welcome'` — this function lives inside `OnboardingWizard.tsx` and is **not exported or unit tested**. Confirmed correct by reading the code; not proven by a test. |
| 6 | Farm creation advances the wizard | **Partially unit-tested** | `createFarm` action is fully tested (`onboarding.test.ts`). The client-side `useEffect` that watches `farmState.success` and calls `setStep('season')` is plain React state logic with no rendering test — never verified to actually fire. |
| 7 | Refresh mid-wizard resumes at the correct step | **Unit-test-covered** (server) / **code-review-only** (page wiring) | `getFarmSetupState()`'s state transitions are fully tested. That `onboarding/page.tsx` correctly threads `setupState.state` into `OnboardingWizard`'s initial step on a fresh server render is verified by reading the code, not by an integration test. |
| 8–13 | Season/field/crop/inventory/employee steps | **Unit-test-covered** (actions) / **code-review-only** (wizard advancement) | `createSeason`, `createField`, `addFieldToSeason`, `addOnboardingInventoryItem`, `addOnboardingEmployee` are all individually tested. The wizard's step-to-step client advancement (5 separate `useEffect` hooks) has zero test coverage — no rendering harness exists in this project. |
| 14 | "You're all set" screen | **Not tested at all** | Pure JSX, no logic to unit test, never rendered in a browser this conversation. |
| 15 | Dashboard shows real data post-onboarding | **Gap found: no test exists** | `getRealDashboardData()` (`src/lib/dashboard-data.ts`) — the function that assembles the entire ready-state dashboard — **has no test file**. Nothing automated proves it correctly maps Prisma results to `DashboardData`, handles nulls, or converts Decimals. This is the single largest untested piece of core logic in the app. |
| 16 | User menu displays correctly | **Not tested** | `UserMenu.tsx` has no test; Clerk's `useUser()` hook makes it impractical to unit test without a rendering harness. Code-review-only. |
| 17 | Log spray activity, insufficient-stock error scrolls into view | **Unit-test-covered** (validation/stock logic) / **not testable** (scroll behavior) | `createActivity`'s stock check, cross-farm rejection, and Zod validation are all tested. The `scrollIntoView` fix in `SprayDiaryDialog.tsx` is DOM behavior with no automated test possible without a real browser — added on a plausible diagnosis, never watched happen. |
| 18 | Inventory stock reduced by exact dose × area | **Unit-test-covered** | `activities.test.ts` verifies the atomic `$executeRaw` deduction logic against a mocked Prisma client. Never verified against a real Postgres row. |
| 19 | Dashboard reflects new activity without hard refresh | **Code-review-only** | `createActivity` calls `revalidatePath('/activities')` and `revalidatePath('/dashboard')`. That Next.js actually re-renders fresh data on client-side navigation after this is standard framework behavior, not independently tested. |
| 20 | Sign-out redirects to `/` | **Not tested** | Clerk's own `<UserButton>` + `afterSignOutUrl="/"` config. Never watched run. |
| 21 | Anonymous access to `/dashboard` redirects to `/sign-in` | **Partially covered** | The underlying "no session → no farm" logic is tested (`farm.test.ts`). The actual proxy-level redirect is Clerk's `auth.protect()`, outside this codebase, never watched run in a browser. |
| 22 | Sign back in loads the same farm | **Unit-test-covered** | `farm.test.ts`'s "resolves the seeded farm for the Clerk user it is linked to" test proves the lookup logic. Never watched happen across a real sign-out/sign-in cycle. |
| 23 | Second user sees no cross-contamination | **Unit-test-covered** | `farm.test.ts` and `farm-setup.test.ts` both have dedicated cross-user tests. Never verified with two real Clerk accounts in a browser. |
| 24 | Second user's protected routes redirect to onboarding | **Unit-test-covered** | `require-farm.test.ts` proves `requireFarm()` redirects on `null` farm. Never watched happen in a browser. |

---

## Headline findings

1. **No browser flow in this checklist has ever actually been run.** Every "Works" claim in any prior sprint report meant "the server-side logic is unit-tested and the code looks right on review" — not "a human watched this happen." This audit corrects that framing going forward: nothing here is marked as browser-verified, because nothing has been.
2. **Two real gaps, not just untested-but-fine code:**
   - `/` has no landing page — it's a redirect stub. Minor, but the checklist's claim about it was simply wrong.
   - `getRealDashboardData()` has zero test coverage despite being the function that assembles the entire post-onboarding dashboard. This is the most consequential gap — it's the first thing a new user sees after finishing setup, and nothing automated catches a regression in it.
3. **The wizard's client-side step advancement (5 `useEffect` hooks watching 5 different action states) has no test coverage anywhere**, and can't be given the current test setup (no React rendering harness in this project, noted as a limitation since Sprint 8).
4. **Anything involving Clerk's own hosted UI, sign-out redirect, or DOM behavior (scroll-into-view) is fundamentally unverifiable without a browser**, no matter how much more unit testing is added — these aren't gaps to close with more unit tests, they need an actual manual pass.

## What this sprint does about it

- Adds a test file for `dashboard-data.ts` (closing the largest real gap identified above) as part of the first-run dashboard work in Part 2.
- Does not attempt to build a marketing landing page — out of scope for this sprint, noted as a minor discrepancy rather than a blocker.
- Continues to rely on `docs/Sprint_9_Manual_E2E_Checklist.md` (updated this sprint, see Part 13 additions) as the only way to actually close the remaining gaps — no amount of additional unit testing substitutes for a real browser pass.
