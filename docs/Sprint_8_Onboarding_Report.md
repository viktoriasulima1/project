# Sprint 8 — Complete Farm Onboarding, Empty States and Module Guards

**Goal:** a brand-new authenticated user can create a real farm and reach a usable dashboard without seed data or developer tools. Achieved, with the schema footprint reduced due to a persistent environment blocker (see §2).

---

## 1. Files created / changed

**New:**
- `src/lib/farm-setup.ts` — `getFarmSetupState()` state machine resolver
- `src/lib/require-farm.ts` — `requireFarm()` centralized guard
- `src/lib/actions/onboarding.ts` — `createFarm`, `addOnboardingInventoryItem`, `addOnboardingEmployee`
- `src/app/onboarding/layout.tsx` + `.module.css` — minimal layout outside the farm `AppShell`
- `src/app/onboarding/page.tsx` — server resolver + resume logic
- `src/components/onboarding/OnboardingWizard.tsx` + `.module.css` — the 9-step wizard
- `prisma/migrations/20260713000001_sprint8_onboarding/migration.sql`
- 5 new test files (see §7)

**Changed:**
- `prisma/schema.prisma` — Farm/Season additions (see §2)
- `src/lib/farm.ts` — added exported `getClerkUserId()`
- `src/lib/actions/fields.ts` — `createField`/`FieldFormState` now returns `fieldId`
- `src/lib/actions/dev-demo-farm.ts` — hardened per §6
- `src/lib/dashboard-data.ts` — weather now uses real farm coordinates + fixed a latent UTC/Amsterdam date bug (`getAmsterdamDateString()` instead of `toISOString().slice(0,10)`)
- `src/app/(farm)/dashboard/page.tsx`, `fields/page.tsx`, `activities/page.tsx`, `weather/page.tsx`, `inventory/page.tsx`, `finance/page.tsx`, `compliance/page.tsx`, `ai/page.tsx` — guards + empty states
- `src/components/layout/StubPage.tsx` — added optional `action` link

---

## 2. A mid-sprint environment decision (read this first — it shaped everything else)

Attempting to add the requested Farm/Season fields (`farmType`, `legalName`, `city`, `province`, `postalCode`, `timezone`, `currency`, `Season.name`) hit the same Prisma Windows file lock that has blocked `npx prisma generate` all session (3 Node processes, almost certainly the running dev server, hold the query engine DLL open). The migration SQL applies to the database fine (confirmed via `--skip-generate`), but the **generated TypeScript client** — which is what `tsc` actually checks against, not `schema.prisma` — was never regenerated. Writing code against fields the generated client doesn't know about would fail typecheck immediately.

I stopped and asked you how to proceed rather than guess. You chose: **build the full wizard using only fields already in the generated client**, leave the migration applied to the database for later, and defer the extra fields until `prisma generate` can run.

Concretely, this means:
- **Farm details step** collects: name, location, country, total hectares (optional), BRP number (optional), VAT number (optional), latitude/longitude (optional) — not farm type, legal name, city/province/postal code separately, or timezone/currency.
- **Active season step** collects: year, start date, end date — not a separate season name.
- Parts 3 and 4 of the original brief (Farm details / Farm location as two distinct steps) were **merged into one step**, since the reduced field set didn't justify splitting them, and fewer steps serves the "under 5 minutes" UX target better.
- `totalHectares` is optional in the UI but still always sent as a number (defaulting to 0) — the generated client's `Farm.totalHectares` type is still `Decimal` (non-nullable), reflecting the schema *before* this sprint's `DROP NOT NULL` change, which the database has but the client doesn't know about yet.

**Once `npx prisma generate` can run** (stop the dev server, or however you prefer to release the lock), the deferred fields are already in `schema.prisma` and the database — wiring them into `createFarm`/the wizard form is a small follow-up, not a re-migration.

---

## 3. Onboarding state model

`getFarmSetupState()` (`src/lib/farm-setup.ts`) is the single resolver every page and guard uses — no page re-derives this independently.

| State | Meaning | `nextRoute` | `completionPercent` |
|---|---|---|---|
| `no_farm` | No farm linked to this Clerk user | `/onboarding` | 0 |
| `farm_created` | Farm exists, has never had any season | `/onboarding?step=season` | 20 |
| `no_active_season` | Farm has season(s), but none currently active | `/onboarding?step=season` | 20 |
| `no_fields` | Active season exists, zero fields | `/onboarding?step=field` | 50 |
| `no_field_seasons` | Fields exist, none assigned to the active season | `/onboarding?step=crop` | 75 |
| `ready` | Farm, active season, ≥1 field, ≥1 field season all exist | `/dashboard` | 100 |

`farm_created` and `no_active_season` are deliberately distinct (both route to the same step) — the former means the farm has literally never had a season; the latter means it has one or more seasons but all are inactive (e.g. last season ended and a new one hasn't started). Same recovery step, different diagnostic meaning.

---

## 4. Onboarding route and steps

`/onboarding` (outside the `(farm)` route group — a user with no farm has nothing for the farm nav sidebar to point at). 9 practical steps (see §2 for why 10 became 9): **Welcome → Farm details → Active season → First field → Crop assignment → Inventory (optional) → Employee & licence (optional) → Review → Complete.**

**Progressive persistence, not a single mega-transaction:** each required step calls its own server action and writes to the database immediately (`createFarm`, the existing `createSeason`, `createField`, `addFieldToSeason` — reused, not duplicated). This is what makes "preserve progress after refresh" work for free: `getFarmSetupState()` is recomputed fresh from the database on every page load, so refreshing mid-wizard resumes at the correct step without needing localStorage or a draft-state table. It also means a failed step genuinely can't corrupt an earlier one — earlier steps already committed successfully, or the user wouldn't have advanced.

**Reused existing, already-hardened code** rather than duplicating: `createSeason` (transactional, deactivates old active seasons, existing tests), `createField` (validated, farm-scoped, existing tests), `addFieldToSeason` (verifies both field and season belong to the current farm, existing tests). Only `createFarm`, `addOnboardingInventoryItem`, and `addOnboardingEmployee` are new.

**A specific step can be requested post-setup** (`/onboarding?step=inventory`) without triggering the "already ready → redirect to dashboard" behavior — this lets Inventory's empty state link to a real "add a product" form by reusing the onboarding step, rather than building a second form.

---

## 5. Access guards and empty states

`requireFarm()` (`src/lib/require-farm.ts`) redirects to `/onboarding` when there is no farm at all, and is now used by Fields, Activities, Inventory, Finance, Weather, Compliance, and AI. Dashboard does **not** use it — it shows the "Finish setting up your farm" CTA with a completion-percent bar instead, per spec.

**Deliberate divergence from the literal Part 11 cascade** (redirecting on `no_active_season`/`no_fields`/`no_field_seasons` too): I only redirect on `no_farm`. Reasoning: Fields is itself the tool that fixes `no_fields` — redirecting it away would make its own "add your first field" empty state (required by Part 12) unreachable, a direct contradiction between the two parts of the brief. Applying the same logic to Inventory/Finance/Weather/Compliance/AI (all independently meaningful with zero fields/seasons), I kept the redirect to the one unambiguous, non-contradictory condition and let each page's own contextual empty state — already required by Part 12 — handle the rest. This also makes "no redirect loop" trivial to guarantee: exactly one condition ever redirects, to one target, and `/onboarding` never calls `requireFarm()` itself.

Empty states implemented, each with one action:
- **Dashboard:** "Finish setting up your farm" + completion bar + "Start onboarding" (+ dev-only "Load demo farm")
- **Fields:** pre-existing "No fields yet" + "Add field" (untouched, already correct)
- **Activities:** pre-existing `SetupGuide` component (inline season/field-assignment flow) — kept as-is; wording differs slightly from the brief's suggested copy but covers the same two sub-states already
- **Inventory:** "Add your first product or fertiliser" → links to `/onboarding?step=inventory`
- **Finance:** "No financial records yet" (text only — no real P&L exists to link to)
- **Weather:** "Add farm coordinates to receive local weather" → links to `/onboarding?step=farm`; **this is a real logic fix**, not just copy — the page previously ignored the farm entirely and always used a hardcoded env-var location
- **Compliance:** "Compliance records will appear after regulated activities" → links to `/activities`
- **AI:** "AI insights become available as farm data is added" (text only)

---

## 6. Security (Part 14)

- `createFarm` derives `clerkUserId` **only** from the server-side Clerk session (`getClerkUserId()`), never from form data — verified by a test that submits a spoofed `clerkUserId` field and asserts it's ignored.
- `createFarm` is idempotent: a user who already owns a farm gets that farm back rather than a duplicate — this also makes double-submission safe for free.
- `addOnboardingInventoryItem`/`addOnboardingEmployee` both verify farm ownership via `db.farm.findUnique({ where: { clerkUserId } })` before writing, and scope the created row to that farm's id — never a client-supplied `farmId`.
- `addFieldToSeason` (reused, pre-existing) verifies both the field and the season belong to the current farm before creating a `FieldSeason` — rejects cross-farm IDs.
- All action error returns are structured (`{ error }` / `{ fieldErrors }`), never a raw thrown database error surfacing to the UI.
- **`loadDemoFarm` hardened per Part 13:** now checks whether the signed-in user already owns a farm before relinking. If they own a *different* real farm, it refuses with a clear error ("you already have a farm — demo farm not loaded, to avoid overwriting it") instead of stealing it. If they already own the demo farm itself, it's a no-op success (idempotent). Still double-guarded by `NODE_ENV === 'development'` (action) and only rendered in dev (dashboard button).

---

## 7. Tests added — 90/90 passing (77 pre-existing + 13 new/expanded)

- `src/lib/__tests__/farm-setup.test.ts` (7 tests) — every state transition, plus an explicit "never routes ready back to /onboarding" no-loop check
- `src/lib/__tests__/require-farm.test.ts` (2 tests) — redirects on no farm, passes through otherwise
- `src/lib/actions/__tests__/onboarding.test.ts` (7 tests) — `createFarm` auth/ownership/idempotency/mass-assignment, `addOnboardingInventoryItem`/`addOnboardingEmployee` ownership
- `src/lib/actions/__tests__/seasons.test.ts` (6 tests, new file for pre-existing actions) — only-one-active-season, transactional deactivation, duplicate-season error handling, `addFieldToSeason` cross-farm rejection
- `src/lib/actions/__tests__/dev-demo-farm.test.ts` (5 tests) — dev-only guard, refuses to overwrite a real farm, relinks when unowned, no-op when already owned, requires a session

Mapped against the 20-item list in Part 16: items 1–11, 13–15, and 20 have direct automated tests. Items 12 (optional-step-skippable), 16–19 (dashboard-loads-after-onboarding, activities-receives-fieldseason, weather-handles-missing-coordinates, refresh-preserves-progress) are architectural properties of the design (progressive persistence + `getFarmSetupState()` recomputed fresh) rather than independently unit-testable without a browser/component-rendering harness (none exists in this project yet — see §8).

---

## 8. Manual verification results

Ran: `npx prisma migrate dev` (already in sync ✓), `npx tsc --noEmit` (0 errors ✓), `npx vitest run` (90/90 ✓), `npm run build` (succeeded, `/onboarding` compiles as a dynamic route alongside all existing routes ✓). `npx prisma generate` remains blocked by the pre-existing lock (see §2).

Verified directly against the real database (no browser available in this environment):
- The seeded farm (`dev-farm-gelderland`) resolves through the real season/field/fieldSeason counts to `ready` — confirmed via a throwaway script running the exact same queries `getFarmSetupState()` uses, then deleted.
- A never-seen Clerk user id resolves to no farm found (`no_farm`) — confirmed the same way.

**Not verified** (require a browser + a real second Clerk account, unavailable here): signing in as a genuinely new user through the actual UI, clicking through all 9 wizard steps by hand, and confirming a second Clerk user cannot see farm A's data through the rendered Fields/Activities pages. The underlying guarantees (ownership checks, `requireFarm` redirect, `getFarmSetupState` correctness) are unit-tested; the end-to-end click-through is not.

---

## 9. Remaining risks

- **Deferred schema fields** (farm type, legal name, city/province/postal code, timezone, currency, season name) are migrated into the database but not yet wired into any code — needs `prisma generate` to unblock, then a small follow-up to add them to `createFarm`'s form/schema.
- **Back navigation in the wizard doesn't re-submit edits** — going back to an already-completed step shows the current known values but clicking "Continue" again doesn't update a farm/season/field that already exists (the underlying actions are create-only, not upsert-with-edit). Fine for a first pass; a real "edit" affordance is future work.
- **No component-level render tests exist for the wizard itself** — all onboarding tests are server-action/resolver unit tests. The step-to-step client flow (advancing state, skip buttons, back navigation) is untested beyond manual code review.
- **Reusing the onboarding wizard for post-setup "quick add" flows** (Inventory's empty-state link) works but isn't polished — clicking "add a product" from Inventory after setup is already complete still walks through the inventory→employee→review→complete tail of the wizard rather than a focused single-field modal.
- **`addOnboardingInventoryItem`/`addOnboardingEmployee` have no dedicated UI outside onboarding** — there's still no general-purpose "add product" or "manage employees" page; Inventory/Compliance's empty-state links are currently the only way to reach these forms.

## 10. Recommended next sprint

1. Once the Prisma lock clears: run `prisma generate`, then wire `farmType`/`legalName`/`city`/`province`/`postalCode`/`timezone`/`currency`/`Season.name` into `createFarm` and the wizard's farm-details form.
2. Build a real Inventory management page (list, edit, delete) so the onboarding step stops being the only way to add a product.
3. Add a lightweight component-rendering test harness (React Testing Library or similar) so the wizard's client-side step transitions and skip/back behavior can be tested directly, not just the server actions underneath them.
