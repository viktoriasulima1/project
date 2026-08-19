# Pilot Deployment Runbook

1. Select provider, stable HTTPS hostname and region near the pilot/database.
2. Provision isolated PostgreSQL with pooling, backups and least privilege.
3. Activate Clerk production, stable domain and production redirects.
4. Set variables from `.env.pilot.example`; never upload the example itself or enable E2E/dev flags.
5. Run `prisma generate`, `db:pilot:status`, confirmed `db:pilot:migrate`, then build/deploy.
6. Verify headers, health, auth, manifest, service worker version and logs.
7. Run `test:pilot:smoke`; it never resets or seeds pilot data.
8. Perform backup/restore evidence and physical iPhone auth.
9. Execute the Sprint 21 golden offline flow and `verify:offline-sync` under the authorized farm.

Rollback to the previous immutable application deployment only if it supports the current database schema. Never reverse a pilot database destructively. For incompatible migrations, deploy a forward fix. Confirm health, auth and offline drafts after rollback/update.
