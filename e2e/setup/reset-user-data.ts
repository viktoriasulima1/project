/**
 * Guarded, per-user E2E data reset/reseed helpers (Sprint 18 Final E2E
 * Stabilization, Parts 3-4).
 *
 * These exist so "freshness" for a test comes from resetting one fixed
 * identity's own FarmOS rows, never from creating a new Clerk user — see
 * docs/E2E_Clerk_User_Quota_Audit.md for why the old per-test throwaway-user
 * approach exhausted this project's Clerk quota.
 *
 * Like reset-db.ts, this opens its own PrismaClient pointed explicitly at
 * E2E_DATABASE_URL and never imports the app's shared `@/lib/db` singleton.
 *
 * Refuses to run unless ALL of the following hold:
 *   1. NODE_ENV is not "production"
 *   2. E2E_DATABASE_URL is set and its database name contains "e2e" or "test"
 *   3. E2E_ALLOW_RESET=true is set (an explicit, deliberate opt-in — distinct
 *      from reset-db.ts's whole-database E2E_RESET_CONFIRM flag, since this
 *      one scopes to a single user's rows rather than the whole database)
 */
import { PrismaClient } from '@prisma/client';
import { seedReadyFarm, type SeededFarm } from './seed-farms';
import { ensureE2eUser, type E2eUser } from './create-test-users';
import { localePrefDelegate, resetLocalePreference, writeLocalePreference, readLocalePreference } from './locale-preference-core';

function assertSafeForUserReset(): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset E2E user data: NODE_ENV is production.');
  }

  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error('Refusing to reset E2E user data: E2E_DATABASE_URL is not set.');
  }

  let dbName: string;
  try {
    dbName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    throw new Error('Refusing to reset E2E user data: E2E_DATABASE_URL is not a valid connection string.');
  }

  if (!/e2e|test/i.test(dbName)) {
    throw new Error(
      `Refusing to reset E2E user data: database name "${dbName}" does not contain "e2e" or "test". ` +
      'This guard exists specifically to prevent an E2E run from ever pointing at a real database.',
    );
  }

  if (process.env.E2E_ALLOW_RESET !== 'true') {
    throw new Error('Refusing to reset E2E user data: E2E_ALLOW_RESET=true was not set.');
  }

  return url;
}

function getE2ePrisma(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

/**
 * Deletes only the given Clerk user's own FarmOS records — their Farm (if
 * any) and everything under it — leaving the Clerk account itself untouched
 * and every other user's data untouched. Used to give the NEW identity a
 * genuine "no farm yet" starting state before onboarding tests, and to reset
 * PILOT before tests that need a clean slate of their own.
 *
 * Safe to call when the user has no farm yet (no-op).
 */
export async function resetE2eUserFarmData(clerkUserId: string): Promise<void> {
  const url = assertSafeForUserReset();
  const prisma = getE2ePrisma(url);
  try {
    // UserLocalePreference was added after this harness. Clear it on EVERY reset
    // (even for a user with no farm) so a stale DB preference can never leak
    // across specs and silently override a test's cookie/UI locale switch —
    // exactly the confound behind the Onboarding Flow A failure. Defensive: a
    // pending migration (no table) is a no-op, not a hard failure.
    try { await resetLocalePreference(localePrefDelegate(prisma), clerkUserId); } catch { /* table pending migration */ }

    const farm = await prisma.farm.findUnique({ where: { clerkUserId } });
    if (!farm) return;

    // Sprint 19 — Farm cascades onto AuditEvent (ON DELETE CASCADE), and
    // audit_events has a DB trigger that rejects DELETE unless
    // app.allow_audit_hard_delete=true is set for the transaction (see the
    // Sprint 19 migration and docs/AUDIT_TRAIL_ARCHITECTURE.md). This is
    // exactly the narrow, documented escape hatch for whole-farm teardown —
    // an E2E per-user reset is real teardown, not a normal application
    // request, and the flag is set only for this one transaction.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL app.allow_audit_hard_delete = 'true'");

      // Children first, in FK-dependency order (mirrors reset-db.ts), scoped
      // to this one farm only via relation filters.
      await tx.stockMovement.deleteMany({ where: { inventoryItem: { farmId: farm.id } } });
      await tx.complianceRecord.deleteMany({ where: { activity: { fieldSeason: { field: { farmId: farm.id } } } } });
      await tx.activity.deleteMany({ where: { fieldSeason: { field: { farmId: farm.id } } } });
      // Sprint 27 evidence owns RESTRICT links to Field/FieldSeason so the
      // deterministic fixed-pool reset must remove visits before seasons.
      // Observations/photos/suggestions cascade from the visit; crop stages
      // cascade from FieldSeason.
      await tx.scoutingVisit.deleteMany({ where: { farmId: farm.id } });
      await tx.soilAnalysis.deleteMany({ where: { field: { farmId: farm.id } } });
      await tx.fieldSeason.deleteMany({ where: { field: { farmId: farm.id } } });
      await tx.cropFinancial.deleteMany({ where: { snapshot: { season: { farmId: farm.id } } } });
      await tx.financialSnapshot.deleteMany({ where: { season: { farmId: farm.id } } });
      await tx.complianceItem.deleteMany({ where: { farmId: farm.id } });
      await tx.task.deleteMany({ where: { farmId: farm.id } });
      await tx.inventoryItem.deleteMany({ where: { farmId: farm.id } });
      await tx.machine.deleteMany({ where: { farmId: farm.id } });
      await tx.employee.deleteMany({ where: { farmId: farm.id } });
      // Field.deleteMany cascades FieldExternalProvenance at the DB level.
      await tx.field.deleteMany({ where: { farmId: farm.id } });
      await tx.season.deleteMany({ where: { farmId: farm.id } });
      await tx.auditEvent.deleteMany({ where: { farmId: farm.id } });
      await tx.farm.delete({ where: { id: farm.id } });
    });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Resets, then re-seeds, a stable "ready" farm for the given Clerk user.
 * Used for the READY identity: idempotent and safe to call repeatedly, but
 * intended to be called only in global setup, not from within individual
 * tests — READY's farm must stay stable for the many read-mostly specs that
 * depend on it.
 */
export async function seedReadyE2eFarm(clerkUserId: string): Promise<SeededFarm> {
  assertSafeForUserReset();
  return seedReadyFarm(clerkUserId, 'E2E Farm READY');
}

/**
 * Same as seedReadyE2eFarm, but for the OTHER identity — a second, separate
 * stable farm used only for cross-farm isolation checks against READY.
 */
export async function seedOtherE2eFarm(clerkUserId: string): Promise<SeededFarm> {
  assertSafeForUserReset();
  return seedReadyFarm(clerkUserId, 'E2E Farm OTHER');
}

/**
 * Convenience for individual specs: looks up (idempotently, never creates a
 * new Clerk account beyond the one already in the fixed pool) one of the
 * fixed-pool identities by email, then deletes its FarmOS data so the test
 * gets a genuinely fresh state — regardless of what other tests already ran
 * against that same identity earlier in this run. This is the direct
 * replacement for the old per-test `createThrowawayUser(label)` calls.
 */
export async function resetNamedE2eUser(email: string): Promise<E2eUser> {
  const user = await ensureE2eUser(email);
  await resetE2eUserFarmData(user.id);
  return user;
}

// ─── UserLocalePreference E2E helpers (Parts 2 & 8) ───────────────────────────
// All three are user-scoped (by clerkUserId) and share the same E2E-database
// safety guard as the reset helpers — they refuse to run against a non-E2E DB.

/** Removes ONLY the given user's stored locale preference. */
export async function resetE2eUserLocalePreference(clerkUserId: string): Promise<number> {
  const url = assertSafeForUserReset();
  const prisma = getE2ePrisma(url);
  try { return await resetLocalePreference(localePrefDelegate(prisma), clerkUserId); }
  catch { return 0; }
  finally { await prisma.$disconnect(); }
}

/** Deterministically seeds the given user's DB locale preference (validated). */
export async function setE2eUserLocalePreference(clerkUserId: string, locale: string): Promise<boolean> {
  const url = assertSafeForUserReset();
  const prisma = getE2ePrisma(url);
  try { return await writeLocalePreference(localePrefDelegate(prisma), clerkUserId, locale); }
  finally { await prisma.$disconnect(); }
}

/** Read-only: returns just the stored locale for the given user, or null. */
export async function getE2eUserLocalePreference(clerkUserId: string): Promise<string | null> {
  const url = assertSafeForUserReset();
  const prisma = getE2ePrisma(url);
  try { return await readLocalePreference(localePrefDelegate(prisma), clerkUserId); }
  catch { return null; }
  finally { await prisma.$disconnect(); }
}
