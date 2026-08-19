# Pilot Environment Runbook

**Honesty note:** no hosting/deployment platform has been chosen for this project yet — everything to date has run locally (`next dev` / `next start` against local Postgres). This runbook documents what is concretely true today (a real, isolated local pilot database and migration path) and what remains a decision for whoever deploys this for real (where it's hosted, how backups are automated, how logs are shipped). Do not read the "concrete today" sections as claims about a live deployed pilot — none exists yet.

## What's concrete today

- **Isolated pilot database**: `farmos_pilot`, created and migrated (see `e2e/setup/create-pilot-db.sql`), fully separate from local development (`farmos`) and E2E (`farmos_e2e`).
- **Environment variable separation**: `.env.pilot.example` documents every variable the pilot needs, with `ALLOW_DEV_FARM_FALLBACK` deliberately absent (never set for the pilot — it's dev-only by design, gated on `NODE_ENV === 'development'` regardless).
- **Pilot version identifier**: `PILOT_VERSION` env var, surfaced in `/api/health`'s JSON response (`pilotVersion` field) — set it to the exact commit/tag before each pilot deploy.
- **Health endpoint**: `/api/health`, public (no auth required — fixed in Sprint 12), returns `{status, timestamp, version, environment, pilotVersion, database}`.

## What depends on a future hosting decision

- Where the pilot actually runs (a real server needs to exist somewhere reachable by the pilot farmer — this could be a cloud VM, a PaaS like Railway/Render/Vercel, or similar; none is chosen yet).
- Automated daily backups (mechanism depends entirely on the hosting choice — e.g., a managed Postgres provider's built-in snapshots, or a cron `pg_dump` if self-hosted).
- Structured log shipping / error reporting (e.g., to a log aggregator or a service like Sentry) — the app currently only does structured `console.log`/`console.error`, which is fine for a single-farmer pilot read directly from server logs, but has no external aggregation yet.

## Deploy steps (local-equivalent — adapt paths once a host is chosen)

1. Confirm `.env.pilot` exists (copied from `.env.pilot.example`, real secrets filled in, **never committed**).
2. `DATABASE_URL=<pilot URL> npx prisma migrate deploy` — applies any pending migrations to `farmos_pilot` only. Never run `prisma migrate dev` against the pilot database (that command is designed for local iteration and can prompt to reset).
3. `npm run build`.
4. Set `PILOT_VERSION` to the current commit hash or a tag before starting.
5. Start with `npm run start` (or the hosting platform's equivalent), pointed at `.env.pilot`.
6. Confirm `/api/health` returns `200` with `"database": "ok"` and the expected `pilotVersion`.

## Environment variables

See `.env.pilot.example` for the full list with inline explanations. Summary of what must differ from local dev/E2E:

| Variable | Pilot requirement |
|---|---|
| `DATABASE_URL` | Must point at `farmos_pilot` (or its hosted equivalent) — never `farmos` or `farmos_e2e`. |
| `ALLOW_DEV_FARM_FALLBACK` | Must be absent entirely. |
| `NODE_ENV` | `production`. |
| `PILOT_VERSION` | Set explicitly before each deploy. |
| Clerk keys | Documented as reusable from the existing dev-mode instance for a single-farmer pilot; note in your own records which instance is live. |

## Migration steps

Same command as any environment: `DATABASE_URL=<pilot URL> npx prisma migrate deploy`. This project's migrations are already applied to `farmos_pilot` as of Sprint 13 (4 migrations, matching local dev exactly). Before the pilot farmer's first session, re-run this command to confirm no migration has been missed since.

## Backup and restore (local-equivalent)

Until a hosting decision is made, "backup" means a manual `pg_dump`:

```powershell
pg_dump -U postgres -h localhost -d farmos_pilot -F c -f farmos_pilot_backup_$(Get-Date -Format yyyyMMdd_HHmmss).dump
```

Restore (to a **freshly created**, empty database — never restore over a live one without confirming first):

```powershell
pg_restore -U postgres -h localhost -d farmos_pilot_restored --clean --if-exists farmos_pilot_backup_<timestamp>.dump
```

**Daily automated backup is a real requirement per the brief and is not yet automated** — this is a genuine gap until a hosting platform with either built-in snapshots or a cron-capable host is chosen. Flagged explicitly, not silently assumed done.

## Rollback procedure

1. Stop the running pilot server.
2. Restore the most recent known-good `pg_dump` (see above) to a new database, verify it looks right, then point `DATABASE_URL` at it.
3. Redeploy the previous known-good build (`git checkout <previous tag>`, rebuild).
4. Confirm `/api/health` again before telling the farmer it's back.

## Account removal

Given no self-service account deletion exists yet (noted in `FIRST_BETA_USER_GUIDE.md`), removal is manual:

```sql
-- Run against farmos_pilot only — confirm DATABASE_URL first.
DELETE FROM farms WHERE "clerkUserId" = '<their Clerk user id>';
-- Cascades to seasons/fields/inventory/machines/employees/compliance items
-- per the schema's onDelete: Cascade relations. Activities and compliance
-- records under RESTRICT relations may need their parent rows handled
-- first if this errors — check the specific FK before forcing anything.
```

Also remove their Clerk user via the Clerk dashboard or Backend API (`clerkClient.users.deleteUser(id)`), separately from the FarmOS database deletion.

## Farm data export

No dedicated export feature exists yet. For the pilot, a manual export is:

```powershell
# Export just this farm's data as JSON via a one-off Prisma script, or
# query the specific tables (farms, fields, seasons, field_seasons,
# activities, inventory_items, compliance_records) filtered by farmId
# and hand the farmer a JSON/CSV dump on request.
```

This is a manual, ad-hoc process today — worth automating if a second pilot round happens, not built speculatively now.

## Incident procedure

1. If the app is down or clearly broken: stop it, don't leave it half-working.
2. Check `/api/health` first — database or app-level issue?
3. Check server logs for the actual error (structured `console.error` calls already include context — e.g. `[createActivity] Error: ...`).
4. If data-integrity is in question, back up the CURRENT state before touching anything (even if it's already broken — you may need to diff against it later).
5. Communicate honestly and promptly with the farmer per `PILOT_SUPPORT_RUNBOOK.md` — do not let them discover it themselves without warning.
