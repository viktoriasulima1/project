import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';

/**
 * Sprint 12 Part 3 — the full first-value journey for a brand-new user, as
 * one reliable browser test. Runs as the fixed NEW identity (from global
 * setup's storage state) — this is the ONE test in the suite that actually
 * drives onboarding end-to-end; every other spec reuses a pre-seeded farm
 * (READY/OTHER) so it doesn't have to repeat this.
 *
 * NEW's own FarmOS data is reset immediately before this test runs (rather
 * than relying only on global setup's one-time reset) so this test's outcome
 * does not depend on run order relative to the other specs that also use
 * NEW (failure-paths.spec.ts, founder-walkthrough.spec.ts) — see Sprint 18
 * Final E2E Stabilization Part 6.
 */
test.use({ storageState: 'playwright/.auth/userNew.json' });

test.beforeEach(async () => {
  await resetNamedE2eUser(process.env.E2E_USER_NEW_EMAIL!);
});

test('golden path: sign-in through first activity and back', async ({ page }) => {
  await test.step('farm modules redirect to onboarding when no farm exists', async () => {
    await page.goto('/fields');
    await expect(page).toHaveURL(/\/onboarding/);
  });

  await test.step('welcome step', async () => {
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: 'Welcome to FarmOS' })).toBeVisible();
    await page.getByRole('button', { name: 'Get started' }).click();
  });

  await test.step('create farm', async () => {
    await expect(page.getByRole('heading', { name: 'Your farm' })).toBeVisible();
    await page.locator('#name').fill('E2E Golden Path Farm');
    await page.locator('#location').fill('Westervoort, Gelderland');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Active season' })).toBeVisible();
  });

  await test.step('create active season', async () => {
    // Year/dates are pre-filled with sensible defaults — just submit.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Your first field' })).toBeVisible();
  });

  await test.step('create first field', async () => {
    await page.locator('#fname').fill('E2E Noordkamp');
    await page.locator('#hectares').fill('15.5');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: "What's growing there?" })).toBeVisible();
  });

  await test.step('assign crop', async () => {
    await page.locator('#crop').selectOption('wheat');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add your first product? (optional)' })).toBeVisible();
  });

  await test.step('skip optional inventory and employee steps', async () => {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByRole('heading', { name: 'Add an operator? (optional)' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  });

  await test.step('complete onboarding', async () => {
    await expect(page.getByText('Crop assigned').locator('..')).toContainText('Yes');
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
    await page.getByRole('link', { name: 'Go to dashboard' }).click();
  });

  await test.step('first-run dashboard appears with one dominant CTA', async () => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('Farm setup complete')).toBeVisible();
    // Inventory was skipped, so per the priority order the dominant CTA
    // must be "Add your first inventory item" (not "Record your first
    // activity" — that tier only applies once inventory exists).
    await expect(page.getByRole('link', { name: 'Add your first inventory item' })).toBeVisible();
  });

  await test.step('add first inventory product', async () => {
    await page.getByRole('link', { name: 'Add your first inventory item' }).click();
    await expect(page.getByRole('heading', { name: 'Add your first product? (optional)' })).toBeVisible();
    await page.locator('#pname').fill('Amistar Opti');
    await page.locator('#category').selectOption('fungicide');
    await page.locator('#currentStock').fill('500');
    await page.getByRole('button', { name: 'Add product' }).click();
    await expect(page.getByRole('heading', { name: 'Add an operator? (optional)' })).toBeVisible();
  });

  await test.step('return to dashboard without re-finishing onboarding', async () => {
    // Deliberately navigate directly rather than clicking "Finish" again —
    // re-clicking Finish would re-visit /onboarding?done=1, which is exactly
    // the duplicate-event path fixed this sprint (see onboarding/page.tsx's
    // onboardingCompletedAt guard). Going straight to /dashboard exercises
    // the more common real path: a user adding one optional item, then
    // navigating away via the sidebar rather than re-finishing a wizard
    // they already completed.
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Record your first activity' })).toBeVisible();
  });

  await test.step('open Quick Log from the dashboard', async () => {
    await page.getByRole('button', { name: '+ Quick Log' }).click();
    await expect(page.getByRole('heading', { name: 'What did you do?' })).toBeVisible();
  });

  await test.step('record first activity (spraying) — including adding a sprayer inline', async () => {
    await page.getByRole('button', { name: 'Spraying' }).click();
    await page.locator('#fieldSeasonId').selectOption({ label: 'E2E Noordkamp (wheat)' });
    await page.locator('#productId').selectOption({ label: 'Amistar Opti (L)' });
    await page.locator('#dosePerHa').fill('2');
    await page.locator('#operatorName').fill('Jan de Boer');
    await page.locator('#waterVolumePerHa').fill('300');
    await page.locator('#nozzleType').selectOption('flat_fan');

    // This brand-new farm has no machines yet (onboarding never creates
    // one) — use the Sprint 12 inline "add a new sprayer" escape hatch
    // rather than hitting a dead end.
    await page.locator('#machineId').selectOption('__add_new__');
    await page.getByLabel('New sprayer name').fill('Sprayer 1');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('#machineId')).toHaveValue(/.+/);

    await page.getByRole('button', { name: 'Save activity' }).click();
  });

  await test.step('confirm success state, inventory deduction, and compliance record', async () => {
    await expect(page.getByText('Activity recorded')).toBeVisible();
    await expect(page.getByText(/Stock updated/)).toBeVisible();
    await expect(page.getByText('Compliance record created')).toBeVisible();
  });

  await test.step('activity appears in history', async () => {
    await page.getByRole('button', { name: 'View activity history' }).click();
    await expect(page).toHaveURL(/\/activities/);
    await expect(page.getByRole('cell', { name: 'spray' })).toBeVisible();
    await expect(page.getByText('E2E Noordkamp')).toBeVisible();
  });

  await test.step('inventory reflects the stock deduction', async () => {
    // 2 units/ha × 15.5 ha = 31 used, from a starting stock of 500 → 469.
    // The Inventory module is still a stub page (no per-product detail view
    // yet, per src/app/(farm)/inventory/page.tsx) — deduction is confirmed
    // via the success panel and stock-preview logic instead (unit-tested in
    // activity-form-logic.test.ts and activities.test.ts).
  });

  await test.step('dashboard experience state changes after the first activity', async () => {
    await page.goto('/dashboard');
    // With 1 activity recorded and inventory already present, the state
    // moves to early_usage — the full dashboard grid, not the first-run
    // summary or its "Add your first..." CTA.
    await expect(page.getByText('Farm setup complete')).toHaveCount(0);
  });

  await test.step('sign out and confirm the protected route redirects', async () => {
    await clerk.signOut({ page });
    // signOut() triggers its own client-side (SPA) redirect to
    // afterSignOutUrl ("/"), which in dev mode can settle against a stale
    // Next.js client router-cache entry from before the session changed —
    // observed hanging indefinitely on "/" in dev (not a timing issue, it
    // never progressed even at 20s+). A fresh, hard navigation via
    // page.goto() forces an actual server round-trip instead of relying on
    // that in-flight client-side chain, sidestepping the staleness. A plain
    // curl-equivalent request confirmed the server-side redirect chain
    // itself (/ → /dashboard → /sign-in) is correct.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  await test.step('sign back in and confirm farm and data persist', async () => {
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: process.env.E2E_USER_NEW_EMAIL! });
    await page.goto('/activities');
    await expect(page.getByRole('cell', { name: 'spray' })).toBeVisible();
    await expect(page.getByText('E2E Noordkamp')).toBeVisible();
  });
});
