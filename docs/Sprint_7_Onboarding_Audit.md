# Sprint 7 — Onboarding / Clerk-Farm Linking Audit

**Scope of this pass:** verifying why the seeded farm is not visible to the currently authenticated Clerk user, and fixing the concrete Decimal-serialization crash on the Fields page. The full onboarding wizard, empty-state redesign, and module access guards from the original Sprint 7 brief are **out of scope for this pass** — see the report's "deferred" section.

---

## 1. The exact model that links Clerk users to farms

There is **no separate membership/ownership table**. `Farm.clerkUserId` (`prisma/schema.prisma:130`) is a single `@unique` string field — the farm *is* the ownership record. One Clerk user maps to at most one farm, directly:

```prisma
model Farm {
  id            String   @id @default(uuid())
  clerkUserId   String   @unique
  ...
}
```

Any future multi-user-per-farm requirement (a `FarmMember` join table, as the original brief's Part 4 assumed might exist) would be new schema — it does not exist today.

## 2. How the active farm is resolved (`src/lib/farm.ts`)

```ts
export async function getActiveFarm(): Promise<Farm | null> {
  const clerkUserId = await tryGetClerkUserId();

  try {
    if (clerkUserId) {
      return await db.farm.findUnique({ where: { clerkUserId } });
    }
    // Dev-only fallback: never enabled in production.
    if (process.env.NODE_ENV === 'development') {
      return await db.farm.findFirst({ orderBy: { createdAt: 'asc' } });
    }
    return null;
  } catch {
    return null;
  }
}
```

This is used directly by `getActiveFarm()`/`getActiveFarmOrThrow()` and by every page (`fields`, `activities`, `dashboard` via `dashboard-data.ts`, etc.) as the single source of truth for "which farm am I looking at."

**Critical detail:** the development fallback (`findFirst`, ordered by `createdAt`) only fires when `clerkUserId` itself is falsy — i.e. Clerk auth failed or returned no session. **It does not fire when a real session exists but the lookup by that real ID finds nothing.** This is the root cause below.

## 3. Does `prisma/seed.ts` create the ownership record?

Yes — but with a hardcoded placeholder that will not match a real session:

```ts
const farm = await db.farm.upsert({
  where: { clerkUserId: 'dev_user_001' },
  update: {},
  create: { clerkUserId: 'dev_user_001', name: 'Dev Farm Gelderland', ... },
});
```

## 4. Root cause of "seeded but still shows No farm configured"

1. Developer runs `npx prisma db seed` → a farm is created with `clerkUserId: 'dev_user_001'`.
2. Developer opens the app **while actually signed in via a real Clerk session** (Clerk is configured and working, not bypassed).
3. `tryGetClerkUserId()` returns the real Clerk user ID (e.g. `user_2abc...`), which is truthy.
4. `getActiveFarm()` takes the `if (clerkUserId)` branch: `db.farm.findUnique({ where: { clerkUserId: 'user_2abc...' } })` — this returns `null`, because the only farm in the database has `clerkUserId: 'dev_user_001'`, not the real ID.
5. Because `clerkUserId` was truthy, the dev-fallback branch (`findFirst`) is **never reached** — that branch is gated on "no session," not "session's farm not found."
6. Result: `getActiveFarm()` returns `null` → "No farm configured" / "No farm found. Complete onboarding to get started." — even though a farm row exists in the database.

This is a **linking gap, not a query bug**: the seed and the real session are simply keyed by two different, unrelated identifiers, and nothing in the codebase reconciles them.

## 5. Existing seed files / package.json Prisma seed configuration

- `prisma/seed.ts` existed and ran successfully in isolation (confirmed by the reported seed output: farm, season, 5 fields, 4 inventory items, 1 machine).
- **`package.json` had no `"prisma": { "seed": ... }` block.** The installed Prisma version is exactly **5.22.0** (`node_modules/prisma/package.json`), which requires the `package.json`-based seed config — the `prisma.config.ts` file-based approach is a later-version feature and does not apply here. Without this block, `npx prisma db seed` (as opposed to the existing `npm run db:seed` script) would fail to locate the seed command, and `npx prisma migrate dev` would not auto-run the seed after applying migrations.

## 6. The Decimal serialization crash (fields page)

Unrelated to Clerk linking, but blocking any further manual verification: `src/app/(farm)/fields/page.tsx` passed the raw Prisma `Field[]` result (with `hectares: Decimal`) directly into `FieldsListClient`, a `'use client'` component. Prisma's `Decimal` is a class instance, not a plain object, and cannot cross the Server → Client Component serialization boundary — Next.js throws at render time. Confirmed (via a targeted codebase search) to be the only occurrence of this bug pattern; every other page already converts Decimal fields to plain numbers before passing to a client component.

## 7. Fix approach taken (see the Sprint 7 report for full detail)

- Convert `hectares` to a plain number in `fields/page.tsx` before passing to `FieldsListClient` (and update its prop type accordingly).
- Add the `package.json` `"prisma": { "seed": "tsx prisma/seed.ts" }` block.
- Rework `prisma/seed.ts` to key the dev farm by a **stable fixed `id`** (not by `clerkUserId`), reading the target Clerk user ID from `DEV_SEED_USER_ID` (falling back to the old placeholder) and always reconciling `clerkUserId` to that value on every run — so the farm is never duplicated even if the target ID changes between seed runs.
- Add a development-only `loadDemoFarm` server action that relinks the same fixed dev farm to whichever Clerk user is *currently signed in*, for the common case where a developer seeds once but doesn't know (or want to hardcode) their own Clerk user ID in advance.
- Add tests asserting: a session matching the farm's `clerkUserId` resolves it, a session with a different ID does not, and production never falls back to "first farm in the database."
