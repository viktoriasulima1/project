# E2E Clerk User Quota Audit

Real root-cause analysis, not a guess — traced directly through `e2e/setup/create-test-users.ts` and every call site of the functions it exports, across the whole `e2e/` directory as it existed going into this sprint.

## The mechanism that caused the exhaustion

`ensureE2eUser(email)` is genuinely idempotent: it looks up the email via Clerk's Backend API first and only creates a new user if none exists. Reused across runs, it creates zero new users after the first.

`createThrowawayUser(label)` is **not** idempotent, by construction:

```ts
export async function createThrowawayUser(label: string): Promise<E2eUser> {
  const email = `e2e-${label}-${Date.now()}+clerk_test@example.com`;
  return ensureE2eUser(email);
}
```

`Date.now()` makes the email different on every single call, every single run. `ensureE2eUser`'s own idempotency check can never find a match, so it always creates a brand-new Clerk user. The function's own doc comment even says so directly: *"Not cleaned up afterward — disposable by design on a test-mode Clerk instance."* That assumption held for a handful of runs; it does not hold across a real iterative debugging session that re-runs the suite (or parts of it) many times in a row — which is exactly what happened during Sprint 18's validation-fix pass.

## How many Clerk users one full run creates

**Fixed, reused users (created once, never again):** 3 — `E2E_USER_A_EMAIL`, `E2E_USER_B_EMAIL`, `E2E_USER_C_EMAIL`, created via `ensureAllNamedE2eUsers()` in `global.setup.ts`. After the first successful run ever, these consume **zero** additional quota.

**Disposable, never-reused users created via `createThrowawayUser()`, per full run:**

| File | Call sites | Count |
|---|---|---|
| `failure-paths.spec.ts` | `'validation-fail'`, `'refresh-mid'`, `'back-forward'` | 3 |
| `founder-walkthrough.spec.ts` | `'founder-walkthrough'` | 1 |
| `sprint16-close-the-loops.spec.ts` | `'finance-golden-flow'`, `'insights-golden-flow'`, `'weather-failure-flow'` | 3 |
| `sprint18-ctgb-brp.spec.ts` (pre-consolidation, as originally written) | `'ctgb-flow-a'`, `'ctgb-unavailable-flow'`, `'brp-flow-b'`, `'brp-duplicate-flow'`, `'brp-no-results-flow'`, `'brp-unavailable-flow'` | 6 |
| **Total per full run (original)** | | **13** |

(`sprint18-ctgb-brp.spec.ts` was later consolidated from 6 down to 4 disposable-user call sites during the validation-fix pass, reducing the per-run total to 11 — matching exactly the "11 Playwright tests fail" figure reported at the start of this sprint. Consolidation alone was not enough: 11 new users per run still exhausts a 100-user quota within roughly 9 repeated runs, which is well within what a single debugging session produces.)

**Root cause, stated plainly:** this is a disposable-identity architecture applied to a finite, shared, non-expiring resource (a Clerk development instance's user table), re-run dozens of times over one extended session. Every fix-verify-rerun cycle during Sprint 18's own validation-fix pass added another 11 permanent, never-deleted Clerk users. Nothing in the application itself is at fault.

## Which tests create a unique (disposable) user vs. which can reuse a fixed one

Inspecting every call site's actual need (not just what it currently does):

| Test | Currently does | Actually needs |
|---|---|---|
| `golden-path.spec.ts` (onboarding-from-scratch) | Reuses fixed `userA` via storage state | A **reused, reset-to-empty** identity — already correct in spirit, just needs a data reset guarantee, not a new Clerk user |
| `failure-paths.spec.ts`'s 3 onboarding tests | `createThrowawayUser` each | A **reused, reset-to-empty** identity — same underlying need as golden-path, currently solved the expensive way |
| `founder-walkthrough.spec.ts` | `createThrowawayUser` once | Same — a reused, reset-to-empty identity |
| `sprint16-close-the-loops.spec.ts`'s 3 scenarios | `createThrowawayUser` + `seedReadyFarm` each | A **reused, freely-reseedable** farm identity distinct from the shared "stable" `userB` farm that many other specs depend on staying unchanged |
| `sprint18-ctgb-brp.spec.ts`'s 4 scenarios | `createThrowawayUser` + `seedReadyFarm` each | Same as above — a reused, freely-reseedable identity |
| `accessibility.spec.ts`, `mobile/critical-flow.spec.ts`, `isolation.spec.ts` (own-farm checks), `sprint16` golden flow 1 | Reuse fixed `userB` via storage state | Already correct — no change needed |
| `isolation.spec.ts` (cross-farm checks), `founder-walkthrough.spec.ts`'s final step | Reuse fixed `userC` / `E2E_USER_C_EMAIL` | Already correct — no change needed |

**No test in this suite structurally requires a Clerk identity that has never existed before.** `Farm.clerkUserId` is `@unique` (one Clerk user → at most one farm, ever), which is the only reason more than one identity is needed at all — but a *reused* identity with its farm data deleted and rebuilt satisfies every scenario above just as well as a brand-new one, at zero ongoing quota cost. The distinction that actually matters is **"stable, shared, must-not-be-mutated" (`userB`/`userC`) vs. "reused, freely reset-and-rebuilt before each test that touches it"** — not "brand new every time."

## Why users were never cleaned up

Because `createThrowawayUser`'s own design assumed disposal was free ("disposable by design on a test-mode Clerk instance") — true only in the sense that a throwaway user doesn't cost money, not in the sense that the *quota slot* it occupies is free or automatically reclaimed. Clerk's development-instance user cap (100) is a hard ceiling with no automatic expiry observed. Nothing in this codebase ever called Clerk's delete-user API for a throwaway account.

## Conclusion driving Part 2 onward

Replace all 11 `createThrowawayUser()` call sites with a **fixed pool of 4 reusable identities** (`E2E_USER_NEW`, `E2E_USER_READY`, `E2E_USER_OTHER`, `E2E_USER_PILOT`), each created **once** and reused forever, with **FarmOS-side data resets** (delete/reseed rows in `farmos_e2e`) standing in for what a brand-new Clerk user used to provide. This eliminates ongoing Clerk quota consumption entirely after the pool's one-time creation, without weakening any production authentication or farm-ownership check — the reset/reseed helpers operate only on the isolated E2E database, gated by the same safety pattern already established in `reset-db.ts`.
