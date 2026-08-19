# Sprint 3: Deep Product + Code Audit

**Date:** 2026-07-07  
**Scope:** All Sprint 2 code — Fields, Activities, Weather, Spray Window, Inventory deduction, Clerk auth, Server Actions, Prisma schema  
**Auditor perspectives:** Senior SaaS architect · Farm management software expert · Agronomist · EU compliance expert · QA engineer · Product manager

---

## 1. Product Flow Audit

### 1.1 Can a farmer understand what to do?

**Current state: Partially.** A farmer who opens the app for the first time sees the dashboard with mock data from Sprint 1, then navigates to Fields and finds an empty state. The first action they must take — "Add field" — is discoverable. But after adding a field, nothing tells them what to do next.

The critical missing step is **onboarding sequence**. Right now:

1. Farmer opens app → dashboard with mock Maatschap De Ridder data (confusing — not their farm)
2. Farmer goes to Fields → adds a field ✓
3. Farmer tries to log an activity → the field dropdown is **empty** because there is no active Season and no FieldSeason record
4. Farmer is silently blocked with no explanation

This is the single biggest product flaw: **a farmer can create fields but cannot use them for anything until a Season and FieldSeason are created via database tooling — there is no UI for this.**

### 1.2 Does Fields → Activities → Inventory → Weather → Spray Diary feel connected?

**No. They feel like separate modules that happen to share a database.**

- Fields do not show the current crop or season
- Activities cannot be reached from a Field row (no "Log activity for this field" button)
- Inventory is not linked from the spray form in a meaningful way (no stock warning, no "you only have 8L left" message)
- Weather is completely disconnected from Activities — the farmer must manually read the wind speed and type it into the spray form
- After logging a spray, there is no confirmation that the diary record was created or where to find it

The flow should feel like: **Field → Season → Today's spray window → Pre-fill form → Log → Diary confirmed**. Currently it's: **5 separate pages with no connections between them.**

### 1.3 Where does the user get confused?

1. **The Season gap**: No Season = no FieldSeason = the "Field" dropdown in the spray form is empty. The farmer has no idea why.
2. **"Log spray" button**: Only accessible from Activities page. A farmer on the Fields page seeing a field at "attention" status has no direct path to "what should I do about this?"
3. **Area sprayed**: The form asks for "Area sprayed (ha)" which must be manually entered even though the field's hectares are already in the system.
4. **Weather prefill**: The farmer is on the tractor, spraying. They are expected to check the Weather page, mentally note the values, then come back to the form and type them. Nobody does this.
5. **Deleted activities visible**: Soft-deleted rows appear struck-through in the activity list. From a farmer's perspective this is confusing — they want to see only what happened, not what was undone.
6. **Compliance note at bottom**: "A spray diary record will be auto-generated" is important but buried at the bottom of a long form. Most farmers will not read it.

### 1.4 What is still too ERP-like?

- The Fields list is a table. Farmers think spatially (map), not in rows.
- "FieldSeason" is a database concept that has leaked into the UI (the dropdown shows IDs in the source, crop names in the output — but the concept of "a field in a season" is not explained anywhere).
- "Area sprayed (ha)" as a separate input from "field area" is an accounting field, not a farming decision.
- The weather section header says "required for compliance" — compliance language belongs in the audit trail, not in the farmer's face.
- Filters: "All / Spray / Fertilise / Harvest" are activity type labels the system uses, not terms a farmer naturally thinks in.

---

## 2. Code Architecture Audit

### 2.1 Server Actions quality

**Fields actions (`src/lib/actions/fields.ts`)**

- ✓ Correct `'use server'` directive
- ✓ Zod parsing before any DB call
- ✓ Farm ownership verified before update/delete
- ✗ `deleteField` does a hard delete. A field with associated activities (even soft-deleted) will cascade-delete all activity records via Prisma `onDelete: Cascade`. This destroys regulatory records silently.
- ✗ `getActiveFarmOrThrow()` throws a raw `Error`. In a Server Action used with `useActionState`, an uncaught throw causes a Next.js error boundary instead of returning `{ error: '...' }` to the form. The farmer sees a crash screen.
- ✗ No transaction: `createField` creates the field, then `revalidatePath` is called — if the DB write fails mid-way there is nothing to roll back. (This is fine for single-write, but multi-step mutations need `db.$transaction`.)

**Activities actions (`src/lib/actions/activities.ts`)**

- ✓ Ownership verified via nested `field: { farmId: farm.id }`
- ✓ Auto-generates ComplianceRecord for spray type
- ✓ Soft delete implemented correctly
- ✗ **Critical race condition**: The stock deduction and StockMovement creation run in a `db.$transaction([...])` but the `db.activity.create()` runs BEFORE the transaction. If the transaction fails (e.g. product not found, constraint error), the Activity is already written but stock was not deducted. The activity and the inventory are now inconsistent.
- ✗ **No stock sufficiency check**: `currentStock: { decrement: totalUsed }` will go negative without any guard. PostgreSQL has no constraint preventing negative Decimal values. A farmer could record spraying 500L when they only have 20L.
- ✗ **deleteActivity does not reverse stock**: Soft-deleting an activity leaves the stock permanently deducted. The farmer removed the record but their inventory shows less than it should.
- ✗ **No re-throw safety**: `getActiveFarmOrThrow()` throws a generic Error — in production this will render as "An error occurred" with no actionable message.
- ✗ `dosePerHa: z.coerce.number().positive().optional().or(z.literal(''))` — this accepts `0` from `.positive()` which requires strictly > 0, but the `or(z.literal(''))` means an empty string bypasses it. The resulting `d.dosePerHa || null` then converts `0` to `null`. Correct but fragile.

### 2.2 Zod validation

- ✓ Schemas are well-structured and coerce FormData strings
- ✗ `z.string().date()` on `date` field: this is a Zod v3 validator that requires `YYYY-MM-DD` format. Fine, but there is no timezone handling — if the server runs in UTC and the farmer submits "2026-07-07" at 23:00 NL time, `new Date(d.date)` will be 2026-07-07T00:00:00Z which renders as July 6 in NL. Spray diary date will be off by one.
- ✗ `weatherWindKmh: z.coerce.number().int().min(0).max(999)` — max 999 km/h. A hurricane limit should be ~200 km/h. A farmer typing "999" by accident is not caught.
- ✗ No validation that `doseUnit` is meaningful when `dosePerHa` is provided (and vice versa). Both are independently optional.
- ✗ `operatorName` has `max(100)` but no `min` on the spray form — empty string is technically blocked by `min(1)` but an operator named "a" passes validation.

### 2.3 Prisma / database assumptions

- ✗ **No Season onboarding**: The entire Activity system depends on `Season` and `FieldSeason` records existing. The schema supports this. The UI does not. There is no migration or seed that creates a default season. New users are silently blocked.
- ✗ `direction` in `StockMovement` is `String @db.VarChar(3)`. Currently only `'out'` is written. `'in'` is never used. The direction column should be a Prisma enum.
- ✗ The `Activity` model has `weatherRainMm` column defined in the schema but it is never populated in the Server Action. The form does not ask for it.
- ✗ `Task.farmId` is nullable with no relation defined. Tasks can exist without being linked to a farm or field — orphaned tasks are possible.
- ✗ `ComplianceRecord.data` is Json. The shape of this JSON is undocumented and unvalidated. Two different code paths could write incompatible shapes.
- ✗ UUID primary keys are generated by Prisma default, but the schema uses `@default(uuid())` — this is application-generated, not DB-generated. In PostgreSQL, using `gen_random_uuid()` at the DB level is safer (survives bulk imports).

### 2.4 Error handling

- ✗ `getActiveFarmOrThrow()` throws inside a Server Action. Next.js catches this and shows a generic error. The `useActionState` pattern requires Server Actions to return `{ error: string }` — they must never throw from user-visible paths.
- ✗ Weather page: `try/catch` around `fetchWeather` is correct, but if Open-Meteo returns a 200 with malformed JSON, `res.json()` will throw and the page shows "Failed to load weather data" — no distinction between network error and API error.
- ✗ `deleteField` action does not handle the case where Prisma throws due to cascade constraint (e.g., DB triggers or foreign key violations). The returned `{}` (empty success object) would be indistinguishable from a successful delete.
- ✗ Client-side `handleDelete` in `ActivitiesClient`: `await deleteActivity(id)` — the returned `{ error?: string }` is not checked. If the Server Action returns `{ error: 'Activity not found.' }`, the client still calls `router.refresh()` and shows no error to the user.
- ✗ Client-side `handleDelete` in `FieldsListClient`: same problem — error return is ignored.

### 2.5 Loading states

- ✓ `Button` component has `loading` prop with spinner
- ✓ `isPending` from `useActionState` disables the submit button
- ✗ Page-level loading: when `router.refresh()` is called after a create/delete, there is no visual indicator that the list is refreshing. The user clicks, waits ~500ms for the Server Component re-fetch, and sees nothing happen. They may click again (double-submit).
- ✗ No `loading.tsx` files for any route. Navigating between modules shows a blank flash.
- ✗ The spray form does not clear after successful submission — the dialog closes (via `useEffect` on `state.success`) but if there is a network delay between submit and the success state arriving, the button stays in loading state with no feedback about what is happening.

### 2.6 Empty states

- ✓ Fields: good empty state with icon, title, description, CTA
- ✓ Activities: good empty state
- ✗ The activities empty state CTA says "+ Log spray activity" — what about fertiliser or tillage? ERP thinking again.
- ✗ No empty state for when there IS a farm but NO active season — the dropdown is just empty with "— Select field —" and no explanation.
- ✗ Weather: no empty state for the edge case where `todayWindow.hours` is empty (e.g. Open-Meteo returns data starting tomorrow).

### 2.7 Auth / farm ownership safety

- ✓ All field mutations verify `farmId === farm.id` before acting
- ✓ Activity mutations verify ownership via nested `field: { farmId: farm.id }`
- ✗ The dev fallback in `getActiveFarm()` — `db.farm.findFirst()` — means in development, the first farm in the database is used regardless of who is logged in. If two developers share a database, they will silently see each other's data.
- ✗ `tryGetClerkUserId()` caches `_clerkAuth` in module scope. In a serverless environment, module scope is not guaranteed to persist across requests. The cache is fine, but if `_clerkAuth` is somehow corrupted (e.g. by a hot-reload), it could return a stale function.
- ✗ `deleteField` does a hard cascade delete. A malicious user who can authenticate as a farm owner can permanently destroy all activity and compliance records by deleting a field. There is no "are you really sure, this will delete X activities" confirmation that's backed by a server-side count.

### 2.8 Soft delete correctness

- ✓ `Activity.deletedAt` is set, never hard-deleted
- ✓ Soft-deleted activities are shown struck-through in the UI
- ✗ The `findMany` query in `activities/page.tsx` does NOT filter `deletedAt: null`. Soft-deleted activities are loaded and displayed to the user. The intent of soft delete is regulatory retention, not UI display. They should be excluded from the list unless the user explicitly asks to see them.
- ✗ `deleteActivity` action filters `where: { deletedAt: null }` when looking up the activity — so double-deleting is prevented. Good. But the client still shows the row with a "Remove" button for already-soft-deleted rows if the component state is stale before refresh.
- ✗ No equivalent soft-delete exists for Fields — deleting a field cascade-deletes everything under it, including activities with compliance records.

### 2.9 Cache correctness

- ✓ `revalidatePath('/fields')` after field mutations
- ✓ `revalidatePath('/activities')` and `revalidatePath('/dashboard')` after activity mutations
- ✗ `revalidatePath('/fields/${id}')` in `updateField` — this path does not exist (there are no individual field pages yet). Harmless but dead code.
- ✗ Weather page uses `next: { revalidate: 1800 }` in `fetchWeather` but the page itself is `force-dynamic`. The `revalidate` option on `fetch` has no effect inside a `force-dynamic` page — every request re-fetches from Open-Meteo. This is a ~100ms penalty on every weather page load and unnecessary load on Open-Meteo.
- ✗ `revalidatePath('/dashboard')` after creating an activity will trigger the dashboard Server Component to re-run, but the dashboard still uses mock data from Sprint 1. The revalidation is correct in intent but has no visible effect yet.

### 2.10 TypeScript strictness

- ✓ Zero `tsc --noEmit` errors
- ✗ `proxy.ts` uses `require('@clerk/nextjs/server')` to avoid import-time execution — this bypasses TypeScript's module resolution. The `auth` parameter in the callback is typed as `{ protect: () => Promise<void> }` which is a partial type, not the actual `ClerkMiddlewareAuth`.
- ✗ `ActivityRow.date` is typed as `Date` but receives `a.date` from Prisma (a `DateTime`). When serialised to the Client Component via JSON, `Date` objects become strings. The component calls `new Date(a.date)` which works but the TypeScript type says `Date`, not `string | Date`.
- ✗ `WeatherPageClient` calls `isCurrentHourSlot` defined inside the component body after it's used in `find()`. This is a hoisting-dependent function declaration pattern — it works in JavaScript but is confusing and should be lifted.

---

## 3. Agronomy Logic Audit

### 3.1 Is the spray window logic realistic?

**Partially.** The current limits used:

| Factor | Current limit | Agronomic reality |
|--------|--------------|-------------------|
| Wind speed | 15 km/h | Correct for most products. But some require ≤ 8 km/h (e.g. glyphosate near sensitive crops). Product-specific limits should override defaults. |
| Temperature min | 5°C | Correct for most herbicides. Fungicides may need min 8°C for efficacy. |
| Temperature max | 28°C | Should be 25°C for most products (evaporation and inversion risk start earlier). |
| Rain probability | 20% | Too strict. Dutch standard is often stated as "no rain within 4 hours". 20% probability does not mean it will rain. |
| Humidity max | 90% | Correct for most situations. |

### 3.2 Which weather factors are missing?

**Critical omissions:**

1. **Temperature inversion risk**: When `temperature_2m` is significantly warmer than surface temperature at dusk/dawn, spray droplets can drift kilometres. Currently not detected at all. The Open-Meteo API provides `temperature_80m` which would allow inversion detection.

2. **Leaf wetness**: `leaf_wetness_index` is fetched from Open-Meteo but is stored in `HourlyWeather.leafWetness` and never used in `computeSprayWindows`. Wet leaves reduce herbicide uptake and can cause phytotoxicity with certain fungicides. It's fetched, then ignored.

3. **Rain within 4 hours**: The current check is `precipitationProbability > 20%` for the target hour. But sprays have a post-application rain-free period (PHI for entry, not harvest — the "rain-fast" period). For many herbicides this is 1–4 hours. The check should look at the next 4 hours, not just the current hour.

4. **Sunrise/sunset**: Spraying before sunrise or after sunset is avoided by most farmers (visibility, dew). The `is_day` field is fetched but not used.

5. **Frost risk same night**: A herbicide applied in afternoon can be rendered ineffective if frost follows within 12 hours (the plant closes stomata). Not checked.

6. **Buffer zone wind direction**: Spraying near water or sensitive crops requires different wind direction limits depending on which direction the sensitive area is. The `weatherWindDir` is recorded but never factored into spray window calculations.

### 3.3 Are wind, humidity, temperature and rain probability enough?

**No.** At minimum, the following should be added before claiming "EU-compliant spray window":
- Post-application rain-free period check (4-hour window, not single-hour probability)
- `is_day` check (no spraying before 05:30 or after 21:00 in Netherlands)
- Leaf wetness check for fungicide applications

### 3.4 What should be added later?

- **GDD (Growing Degree Days)**: Accumulated from sowing date. Used for BBCH staging and fungicide timing (e.g., apply Septoria fungicide at T1 = BBCH 30–31). Requires sowing date from FieldSeason, already in the schema.
- **Evapotranspiration**: For irrigation scheduling. Open-Meteo provides ET0.
- **Disease pressure models**: Septoria, late blight (BLITECAST), downy mildew based on leaf wetness hours and temperature. These are the core value of an agronomic AI.
- **Product-specific spray windows**: Some products have label restrictions that are stricter than generic weather limits.

---

## 4. Compliance Logic Audit

### 4.1 Is the spray diary structure EU-ready?

**The structure is sound but incomplete.** EU Directive 2009/128/EC Article 67 of Regulation 1107/2009 requires the following to be recorded for each spray application:

| Required field | In schema | In UI | In ComplianceRecord |
|---|---|---|---|
| Date of application | ✓ | ✓ | ✓ |
| Name of plant protection product | ✓ (productId → name) | ✓ | ✓ |
| Area treated (ha) | ✓ | ✓ | ✓ |
| Dose applied | ✓ | ✓ | ✓ |
| Crop treated | ✓ (via FieldSeason) | Shown in dropdown | Stored as `fieldSeasonId`, not denormalised |
| Name of field/plot | ✓ (via FieldSeason → Field) | Shown in dropdown | Stored as `fieldSeasonId`, not denormalised |
| Weather conditions | ✓ (temp, wind, dir, humidity) | ✓ | ✓ |
| **Operator name** | ✓ | ✓ | ✓ |
| **Operator certificate number** | **✗ not in schema** | **✗ not in form** | **✗ not in record** |
| **Product registration number** | ✓ in InventoryItem | ✗ not in form | ✗ not copied to record |
| **PHI (pre-harvest interval)** | ✓ in InventoryItem | ✗ not shown | ✗ not in record |
| **Water volume (L/ha)** | **✗ not in schema** | **✗ not in form** | **✗** |
| **Buffer zone respected** | **✗ not in schema** | **✗ not in form** | **✗** |

### 4.2 What fields are missing for Dutch/RVO context?

The Netherlands has additional requirements beyond the EU minimum (RVO Gewasbeschermingsmiddelen registration):

1. **Operator certificate number (spuitlicentie)**: Every spray operator in the Netherlands must hold a valid certificate. The certificate number must appear in the diary. Currently `operatorName` is a free text field.
2. **GBM registration number**: The formal Dutch registration number (CTB-number) of the plant protection product. Stored in `InventoryItem.registrationNumber` but not copied to ComplianceRecord.
3. **Water volume per hectare (L/ha)**: Required by RVO for spray diary. Completely absent from the schema and UI.
4. **Nozzle type and pressure**: Required for drift-reduction compliance (NL policy, must document if reduced-drift nozzles used).
5. **Spray equipment identification**: Machine serial number or registration. Required by some inspectors.
6. **Buffer zone distance**: Whether the mandatory buffer zone from watercourses was respected.

### 4.3 What must never be guessed automatically?

The following fields must always be entered by the operator and must never be prefilled, auto-generated, or inferred by AI:

1. **Operator name and certificate number** — determines legal liability
2. **Actual date of application** — must be the true spray date, not system date
3. **Actual dose applied** — if the farmer ran out mid-field and applied less, the diary must reflect actual, not planned dose
4. **Area actually treated** — must reflect actual sprayed area, not field area (field may be partially sprayed)
5. **Weather at time of application** — must be observed/measured, not forecast

The AI can **suggest** weather values from Open-Meteo for the application time, but the farmer must **confirm** them. Currently the form has no pre-fill mechanism and no "prefilled from weather data — please confirm" affordance.

---

## 5. Inventory Logic Audit

### 5.1 Is automatic stock deduction safe?

**No. Three critical problems:**

**Problem 1 — No sufficiency check:**
```ts
// activities.ts line 103-116
await db.$transaction([
  db.inventoryItem.update({
    where: { id: d.productId },
    data: { currentStock: { decrement: totalUsed } },
  }),
  ...
]);
```
`currentStock` can go negative. There is no `CHECK` constraint in the Postgres schema and no application-level guard. A farmer recording "sprayed 500L" when stock is 20L will result in `-480L` in the database. The inventory card will show a negative number. This will silently corrupt the farmer's inventory records.

**Problem 2 — Activity and stock deduction are not atomic:**
The `db.activity.create()` is called before the `db.$transaction([...])`. These are two separate database operations. If the transaction fails (product not found, DB error), the Activity record exists but stock was not deducted. The database is inconsistent. The activity count says it happened; the inventory says it didn't.

**Problem 3 — No verification that the product belongs to this farm:**
`db.inventoryItem.update({ where: { id: d.productId } })` does not check `farmId`. A malicious actor who knows a product UUID from another farm could potentially trigger a stock decrement on that product by submitting a crafted form.

### 5.2 What happens if stock is insufficient?

Currently: stock goes negative silently. No warning, no blocking, no notification.

What should happen:
- **Warn at form time**: "You have 18L in stock. This spray will use 15L. Remaining: 3L." (non-blocking)
- **Hard-block at action time**: If stock would go negative, return `{ error: 'Insufficient stock. Current stock: 18L, required: 20L.' }`
- **Allow override with reason**: Professional users sometimes need to record usage even when the system stock is wrong (e.g., they bought more but haven't entered a receipt yet). Provide an override with a mandatory note.

### 5.3 What happens if an activity is deleted?

Currently: the stock deduction is **not reversed**. The activity is soft-deleted but the inventory record permanently shows the stock as consumed.

This creates a scenario:
1. Farmer logs spray: 10L deducted from stock
2. Farmer realises they logged the wrong field → "Remove" activity
3. Activity soft-deleted → stock still shows -10L
4. Farmer logs the correct activity → another 10L deducted
5. Stock is now -20L instead of -10L

### 5.4 Should deletion restore stock or create a correction movement?

**Correction movement is correct.** Regulatory best practice:
- Never modify a historical stock movement
- Create a new `StockMovement` with `direction: 'in'` and `notes: 'Correction: activity ${id} removed'`
- This maintains a complete audit trail of all stock changes

---

## 6. UX Audit

### 6.1 Are forms too long?

**Yes. The spray form is 5 sections and ~12 inputs.** Realistic on-farm use:
- Farmer is on tractor (mobile)
- Gloves on, potentially
- Wants to log immediately after or during spraying
- Attention span for form: ~60 seconds

Current form sections:
1. Activity (field, date, operator, area) — 4 inputs
2. Product (product, dose/ha, unit) — 3 inputs
3. Weather (temp, wind speed, wind direction, humidity) — 4 inputs
4. Notes — 1 input
5. Compliance note — static text

Total: 12 inputs minimum before submitting. This is too long for mobile field use.

### 6.2 Can a farmer log a spray activity in under 60 seconds?

**On desktop with a database pre-populated: maybe 90 seconds.**  
**On mobile with the current form: no. Estimate 3–5 minutes.**

Blockers:
- No weather prefill from Open-Meteo (must open Weather page, note values, return)
- Area must be typed manually (not prefilled from field size)
- Operator name is free text (not a saved person from Employee table)
- Wind direction requires opening a select with 16 options

### 6.3 What should be prefilled by AI?

Fields that CAN be safely prefilled from existing data (with user confirmation):

| Field | Source | Confidence |
|---|---|---|
| Date | System clock | High — but farmer should confirm (backdating is common) |
| Area sprayed | Field.hectares from selected FieldSeason | Medium — farmer may have sprayed part of the field |
| Temperature | Open-Meteo historical for application time | Medium — confirm required |
| Wind speed | Open-Meteo historical for application time | Medium — confirm required |
| Wind direction | Open-Meteo historical for application time | Medium — confirm required |
| Humidity | Open-Meteo historical for application time | Medium — confirm required |
| Operator | Last-used operator or logged-in user | High — remember and pre-select |
| Product dose | Last dose used for this product | Medium — might be different spray target |

Fields that must NEVER be prefilled:
- Actual dose applied (regulatory, must be measured)
- Operator certificate number (legal identity)
- The application date when logging a past application

### 6.4 What should be hidden under advanced mode?

**Basic mode (for 80% of use cases, <60s target):**
- Field (dropdown)
- Date (pre-filled with today, editable)
- Product (dropdown)
- Area sprayed (pre-filled from field, editable)
- Weather: auto-fetched from Open-Meteo for selected time, shown as read-only with "Edit" link

**Advanced mode (tap to expand):**
- Manual weather override (all 4 weather fields)
- Dose unit override
- Notes
- Operator name override (if logged-in user is the operator)

This would bring the basic-mode entry to 3 inputs: field, product, confirmation of weather. **Under 30 seconds.**

---

## 7. Top 50 Risks

### Category A: Data Integrity (1–12)

1. **Stock goes negative silently.** No constraint or application guard. Inventory data becomes useless.
2. **Activity created but stock not deducted.** Race condition: activity.create succeeds, transaction fails. Inconsistent state with no recovery path.
3. **Field hard-delete cascades into regulatory records.** A compliance record that must be kept for 3 years (EU) can be destroyed by clicking "Delete" on a field.
4. **Soft-deleted activities show in list.** `deletedAt` is not filtered in the Prisma query. Farmers see removed records.
5. **Date off-by-one due to UTC.** A spray logged at 23:00 NL time appears as the previous day in the diary. Regulatory date is wrong.
6. **ComplianceRecord.data JSON has no schema.** Future code changes can write incompatible shapes. No validation at read time.
7. **No Season = empty Activities dropdown.** New user creates fields but cannot log anything. Silent failure.
8. **StockMovement.direction is a string, not enum.** Typo ("Out" vs "out") would break filtering and reporting.
9. **weatherRainMm field in schema, never populated.** When a compliance inspector requests this field, the data is missing.
10. **Product ownership not verified during stock deduction.** Cross-farm inventory manipulation is theoretically possible.
11. **No DB-level check constraints.** Negative stock, NDVI > 100, humidity > 100 are all possible.
12. **Task.farmId has no relation defined.** Orphaned tasks can be created. Queries by farm will miss them.

### Category B: Security (13–20)

13. **Dev fallback shows all farms.** `db.farm.findFirst()` in development returns any farm to any unauthenticated request. Demo/staging data exposed.
14. **Server Action parameter injection.** `deleteField(id: string)` takes a raw ID from the client with no CSRF token beyond what Next.js provides. Rate limiting absent.
15. **`getActiveFarmOrThrow()` throws instead of returning error.** Uncaught throw in Server Action context crashes the page instead of showing a form error.
16. **No audit log.** There is no record of who deleted what, when, from which IP. For regulatory compliance this is a gap.
17. **Clerk disabled in dev.** Any user hitting the dev server can access any farm. Acceptable in development, catastrophic if dev server is accidentally exposed.
18. **No input sanitisation for `notes` field.** Max 2000 chars is validated but no XSS protection beyond React's default escaping. If notes are ever rendered as HTML (e.g., PDF export), this becomes an injection vector.
19. **UUID guessing.** UUIDs are hard to guess but not impossible. Without row-level farm ownership checks on every query, a known UUID could be queried.
20. **`proxy.ts` uses `require()` with a runtime check.** If Clerk is partially configured (key present but invalid), the check passes but Clerk throws at auth time with a non-actionable error.

### Category C: Product/UX (21–34)

21. **No onboarding flow.** First-time user cannot use the product after completing setup.
22. **No Season management UI.** Core data model requirement with no UI surface.
23. **FieldSeason concept not explained.** Farmers do not think in "field seasons".
24. **Area sprayed not prefilled.** Every form entry requires manual typing of a value the system already knows.
25. **Weather not prefilled.** The most tedious part of the spray form requires manual lookup and re-entry.
26. **No "log from field" shortcut.** User must navigate to Activities page to log.
27. **No confirmation after spray log.** Farmer doesn't know if the diary record was created.
28. **Deleted activities visible in list.** Confusing and clutters the primary view.
29. **Empty state in Activities doesn't explain Season requirement.** User has no path forward.
30. **No mobile optimisation.** Forms are desktop-width. Target users are on phones in fields.
31. **"Log spray" button only opens spray form.** Fertiliser, tillage, harvest have no dedicated entry point.
32. **Activity list shows 200 records.** No pagination. A farm with 2 years of history returns 200 rows on every page load.
33. **No search or date range filter on activities.** Finding a specific application is difficult at scale.
34. **Weather page shows hours 05:00–22:00 hardcoded.** In winter, sunrise is 08:30 — many of the early hours shown are irrelevant.

### Category D: Agronomy (35–42)

35. **Leaf wetness fetched, never used.** Critical for fungicide spray decisions — data is there, logic is not.
36. **No temperature inversion detection.** High-risk spray conditions in mornings/evenings are undetected.
37. **Rain-free period check is single-hour, not 4-hour.** Sprays applied with 20% rain chance in hour 3 appear "open" even if hour 1 and 2 are high risk.
38. **`is_day` fetched, never used.** Night spraying is blocked in practice but not in the system.
39. **No BBCH-aware spray timing.** The schema has `bbchStage` but it is not used in any logic.
40. **Wind speed limit is fixed at 15 km/h for all products.** Many label restrictions are 8–12 km/h.
41. **Temperature max is 28°C.** NL regulatory guidance and most product labels say 25°C for drift risk.
42. **No GDD accumulation.** The system cannot tell the farmer if it's time for a T1 or T2 fungicide application.

### Category E: Compliance (43–50)

43. **Operator certificate number absent.** Dutch spuitlicentie number required for legal spray diary.
44. **Water volume (L/ha) absent.** Required by RVO; completely missing from schema and UI.
45. **GBM registration number not copied to ComplianceRecord.** Stored in inventory but not denormalised into the diary record. If product is deleted, the diary loses its product reference.
46. **PHI (pre-harvest interval) not shown at spray time.** Farmer could spray 3 days before harvest without any warning.
47. **Buffer zone compliance not recorded.** Required field for NL spray diary.
48. **Nozzle type/drift reduction not recorded.** Required by NL policy for certain sensitive areas.
49. **ComplianceRecord.confirmed never set to true automatically.** The field exists but there is no workflow for confirmation. All records remain `confirmed: false` indefinitely.
50. **No 3-year retention enforcement.** EU requires diary records for 3 years. There is no soft-delete protection period — an admin could destroy records and the system would not prevent it.

---

## 8. Improvement Plan

### 🔴 CRITICAL FIXES (must be done before any real farm data is used)

**C1 — Prevent negative stock**
Add a sufficiency check in `createActivity` before deducting: if `currentStock < totalUsed`, return `{ error: 'Insufficient stock: have X, need Y' }`. Add a PostgreSQL CHECK constraint `currentStock >= 0` to prevent database-level violations.

**C2 — Make activity creation atomic**
Wrap `db.activity.create()` + compliance record creation + stock deduction into a single `db.$transaction(async (tx) => { ... })`. Either all succeed or all roll back.

**C3 — Verify product farm ownership in stock deduction**
Add `farmId: farm.id` to the `inventoryItem.update` where clause to prevent cross-farm manipulation.

**C4 — Restore stock when activity is soft-deleted**
In `deleteActivity`, after soft-deleting, create a `StockMovement` with `direction: 'in'` for the reversed quantity, linked to the original activity with a note.

**C5 — Prevent field hard-delete when activities exist**
Before deleting a field, check for existing activities (including soft-deleted). If any exist, block the delete and return an error. Or convert to a soft-delete model for fields.

**C6 — Filter soft-deleted activities from list**
Add `deletedAt: null` to the `db.activity.findMany` where clause in `activities/page.tsx`.

**C7 — Handle `getActiveFarmOrThrow()` throws gracefully**
Wrap Server Action bodies in try/catch. Convert uncaught errors to `{ error: 'message' }` returns so the UI receives an error state instead of crashing.

**C8 — Fix UTC date off-by-one**
When parsing `z.string().date()`, interpret the date in Europe/Amsterdam timezone, not UTC. Use a timezone-aware date library or construct the DateTime with explicit offset.

### 🟡 IMPORTANT FIXES (before production launch)

**I1 — Minimum Season + FieldSeason onboarding UI**
Create a simple "Start new season" flow: year picker → assign each field a crop → confirm. Without this the Activities module is inaccessible to new users.

**I2 — Prefill weather from Open-Meteo in spray form**
When the user selects a date and time, fetch the closest hourly weather observation and populate temperature, wind speed, wind direction, humidity as "suggested" values with a "Prefilled from weather forecast — confirm" indicator.

**I3 — Prefill area from FieldSeason**
When a field is selected in the spray form, populate `areaHa` from the field's hectares. Make it editable.

**I4 — Add operator certificate number field**
Add `certificateNumber` to the operator name field group. Store in Activity and ComplianceRecord. Make it required for spray activities. Pre-save from Employee table if configured.

**I5 — Add water volume (L/ha) field**
Add `waterVolumePerHa` to the Activity schema and spray form. Make it optional now, required later.

**I6 — Copy product registration number to ComplianceRecord**
At spray time, denormalise `InventoryItem.registrationNumber` into the ComplianceRecord.data JSON so the diary remains valid even if the inventory item is deleted.

**I7 — Fix Weather cache strategy**
Remove `force-dynamic` from `weather/page.tsx` and use `export const revalidate = 1800` instead. The `fetch` inside `fetchWeather` already has `next: { revalidate: 1800 }` which will work correctly on a statically-generated or ISR page.

**I8 — Use leaf wetness in spray window calculator**
Add a check: if `leafWetness > 0.5` (scale 0–1), add a warning blocker "Wet leaves — reduced herbicide uptake" without blocking the window outright.

**I9 — Add 4-hour rain-free period check**
In `computeSprayWindows`, check the next 4 hourly slots for rain probability > 40% and add a blocker if found.

**I10 — Use `is_day` flag to block night spraying**
Add `if (hour.isDay === 0) blockers.push('Night spraying not recommended')`.

**I11 — StockMovement.direction should be an enum**
Change `direction String @db.VarChar(3)` to a Prisma enum `StockDirection { in out }`.

**I12 — Add PHI warning at spray time**
When a product is selected, display: "⚠️ PHI: 28 days. Harvest after [date]." calculated from application date.

### 🟢 NICE TO HAVE (Sprint 4+)

**N1 — Quick-log mode (mobile)**
3-input mode: field, product, confirm weather. Submits with defaults. Expandable for full form.

**N2 — "Log from Field" shortcut**
On the Fields list, each row gets a "Log activity" quick action that opens the spray form with the field pre-selected.

**N3 — Show soft-deleted activities in a "Removed entries" collapsible section**
Keep them accessible for audit but hidden from the primary view.

**N4 — Pagination on activities list**
Replace `take: 200` with cursor-based pagination. Show 20 records, "Load more".

**N5 — Activity list date range filter**
Default to current season. Allow custom range.

**N6 — ComplianceRecord confirmation workflow**
Add a "Review & confirm" step after logging spray. Shows the generated diary entry. Farmer taps "Confirm" → `confirmed: true`. Unconfirmed records flagged on dashboard.

**N7 — GDD accumulation from sowing date**
Compute and store GDD per FieldSeason. Show on Fields page alongside BBCH stage.

**N8 — 3-year retention enforcement**
Add a `lockedAt` field to Activity. After 3 years, set `lockedAt` automatically. Locked records cannot be soft-deleted.

**N9 — Spray equipment identification**
Add `machineId` (FK to Machine) to Activity. Pre-select the last used sprayer.

**N10 — Temperature inversion detection**
Fetch `temperature_80m` from Open-Meteo. If `temp_80m > temp_2m + 2°C` at dusk/dawn, add "Inversion risk — check drift" blocker.

### ⛔ DO NOT BUILD YET

- **Map view for fields**: Requires geo data, a tile provider, polygon drawing. Valuable but scope-heavy.
- **Disease models (Septoria, late blight)**: Requires field-calibrated models, historical leaf wetness data, and crop-specific logic. Do not ship until BBCH tracking and leaf wetness integration are stable.
- **PDF spray diary export**: Needed for compliance but format varies by country/inspector. Build after the data model is complete.
- **Multi-farm / enterprise accounts**: Do not add until single-farm flow is fully validated.
- **Push notifications for spray windows**: Do not add until the spray window logic passes agronomic review.
- **Satellite NDVI integration**: Expensive (Sentinel API costs, image processing) and complex. Placeholder in schema is correct — do not build yet.
- **Offline mode / service worker**: Significant complexity. Address once mobile UX is validated.
- **Third-party integrations (John Deere Operations Center, CNH AFS)**: Post-product-market-fit.

---

## Summary Table

| Area | Status | Blocker for production |
|---|---|---|
| Fields CRUD | Working with hard-delete risk | Yes (C5) |
| Activities log | Working but stock unsafe | Yes (C1, C2, C3) |
| Soft delete | Logic correct, UI shows deleted | Yes (C6) |
| Spray window | Partially correct | No (I8, I9) |
| EU compliance | Missing 3+ required fields | Yes (I4, I5, I6) |
| Auth/farm safety | Dev fallback acceptable, prod ok | No |
| Error handling | Server Actions can crash page | Yes (C7) |
| Onboarding | Completely absent | Yes (I1) |
| Date handling | Off-by-one risk | Yes (C8) |
| TypeScript | Clean | No |
| Build | Clean | No |
