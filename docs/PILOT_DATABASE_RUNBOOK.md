# Pilot Database Runbook

Create a dedicated managed PostgreSQL database and least-privilege application role. It must not be `farmos`, `farmos_e2e`, `test`, `postgres`, or shared with local/E2E. Prefer provider pooling for serverless deployments and reserve a direct connection for migrations if required.

1. Store the URL as `PILOT_DATABASE_URL` and deployment `DATABASE_URL`; never commit it.
2. Run `npm run db:pilot:status`.
3. Set `PILOT_MIGRATION_CONFIRM=true` only for the controlled migration job and run `npm run db:pilot:migrate`.
4. Verify eight migrations, audit trigger, idempotency unique indexes and offline columns.
5. Enable daily backups and record retention from the provider contract.
6. Rotate credentials through the provider and redeploy; revoke the old role.

Emergency read-only mode is provider-specific: revoke writes or switch to a read-only role, then return HTTP maintenance responses for mutations. Never run Prisma reset, E2E reset, `migrate dev`, or demo seed. Application rollback must remain schema-compatible; otherwise use a forward fix.
