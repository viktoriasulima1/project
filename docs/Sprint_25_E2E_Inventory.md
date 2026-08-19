# Sprint 25 — E2E Inventory & Execution Status (Parts 1–2)

Date: 2026-07-16. A complete inventory of every Playwright spec, its seed/auth
requirements, and — honestly — whether it was executed this iteration.

## Executed + stabilized (2026-07-17)

**Clerk connectivity returned and the full suite now executes and passes.** First
run surfaced 17 real failures; all were triaged and fixed
(`docs/Sprint_25_E2E_Failure_Triage.md`), including three product defects (Weather
badge contrast, the `workOrderId` sync-allowlist drop that stopped WorkOrder
completion, and reversed-record mislabelling). **Two consecutive clean full runs**
(CI mode, `--retries=2` for the sandbox's external Clerk-CDN/Open-Meteo
flakiness): run 1 = 92 passed / 1 flaky-recovered / 0 failed / 1 skipped (exit 0);
run 2 = 93 passed / 0 flaky / 0 failed / 1 skipped (exit 0). No new Clerk users.
The Sprint 23 WorkOrder-lifecycle spec and all Sprint 25 specs pass. The single
skip is the documented conditional pilot-smoke auth test. **Economics pilot
automated gate: GO; offline mobile pilot: NO-GO (physical devices pending).** The
historical "not executed" notes below are superseded.

## Latest attempted run + Clerk preflight hardening (2026-07-16)

The most recent attempts were **blocked inside global setup**: `clerkSetup()` /
`clerk.users.getUserList()` failed with Clerk `code: unexpected_error` /
`message: fetch failed`. **Zero application scenarios executed** — this is an
external Clerk/network blocker, not an application or test failure. No E2E pass
and no application failure is claimed.

Hardening added this iteration so the failure is explicit, fast and
non-misleading (never bypassing auth, never mocking Clerk in the normal suite):

- **`e2e/setup/clerk-preflight.ts`** — validates env + development-key shape
  (`pk_test_`/`sk_test_`, refuses `*_live_`), resolves DNS, then makes **one**
  harmless authenticated request (`users.getUserList({ limit: 1 })`) under an
  8s bounded timeout with a **small bounded retry** (≤3 attempts, exponential
  backoff) for transient errors only. Classifies failures as `missing_env` /
  `invalid_key` / `dns_failure` / `network_unreachable` / `timeout` /
  `quota_exceeded` / `clerk_service_error` (credential/quota errors are **not**
  retried). Prints only host / category / booleans / timestamp — **never keys,
  headers or tokens**.
- **`e2e/global.setup.ts` reordered** — preflight → `clerkSetup` → migrate →
  reset → seed → storage states. Destructive DB work now happens **only after**
  auth connectivity is confirmed. The DB safety guards are unchanged.
- **`npm run test:e2e:preflight`** (`e2e/setup/preflight.ts`) — read-only:
  checks safe DB target, fixed-pool config, Playwright browsers, local port
  3100 free-or-reusable, and Clerk connectivity. **Resets no data, creates no
  users.**

Latest `npm run test:e2e:preflight` output in this environment (verbatim,
read-only): DB target `farmos_e2e` **PASS**, pool config **PASS**, browsers
**PASS**, port 3100 free **PASS**, **Clerk connectivity FAIL — `timeout`**
(`dns resolved: true`, `https reachable: unknown`, 3 attempts). DNS resolves but
the HTTPS request to `api.clerk.com` never completes — a network/firewall block
at the TCP/TLS layer, confirmed empirically.

## Execution environment finding (decisive)

The dedicated E2E suite **could not be executed in this environment**. Two
concrete, empirically-confirmed blockers:

1. **Clerk backend is unreachable.** `global.setup.ts` calls `clerkSetup()` +
   `clerk.signIn()` for all four fixed-pool identities against Clerk's Frontend
   API. A direct probe of `https://api.clerk.com` and `https://clerk.com` both
   **timed out**. Every authenticated spec declares `dependencies: ['setup']`,
   so if global setup cannot sign in, the entire main suite cannot run.
2. **A `next dev` server already occupies the project.** Launching the harness
   failed with *"Another next dev server is already running"* (PID on :3000);
   Next refuses a second dev instance in the same project directory. (Secondary —
   even resolved, blocker #1 remains.)

Confirmed **reachable/healthy**: Postgres `localhost:5432` (TCP test succeeded),
Playwright browsers installed (`chromium-1228`), `.env.e2e` present with
`pk_test`/`sk_test` keys and the four `+clerk_test@example.com` fixed-pool
emails. So the blocker is **network access to Clerk (an external service)** — a
`network/external-service` class blocker (Part 7), not a test/app/seed defect.

**No E2E pass is claimed. No run counts are reported as if executed.** The specs
below are written and typechecked (the repo `tsconfig` includes `**/*.ts`, and
`tsc --noEmit` is clean); their execution remains gated on Clerk reachability.

## Spec inventory

| Spec | Scenarios | Auth identity | Seed data | Reset assumptions | External dep | Expected result | Executed? | Skipped? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `golden-path.spec.ts` | Sign-in → first activity → back (1) | userNew (storageState) | `resetNamedE2eUser(NEW)` | global reset + per-test user reset | Clerk | Full happy path completes | **No (Clerk gated)** | No |
| `failure-paths.spec.ts` | Validation / error paths (4) | userReady + NEW | `resetNamedE2eUser(NEW)` | global reset | Clerk | Honest errors, no crash | No (gated) | No |
| `isolation.spec.ts` | Cross-farm UI + server-id rejection (7) | userReady | `seeded-farms.json` (READY/OTHER) | seeded once in setup | Clerk | No cross-farm leak; ids rejected | No (gated) | No |
| `accessibility.spec.ts` | axe checks | userReady | seeded READY farm | global reset | Clerk | No serious a11y violations | No (gated) | No |
| `founder-walkthrough.spec.ts` | Onboarding narrative | userNew (+OTHER) | `resetNamedE2eUser(NEW)`, `seeded-farms.json` | global reset | Clerk | Narrative walkthrough passes | No (gated) | No |
| `sprint16-close-the-loops.spec.ts` | Spray suitability→activity; finance cost; low-stock insight; weather-failure (5) | userReady + PILOT | `seedReadyFarm(PILOT,…)` | per-test PILOT reset+seed | Clerk; weather (failure-mocked) | Loops close; real cost/insights | No (gated) | No |
| `sprint18-ctgb-brp.spec.ts` | Ctgb link, BRP import, failure flows (≈6) | PILOT | `seedReadyFarm(PILOT,…)` | per-test PILOT reset+seed | Clerk; Ctgb/PDOK (env-mocked) | Ctgb/BRP happy + failure paths | No (gated) | No |
| `sprint19-compliance-corrections.spec.ts` | Correction, reversal, PDF, CSV, cross-farm attack (5) | PILOT | `seedReadyFarm(PILOT,…)`, `seeded-farms.json` | per-test PILOT reset+seed | Clerk | Corrections/exports/attack rejected | No (gated) | No |
| `sprint20-offline-sync.spec.ts` | Offline draft survives + syncs once; SW/manifest safe (2) | userReady | seeded READY farm | global reset | Clerk; service worker | Exact-one offline sync | No (gated) | No |
| `sprint25-reallocation.spec.ts` | Allocate unallocated (A); partial remainder (D) | PILOT | `seedReadyFarm(PILOT,…)` | per-test PILOT reset+seed | Clerk | Reallocation via dialog | No (gated) | No |
| `sprint25-field-detail.spec.ts` | A complete detail; B missing-data; C correction hist; D realloc hist; E reversal; F purchase; G cross-farm; H offline; I mobile | PILOT | `seedReadyFarm(PILOT,…)` | per-test PILOT reset+seed | Clerk | Field Detail economics + history | No (gated) | No |
| `sprint25-dashboard-reports.spec.ts` | A signal→CTA; B missing-price; C unallocated-rev; D PDF; E CSV; F season; G cross-farm 403; H offline; I mobile | PILOT | `seedReadyFarm(PILOT,…)` | per-test PILOT reset+seed | Clerk | Signals + reports | No (gated) | No |
| `sprint23-workorder-lifecycle.spec.ts` **(new)** | A plan→WO; B reservation; C blockers×2; D start; E complete-through-Activity; F/H exact-one; G cancel; I cross-farm; J offline; K mobile×2 (12) | PILOT + OTHER ids | `seedReadyFarm(PILOT,…)`, `seeded-farms.json` | per-test PILOT reset+seed | Clerk | Full WorkOrder lifecycle, exact-one | No (gated) | No |
| `mobile/critical-flow.spec.ts` | Mobile nav, FAB, activity, numeric inputs, offline (5) | userReady (iPhone 12/14ProMax) | seeded READY farm | global reset | Clerk | Mobile layout + activity | No (gated) | No |
| `pilot/smoke.spec.ts` | Health, public pages, anon redirect, SW/manifest, authed pilot (5) | none / storageState env | none | none | separate pilot config (HTTPS origin) | Public safety + authed reachability | No (gated) | **1 conditional** |

## Sprint 23 WorkOrder-lifecycle spec — now authored (2026-07-16)

`e2e/sprint23-workorder-lifecycle.spec.ts` now exists — **WRITTEN /
TYPECHECKED / NOT EXECUTED** (Clerk unreachable). `npx playwright test … --list`
discovers **12 scenarios** under the chromium project; `tsc --noEmit` is clean.
It closes the previously-missing lifecycle coverage:

| Flow | Scenario | Exact-one verification point (`db-inspect` helper) |
| --- | --- | --- |
| A | Plan item → one WorkOrder, no activity yet | `countForFarm`: workOrders=1, activities=0, activeReservations=1 |
| B | Reservation holds stock; over-reserve prevented | `inventoryStock`: currentStock unchanged, activeReserved=qty |
| C | Insufficient stock rejected; spray-no-operator reads Blocked | counts unchanged on reject |
| D | Start → in_progress, reservation kept, no activity | `countForFarm`: activities=0, activeReservations=1 |
| E | Complete through Activity | activities=1, completedWorkOrders=1, consumedReservations=1, `workOrderState` completed + audit `completed` |
| F/H | No double completion (exact-one) | activities stays 1; second attempt refused |
| G | Cancel releases reservation, no activity | releasedReservations=1, activities=0, audit `archived` |
| I | Cross-farm fieldSeason id rejected as "not found" | server farm-scoping; no reveal |
| J | Offline completion device-local → syncs once | completedWorkOrders 0 offline → 1 after sync |
| K | Mobile 390×844 + 430×932: no overflow, Start reachable | — |

**Still covered elsewhere (not duplicated here):** field map / Field Detail
(`golden-path`, `sprint25-field-detail`); the offline idempotency-key retry
(`sprint20-offline-sync`).

**Required fixtures still to add before some sub-cases assert fully** (honest —
`seedReadyFarm` creates no employees): an `Employee` with an expired `certExpiry`
(expired-certificate blocker), a second conflicting order (machine conflict), an
uncertified/absent machine (unavailable-machine blocker), and a deterministic
weather fixture (weather hard-block). Flow C asserts the two deterministic cases
today (insufficient stock; spray-needs-certified-operator readiness) and marks
the rest inline.

**Honest behavior note:** WorkOrder status transitions are last-write-wins (they
bump `version` but do not reject a stale version); the real concurrency safety is
the single-completion invariant, which Flow F/H asserts — no non-existent
status-level rejection is claimed.

This spec being **written + typechecked but not executed** means the Part 14 "all
dedicated Sprint 23–25 E2E pass" gate is still **unmet** — execution remains
blocked on Clerk reachability. Sprint 25 stays **NO-GO**.

## Execution plan when Clerk connectivity returns (Part 18)

Run these exact commands once `https://api.clerk.com` is reachable:

1. **Stop any duplicate dev server** occupying the project (the harness spawns
   its own on :3100): find and stop the stray `next dev` (e.g. the PID reported
   by the failed run) so Playwright's webServer can start.
2. **Verify Clerk connectivity:** `curl -I https://api.clerk.com` (expect a
   response, not a timeout).
3. **Record Clerk user count before.**
4. **Run the new Sprint 23 spec alone first:**
   `npx playwright test e2e/sprint23-workorder-lifecycle.spec.ts`
5. **Run all dedicated Sprint 23–25 specs:**
   `npx playwright test e2e/sprint23-workorder-lifecycle.spec.ts e2e/sprint25-*.spec.ts`
6. **Two consecutive full runs:** `npm run test:e2e` then `npm run test:e2e`
   again — record collected/passed/skipped/failed/duration for each; confirm the
   counts match and no new Clerk users were created.
7. **Confirm exact-one at the DB level:** after a completion flow,
   `EXACT_ONE_VERIFY_FARM_ID=<seeded farm id> tsx scripts/verify-exact-one.ts`.
8. **Record Clerk user count after** (must equal "before" — fixed pool only).

## Part 2 — skip audit

The main chromium suite has **zero `test.skip` / `test.fixme` / `test.todo`**.
The only skip in the repo is:

- `pilot/smoke.spec.ts` → *"authenticated smoke account reaches pilot pages"*:
  `test.skip(!process.env.PILOT_SMOKE_STORAGE_STATE, 'PILOT_SMOKE_STORAGE_STATE
  is required for authenticated pilot smoke.')`. This is a **documented,
  conditional guard** in the **separate pilot config** (`playwright.pilot.config.ts`,
  which itself requires a stable HTTPS `PILOT_BASE_URL`) — it is not part of the
  local main suite and is correctly a non-blocking contract check. **No action
  needed**; it is neither a placeholder nor a todo-only scenario.

Conclusion: the main local E2E suite has zero unexplained skips, zero
placeholders, and zero todo-only scenarios. The written-but-unexecuted Sprint 25
flows contain real selectors/assertions (not `test.todo`); several carry an
inline note that extra seeded state is required before they assert fully — those
are documented, not silent stubs.
