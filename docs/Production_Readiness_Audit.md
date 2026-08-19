# Production Readiness Audit
**FarmOS — 100 Dutch Farms Launch Review**

**Date:** 2026-07-07  
**Auditor roles:** CTO · Staff Engineer · Principal Architect · Senior QA Lead · Database Architect · Security Engineer · Product Architect  
**Scope:** Complete codebase review against production deployment of 100 farms, 500 fields, 40 workers, 5,000 activities

---

## SECTION 1 — Database Integrity

### 1.1 Race Conditions

**RC-1 — Activity creation is non-atomic across three operations**
`src/lib/actions/activities.ts` lines 58–117 execute three separate database operations in sequence:
1. `db.activity.create()` — inserts the activity record
2. `db.complianceRecord.create()` — inserts the EU diary record  
3. `db.$transaction([inventoryItem.update, stockMovement.create])` — deducts stock

If operation 2 fails (DB error, constraint violation), the Activity exists but has no ComplianceRecord. The spray happened in the system with no regulatory trail. If operation 3 fails, the Activity and ComplianceRecord both exist but inventory was not deducted — the farm's stock book is now wrong. The `$transaction` only wraps the last two calls; the first `create()` is outside it.

**Fix required:** Wrap all three operations in a single `db.$transaction(async (tx) => { ... })`.

**RC-2 — Concurrent spray submissions can double-deduct stock**
Two workers submit spray forms simultaneously for the same product. Both read `currentStock = 20L`. Both compute `totalUsed = 10L`. Both run `decrement: 10`. Final stock: `0L` (correct). But if `currentStock = 15L` and both submit `totalUsed = 10L`, the check (if added) would pass for both individually because neither sees the other's write. Final stock: `-5L`. This is a classic TOCTOU (Time-of-Check-Time-of-Use) race.

**Fix required:** Use a database-level check constraint `currentStock >= 0` AND `SELECT FOR UPDATE` within the transaction to lock the row before decrementing.

**RC-3 — Duplicate season creation**
No application guard prevents two concurrent requests from creating two `Season` records with the same `year` for the same farm. The `@@unique([farmId, year])` constraint will catch this at the database level, but the error propagates as an uncaught Prisma exception to the user.

### 1.2 Orphan Records

**OR-1 — Task records have no enforced farm relationship**
`prisma/schema.prisma` lines 274–291: `Task.farmId` is `String?` with no `@relation` defined. Tasks can exist with a `farmId` that references a non-existent farm. `db.task.findMany({ where: { farmId: farm.id } })` will miss tasks where `farmId` is null. Any query filtering by farm will silently exclude them.

**OR-2 — ComplianceRecord survives Activity soft-delete**
When `deleteActivity` soft-deletes an activity, the `ComplianceRecord` remains with `activityId` pointing to an activity that is logically removed. The compliance record is now orphaned from the farm's operational perspective — it exists but the activity it documents is "deleted". No query currently surfaces this discrepancy.

**OR-3 — FieldSeason records when a Season is deactivated**
When `isActive` is set to `false` on a `Season`, all associated `FieldSeason` records remain. There is no cascading status update and no application logic handling this transition. A FieldSeason for an inactive season will still appear in the field dropdown of the spray form (because `activeSeason` is the only filter in `activities/page.tsx` and if `activeSeason` is null, the list is empty — but if it's set to inactive without proper cleanup, the dropdown may show stale data).

**OR-4 — StockMovement without activityId**
`StockMovement.activityId` is optional. If a stock correction is made outside of an activity (e.g. manual adjustment — which has no UI yet), the movement exists with no activity link. There is no `MovementType` enum and no way to distinguish a correction from a usage. The `direction` field is a raw `VarChar(3)` with values `'out'` hardcoded in one place and nothing else.

### 1.3 Invalid States

**IS-1 — Multiple active seasons per farm**
`Season` has `isActive Boolean @default(false)`. Nothing prevents two seasons from having `isActive = true` simultaneously for the same farm. The `activities/page.tsx` uses `db.season.findFirst({ where: { farmId, isActive: true } })` — it will silently return whichever Prisma returns first, and the other active season's fields will be invisible.

**Fix required:** Add a partial unique index: `@@unique([farmId, isActive])` filtered for `isActive = true`, or use a database trigger. In PostgreSQL this is: `CREATE UNIQUE INDEX seasons_one_active_per_farm ON seasons (farm_id) WHERE is_active = true;` — not expressible in Prisma schema directly, requires a raw migration.

**IS-2 — Stock can go negative**
`InventoryItem.currentStock` is `Decimal @db.Decimal(10, 3)` with no lower bound constraint. `decrement` in Prisma translates directly to `UPDATE SET currentStock = currentStock - X` with no WHERE clause protecting against negative values. PostgreSQL will happily store `-480.000`.

**IS-3 — NDVI score has no range constraint**
`Field.ndviScore Int? @db.SmallInt` — SmallInt can hold -32768 to 32767. An NDVI score outside 0–100 is agronomically meaningless. An external API or manual entry could write `ndviScore = 5000` and it would persist.

**IS-4 — Activity date in the future**
`Activity.date` has no validation against future dates in the Zod schema (`z.string().date()`). A farmer could accidentally log a spray activity for next year and it would be accepted. Future-dated compliance records could confuse regulatory audits.

**IS-5 — weatherWindDir inconsistency**
`Activity.weatherWindDir` is `@db.Char(3)` but valid values include 4-character directions (`'NONE'`... actually none are 4-char, but `'NNE'`, `'ENE'` are 3 chars). The Zod schema validates `max(3)` — correct. But the SprayDiaryDialog renders 16 direction options including `'NNE'`, `'ENE'` etc. which are 3 chars. The `Char(3)` will right-pad with spaces in some PostgreSQL configurations, causing string comparison mismatches.

### 1.4 Transaction Problems

**TP-1 — Three-step mutation is not atomic** (see RC-1 above)

**TP-2 — `deleteActivity` does not reverse stock in any transaction**
Soft-deleting an activity and creating a compensating StockMovement are currently two separate operations (and the compensating movement is not implemented at all). If the soft-delete succeeds and the compensating movement fails, inventory is permanently undercounted.

**TP-3 — `db.$transaction([...])` uses interactive transaction syntax incorrectly for concurrent load**
The interactive transaction form `db.$transaction(async (tx) => { ... })` holds a database connection open for its entire duration. Under 100 farms with concurrent submissions, this will exhaust the connection pool. The batch transaction `db.$transaction([...])` (array form) used in activities.ts is slightly better but still holds a connection during round trips.

### 1.5 Cascading Problems

**CP-1 — Field hard delete cascades to ComplianceRecord**
Delete path: `Field → FieldSeason (Cascade) → Activity (Cascade) → ComplianceRecord (Cascade)`. A single `deleteField` call permanently destroys all EU spray diary records for that field. EU Directive 2009/128/EC requires records to be kept for **at least 3 years**. Hard-deleting a field is a compliance violation.

The `deleteField` action (`fields.ts` line 76) does:
```ts
await db.field.delete({ where: { id } });
```
One line. No check for existing activities. No warning. Immediate cascade.

**CP-2 — InventoryItem deletion leaves Activity.productId dangling**
`Activity.productId` is an optional FK to `InventoryItem`. There is no `onDelete` clause defined, meaning Prisma defaults to `RESTRICT` — the inventory item cannot be deleted if activities reference it. This is correct behaviour, but the error surfaces as an uncaught Prisma exception with no user-facing error message.

**CP-3 — Season deletion cascades through FieldSeason to Activities**
`Season → FieldSeason (Cascade) → Activity (Cascade)`. Deleting a season destroys all activities and compliance records for all fields in that season. There is no season deletion UI yet, but when it is added, this cascade must be blocked.

### 1.6 Inventory Corruption

**IC-1 — No stock sufficiency check before deduction**
Verified in `activities.ts` line 103: `data: { currentStock: { decrement: totalUsed } }`. No pre-check. Stock goes negative.

**IC-2 — Stock deduction uses application-computed quantity**
`totalUsed = Number(d.dosePerHa) * Number(d.areaHa)`. Both values come from user input, not from verified field measurements. A user typing `dosePerHa = 99999` and `areaHa = 9999` computes `totalUsed = 999,890,001` which decrements stock to an absurdly negative number.

**IC-3 — No maximum dose validation**
The Zod schema for `dosePerHa` has no maximum. Real-world application rates rarely exceed 10 L/ha for liquid products or 500 kg/ha for fertiliser. No domain limit is enforced.

**IC-4 — Soft-deleted activity does not restore stock**
Confirmed: `deleteActivity` (lines 124–143) soft-deletes with `data: { deletedAt: new Date() }` and makes no StockMovement correction. Net effect: stock is permanently understated for every removed activity.

**IC-5 — No inventory item validation against farm ownership during deduction**
`db.inventoryItem.update({ where: { id: d.productId }, data: { currentStock: { decrement: totalUsed } } })` — the `where` clause contains only `id`. The product could belong to any farm. A crafted form submission with a known product UUID from another farm would decrement that farm's stock.

### 1.7 Duplicated Data

**DD-1 — ComplianceRecord.data duplicates Activity fields**
The JSON in `ComplianceRecord.data` re-stores `fieldSeasonId`, `date`, `operatorName`, `areaHa`, `productId`, etc. — all of which are already in the `Activity` record. But it stores `fieldSeasonId`, not the resolved `fieldName` or `cropName`. If the field is renamed after the spray, the ComplianceRecord shows an ID, not a human-readable name. A compliance audit requiring a printable diary would need to JOIN back to the original tables — which may have changed.

**DD-2 — `src/types/farm.ts` duplicates Prisma types**
The TypeScript types in `src/types/farm.ts` are hand-maintained duplicates of the Prisma-generated types. `CropName` in `farm.ts` includes `'corn'`, `'rapeseed'`, `'rye'`, `'oat'` — none of which exist in the Prisma schema `CropName` enum (which has `oilseed_rape`, `cover_crop`, `grass`). These types will diverge over time and create silent bugs when mock data types are used where Prisma types are expected.

**DD-3 — `InventoryCategory` mismatch**
`src/types/farm.ts` defines `InventoryCategory` including `'fertilizer'` (American spelling). Prisma schema defines `InventoryCategory` with `fertiliser` (British spelling). The mock data uses `'fertilizer'`. Dashboard components use the mock-data type. When real Prisma data is wired up, the category label lookup will silently fail for fertiliser items.

### 1.8 Missing Constraints

**MC-1 — No CHECK constraint on `currentStock >= 0`**
**MC-2 — No CHECK constraint on `ndviScore BETWEEN 0 AND 100`**
**MC-3 — No CHECK constraint on `weatherWindKmh >= 0`**
**MC-4 — No CHECK constraint on `weatherHumidity BETWEEN 0 AND 100`**
**MC-5 — No CHECK constraint on `hectares > 0`**
**MC-6 — No CHECK constraint on `areaHa > 0`**
**MC-7 — No CHECK constraint on `dosePerHa > 0` when provided**
**MC-8 — No partial unique index enforcing one active season per farm**
**MC-9 — No index on `Activity.fieldSeasonId`** (FK, no index = full table scan on join)
**MC-10 — No index on `Activity.date`** (most common query filter)
**MC-11 — No index on `FieldSeason.seasonId`**
**MC-12 — No index on `Field.farmId`**
**MC-13 — No index on `InventoryItem.farmId`**
**MC-14 — No index on `Task.farmId`**
**MC-15 — No index on `ComplianceItem.farmId`**

PostgreSQL adds indexes for primary keys and unique constraints automatically, but **no foreign key indexes exist**. Every JOIN traversal is a sequential scan. At 5,000 activities across 100 farms, every query to the activities page performs a full table scan on `field_seasons`, `fields`, and `farms`.

---

## SECTION 2 — Business Logic

### 2.1 Negative Inventory Scenario

**Sequence:** Farm A has 18L of Amistar. Worker logs spray of 10 ha × 2 L/ha = 20L. System deducts 20L. Stock = -2L. No error shown. Inventory dashboard now shows -2L. Agronomist calls: "Do we have enough Amistar for the remaining 8 ha?" System says: "-2L". Farmer orders 22L. Over-orders by 20L. Wastes €640.

### 2.2 Deleted Activity + No Stock Restoration

**Sequence:** Worker logs wrong field. Soft-deletes activity. Stock stays deducted. Logs correct activity. Stock deducted again. Farm's system now shows 20L consumed when only 10L was actually used. At season end, the farm's spray cost is overstated. The RVO diary has one deleted entry and one correct entry — but a compliance audit will see BOTH in the ComplianceRecord table (soft-deleted activity's record is retained, correct record is also there), making it look like the field was sprayed twice.

### 2.3 Dashboard Shows Wrong Farm Data

The dashboard page (`src/app/(farm)/dashboard/page.tsx` line 18) hardcodes:
```ts
const data = mockDashboardData;
```
This is "Maatschap De Ridder" in Westervoort. Every farm that logs in sees this mock farm's data: their fields, their stock levels, their tasks, their compliance status. Farm 47 ("Boerderij Van Dijk" in Zeeland) opens FarmOS and sees Jan de Ridder's wheat fields and his task to scout Achterste Kamp. This is a product-defining bug.

### 2.4 Mock Weather Dates Are Stale

`src/lib/mock-data/farm-dashboard.ts` lines 63–110: weather days are hardcoded as `'2025-07-03'` through `'2025-07-07'`. `generateDailyBriefing` compares these against `new Date()` which is today (2026-07-07). Every date in the mock forecast is 365 days in the past. The overdue task check (`due < today`) will flag ALL mock tasks as overdue. The spray window check will always show stale data.

### 2.5 Season Change Scenario

**Sequence:** Season 2025 ends. Admin creates Season 2026 and sets `isActive = true`. They forget to set Season 2025 `isActive = false`. Now `db.season.findFirst({ where: { farmId, isActive: true } })` returns whichever season Prisma happens to select first (no ORDER BY in the query). Workers in January 2026 log activities against 2025 FieldSeasons. The 2026 spray diary starts accumulating records in the wrong season.

### 2.6 Field Deletion Scenario

**Sequence:** A field called "Rijnkamp West" was subdivided — the farmer wants to remove it and add two smaller fields. They click "Delete" on the field. The confirm dialog says "Delete 'Rijnkamp West'? This cannot be undone." They confirm. Prisma cascade-deletes: 1 Field → 3 FieldSeasons → 47 Activities → 47 ComplianceRecords → 12 StockMovements → 47 ComplianceRecords. Three years of spray diary data permanently destroyed. The RVO inspector who comes in September will find no records for 47 sprays on that land.

### 2.7 Duplicate Activity Scenario

**Sequence:** Worker has poor internet. Submits spray form. Loading spinner appears. Network times out client-side (no timeout is configured). Worker submits again. Both requests reach the server. Two Activity records are created for the same field, same day, same product, same operator. Two ComplianceRecords. Two stock deductions. The farmer's stock is understated by one application's worth. The diary shows the field was sprayed twice on the same day (a compliance red flag).

No idempotency key. No duplicate detection. Both activities are valid per the schema.

### 2.8 Product Deletion Scenario

**Sequence:** Farm removes an expired product from inventory. The delete fails silently because Prisma RESTRICT prevents deletion of an InventoryItem referenced by activities (the FK has no `onDelete` specified, so Prisma defaults to RESTRICT in PostgreSQL). The error is not communicated to the user. The product remains in inventory. The farmer thinks it was deleted, orders a replacement, and the old item sits taking up inventory space permanently.

### 2.9 Harvest Date Correction Scenario

**Sequence:** Farmer records harvest date of August 1. A week later, discovers the correct date was July 28. There is no edit UI for activities. The spray diary cannot be corrected. The farmer must soft-delete the harvest record and re-enter it — which creates two records in the ComplianceRecord table (one soft-deleted, one new). An auditor sees a "deleted" harvest record followed immediately by an identical harvest record and will ask questions.

### 2.10 Area Exceeds Field Hectares

**Sequence:** Worker enters spray area of 50 ha for a 24.3 ha field. Zod schema validates `areaHa` as `z.coerce.number().positive().max(9999)` — 50 passes. No cross-validation against `FieldSeason.field.hectares`. Stock deduction of 50 ha × 2 L/ha = 100L occurs on a field that is 24.3 ha. The RVO diary shows 50 ha sprayed. Completely implausible to any agronomist reviewing the record.

---

## SECTION 3 — Real Farmer Scenarios at Scale

### 3.1 Scenario: 100 Farms, Monday Morning, 07:00

All 100 farms open the app simultaneously after weekend. 100 concurrent requests hit:
- `/dashboard` (static, fast — but shows wrong farm data)
- `/weather` (force-dynamic → 100 calls to Open-Meteo within seconds)
- `/activities` (each loads up to 200 activities with nested includes)

**Open-Meteo free tier:** No documented rate limit, but rapid burst from a single origin IP (your server) will trigger rate limiting or blocking. 100 simultaneous requests from one IP to `api.open-meteo.com` within seconds will very likely get 429s. Weather pages show errors for all 100 farms simultaneously.

**Activities page query load:**
```ts
db.activity.findMany({
  where: { fieldSeason: { field: { farmId: farm.id } } },
  include: { fieldSeason: { include: { field: true } }, product: true },
  take: 200
})
```
This query traverses three levels of nesting. Without indexes on `fieldSeasonId`, `seasonId`, `farmId`, PostgreSQL performs sequential scans on every table for every farm request. At 5,000 activities total, each query scans the full `activities` table to filter by `farmId` through nested joins. 100 concurrent queries scanning 5,000 rows = 500,000 row scans in seconds.

### 3.2 Scenario: 40 Workers, Simultaneous Spray Logging

40 workers across 100 farms log spray activities simultaneously during the morning spray window. Each hits `createActivity`. Without connection pooling (none configured), Prisma's connection pool (default: 5 + cpu_count * 2 ≈ 15 connections) is exhausted. Requests queue and time out. Workers see loading spinners indefinitely. Some retry — see Section 2.7 (duplicates).

Prisma default connection pool limit for PostgreSQL: `min(2 + math.floor(cpus/2), 10)`. On a 2-CPU server: ~3 connections. 40 concurrent submissions saturate this in milliseconds.

### 3.3 Scenario: Farm With 500 Fields

The fields page loads:
```ts
db.field.findMany({ where: { farmId: farm.id }, orderBy: { createdAt: 'asc' } })
```
No `take` limit. A large grain operation with 500 fields returns all 500 in a single query result. The `FieldsListClient` renders a 500-row HTML table. On mobile (which is the primary use context), this is 500 DOM nodes rendered synchronously. Page becomes non-interactive for several seconds. On 2G mobile connections common in rural Netherlands, the time-to-interactive could exceed 30 seconds.

### 3.4 Scenario: One Farm, 5,000 Activities

The activities page:
```ts
db.activity.findMany({ ..., take: 200 })
```
Only 200 shown. But the `filter` buttons ("All / Spray / Fertilise / Harvest") are client-side only — they filter the already-loaded 200 records. If a farm has 300 spray activities this season, the "Spray" filter shows 133 records (the sprays within the first 200 loaded), missing the other 167. The farmer thinks they've only sprayed 133 times when they've sprayed 300. Their spray diary is incomplete from their perspective.

### 3.5 Scenario: Worker Loses Internet Mid-Submission

Worker on tractor submits spray form over 3G. Connection drops after the HTTP request is sent but before the response is received. The server processes and commits the activity. Worker sees the form still loading (no response received). Worker closes app, reopens, sees no new activity (page uses `router.refresh()` which requires response). Worker re-submits. Duplicate created. No idempotency protection.

### 3.6 Scenario: Two Admins, Same Farm

Two business partners manage the same farm account. Both are logged in via the same Clerk user (shared credentials — common in Dutch family farms). Both open the season setup at the same time. Both create "Season 2026". Race condition: one succeeds, one gets a unique constraint violation from `@@unique([farmId, year])`. Error propagates as unhandled exception. Business partner 2 sees a crash screen.

### 3.7 Scenario: Seasonal Worker Certificate Expiry

A seasonal worker's spray certificate (spuitlicentie) expires. The system has no certificate number field, no expiry date for operators. The worker continues logging spray activities with their name. The farm accumulates legally invalid spray diary entries for weeks before anyone notices. Under Dutch law (Besluit gebruik meststoffen), the operator's valid certificate number must be verifiable in the diary.

### 3.8 Scenario: Inventory Restock

Farm receives 100L of Amistar from Syngenta. There is no Inventory module UI (stub page). There is no `StockMovement` creation for receipts (`direction: 'in'` is never used). The farmer cannot record the receipt. The system continues showing the stock level from before delivery. Stock tracking is one-directional (only outbound).

---

## SECTION 4 — Compliance

### 4.1 EU Directive 2009/128/EC

Article 67 of Regulation (EC) 1107/2009 requires plant protection product use records to contain, at minimum:

| Required Field | Schema | Form | Diary Record | Status |
|---|---|---|---|---|
| Name of product | ✓ via productId | ✓ dropdown | Stored as productId, not name | **FAIL** |
| Registration number | ✓ in InventoryItem | ✗ not shown | ✗ not copied | **FAIL** |
| Date of application | ✓ | ✓ | ✓ | PASS |
| Area treated (ha) | ✓ | ✓ | ✓ | PASS |
| Dose applied | ✓ | ✓ | ✓ | PASS |
| Crop protected | ✓ via FieldSeason | shown in dropdown | stored as fieldSeasonId | **FAIL** |
| Reason for use (pest/disease target) | ✓ notes field | ✓ textarea | ✗ not in JSON | PARTIAL |
| Pre-harvest interval (PHI) | ✓ in InventoryItem | ✗ not shown | ✗ not recorded | **FAIL** |
| Operator name | ✓ | ✓ | ✓ | PASS |

**Records must be kept for at least 3 years.** Current implementation allows hard cascade-deletion of compliance records. **FAIL.**

**Records must be made available to competent authorities upon request.** There is no export functionality. **FAIL.**

### 4.2 Dutch RVO Requirements

The Netherlands imposes additional obligations:

| Requirement | Status |
|---|---|
| Operator certificate number (spuitlicentie) | ✗ Missing from schema and UI |
| Water volume per hectare (L/ha) | ✗ Missing from schema and UI |
| Machine identification (sprayer) | ✗ Machine table exists but not linked to Activity |
| Buffer zone respected (waterway distance) | ✗ Missing |
| Nozzle type / drift reduction class | ✗ Missing |
| Product CTB (toelatingsnummer) in diary | ✗ Not denormalised into ComplianceRecord |
| Monthly digital submission to RVO portal | ✗ No export function |
| BRP number in farm record | ✓ In schema, optional |

### 4.3 Record Retention and Audit Trail

**Retention gap:** `deletedAt` soft-delete can be set and the record conceptually disappears, but there is no lock preventing deletion within the 3-year window. An admin could soft-delete all activities from a regulatory inspection year.

**Audit trail gap:** No `AuditLog` table. No recording of: who deleted what, when, from which IP, with what user ID. A compliance inspector asking "who removed these 47 spray records?" would find no answer.

**Immutability gap:** `ComplianceRecord.confirmed` exists but is never set to `true`. There is no workflow for a farmer to review and lock a diary entry. All 5,000 records remain `confirmed: false` indefinitely.

**Export gap:** No PDF export, no CSV export, no RVO API integration. The entire diary exists only inside the database.

### 4.4 Product Registration Denormalisation

`ComplianceRecord.data` stores `productId` but not `productName` or `registrationNumber`. After 3 years, if the product is renamed or the inventory item is reorganised, the compliance record shows a UUID with no resolvable meaning. A 2027 inspection reviewing a 2026 spray record will see `productId: "abc-123"` with no way to resolve what product was used.

---

## SECTION 5 — Scalability

### 5.1 At 10 Farms (Current + 9)

**Works.** Single PostgreSQL instance, Prisma client, Next.js. No problems.

### 5.2 At 100 Farms (Launch Target)

**Will have visible problems:**

- Open-Meteo: 100 simultaneous weather page loads = 100 requests to a single free API. Will likely result in 429 responses. All users see error simultaneously.
- Connection pool exhaustion: Default Prisma pool handles ~10 concurrent connections. 100 farms × 1 active request each = 90 requests queued behind the pool.
- Activities page: No pagination. If any farm has 500+ activities, their page stalls and times out.
- Mock data on dashboard: 100 farms all see "Maatschap De Ridder" data.

### 5.3 At 1,000 Farms

**Will fail without architecture changes:**

- Single PostgreSQL instance at ~50 concurrent transactions hits I/O ceiling without read replicas
- Prisma connection pool default is too small — requires PgBouncer or external connection pooler
- No query result caching — every dashboard load reads the database
- Open-Meteo at 1,000 farms needs either: a) shared weather cache by farm coordinates (most farms in the same region share weather), b) a dedicated weather API subscription
- Activities with 50,000 records and no index on `date` + `farmId` = full table scans

**Architecture changes needed:**
1. Add `pgbouncer` or Supabase Pooler for connection management
2. Add Redis for weather cache (cache by lat/lon rounded to 0.1°, TTL 30 min)
3. Add indexes on `Activity(fieldSeasonId, date)`, `Field(farmId)`, `FieldSeason(seasonId)`, `InventoryItem(farmId)`
4. Paginate activities list

### 5.4 At 10,000 Farms

**Requires multi-tenant database architecture:**

- Consider row-level security (RLS) in PostgreSQL to enforce farm isolation at DB level
- Consider schema-per-tenant or database-per-tenant for largest accounts
- Prisma ORM performance overhead becomes significant at this scale (raw SQL for reporting)
- NDVI data, weather history, compliance exports become petabytes — object storage required
- Background jobs required for: compliance report generation, stock alerts, GDD calculation
- Queue system (Bull, BullMQ) required for spray window notifications

### 5.5 At 100,000 Farms

**Requires full SaaS platform architecture:**

- Database sharding by `farmId`
- Separate read replicas for reporting
- Global CDN with edge workers for weather API response caching
- Microservices for: compliance engine, inventory, AI briefing
- Event-driven architecture: Activity created → event → compliance record → stock update → notification
- Separate compliance data store with immutable append-only design (EventStore or similar)
- Dedicated data warehouse for agronomic analytics

### 5.6 Current Missing Infrastructure

There is no:
- Database connection pool manager (PgBouncer, pgpool)
- Caching layer (Redis, Upstash)
- Background job queue
- CDN configuration in `next.config.ts`
- Rate limiting on any route or Server Action
- Health check endpoint (`/api/health`)
- Database migration strategy (only `prisma generate` was run, no `prisma migrate`)
- Seed data for development

---

## SECTION 6 — Security

### 6.1 Authentication Bypass in Development

`src/lib/farm.ts` lines 22–31:
```ts
if (clerkUserId) {
  return await db.farm.findUnique({ where: { clerkUserId } });
}
// Dev fallback: use first farm in DB
return await db.farm.findFirst({ orderBy: { createdAt: 'asc' } });
```

When `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is unset or uses the placeholder `pk_test_...`, `tryGetClerkUserId()` returns `null` and the dev fallback fires. **Any unauthenticated request sees the first farm in the database.** If staging or a demo environment runs without Clerk keys, all farm data is publicly accessible.

### 6.2 Farm Ownership Not Enforced at the Auth Layer

All farm ownership checks are application-level in Server Actions. There is no middleware that ensures a logged-in user can only access their own farm's routes. A URL like `/fields` will render the correct farm's data only if `getActiveFarm()` returns the right farm — which depends on Clerk userId. If Clerk is misconfigured, the wrong farm is served.

PostgreSQL row-level security (RLS) is not configured. If the database connection string were leaked, any query returns all farms' data.

### 6.3 Server Actions Accept Arbitrary Form Data

`src/lib/actions/activities.ts` line 29:
```ts
const raw = Object.fromEntries(formData);
```

`formData` is a `FormData` object. `Object.fromEntries` creates an object where each form field name is a key. If the form has a field named `fieldSeasonId` set by the user (not from a select dropdown but from a crafted HTTP request), it overrides the intended value. A malicious actor can submit any `fieldSeasonId` UUID — the ownership check `field: { farmId: farm.id }` would catch a cross-farm UUID, but same-farm UUID manipulation is possible.

More critically: `type` is a hidden input in the SprayDiaryDialog:
```tsx
<input type="hidden" name="type" value="spray" />
```
A crafted form submission could set `type` to any `ActivityType` enum value. The type validation in Zod catches this (only valid enum values pass), so this specific risk is mitigated.

### 6.4 No Rate Limiting

Server Actions have no rate limiting. A script can call `createActivity` 10,000 times per minute, creating 10,000 activities with 10,000 compliance records and 10,000 stock deductions. At sufficient speed, this would:
1. Exhaust the database connection pool
2. Drive all inventory items to deeply negative values
3. Fill the `activities` and `compliance_records` tables

### 6.5 No CSRF Protection Beyond Next.js Default

Next.js Server Actions include some CSRF protection (the `Origin` header must match the server's origin). However, this is not explicitly configured and can fail in certain reverse proxy configurations. `next.config.ts` has no security headers configured.

### 6.6 Missing Security Headers

`next.config.ts` is empty (no configuration). Missing:
- `Content-Security-Policy` header
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `Referrer-Policy`

### 6.7 UUID Predictability

Primary keys use Prisma's `@default(uuid())` which generates UUIDv4 in the application layer. UUIDv4 is random but generated by `crypto.randomUUID()` in Node.js — cryptographically secure. Not a risk, but worth noting.

### 6.8 Product UUID Cross-Farm Manipulation

`createActivity` verifies `fieldSeasonId` belongs to the current farm (lines 48–54) but does NOT verify that `productId` belongs to the current farm (lines 100–116). An authenticated user on Farm A who knows a product UUID from Farm B (through a data breach, social engineering, or UUID enumeration) could include that product's UUID in their spray form. The stock deduction would fire against Farm B's inventory item.

### 6.9 Error Messages Leak Internal State

`getActiveFarmOrThrow()` throws: `'No farm found. Please complete onboarding.'` This message reaches the client. If the error occurs due to a DB query failure, the client sees "No farm found" — which is a misleading message that could confuse support and expose information about farm configuration.

### 6.10 Sensitive Data in Logs

`src/lib/db.ts` enables `['query', 'error', 'warn']` logging in development. In development pointing at production data (common mistake), all SQL queries including farm names, operator names, product names, and coordinates are logged to console. No PII masking.

---

## SECTION 7 — Reliability

### 7.1 No Error Boundaries

The entire application has no React Error Boundaries. A component crash (e.g., `WeatherPageClient` receiving `null` hourly data, or `FieldsListClient` receiving malformed Prisma `Decimal` as a number) will unmount the entire page and show Next.js's generic error page. The user loses all context and must navigate back from scratch.

### 7.2 Open-Meteo Failure

`src/app/(farm)/weather/page.tsx` wraps `fetchWeather` in try/catch (correct). But there is no cached fallback. If Open-Meteo is unavailable:
- The weather page shows an error box
- The spray window status ("Window open / closed" in the Topbar) shows the fallback text "10-day forecast and spray window analysis"
- The dashboard's `WeatherCard` shows mock data (Sprint 1 static data)
- The spray form has no weather prefill

A farmer relying on the spray window during an Open-Meteo outage has no data. They must spray blind or check another service.

**The weather data should be cached.** The current `force-dynamic` page setting bypasses the `fetch` cache entirely. Even 30 minutes of stale weather is better than an error.

### 7.3 Database Failure

If PostgreSQL is unreachable, `getActiveFarm()` catches the error and returns `null` (after the fix in the previous session). The Fields and Activities pages show "No farm configured. Add your DATABASE_URL..." — a development error message, not a user-appropriate message for a production outage.

No retry logic. No circuit breaker. If the database connection drops briefly (RDS failover, maintenance), all requests fail for the duration of the reconnect, which can be 15–60 seconds.

### 7.4 Partial Write Recovery

There is no mechanism to detect or recover from a partial write (Activity created, ComplianceRecord creation failed). No background job checks for Activities missing ComplianceRecords. No admin interface to identify and repair inconsistent state.

### 7.5 No Health Check Endpoint

No `/api/health` or `/api/ready` endpoint exists. Kubernetes liveness probes, load balancers, and monitoring systems cannot verify the application is healthy. Database connectivity cannot be verified externally.

### 7.6 No Database Migrations

Only `prisma generate` was run — this generates the Prisma client from the schema but does NOT create the database tables. Running the application against a fresh database (as 100 new farms would require) will immediately fail: no tables exist. 

The correct command is `prisma migrate dev` (development) or `prisma migrate deploy` (production). No migration files exist in the repository. If someone runs `prisma generate` and tries to start the app, every query throws `relation "farms" does not exist`.

### 7.7 No Graceful Degradation

The dashboard shows mock data (Sprint 1) — this is actually accidental graceful degradation, but for the wrong reason. The real issue is that 6 of 8 modules (Inventory, Finance, Compliance, AI, plus partially Finance and Compliance) are stub pages. If a farmer navigates to Inventory from the low-stock alert, they see "Inventory module — coming in Sprint 2." A customer-facing launch cannot include stub pages.

---

## SECTION 8 — Performance

### 8.1 Critical Missing Indexes

Running `EXPLAIN ANALYZE` on the activities query:
```sql
SELECT * FROM activities a
JOIN field_seasons fs ON a.field_season_id = fs.id
JOIN fields f ON fs.field_id = f.id
WHERE f.farm_id = $1
AND a.deleted_at IS NULL
ORDER BY a.date DESC
LIMIT 200;
```

Without indexes on:
- `fields.farm_id`
- `field_seasons.field_id` and `field_seasons.season_id`
- `activities.field_season_id`
- `activities.date`
- `activities.deleted_at`

PostgreSQL plans sequential scans on all three tables. At 5,000 activities, 500 fields, 100 farms: the planner scans all 5,000 activities and performs nested loop joins with 500 field_seasons and 100 farms. Estimated query time without indexes on a mid-range RDS instance: 200–800ms per request. With 100 concurrent users: multi-second response times.

### 8.2 N+1 Pattern in Activities Page

The activities page query does:
```ts
include: {
  fieldSeason: {
    include: { field: { select: { name: true } } }
  },
  product: { select: { name: true } }
}
```
Prisma resolves this with multiple SQL queries (not a single JOIN in all cases depending on Prisma version). For 200 activities: potentially 200 individual product lookups + 200 fieldSeason lookups + 200 field lookups. Prisma batches these with `IN` clauses in v5, but the result is still 3 additional queries per page load.

### 8.3 Weather API on Every Request

`src/app/(farm)/weather/page.tsx` is marked `export const dynamic = 'force-dynamic'`. Every page load makes a live HTTP request to Open-Meteo. Response time: 100–300ms added to every weather page request. For 100 farms checking weather simultaneously: 100 outbound HTTP requests. The `next: { revalidate: 1800 }` in `fetchWeather` has **no effect** inside a `force-dynamic` page — it is silently ignored.

### 8.4 Fields List: No Limit

`db.field.findMany({ where: { farmId }, orderBy: { createdAt: 'asc' } })` — no `take`. A farm with 500 fields loads all 500 into a single `FieldsListClient` prop. The component renders an HTML `<table>` with 500 rows, each with computed styles. On mobile, this table causes significant layout thrashing.

### 8.5 Activities Pagination Is Client-Side Filtering, Not Server-Side Pagination

The filter buttons ("All / Spray / Fertilise / Harvest") filter the 200 already-loaded records client-side. This means:
1. All 200 records are always loaded from the database
2. Filtering beyond the 200-record window is impossible
3. A farm with 1,000 spray activities in a season will see only the 200 most recent, and "Spray" filter will show only those 200

Server-side pagination with filter parameters in the URL is required.

### 8.6 Dashboard Static Mock Data (Accidental Performance Win)

The dashboard currently loads no database data — it's all static mock data. This is actually fast (no DB round trip). But it is functionally useless. The real dashboard will need 6–8 database queries to populate. Without proper caching and query optimisation, the real dashboard will be slow.

### 8.7 No Optimistic UI Updates

When a farmer creates a new field (`createField`), the UI shows a loading spinner until the Server Action completes AND `router.refresh()` re-fetches the page. Total latency: action round trip (200ms) + page re-render (100ms) + network response (100ms) = ~400ms of dead time with a spinner. No optimistic insertion. On mobile connections this can exceed 1 second.

### 8.8 `--space-10` Referenced but Not Defined

`src/components/fields/FieldsList.module.css` and `ActivitiesPage.module.css` reference `var(--space-10)` in empty state padding. `globals.css` defines spacing variables only up to `--space-8`. `--space-10` resolves to `unset` (fallback to 0). Empty states have no top/bottom padding, making them visually cramped.

---

## SECTION 9 — Developer Experience

### 9.1 No Database Migration Files

`prisma/migrations/` directory does not exist. The schema has been generated but never migrated. A new developer cloning the repo and running `npm run dev` will see database connection errors immediately. The README equivalent (`AGENTS.md`) mentions Next.js breaking changes but has no setup instructions.

### 9.2 No Tests

`vitest` is installed (`package.json` devDependencies) but there are no test files anywhere in the project. Zero test coverage. Critical business logic (`spray-window.ts`, `createActivity`, stock deduction) has no automated verification. Changing the wind speed limit from 15 to 12 km/h could be done without any test catching the regression.

### 9.3 Mock Data Type Divergence

`src/types/farm.ts` defines `InventoryCategory` as `'fertilizer'` (American). The Prisma schema defines `InventoryCategory` enum as `fertiliser` (British). The mock data uses `fertilizer`. The `CATEGORY_LABEL` object in `InventoryAlertsCard.tsx` maps `fertilizer` correctly. When real Prisma data is wired up, the Prisma `fertiliser` value will not match the TypeScript type `fertilizer`, causing a type error or silent label mismatch.

`CropName` in `farm.ts`: `'corn'`, `'rapeseed'`, `'rye'`, `'oat'`. In Prisma schema: `oilseed_rape`, `cover_crop`, `grass`, `other`. No `corn`, `rapeseed`, `rye`, `oat`. These types will never align without a merge.

### 9.4 No Seed File

There is no `prisma/seed.ts`. Running the app against a fresh database after `prisma migrate dev` produces: no farms, no seasons, no fields, no products. The developer must manually insert data via Prisma Studio or raw SQL to test anything. This blocks every new team member on day one.

### 9.5 Sidebar Shows "Sprint 1 · v0.1"

`src/components/layout/Sidebar.tsx` line 51: `Sprint 1 · v0.1`. This will appear to every paying customer. Version display in the sidebar is fine, but it must reflect the actual version and not a sprint label.

### 9.6 Five Stub Pages in Production Build

The following routes return `StubPage` components with "coming in Sprint 2" text:
- `/inventory` — critical module; referenced by dashboard and AI briefing
- `/finance` — referenced by dashboard
- `/compliance` — referenced by dashboard and AI briefing
- `/ai` — entire AI assistant module
- Dashboard itself shows mock farm data

Customers navigating from the AI briefing card ("View inventory →") hit a stub page. This is a product-breaking experience that cannot ship to paying customers.

### 9.7 No .env.local in Repository

Only `.env.local.example` exists. A new developer must manually copy this file and fill in values. `DATABASE_URL` placeholder (`postgresql://postgres:password@localhost:5432/farmos`) is not a working URL out of the box. No documentation exists on how to set up a local PostgreSQL instance.

### 9.8 No CI/CD Pipeline

No `.github/workflows/`, no `Dockerfile`, no Vercel config. Deployment process is undocumented. TypeScript check is manual (`npx tsc --noEmit`). No automated linting, no automated tests (no tests exist), no build verification on PR.

### 9.9 Inconsistent Naming

- `ActivityType` enum in Prisma uses `fertilise` (British spelling)
- `src/types/farm.ts` uses `fertilize` (American spelling)
- `InventoryCategory` uses `fertiliser` (British) in Prisma, `fertilizer` (American) in TypeScript types
- CSS classes mix `camelCase` and `kebab-case` (mostly camelCase, but `--space-10` etc. use kebab)
- Component files: `FieldsListClient.tsx` vs `ActivitiesClient.tsx` (inconsistent Client suffix usage)

### 9.10 No Error Tracking

No Sentry, Datadog, or equivalent integration. When a farmer on Farm 47 in Zeeland encounters a Prisma crash at 06:30 on a Monday morning, there is no alert, no stack trace captured, no context. The engineering team learns about it when the farmer emails support.

---

## SECTION 10 — Production Readiness Score

| Dimension | Score | Justification |
|---|---|---|
| **Architecture** | 5/10 | App Router + Server Actions + Prisma is the right foundation. But no connection pooling, no caching layer, no background jobs, no migrations. Structural bones are good; production readiness gaps are real. |
| **Security** | 3/10 | Auth bypass in dev, no rate limiting, no security headers, cross-farm product manipulation possible, no audit log. Passable for a prototype; not for 100 real farms. |
| **Compliance** | 2/10 | Missing operator certificate number, water volume, product registration in diary, no 3-year retention enforcement, no export, hard-delete cascade destroys regulatory records. Cannot legally serve Dutch farmers as a spray diary. |
| **Scalability** | 3/10 | No indexes, no pagination, no connection pooler, no cache. Works at 1 farm. Will show stress at 10 farms. Will fail at 100. |
| **Reliability** | 3/10 | No error boundaries, no health endpoint, no DB migrations, no retry logic, no circuit breakers, no graceful degradation. Fragile against any infrastructure event. |
| **Maintainability** | 4/10 | TypeScript is clean (zero errors). CSS Modules are consistent. But no tests, diverging type systems, no seed data, no CI, mock data in production build. |
| **Product maturity** | 2/10 | Dashboard shows wrong farm. 5 of 8 modules are stubs. No onboarding. No season management UI. Activities dropdown empty for new users. |
| **Database integrity** | 3/10 | No constraints, no indexes, non-atomic transactions, hard-delete cascade on regulatory records, stock goes negative. |
| **Business logic** | 4/10 | Server Actions are structurally correct. Zod validation is good. Farm ownership checks exist. But stock logic is broken, soft-delete is incomplete, duplicate detection absent. |
| **AI readiness** | 4/10 | `generateDailyBriefing` is elegant rule-based logic. The Briefing Room architecture concept is right. But it runs on mock data and will need real DB integration. No Claude API calls yet. Schema has the data model AI needs (BBCH, disease risk score, GDD-ready fields). |

**Overall Production Readiness: 3.3 / 10**

This system is **not ready for 100 real farms next week.** It is ready for a closed beta with 1–2 technically tolerant farms who understand they are testing software.

---

## TOP 100 IMPROVEMENTS

### 🔴 CRITICAL — Must fix before any real farm data (P0)

| # | Issue | File(s) |
|---|---|---|
| 1 | Run `prisma migrate dev` and commit migration files — without this, production database has no tables | `prisma/` |
| 2 | Make all three activity operations (create + compliance + stock) atomic in a single `db.$transaction` | `actions/activities.ts:58–117` |
| 3 | Add stock sufficiency check before deduction — block if `currentStock < totalUsed` | `actions/activities.ts:100` |
| 4 | Add `farmId: farm.id` to inventory item ownership check in stock deduction | `actions/activities.ts:104` |
| 5 | Block field hard delete if activities exist — prevent cascade destroying regulatory records | `actions/fields.ts:76` |
| 6 | Restore stock on activity soft-delete — create compensating `StockMovement { direction: 'in' }` | `actions/activities.ts:136` |
| 7 | Filter `deletedAt: null` in activity findMany — soft-deleted records must not appear in list | `app/(farm)/activities/page.tsx:49` |
| 8 | Add partial unique index: one active season per farm (raw SQL migration) | `schema.prisma` |
| 9 | Replace dashboard mock data with real DB queries or remove before customer launch | `app/(farm)/dashboard/page.tsx:18` |
| 10 | Remove or disable dev auth bypass (`findFirst` fallback) before any shared environment | `lib/farm.ts:28` |
| 11 | Wrap `getActiveFarmOrThrow` throws in Server Actions — return `{ error }` never throw | `lib/farm.ts:34` / all actions |
| 12 | Fix UTC date off-by-one — interpret date input in Europe/Amsterdam timezone | `actions/activities.ts:63` |
| 13 | Add database indexes: `Activity(fieldSeasonId)`, `Activity(date)`, `Field(farmId)`, `FieldSeason(seasonId)`, `InventoryItem(farmId)` | Migration |
| 14 | Replace 5 stub pages with at minimum an "under construction" message that doesn't reference sprints | All stub pages |
| 15 | Add `ORDER BY` to `season.findFirst` — deterministic active season selection | `app/(farm)/activities/page.tsx:25` |

### 🔴 CRITICAL — Compliance blockers (P0)

| # | Issue |
|---|---|
| 16 | Add operator certificate number (`certificateNumber` field) to Activity schema and spray form |
| 17 | Add water volume per hectare (`waterVolumePerHa`) to Activity schema and spray form |
| 18 | Denormalise product name and registration number into `ComplianceRecord.data` at creation time |
| 19 | Denormalise field name and crop name into `ComplianceRecord.data` at creation time |
| 20 | Block soft-delete of activities that have confirmed compliance records (3-year retention rule) |
| 21 | Add `ComplianceRecord` lock mechanism after confirmation — prevent modification after `confirmed = true` |
| 22 | Add PHI warning at spray form time — calculate and display harvest exclusion date |
| 23 | Add machine (sprayer) selection to spray activity form |
| 24 | Add buffer zone checkbox to spray activity form (required by NL) |
| 25 | Add nozzle type / drift reduction class field to spray activity form |

### 🟠 HIGH — Product blockers for customer launch (P1)

| # | Issue |
|---|---|
| 26 | Build Season management UI (create season, assign crops to fields, activate/deactivate) |
| 27 | Build Inventory CRUD UI (add product, record receipt, view stock levels) |
| 28 | Prefill area sprayed from FieldSeason hectares in spray form |
| 29 | Prefill weather from Open-Meteo when date is selected in spray form |
| 30 | Add `StockMovement { direction: 'in' }` UI — receipt logging |
| 31 | Add activity area validation — cannot exceed field hectares |
| 32 | Add duplicate activity detection — warn if same field + same type + same date already exists |
| 33 | Fix weather page caching — remove `force-dynamic`, use `export const revalidate = 1800` |
| 34 | Add server-side pagination to activities list (20 per page, URL-based cursor) |
| 35 | Add limit to fields list (`take: 100`, with "show more") |
| 36 | Add error return check in `handleDelete` (both fields and activities client components) |
| 37 | Add `loading.tsx` files for all routes to prevent blank flash on navigation |
| 38 | Add maximum dose validation — `dosePerHa max(50)` for L, `max(500)` for kg |
| 39 | Block activity date in future (Zod `.max(new Date())` on date field) |
| 40 | Add `Task.farmId` foreign key relation in Prisma schema |
| 41 | Merge `src/types/farm.ts` with Prisma-generated types — eliminate divergence |
| 42 | Fix `InventoryCategory` spelling: align Prisma `fertiliser` vs TypeScript `fertilizer` |
| 43 | Fix `CropName` divergence between `farm.ts` and Prisma schema |
| 44 | Add React Error Boundaries around each module page |
| 45 | Add health check endpoint (`/api/health`) that verifies DB connectivity |
| 46 | Add `StockMovement.direction` Prisma enum (`StockDirection { in out correction }`) |
| 47 | Add `Char(3)` constraint safety — change `weatherWindDir` to `VarChar(3)` or enum |
| 48 | Add `Activity.date` future-date validation |
| 49 | Fix Sidebar version: remove "Sprint 1 · v0.1" from customer-facing UI |
| 50 | Add production-appropriate "No farm configured" message (not the dev error message) |

### 🟡 HIGH — Security (P1)

| # | Issue |
|---|---|
| 51 | Add security headers in `next.config.ts`: CSP, X-Frame-Options, HSTS, Referrer-Policy |
| 52 | Add rate limiting on Server Actions (middleware-level, per user per minute) |
| 53 | Add audit log table (`AuditEvent`: userId, farmId, action, entityId, timestamp, ip) |
| 54 | Add Row-Level Security (RLS) in PostgreSQL as defence-in-depth (`ENABLE ROW LEVEL SECURITY` on farms) |
| 55 | Replace `proxy.ts` `require()` dynamic import with type-safe conditional registration |
| 56 | Add maximum payload size validation on all Server Actions (prevent large note fields) |
| 57 | Mask PII in development database logs (disable `query` log in all environments) |
| 58 | Configure Clerk in staging environment — no auth bypass in non-local environments |

### 🟡 MEDIUM — Reliability (P2)

| # | Issue |
|---|---|
| 59 | Add retry logic for Open-Meteo — 3 retries with 500ms backoff before showing error |
| 60 | Add weather cache (Redis or in-memory) — serve stale data on API failure |
| 61 | Add circuit breaker for database — graceful degradation page on DB unavailability |
| 62 | Add database connection pooler (PgBouncer, Supabase pooler, or `pg` pool configuration) |
| 63 | Add `prisma.$connect()` health check at startup — fail fast if DB unreachable |
| 64 | Add `SELECT FOR UPDATE` in stock deduction transaction to prevent concurrent over-deduction |
| 65 | Implement idempotency keys for activity creation — prevent duplicate submission on retry |
| 66 | Add `complianceRecord` existence check — background job to detect activities missing compliance records |
| 67 | Add database connection string validation at startup |

### 🟡 MEDIUM — Performance (P2)

| # | Issue |
|---|---|
| 68 | Add composite index `Activity(fieldSeasonId, date DESC)` for activities query |
| 69 | Add composite index `Activity(deletedAt, date DESC)` for filtered queries |
| 70 | Cache weather by farm coordinates rounded to 0.1° — most farms within 5km share weather |
| 71 | Optimistic UI for field creation — insert into local state immediately, revert on error |
| 72 | Move activities list to URL-based filter (search params) for SSR filtering, not client-side |
| 73 | Add React Suspense boundaries — render fields list skeleton while data loads |
| 74 | Add `LIMIT` to all unbounded database queries |
| 75 | Reduce activities `include` depth — fetch related data in separate targeted queries |

### 🟡 MEDIUM — Agronomy (P2)

| # | Issue |
|---|---|
| 76 | Use `leaf_wetness_index` from Open-Meteo in spray window calculation |
| 77 | Change single-hour rain check to 4-hour rain-free window |
| 78 | Add `is_day` check — block spray window before 05:30 and after 21:00 |
| 79 | Reduce temperature max from 28°C to 25°C (NL standard) |
| 80 | Add temperature inversion detection using `temperature_80m` vs `temperature_2m` |
| 81 | Add "marginal" spray window state (between open/closed) for borderline conditions |
| 82 | Display PHI countdown per field: "Harvest safe from: [date]" on field detail |
| 83 | Add BBCH stage selection to FieldSeason and display on field row |

### 🟢 MEDIUM — Developer Experience (P2)

| # | Issue |
|---|---|
| 84 | Create `prisma/seed.ts` — creates 1 farm, 1 season, 3 fields, 5 products for development |
| 85 | Write unit tests for `computeSprayWindows` — all edge cases (wind, temp, rain, leaf wetness) |
| 86 | Write unit tests for `generateDailyBriefing` — all 7 rule branches |
| 87 | Write integration tests for `createActivity` — success, insufficient stock, wrong farm, duplicate |
| 88 | Add CI pipeline: `tsc --noEmit` + `vitest run` on every PR |
| 89 | Document environment setup in AGENTS.md — DB setup, Clerk setup, first run commands |
| 90 | Create `prisma/migrations/` — run `prisma migrate dev --name init` and commit |
| 91 | Fix mock weather dates — generate relative to `new Date()` not hardcoded 2025-07-03 |
| 92 | Add `--space-10` definition to `globals.css` (`--space-10: 40px`) |

### 🟢 LOW — Nice to have (P3)

| # | Issue |
|---|---|
| 93 | Add Sentry error tracking (`@sentry/nextjs`) with farm context tag |
| 94 | Add compliance diary PDF export (React PDF or Puppeteer) |
| 95 | Add "Removed entries" collapsible section for soft-deleted activities |
| 96 | Add operator saved profile — pre-select from Employee table in spray form |
| 97 | Add spray form quick-fill mode — field + product → pre-fill everything else |
| 98 | Add GDD accumulation column to FieldSeason based on sowing date |
| 99 | Add season archive export — full CSV of all activities for a season |
| 100 | Replace "Sprint 1 · v0.1" with dynamic version from `package.json` in Sidebar footer |

---

*End of Production Readiness Audit.*  
*Next recommended action: address items 1–15 (Critical) before any customer data enters the system.*
