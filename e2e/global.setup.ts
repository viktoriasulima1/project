import { test as setup } from '@playwright/test';
import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resetE2eDatabase } from './setup/reset-db';
import { migrateE2eDatabase } from './setup/migrate-e2e-db';
import { ensureAllNamedE2eUsers } from './setup/create-test-users';
import { resetE2eUserFarmData, seedReadyE2eFarm, seedOtherE2eFarm } from './setup/reset-user-data';
import { clerkPreflight, formatPreflightFailure } from './setup/clerk-preflight';

const AUTH_DIR = 'playwright/.auth';

setup('migrate, reset database, seed fixed-pool users and farms, save auth states', async ({ browser }) => {
  setup.setTimeout(180_000);
  process.env.E2E_RESET_CONFIRM = 'true';
  process.env.E2E_ALLOW_RESET = 'true';

  // Sprint 25 closure hardening — Clerk connectivity preflight runs FIRST, before
  // any migrate/reset. If the authentication backend is unreachable there is no
  // point (and real risk) in resetting the E2E database, and every authenticated
  // scenario would fail anyway; fail fast with an explicit, non-misleading
  // message instead of a mid-setup "fetch failed". Never bypasses auth.
  const preflight = await clerkPreflight();
  if (!preflight.ok) throw new Error(formatPreflightFailure(preflight));

  // Fetch the Clerk testing token now that connectivity is confirmed.
  await clerkSetup({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY });

  // Only now do the destructive DB work. The E2E database has its own migration
  // history, separate from the main dev database (Sprint 18 fix), so migrate
  // before reset and before anything queries a column that might not exist yet.
  migrateE2eDatabase();
  await resetE2eDatabase();

  // Fixed pool of 4 reusable identities — created once, reused forever.
  // See docs/E2E_Clerk_User_Quota_Audit.md: this replaces the old
  // per-test createThrowawayUser() approach that exhausted the Clerk
  // development-instance user quota.
  const { userNew, userReady, userOther, userPilot } = await ensureAllNamedE2eUsers();

  // NEW and PILOT start every run with no FarmOS data of their own — NEW
  // because it exists purely for "no farm yet" onboarding scenarios, PILOT
  // because individual tests reset/reseed it themselves as needed.
  await resetE2eUserFarmData(userNew.id);
  await resetE2eUserFarmData(userPilot.id);

  // READY and OTHER get stable, separate farms seeded once here — tests
  // that run as these identities must not destructively mutate them.
  const farmReady = await seedReadyE2eFarm(userReady.id);
  const farmOther = await seedOtherE2eFarm(userOther.id);

  // Cross-farm isolation tests need OTHER's record ids to attempt
  // submitting them as READY — write them out once here rather than each
  // test re-deriving them.
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(`${AUTH_DIR}/seeded-farms.json`, JSON.stringify({ farmReady, farmOther }, null, 2));

  const identities = [
    ['userNew', userNew],
    ['userReady', userReady],
    ['userOther', userOther],
    ['userPilot', userPilot],
  ] as const;
  for (const [label, user] of identities) {
    const page = await browser.newPage();
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });
    await page.context().storageState({ path: `${AUTH_DIR}/${label}.json` });
    await page.close();
  }
});
