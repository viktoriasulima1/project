/**
 * Guarded, explicit E2E database migration.
 *
 * The isolated E2E database (`farmos_e2e`) is a real Postgres database with
 * its own migration history — it does NOT get schema changes for free just
 * because the main dev database was migrated. This script applies any
 * pending migrations to it via `prisma migrate deploy`, with the same
 * class of safety guard as reset-db.ts.
 *
 * Refuses to run unless ALL of the following hold:
 *   1. NODE_ENV is not "production"
 *   2. E2E_DATABASE_URL is set and its database name contains "e2e" or "test"
 *   3. E2E_RESET_CONFIRM=true is set (reusing the same confirmation flag
 *      reset-db.ts already established for "this operation targets the
 *      isolated E2E database on purpose" — not introducing a second,
 *      near-duplicate flag for a very similar class of guard)
 *
 * Never touches DATABASE_URL (the real dev database) — `prisma migrate
 * deploy` is invoked as a child process with its OWN environment, where
 * DATABASE_URL is overridden to E2E_DATABASE_URL only for that process.
 */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { execSync } from 'node:child_process';

function assertSafeToMigrate(): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to migrate: NODE_ENV is production.');
  }

  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error('Refusing to migrate: E2E_DATABASE_URL is not set.');
  }

  let dbName: string;
  try {
    dbName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    throw new Error('Refusing to migrate: E2E_DATABASE_URL is not a valid connection string.');
  }

  if (!/e2e|test/i.test(dbName)) {
    throw new Error(
      `Refusing to migrate: database name "${dbName}" does not contain "e2e" or "test". ` +
      'This guard exists specifically to prevent an E2E migration from ever touching a real database.',
    );
  }

  if (process.env.E2E_RESET_CONFIRM !== 'true') {
    throw new Error('Refusing to migrate: E2E_RESET_CONFIRM=true was not set.');
  }

  return url;
}

export function migrateE2eDatabase(): void {
  const url = assertSafeToMigrate();
  console.log('[e2e] applying pending migrations to the isolated E2E database...');
  // A single, fixed command string (no interpolated arguments) — avoids
  // Node's execFileSync+shell:true argument-escaping deprecation warning
  // without losing the ability to resolve `npx` as a shell built-in on
  // Windows.
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
  console.log('[e2e] E2E database migrations applied.');
}

if (require.main === module) {
  loadEnv({ path: path.resolve(__dirname, '../../.env.e2e') });
  // Running this file directly (e.g. `npm run db:e2e:migrate`) is itself
  // the deliberate human confirmation the flag exists to require — same
  // reasoning as reset-db.ts's own direct-run block.
  process.env.E2E_RESET_CONFIRM = 'true';
  try {
    migrateE2eDatabase();
  } catch (err) {
    console.error('[e2e] migration refused/failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
