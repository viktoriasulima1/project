# Sprint 17 — Pilot Environment Check

Performed against the real, already-existing `farmos_pilot` database and this codebase's current state (post-Sprint 16). Every row below reflects an actual check run during this sprint, not an assumption carried over from `PILOT_ENVIRONMENT_RUNBOOK.md`'s Sprint 13 write-up — that document describes what was true in Sprint 13; several things have changed since (most importantly, Sprint 16 added a new migration).

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Separate pilot database | **Pass** | `farmos_pilot` exists, distinct from `farmos` (dev) and `farmos_e2e` (E2E) |
| 2 | Migrations current | **Fixed this sprint — was failing** | `prisma migrate status` against `farmos_pilot` initially reported Sprint 16's `20260713150414_add_activity_status` migration as **not applied** — the pilot database still had the pre-Sprint-16 schema. Ran `prisma migrate deploy` against it; now reports "Database schema is up to date." **This would have crashed the very first activity a pilot farmer tried to log**, since the app's generated Prisma client expects the `status` column to exist. |
| 3 | Daily backup works | **Fail — not automated** | Confirmed via `PILOT_ENVIRONMENT_RUNBOOK.md`: backup today is a manual `pg_dump` command, run by a human, on demand. There is no scheduled/automated daily backup — this has been an explicitly flagged gap since Sprint 13 and remains one. No hosting platform has been chosen, so there is nowhere for an automated snapshot mechanism to run yet. |
| 4 | Restore procedure is tested | **Fail — documented, never rehearsed** | The `pg_dump`/`pg_restore` commands in the runbook have never actually been executed as a rehearsal (only written down). "Tested" requires someone to actually run a backup, restore it to a fresh database, and confirm the data matches — this has not happened. |
| 5 | Health endpoint is public and healthy | **Pass** | `GET /api/health` on the local server returns `200` with no authentication required: `{"status":"ok","environment":"development","pilotVersion":"not-set","database":"ok"}`. Confirmed working end-to-end (real DB connectivity check included). |
| 6 | No dev farm fallback | **Pass** | `getActiveFarm()` (`src/lib/farm.ts`) only uses the fallback when **both** `NODE_ENV === 'development'` **and** `ALLOW_DEV_FARM_FALLBACK === 'true'` are true. `.env.pilot.example` explicitly omits `ALLOW_DEV_FARM_FALLBACK` and sets `NODE_ENV="production"` — the fallback is structurally impossible in a correctly-configured pilot deploy. |
| 7 | No demo seed data | **Pass** | Queried `farmos_pilot` directly: 0 farms, 0 activities. Clean. |
| 8 | Load Demo Farm is absent | **Pass** | `LoadDemoFarmButton` is only rendered by `dashboard/page.tsx` when `process.env.NODE_ENV === 'development'` — absent under the pilot's `NODE_ENV="production"` setting. |
| 9 | Clerk production/test keys are correct | **Fail — no pilot keys configured at all** | No `.env.pilot` file exists (only `.env.pilot.example`, which contains placeholders). Local dev/E2E use Clerk **test** keys (`pk_test_...`), which is correct for those environments — but there is currently no environment file with real keys of any kind configured for an actual pilot deployment. This isn't a "wrong key type" problem, it's a "the pilot has no real credentials yet" problem. |
| 10 | Error logs are available | **Pass, with a caveat** | The app logs structured `console.error` calls with context (e.g. `[createActivity] Error: ...`) — sufficient for a single-farmer pilot read directly from server logs. No external log aggregation/alerting exists (documented, accepted limitation for this scale). |
| 11 | Pilot version is visible in UI or logs | **Pass (logs/health endpoint only)** | `PILOT_VERSION` env var surfaces in `/api/health`'s JSON response. Not shown anywhere in the UI itself — the brief accepts "UI or logs," and this satisfies the logs half. |
| 12 | Rollback procedure exists | **Documented, not rehearsed** | `PILOT_ENVIRONMENT_RUNBOOK.md` has a written rollback procedure (stop server → restore last known-good backup → redeploy previous build → re-check `/api/health`). Like #4, it has never actually been executed as a drill. |

## The finding that matters most, not on the brief's checklist

**No hosting/deployment target has been chosen or stood up at all.** Every check above concerns local infrastructure (a local Postgres database, environment file structure, code-level gating) — legitimate and necessary, but none of it produces something a real farmer, physically elsewhere, could actually open in a browser. FarmOS currently only runs on `localhost` on this development machine. This is more fundamental than any single checklist row: **there is nowhere to invite the farmer to, yet**, independent of whether every other row above passes.

## Verdict

**Do not invite the farmer yet.** Per the brief's own rule ("do not invite the farmer while any P0 environment issue remains"), the following are P0 environment blockers, in order of how fundamental they are:

1. No hosting target exists — the app has never been deployed anywhere reachable outside this machine.
2. No real `.env.pilot` credentials exist — Clerk keys, specifically, are entirely unconfigured for a pilot deploy.
3. Daily backup is not automated.
4. Restore and rollback procedures are documented but have never been rehearsed once.

Item #2 (pilot migration drift) was a real, live P0 that has been fixed during this sprint — it is the one item on this list that is now fully resolved. The remaining four require a real decision and real setup work outside this codebase (choosing where to host, provisioning real credentials, running an actual backup/restore rehearsal) before a real farmer session (Part 4) can responsibly happen.

**What this does not block:** a human founder manually walking through the app on `localhost` (Part 3) does not require hosting, real Clerk production keys, or automated backups — only a working local build and a real person at the keyboard. That can proceed independently of the items above.
