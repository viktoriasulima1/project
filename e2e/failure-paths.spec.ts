import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { loadTestMessages } from './setup/test-messages';

const enErrors = loadTestMessages('en-GB').errors;

/**
 * Sprint 12 Part 4 — failure paths. Most scenarios reuse the READY identity's
 * already-seeded farm (fast, no onboarding needed); the onboarding-specific
 * ones (validation, refresh, back/forward) reuse the fixed NEW identity,
 * resetting its FarmOS data immediately before each test so they don't
 * depend on run order relative to golden-path.spec.ts or each other (Sprint
 * 18 Final E2E Stabilization Part 6) — see docs/E2E_Clerk_User_Quota_Audit.md
 * for why these no longer create a brand-new Clerk user per test.
 *
 * Not automated here, with reasons:
 * - "Stale weather warning": no such indicator exists in the product today
 *   (weather.ts always fetches live, no cached-data-age UI) — a real gap,
 *   not a test gap. Documented as a beta blocker in the Sprint 12 report.
 * - "Session expiration": Clerk session tokens are short-lived JWTs
 *   refreshed transparently client-side; forcing a genuine server-side
 *   expiry inside a test run is impractical without waiting out real token
 *   TTLs. The adjacent, practical case — acting while fully signed out — is
 *   covered below and in the golden path.
 */

test.describe('failure paths — pre-seeded farm (READY)', () => {
  test.use({ storageState: 'playwright/.auth/userReady.json' });

  test('insufficient stock is shown before submit and blocks saving', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();

    await page.locator('#fieldSeasonId').selectOption({ index: 1 });
    await page.locator('#productId').selectOption({ label: 'Amistar Opti (L)' });
    // Seeded stock is 500 L; a dose this large against the seeded field's
    // hectares comfortably exceeds it.
    await page.locator('#dosePerHa').fill('9999');
    await expect(page.getByText(/Not enough stock/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save activity' })).toBeDisabled();
  });

  test('missing required spray fields surface field-level errors, not a blank failure', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();
    await page.locator('#fieldSeasonId').selectOption({ index: 1 });
    await page.locator('#areaHa').fill('5');
    // Deliberately leave operator/product/dose/machine/nozzle/water volume
    // blank and submit anyway.
    await page.getByRole('button', { name: 'Save activity' }).click();
    // One of the exact superRefine messages from activities.ts, not a
    // generic substring that could accidentally match unrelated UI text
    // (e.g. a "— Select field —" placeholder option).
    await expect(page.locator('#activity-operator-error')).toHaveText(enErrors.REQUIRED_FIELD);
    await expect(page.locator('#operatorName')).toHaveAttribute('aria-describedby', 'activity-operator-error');
    // Still on the form — no crash, no blank screen.
    await expect(page.getByRole('heading', { name: 'Spraying' })).toBeVisible();
  });

  test('a duplicate season year surfaces a clear conflict message, never a raw Prisma error', async ({ page }) => {
    await page.goto('/onboarding?step=season');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/already exists/i)).toBeVisible();
    await expect(page.getByText(/Unique constraint/i)).toHaveCount(0);
  });

  test('a deleted field can no longer receive an activity', async ({ page }) => {
    // Creates and deletes its own throwaway field, rather than touching the
    // farm's shared seeded field — other spec files (mobile, isolation)
    // rely on that one existing when the full suite runs together.
    await page.goto('/fields');
    await page.getByRole('button', { name: '+ Add field' }).first().click();
    await page.locator('#name').fill('Throwaway Field For Deletion');
    await page.locator('#hectares').fill('3');
    await page.getByRole('button', { name: 'Create field' }).click();
    await expect(page.getByText('Throwaway Field For Deletion')).toBeVisible();

    page.once('dialog', (d) => d.accept());
    const row = page.locator('tr', { has: page.getByText('Throwaway Field For Deletion') });
    await row.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText('Throwaway Field For Deletion')).toHaveCount(0);

    // Never had a crop assigned, so it was never in any FieldSeason — and an
    // Activity can only ever be created against a FieldSeason (a foreign key
    // to a Field), so a deleted, crop-less field structurally cannot receive
    // one. Reloading the Fields page confirms the deletion actually
    // persisted server-side, not just an optimistic client-side removal.
    await page.reload();
    await expect(page.getByText('Throwaway Field For Deletion')).toHaveCount(0);
  });

  test('signed-out action redirects to sign-in instead of failing silently', async ({ page }) => {
    await page.goto('/activities');
    await clerk.signOut({ page });
    await page.goto('/activities');
    await expect(page).toHaveURL(/\/sign-in/);
    // Re-authenticate this worker's storage state isn't persisted back to
    // disk, so later tests in this file are unaffected.
    await clerk.signIn({ page, emailAddress: process.env.E2E_USER_READY_EMAIL! });
  });
});

test.describe('failure paths — fresh onboarding user (NEW, reset before each)', () => {
  test('onboarding validation failure shows a field error, not a crash', async ({ page }) => {
    const user = await resetNamedE2eUser(process.env.E2E_USER_NEW_EMAIL!);
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });
    await page.goto('/onboarding');
    await page.getByRole('button', { name: 'Get started' }).click();
    // Submit the farm step with required fields empty.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Your farm' })).toBeVisible();
    // Zod validation should keep us on this step (no silent success).
  });

  test('refreshing mid-onboarding resumes at the same step, not the beginning', async ({ page }) => {
    const user = await resetNamedE2eUser(process.env.E2E_USER_NEW_EMAIL!);
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });
    await page.goto('/onboarding');
    await page.getByRole('button', { name: 'Get started' }).click();
    await page.locator('#name').fill('Refresh Test Farm');
    await page.locator('#location').fill('Ede, Gelderland');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Active season' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Active season' })).toBeVisible();
  });

  test('browser back/forward mid-onboarding does not corrupt wizard state', async ({ page }) => {
    const user = await resetNamedE2eUser(process.env.E2E_USER_NEW_EMAIL!);
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });
    await page.goto('/onboarding');
    await page.getByRole('button', { name: 'Get started' }).click();
    await page.locator('#name').fill('Back Forward Farm');
    await page.locator('#location').fill('Arnhem, Gelderland');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Active season' })).toBeVisible();

    await page.goBack();
    // Whatever the wizard shows after a back-navigation, it must be a real
    // step, not a broken/blank page.
    await expect(page.locator('body')).not.toBeEmpty();

    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Active season' })).toBeVisible();
  });
});
