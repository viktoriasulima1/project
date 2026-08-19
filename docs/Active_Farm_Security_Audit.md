# Active Farm Resolution — Security Audit

**Trigger:** Prisma query logs showed `SELECT ... FROM farms WHERE 1=1 ORDER BY "createdAt" ASC LIMIT 1` appearing **twice** per dashboard request, raising the concern that the dashboard might be resolving "the first farm in the database" instead of the authenticated user's own farm.

**Verdict up front:** the query is real and confirms a genuine (now-fixed) bug — but not the one it first looks like. It is not silently substituting another user's farm for a signed-in user; the dev-only fallback path was structurally unreachable for any real session. The actual problems were (1) the fallback was too easy to trigger locally with no explicit opt-in, and (2) the dashboard and onboarding pages each called the farm resolver twice, which is what produced the duplicate log lines.

---

## 1. Files inspected

`src/lib/farm.ts` (`getActiveFarm`, `getActiveFarmOrThrow`, `getClerkUserId`), `src/lib/require-farm.ts` (`requireFarm`), `src/lib/farm-setup.ts` (`getFarmSetupState`), `src/lib/dashboard-data.ts`, `src/app/(farm)/dashboard/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/(farm)/layout.tsx`.

## 2. Why Prisma generates `WHERE 1=1`

Prisma builds a query's `WHERE` clause by ANDing together whatever filter conditions you pass in `where`. When there are **no conditions at all** — as in `db.farm.findFirst({ orderBy: { createdAt: 'asc' } })`, which has no `where` key — Prisma still needs a syntactically valid `WHERE` clause to attach the rest of the query to (ORDER BY, LIMIT), so it emits the tautology `WHERE 1=1` as the "no filter" base case. **This is normal, expected Prisma SQL generation, not a bug in itself.** Its presence is diagnostic, though: the only place in the codebase that calls `findFirst` on `farms` with zero `where` conditions is the development fallback branch in `getActiveFarm()`. Seeing it in the logs is direct proof that branch executed.

## 3. Why it executes at all, and why twice

`getActiveFarm()` (`src/lib/farm.ts`):

```ts
export async function getActiveFarm(): Promise<Farm | null> {
  const clerkUserId = await tryGetClerkUserId();
  if (clerkUserId) {
    return await db.farm.findUnique({ where: { clerkUserId } });   // real session → always this branch
  }
  if (process.env.NODE_ENV === 'development') {
    return await db.farm.findFirst({ orderBy: { createdAt: 'asc' } }); // only reached when there is NO session
  }
  return null;
}
```

The fallback branch is only reachable when `tryGetClerkUserId()` returns `null` — i.e. Clerk genuinely found no session for the request (misconfigured Clerk keys, middleware not applied to a route, or simply testing the app without being signed in locally). **Critically, a signed-in user whose farm lookup comes up empty never reaches this branch at all** — the `if (clerkUserId)` branch returns unconditionally, `null` included, before the fallback code is even considered. So the fallback was never capable of substituting another user's farm for a real, signed-in-but-farmless user. The audit confirms this structurally and via a passing test (`does not use the development fallback when a real session exists but its farm lookup misses`, pre-existing since Sprint 7).

**Why twice**, though, was a real bug: `src/app/(farm)/dashboard/page.tsx` called `getFarmSetupState()` (which internally calls `getActiveFarm()` once) and then called `getActiveFarm()` **again** directly afterward to get the farm object for `getRealDashboardData()`. `src/app/onboarding/page.tsx` had the identical pattern. In a request with no Clerk session (the scenario that was actually being tested locally when this was noticed), each of those two calls independently re-ran `tryGetClerkUserId()` and the fallback query — hence two identical `WHERE 1=1` lines per request.

## 4. Production behavior (verified)

- An authenticated Clerk user resolves their farm **only** via `db.farm.findUnique({ where: { clerkUserId } })` — never a table scan, never ordered-by-creation-date.
- If no farm matches that `clerkUserId`, `getActiveFarm()` returns `null` — `getFarmSetupState()` then reports `no_farm`/`nextRoute: '/onboarding'`, and `requireFarm()` redirects protected pages there.
- The fallback path requires `process.env.NODE_ENV === 'development'` — never true in a production deployment — so it's structurally unreachable in production regardless of any other condition.
- No code path returns another user's farm for a *different*, resolvable `clerkUserId`. `db.farm.clerkUserId` is `@unique`, so `findUnique` can only ever return the one row matching the caller's own id or `null`.

## 5. Development fallback — now hardened

Previously gated only by `NODE_ENV === 'development'`. That's a weaker guard than it looks: `NODE_ENV` can be unset or misconfigured in a deploy, and "convenient for local dev" is exactly the kind of thing that quietly survives into a place it shouldn't. Changed to require **both**:

```ts
if (process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_FARM_FALLBACK === 'true') {
  return await db.farm.findFirst({ orderBy: { createdAt: 'asc' } });
}
```

Documented in `.env.local.example` as opt-in and off by default, with the explicit recommendation to prefer the existing `loadDemoFarm` action (`src/lib/actions/dev-demo-farm.ts`, Sprint 8) instead — that action links the demo farm to your *actual* signed-in Clerk session, which is unambiguous, versus this fallback's "whichever farm happens to be oldest," which is not.

Confirmed by test: the fallback does not trigger in development with the flag unset, does not trigger with the flag set to anything other than the literal string `'true'`, and — most importantly — does not trigger for a real signed-in session even with the flag on (structural guarantee: the `if (clerkUserId)` branch returns first, unconditionally).

## 6. Duplicate query — fixed

`getFarmSetupState()` (`src/lib/farm-setup.ts`) now returns the resolved `Farm` object itself as a `farm` field, alongside the existing `farmId`/`activeSeasonId`. Both call sites (`dashboard/page.tsx`, `onboarding/page.tsx`) were updated to use `setupState.farm` instead of calling `getActiveFarm()` a second time. This removes one Clerk `auth()` call and one farm query per request on both pages — not just a performance nicety, but the direct fix for why the suspicious query appeared twice.

`requireFarm()` (used by Fields/Activities/Inventory/Finance/Weather/Compliance/AI) still calls `getActiveFarm()` once per page — that's one call per page render, not a duplicate within a single page, so it was left as-is.

## 7. Tests added

- `src/lib/__tests__/farm.test.ts` — 3 new/updated: fallback requires the explicit flag (not just `NODE_ENV`), fallback does not trigger with the flag set to a non-`'true'` value, fallback still does not trigger for a real session even with the flag on.
- `src/lib/__tests__/farm-setup.test.ts` — 2 new: `getFarmSetupState()` returns the resolved farm object (`getActiveFarm` called exactly once), and two different farms resolve to independent, non-cross-contaminating results (proxy for "two users cannot see each other's dashboard data" at the resolver level — see caveat below).

**Caveat:** "dashboard does not resolve farm twice" and "two users cannot see each other's dashboard data" are verified at the resolver-function level (unit tests on `getFarmSetupState`) and by code review of the two call sites (both now call `getActiveFarm()`/`getFarmSetupState()` exactly once), not by rendering the actual page components — no component-rendering test harness exists in this project yet (noted previously in `Sprint_8_Onboarding_Report.md`).

Full suite: **95/95 passing** (90 pre-existing + 5 new). `tsc --noEmit`: 0 errors.

## 8. Remaining risk

- `ALLOW_DEV_FARM_FALLBACK` is a new env var; if a `.env` file already sets `NODE_ENV=development` in some non-local environment (it shouldn't, but "shouldn't" is exactly the premise of this hardening), the fallback still requires deliberately also setting this flag — but nothing stops someone from setting both. The two-flag design raises the bar; it does not make misconfiguration impossible.
- No automated test renders `dashboard/page.tsx` or `onboarding/page.tsx` directly to confirm `getActiveFarm`/Clerk `auth()` is called exactly once at runtime — the fix is verified by code inspection (one call site each) plus the resolver-level unit tests, not an end-to-end request count assertion.
