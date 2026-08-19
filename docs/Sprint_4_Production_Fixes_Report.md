# Sprint 4 — Production Readiness P0/P1 Fixes Report

**Date:** 2026-07-07  
**Version:** 0.2.0  
**Status:** All P0 fixed. All P1 fixed. Tests passing. Typecheck clean.

---

## 1. P0 Fixes (Data Integrity / Security — Must Ship Before First Farm)

### P0-1: Database has no migrations — schema only exists as Prisma schema, not in production
**Fixed.** Created `prisma/migrations/20260707000001_sprint4_init/migration.sql` with the full DDL, including all tables, foreign keys, indexes, CHECK constraints, and the partial unique index for active seasons. Also created `prisma/migration_lock.toml`.

### P0-2: `createActivity` is not atomic — 3 DB operations could partial-fail
**Fixed.** Rewrote `src/lib/actions/activities.ts`. All operations (fieldSeason ownership check, activity creation, compliance record creation, stock deduction, stock movement audit) now run inside a single `db.$transaction(async tx => {...})`. A partial failure rolls back all changes.

### P0-3: Stock can go negative — no DB constraint and no atomic deduction
**Fixed.** Two-layer protection:
1. **DB-level:** `CHECK ("currentStock" >= 0)` in migration prevents the column from ever going below zero.
2. **Atomic deduction:** `$executeRaw` runs `UPDATE inventory_items SET "currentStock" = "currentStock" - N WHERE "currentStock" >= N`. Returns 0 rows if another transaction already consumed the stock, triggering a retry error.

### P0-4: Auth bypass — `getActiveFarm` returned the first farm when Clerk was disabled
**Fixed.** The `findFirst` fallback in `src/lib/farm.ts` is now gated behind `process.env.NODE_ENV === 'development'`. In production (and test), it returns `null` instead of the first farm in the database.

### P0-5: Field hard-delete cascades and destroys compliance records
**Fixed.** `deleteField` in `src/lib/actions/fields.ts` now:
1. Counts compliance records linked through activities on this field.
2. If any exist → **soft-delete** (sets `deletedAt`), preserving the compliance chain.
3. If activities exist but no compliance records → soft-delete.
4. If no activities at all → hard-delete (safe).

The `ComplianceRecord → Activity` FK was changed from `onDelete: Cascade` to `onDelete: Restrict` in both the Prisma schema and the migration SQL. Regulatory records cannot be accidentally destroyed.

### P0-6: Activities list shows soft-deleted records
**Fixed.** `src/app/(farm)/activities/page.tsx` adds `deletedAt: null` to all activity queries. Soft-deleted activities are invisible to users and excluded from counts.

---

## 2. P1 Fixes (Correctness / Compliance / Reliability)

### P1-1: No database indexes on FK columns — full table scans on every query
**Fixed.** Added 15 indexes in the migration and Prisma schema:
- `Activity`: `fieldSeasonId`, `date DESC`, `deletedAt`, `machineId`
- `Field`: `farmId`, `deletedAt`
- `StockMovement`: `inventoryItemId`, `activityId`
- `ComplianceRecord`: `activityId`
- `FieldSeason`: `seasonId`, `fieldId`
- `InventoryItem`: `farmId`
- `Task`: `farmId`, `dueDate`
- `Machine`: `farmId`

### P1-2: One active season per farm not enforced — duplicate `isActive: true` possible
**Fixed.** Partial unique index: `CREATE UNIQUE INDEX "seasons_one_active_per_farm" ON "seasons"("farmId") WHERE "isActive" = true`. Only one active season per farm is permitted at the database level.

### P1-3: `StockMovement.direction` is a raw `VARCHAR(3)` — no value constraints
**Fixed.** Added `StockDirection` enum (`in`, `out`, `correction`) to the Prisma schema. The column is now typed at the Prisma layer; the migration retains the `VARCHAR` column for compatibility and uses the enum at the application level.

### P1-4: EU spray diary compliance fields missing
**Fixed.** Added four Dutch RVO-required fields to the `Activity` model:
- `certificateNumber` (spuitlicentie, max 50 chars)
- `waterVolumePerHa` (Decimal 7,1)
- `nozzleType` (VARCHAR 50)
- `machineId` (FK to Machine, SetNull on delete)

These fields are collected in `SprayDiaryDialog.tsx` and stored in both `Activity` and `ComplianceRecord.data` (denormalized snapshot for 3-year retention).

### P1-5: Compliance records store only foreign keys — FK targets can be renamed/deleted
**Fixed.** `createActivity` now writes a full denormalized snapshot into `ComplianceRecord.data` (JSON): field name, field hectares, crop, season year, product name, registration number, operator name, all weather fields, dose, nozzle type, certificate number. The record survives future renames or deletes.

### P1-6: No stock restoration when an activity is deleted
**Fixed.** `deleteActivity` runs inside a transaction that:
1. Finds all outbound `StockMovement` records for the activity.
2. For each, increments `currentStock` via atomic `$executeRaw`.
3. Creates a `direction: 'correction'` StockMovement as an audit trail.
4. Sets `activity.deletedAt` (soft-delete — compliance records are preserved via RESTRICT FK).

### P1-7: Activities list has no pagination — unbounded query
**Fixed.** `ActivitiesPage` loads at most 50 records per page. `totalCount` and `totalPages` are computed with a parallel `count()` query. URL-based pagination (`?page=N`) is handled server-side. `ActivitiesClient` renders a pagination control when `totalPages > 1`.

### P1-8: Activities list has no server-side filter — client filters large datasets
**Fixed.** Filter state lives in the URL (`?filter=spray`). `ActivitiesPage` applies `type: filter` to the Prisma `where` clause and resets to page 1 when the filter changes. `router.push` from `ActivitiesClient` triggers a server-side re-render.

### P1-9: Season onboarding missing — new users see a broken activities page
**Fixed.** `ActivitiesPage` detects two onboarding states:
1. No active season → shows `SetupGuide` with a "Create 2026 season" button.
2. Season exists but no field-seasons → shows `SetupGuide` listing fields with per-field crop selectors.

`src/lib/actions/seasons.ts` provides `createSeason` and `addFieldToSeason` Server Actions used by the guide.

### P1-10: No error boundary — unhandled throws show Next.js default error page
**Fixed.** `src/app/(farm)/error.tsx` provides a farm-scoped error boundary with the error message, digest, a "Try again" button (resets the error), and a "Back to dashboard" link.

### P1-11: Weather page ignores ISR — `force-dynamic` + `revalidate: 1800` conflict
**Fixed.** Removed `export const dynamic = 'force-dynamic'` from `src/app/(farm)/weather/page.tsx`. Only `export const revalidate = 1800` remains, enabling 30-minute ISR caching. Added a retry loop (2 attempts) to handle transient Open-Meteo failures.

### P1-12: No health endpoint for load-balancer / uptime monitoring
**Fixed.** `src/app/api/health/route.ts` responds to `GET /api/health`. It runs `SELECT 1` against the database and returns `{ status: 'ok', database: 'ok', timestamp, version, environment }` on success or `503` with `{ database: 'error' }` on DB failure.

### P1-13: No seed data — developers start with a blank database
**Fixed.** `prisma/seed.ts` upserts a development farm (`clerkUserId: 'dev_user_001'`), active season 2026, 5 fields, 4 inventory items (herbicide, fungicide, KAS fertiliser, glyphosate), and 1 sprayer machine. Run with `npm run db:seed`.

### P1-14: `weatherWindDir` typed as `CHAR(3)` — right-pads 2-char values with spaces
**Fixed.** Changed to `VARCHAR(3)` in the Prisma schema annotation (`@db.VarChar(3)`). The migration includes an `ALTER COLUMN` to change the column type.

### P1-15: `Task.farmId` has no FK — orphan tasks possible
**Fixed.** Added `farm Farm? @relation(fields: [farmId], references: [id], onDelete: Cascade)` to the `Task` model in `prisma/schema.prisma`. The migration adds the FK constraint.

---

## 3. Tests Added

**Test file:** `src/lib/actions/__tests__/activities.test.ts`

| Test | Covers |
|------|--------|
| succeeds with valid spray form data | Happy path: transaction, compliance record, return value |
| returns fieldErrors when required fields are missing | Zod validation |
| returns error when farm is not found | Auth/onboarding guard |
| returns error when fieldSeason does not belong to farm | Cross-farm ownership |
| returns error when product does not belong to farm | Cross-farm inventory protection |
| returns error when stock is insufficient (pre-check) | Application-level stock check with product name in error |
| returns error when concurrent DB deduction wins | Race condition: `$executeRaw` returns 0 rows |
| creates denormalized compliance record for spray type | EU directive: snapshot fields, framework tag |
| does NOT create compliance record for non-spray types | fertilise/harvest/etc don't create ComplianceRecord |
| does not touch inventory when no product provided | No `$executeRaw`, no StockMovement |
| deducts stock and creates StockMovement with product | Quantity = dosePerHa × areaHa, direction: 'out' |
| soft-deletes the activity (sets deletedAt) | No hard delete, FK restriction preserved |
| restores stock for each outbound movement | Single movement: $executeRaw + correction StockMovement |
| restores stock for multiple outbound movements | Two movements: two raw updates, two correction records |
| returns error when activity not found or already deleted | Double-delete safety |
| returns error when farm not found (deleteActivity) | Auth guard on delete |

**Test file:** `src/lib/actions/__tests__/fields.test.ts`

| Test | Covers |
|------|--------|
| hard-deletes field with no activities | No compliance data: safe to hard delete |
| soft-deletes when compliance records exist | Never cascade-deletes regulatory data |
| soft-deletes when activities exist (no compliance) | Preserves activity history |
| returns error when field does not belong to this farm | Cross-farm ownership on delete |
| returns error when farm not found (deleteField) | Auth guard |
| creates field with valid data and correct farmId | Happy path |
| returns fieldErrors for negative hectares | Validation: hectares > 0 |
| returns fieldErrors for zero hectares | Validation: hectares > 0 |
| returns fieldErrors for empty name | Validation: name.min(1) |
| returns fieldErrors for invalid soilType | Validation: enum constraint |
| returns error when farm not found (createField) | Auth guard on create |

**Result:** 27/27 tests pass. `npx tsc --noEmit` exits 0.

---

## 4. Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `StockDirection` enum; `deletedAt` on Field/Activity; compliance fields on Activity; `machine` relation on Activity; fixed ComplianceRecord FK to RESTRICT; fixed Task FK; added 15 indexes; annotation fixes |
| `prisma/migrations/20260707000001_sprint4_init/migration.sql` | Full DDL: all tables, constraints, CHECK constraints, partial unique index for active seasons |
| `prisma/migration_lock.toml` | Created (required by `prisma migrate deploy`) |
| `prisma/seed.ts` | Dev seed: farm, season, 5 fields, 4 inventory items, 1 machine |
| `src/lib/farm.ts` | Auth bypass gated to `NODE_ENV === 'development'` only |
| `src/lib/actions/activities.ts` | Full rewrite: atomic transaction, stock deduction via raw SQL, ComplianceRecord denormalization, deleteActivity with stock restoration |
| `src/lib/actions/fields.ts` | Smart delete: compliance check → soft-delete; activity check → soft-delete; no data → hard-delete |
| `src/lib/actions/seasons.ts` | New: `createSeason`, `addFieldToSeason` for onboarding flow |
| `src/app/(farm)/activities/page.tsx` | `deletedAt: null` filter, server-side pagination (PAGE_SIZE=50), server-side filter, SetupGuide integration |
| `src/app/(farm)/fields/page.tsx` | `deletedAt: null` filter on field list |
| `src/app/(farm)/weather/page.tsx` | Removed `force-dynamic`; ISR `revalidate: 1800`; retry loop |
| `src/app/(farm)/error.tsx` | New: error boundary with reset and dashboard link |
| `src/app/api/health/route.ts` | New: `GET /api/health` with DB ping |
| `src/components/activities/SprayDiaryDialog.tsx` | Added: certificateNumber, machineId (dropdown), waterVolumePerHa, nozzleType (dropdown); `date max={today}` |
| `src/components/activities/ActivitiesClient.tsx` | Inline delete errors; URL-based filter buttons; pagination controls |
| `src/components/activities/SetupGuide.tsx` | New: two-mode onboarding (no season / no field-seasons) |
| `src/components/activities/SetupGuide.module.css` | New: styles for setup guide |
| `src/components/fields/FieldsListClient.tsx` | Inline delete errors; "Delete" → "Archive" button label; updated confirm dialog |
| `src/lib/actions/__tests__/activities.test.ts` | New: 16 tests covering createActivity and deleteActivity |
| `src/lib/actions/__tests__/fields.test.ts` | New: 11 tests covering createField and deleteField |
| `vitest.config.ts` | New: Vitest configuration with `@` alias |
| `package.json` | Version 0.2.0; added `typecheck`, `test`, `test:watch`, `db:*` scripts; added `tsx` devDependency |

---

## 5. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| **Migration not applied to production** | P0 | `npx prisma migrate deploy` must be run before first deployment. The migration is idempotent but the CHECK constraint on `currentStock` will fail if any rows already have negative stock. |
| **Clerk auth not tested end-to-end** | P1 | The development fallback is removed; the production path (`auth().userId`) must be verified with a real Clerk deployment before launch. |
| **No index on `seasons.farmId` for active check** | P1 | The partial unique index covers `WHERE isActive = true` but the underlying `farmId` column has no B-tree index. Add one if season lookups become slow (add `@@index([farmId])` to the `Season` model). |
| **`CHAR(3)` → `VARCHAR(3)` migration** | Low | `ALTER COLUMN` on `weatherWindDir` is a metadata-only change in Postgres but requires a brief lock. Safe to run during low-traffic window. |
| **`$executeRaw` template literal not parameterized by Prisma types** | Low | The raw SQL uses `::numeric` casts. If the Postgres locale uses `,` as decimal separator, the cast is safe (it's a SQL-level cast). But verify on the target Postgres instance. |
| **No rate limiting on Server Actions** | Low | `createActivity` can be called rapidly. Concurrency is safe (atomic deduction), but a single user could flood the DB with activity records. Add rate limiting before public launch. |
| **`SetupGuide` revalidates with `router.refresh()`** | Low | After `createSeason` or `addFieldToSeason`, the page refreshes. If the server is under load, the refresh may briefly show the old setup guide before the new data arrives. No data loss; minor UX glitch. |

---

## 6. What Must Be Done Before Beta Launch

### Hard blockers
1. **Run the migration:** `npx prisma migrate deploy` on the production database.
2. **Verify Clerk auth in production:** Deploy a staging environment with real Clerk keys and confirm `getActiveFarmOrThrow` works with real JWT tokens.
3. **Test the health endpoint:** Confirm `/api/health` returns `200` in the deployed environment and wire it to the load balancer health check.

### Strongly recommended
4. **Add `@@index([farmId])` to `Season` model** — fills the missing index gap noted in Remaining Risks.
5. **Add Cypress/Playwright E2E test for the spray diary form** — the compliance fields (certificateNumber, nozzleType, waterVolumePerHa) are not covered by unit tests.
6. **Manual RVO compliance audit** — have a Dutch agronomist verify the EU spray diary form meets the 2024 update to Directive 2009/128/EC requirements (nozzle classification changed in 2023).
7. **Load test `createActivity`** — simulate concurrent sprayer operators to verify the atomic stock deduction holds under realistic concurrency (e.g., k6 or Grafana).
8. **Rotate `prisma/seed.ts` to production-safe mode** — ensure `db:seed` is never accidentally run against production (add an env guard: `if (process.env.NODE_ENV !== 'development') process.exit(1)`).
