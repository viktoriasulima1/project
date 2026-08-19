# Sprint 7 — Clerk-Farm Linking Fix & Decimal Crash

**Scope of this pass:** the concrete, narrower ask — verify and fix why the seeded farm isn't linked to the authenticated Clerk user, plus the blocking Decimal-serialization crash on the Fields page. The full onboarding wizard (`/onboarding` route, 8-step flow, empty states across all six modules, module access guards) from the original Sprint 7 brief was **not built in this pass** — see "Deferred" below.

## 1. Root cause

`Farm.clerkUserId` (a single `@unique` field — there is no separate membership table) is the entire ownership link. `prisma/seed.ts` created the dev farm with a hardcoded placeholder, `clerkUserId: 'dev_user_001'`. Any real, working Clerk session has its own real user ID, which never equals that placeholder. `getActiveFarm()`'s development fallback (`findFirst`, first farm in the DB) only triggers when Clerk returns **no session at all** — not when a real session's farm lookup comes up empty. So a fully signed-in developer, after seeding, still got `null` back and saw "No farm configured." Full detail in [docs/Sprint_7_Onboarding_Audit.md](Sprint_7_Onboarding_Audit.md).

## 2. Prisma/seed configuration

Installed version confirmed as exactly **5.22.0** — the `package.json` `"prisma": { "seed": "tsx prisma/seed.ts" }` block is the correct config for this version (the `prisma.config.ts` file-based approach is a later-version feature and doesn't apply here). This block is now in place, so `npx prisma db seed` works directly, and `npx prisma migrate dev` will auto-run the seed after applying migrations.

## 3. Seed rework — three iterations, each caught by testing against the real database

1. **First attempt:** keyed the dev farm by a fixed `id` and read `DEV_SEED_USER_ID` from the environment. Running it against the real dev database immediately hit a **unique constraint violation** — a farm already existed (from the old seed script) with the placeholder `clerkUserId` under a random UUID `id`, colliding with the new fixed-id create.
2. **Second attempt:** added a resolution chain checking `clerkUserId` (target, then default placeholder) before the fixed `id`. This fixed the immediate collision, but manual testing (relinking to a third arbitrary Clerk ID, then reverting) revealed it still **created a duplicate**: once the farm's `clerkUserId` no longer matched any of the three known lookup keys, it became invisible to future runs.
3. **Final fix:** anchor idempotency on the farm's **`name`** (`'Dev Farm Gelderland'`) instead of `clerkUserId` or `id` — the one value the seed fully owns and never changes. `clerkUserId` is *supposed* to change on every relink; anchoring on it was the actual bug. Verified against the real database: reseeded 4 times total, including two relinks to different Clerk IDs and a revert, and the farm's `id` never changed and no duplicate was created.

Two stray test-artifact farm rows created during this validation were cleaned up directly against the dev database (temporary script, deleted after use).

Clear console output added per the request: target Clerk user ID (and whether it came from `DEV_SEED_USER_ID` or the default placeholder), and whether the farm was created, reused, or relinked (with old → new values shown).

## 4. Decimal serialization crash (Fields page)

`src/app/(farm)/fields/page.tsx` passed raw Prisma `Field[]` results (with `hectares: Decimal`) directly into `FieldsListClient`, a `'use client'` component — Prisma's `Decimal` is a class instance and cannot cross the Server→Client Component boundary. Fixed by mapping `hectares` to a plain `number` in the page before passing down, and updating `FieldsListClient`'s prop type (`Omit<Field, 'hectares'> & { hectares: number }`) to match. A codebase-wide search confirmed this was the only occurrence of the pattern — every other page (activities, dashboard) already converts Decimal fields before crossing the boundary.

## 5. Development-only relinking option

Added `loadDemoFarm` (`src/lib/actions/dev-demo-farm.ts`), a server action guarded by `NODE_ENV === 'development'` that relinks the seeded dev farm to whichever Clerk user is currently signed in — for the common case where a developer seeds once but doesn't want to hand-copy their Clerk user ID into `DEV_SEED_USER_ID` every time their session changes. Wired into the dashboard's no-farm empty state via a new `LoadDemoFarmButton` client component, rendered only when `NODE_ENV === 'development'` (checked at the page level, in addition to the action's own server-side guard — defense in depth, never rendered or reachable in production). Also replaced the old plain-text "No farm found" message with a minimal title/description card, since it was trivial to include alongside the button.

## 6. Empty states

Only the dashboard's no-farm state was touched (title + description + dev-only button). The Fields/Activities/Inventory/Weather/Finance/Compliance contextual empty states from the original brief's Part 6 were **not built** — out of scope for this pass.

## 7. Tests added

`src/lib/__tests__/farm.test.ts` — 5 tests:
- seeded user resolves the seeded farm (matching `clerkUserId`)
- cross-user rejection — a different signed-in user gets `null`, not the seeded farm
- production never falls back to "first farm in the database," even with no session
- development fallback works, but only when there is genuinely no session
- the exact audit bug scenario: a real session with no matching farm returns `null` in development too — it must not silently fall back to the first farm

Full suite: **62/62 passing** (57 pre-existing + 5 new). `tsc --noEmit`: 0 errors.

## 8. Remaining risks / deferred work

- **The full onboarding wizard (`/onboarding`, 8 steps) does not exist.** A brand-new real Clerk user with no seeded/relinked farm still only sees the (now nicer) empty state with a dev-only demo button — there is no way for them to create their *own* farm through the UI yet.
- **Module access guards (Part 7 of the original brief) are not implemented.** Fields/Activities/etc. each independently call `getActiveFarm()` and show their own ad hoc "no farm" message; there's no shared redirect-to-onboarding behavior, and no season/FieldSeason-level guards.
- **`loadDemoFarm` requires the seed to have already been run once** (it `update`s by a fixed ID rather than creating from scratch) — if the farm doesn't exist yet, it returns a clear error telling the developer to run the seed first, rather than silently creating one.
- **The `name`-based idempotency anchor is a pragmatic dev-seed convention, not a schema-level guarantee** — `Farm.name` has no unique constraint, so it's a soundness argument specific to this seed script's own controlled usage, not enforced by the database itself.
- **Cross-user access rejection is verified at the `getActiveFarm()` level only.** No test yet exercises a full request/page render for a second Clerk user attempting to view another farm's Fields/Activities/etc. — only the underlying resolver function is tested.
