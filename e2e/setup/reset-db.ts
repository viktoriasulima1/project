/**
 * Guarded, idempotent E2E database reset.
 *
 * This intentionally never imports the app's shared `@/lib/db` singleton —
 * it opens its own PrismaClient pointed explicitly at E2E_DATABASE_URL, so
 * there is no code path by which a misconfigured import could make this
 * touch the real dev/prod database.
 *
 * Refuses to run unless ALL of the following hold:
 *   1. NODE_ENV is not "production"
 *   2. E2E_DATABASE_URL is set and its database name contains "e2e" or "test"
 *   3. E2E_RESET_CONFIRM=true is set (an explicit, deliberate opt-in)
 */
import { PrismaClient } from '@prisma/client';

function assertSafeToReset(): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset: NODE_ENV is production.');
  }

  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error('Refusing to reset: E2E_DATABASE_URL is not set.');
  }

  let dbName: string;
  try {
    dbName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    throw new Error('Refusing to reset: E2E_DATABASE_URL is not a valid connection string.');
  }

  if (!/e2e|test/i.test(dbName)) {
    throw new Error(
      `Refusing to reset: database name "${dbName}" does not contain "e2e" or "test". ` +
      'This guard exists specifically to prevent an E2E run from ever pointing at a real database.',
    );
  }

  if (process.env.E2E_RESET_CONFIRM !== 'true') {
    throw new Error('Refusing to reset: E2E_RESET_CONFIRM=true was not set.');
  }

  return url;
}

export async function resetE2eDatabase(): Promise<void> {
  const url = assertSafeToReset();
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // Sprint 19 — Farm cascades onto AuditEvent (ON DELETE CASCADE), and
    // audit_events has a DB trigger that rejects DELETE unless
    // app.allow_audit_hard_delete=true is set for the transaction (see the
    // Sprint 19 migration and docs/AUDIT_TRAIL_ARCHITECTURE.md). Wrapping
    // the whole reset in one transaction with that flag set is the narrow,
    // documented escape hatch for whole-farm teardown — this whole-database
    // E2E reset is exactly that, never a normal application code path.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL app.allow_audit_hard_delete = 'true'");

      // Children first, in FK-dependency order. deleteMany() on an empty
      // table is a no-op, so this is safely idempotent on an already-clean
      // database.
      await tx.stockMovement.deleteMany();
      await tx.complianceRecord.deleteMany();
      await tx.activity.deleteMany();
      await tx.scoutingVisit.deleteMany();
      await tx.soilAnalysis.deleteMany();
      await tx.fieldSeason.deleteMany();
      await tx.cropFinancial.deleteMany();
      await tx.financialSnapshot.deleteMany();
      await tx.complianceItem.deleteMany();
      await tx.task.deleteMany();
      await tx.inventoryItem.deleteMany();
      await tx.machine.deleteMany();
      await tx.employee.deleteMany();
      await tx.field.deleteMany();
      await tx.season.deleteMany();
      await tx.auditEvent.deleteMany();
      await tx.complianceExport.deleteMany();
      // Deleting every farm here is safe specifically because this whole
      // function only ever runs against the isolated E2E database (enforced
      // by assertSafeToReset() above) — there is no other farmer's data in
      // farmos_e2e to protect against, unlike the real dev/prod database.
      await tx.farm.deleteMany();
    }, { timeout: 30_000 });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  // Only when run directly (e.g. `npm run db:e2e:reset`) — Playwright's own
  // global.setup.ts imports resetE2eDatabase() and sets this flag itself,
  // deliberately, right before calling it. Running this file directly is
  // itself the deliberate human confirmation the flag exists to require.
  import('dotenv').then(({ config }) => {
    config({ path: require('node:path').resolve(__dirname, '../../.env.e2e') });
    process.env.E2E_RESET_CONFIRM = 'true';
    resetE2eDatabase()
      .then(() => {
        console.log('[e2e] database reset complete.');
      })
      .catch((err) => {
        console.error('[e2e] reset refused/failed:', err instanceof Error ? err.message : err);
        process.exit(1);
      });
  });
}
