import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { readFileSync } from 'fs';

/**
 * Sprint 13 Part 1 — the founder pre-beta walkthrough, executed by
 * automation and clearly labeled as such (see docs/FOUNDER_PRE_BETA_WALKTHROUGH.md
 * for the honesty framing: this is NOT a substitute for a human actually
 * clicking through the app once before inviting a real farmer — it is
 * real evidence for 19 of the 21 items, with the remaining 2 explicitly
 * named as needing a human).
 *
 * Screenshots are saved to e2e/walkthrough-screenshots/ for the founder to
 * skim before their own pass.
 */
test.use({ storageState: undefined });

const SHOT_DIR = 'e2e/walkthrough-screenshots';

test('founder pre-beta walkthrough — all 21 items', async ({ page }) => {
  test.setTimeout(180_000);
  // Reuses the fixed NEW identity (reset to a farm-less state right here)
  // rather than creating a brand-new Clerk user — see
  // docs/E2E_Clerk_User_Quota_Audit.md. Safe regardless of run order because
  // the reset happens immediately before this test uses the identity.
  const user = await resetNamedE2eUser(process.env.E2E_USER_NEW_EMAIL!);

  await test.step('1. Open production-like build', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  await test.step('2. Sign up with a fresh Clerk user', async () => {
    // Ticket-based sign-in via a freshly created +clerk_test user is the
    // automated equivalent of "sign up" here — a REAL sign-up through
    // Clerk's hosted UI (email verification code, etc.) is item requiring
    // a human; see docs/FOUNDER_PRE_BETA_WALKTHROUGH.md item 2.
    await clerk.signIn({ page, emailAddress: user.email });
    await page.goto('/onboarding');
    await page.screenshot({ path: `${SHOT_DIR}/02-signed-in-onboarding-start.png` });
  });

  await test.step('3-4. Complete onboarding, add a real-looking farm', async () => {
    await page.getByRole('button', { name: 'Get started' }).click();
    await page.locator('#name').fill('Maatschap Van der Berg');
    await page.locator('#location').fill('Nagele, Flevoland');
    await page.locator('#totalHectares').fill('180');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Active season' })).toBeVisible();
  });

  await test.step('5. Add active season', async () => {
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Your first field' })).toBeVisible();
  });

  await test.step('6-7. Add first field and crop', async () => {
    await page.locator('#fname').fill('Noordpolder');
    await page.locator('#hectares').fill('42.5');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('#crop').selectOption('wheat');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add your first product? (optional)' })).toBeVisible();
  });

  await test.step('8. Add crop-protection product', async () => {
    await page.locator('#pname').fill('Amistar Opti');
    await page.locator('#category').selectOption('fungicide');
    await page.locator('#currentStock').fill('500');
    await page.getByRole('button', { name: 'Add product' }).click();
    await expect(page.getByRole('heading', { name: 'Add an operator? (optional)' })).toBeVisible();
  });

  await test.step('10. Add spray operator', async () => {
    await page.locator('#ename').fill('Jan van der Berg');
    await page.locator('#role').fill('Spray operator');
    await page.getByRole('checkbox', { name: /has spraying licence|spuitlicentie/i }).check();
    await page.getByRole('button', { name: 'Add operator' }).click();
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/10-review-screen.png` });
  });

  await test.step('finish onboarding', async () => {
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
    await page.getByRole('link', { name: 'Go to dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  await test.step('6b-7b. Add a second field and crop via Fields + Activities SetupGuide', async () => {
    await page.goto('/fields');
    await page.getByRole('button', { name: '+ Add field' }).first().click();
    await page.locator('#name').fill('Zuidkamp');
    await page.locator('#hectares').fill('37');
    await page.getByRole('button', { name: 'Create field' }).click();
    await expect(page.getByText('Zuidkamp')).toBeVisible();

    await page.goto('/activities');
    // With both fields now present but only one in a FieldSeason, Activities
    // shows the "add to season" guide for the unassigned one.
    await page.getByRole('button', { name: '+ Add to season' }).click();
    await page.locator('select[name="crop"]').selectOption('sugar_beet');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText('+ Record activity')).toBeVisible();
  });

  await test.step('9. Add fertiliser product', async () => {
    await page.goto('/onboarding?step=inventory');
    await page.locator('#pname').fill('KAS 27% N');
    await page.locator('#category').selectOption('fertiliser');
    // 150 kg/ha × 37 ha (Zuidkamp) = 5,550 kg needed — stock comfortably above that.
    await page.locator('#currentStock').fill('8000');
    await page.getByRole('button', { name: 'Add product' }).click();
    await expect(page.getByRole('heading', { name: 'Add an operator? (optional)' })).toBeVisible();
    await page.goto('/dashboard');
  });

  await test.step('11-12. Add sprayer and record a spraying activity', async () => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();
    await page.locator('#fieldSeasonId').selectOption({ label: 'Noordpolder (wheat)' });
    await page.locator('#productId').selectOption({ label: 'Amistar Opti (L)' });
    await page.locator('#dosePerHa').fill('2');
    await page.locator('#operatorName').fill('Jan van der Berg');
    await page.locator('#waterVolumePerHa').fill('300');
    await page.locator('#nozzleType').selectOption('flat_fan');
    await page.locator('#machineId').selectOption('__add_new__');
    await page.getByLabel('New sprayer name').fill('John Deere M732i');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('#machineId')).toHaveValue(/.+/);
    await page.screenshot({ path: `${SHOT_DIR}/12-spray-form-filled.png` });
    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByText('Activity recorded')).toBeVisible();
    await expect(page.getByText('Compliance record created')).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/12-spray-success.png` });
    await page.getByRole('button', { name: 'Close' }).click();
  });

  await test.step('13. Record a fertilising activity', async () => {
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Fertilising' }).click();
    await page.locator('#fieldSeasonId').selectOption({ label: 'Zuidkamp (sugar beet)' });
    await page.locator('#productId').selectOption({ label: 'KAS 27% N (L)' });
    await page.locator('#dosePerHa').fill('150');
    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByText('Activity recorded')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
  });

  await test.step('14. Record a scouting activity', async () => {
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Scouting' }).click();
    await page.locator('#fieldSeasonId').selectOption({ label: 'Noordpolder (wheat)' });
    await page.locator('#areaHa').fill('5');
    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByText('Activity recorded')).toBeVisible();
    await page.getByRole('button', { name: 'View activity history' }).click();
  });

  await test.step('15. Verify inventory changes', async () => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();
    await page.locator('#productId').selectOption({ label: 'Amistar Opti (L)' });
    // 2 L/ha × 42.5 ha = 85 L used from 500 → 415 remaining.
    await expect(page.getByText(/Current stock: 415/)).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
  });

  await test.step('16. Verify compliance record is visible', async () => {
    await page.goto('/compliance');
    // Sprint 19 redesign — the old "N record(s) on file" stub copy is gone;
    // the summary card + record list are the real UI now. The field filter
    // dropdown also now has a "Noordpolder" option, so the plain-text
    // locator needs to be scoped to the actual table cell, not just any
    // match on the page.
    await expect(page.getByText('Total records')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Noordpolder' })).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/16-compliance-page.png` });
  });

  await test.step('17. Verify dashboard updates', async () => {
    await page.goto('/dashboard');
    await expect(page.getByText('Farm setup complete')).toHaveCount(0);
    await page.screenshot({ path: `${SHOT_DIR}/17-dashboard-after-activities.png` });
  });

  await test.step('18. Test mobile width', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    await page.screenshot({ path: `${SHOT_DIR}/18-mobile-dashboard.png` });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  await test.step('19-20. Sign out, sign back in, confirm persistence', async () => {
    await clerk.signOut({ page });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });
    await page.goto('/activities');
    // Noordpolder has two activities (spray + scouting) — two matching rows
    // is itself part of the persistence confirmation.
    await expect(page.getByText('Noordpolder').first()).toBeVisible();
    await expect(page.getByText('Zuidkamp').first()).toBeVisible();
  });

  await test.step('21. Confirm another user cannot access this farm', async () => {
    const seeded = JSON.parse(readFileSync('playwright/.auth/seeded-farms.json', 'utf-8'));
    await clerk.signOut({ page });
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: process.env.E2E_USER_OTHER_EMAIL! });
    await page.goto('/activities');
    await expect(page.getByText('Noordpolder')).toHaveCount(0);
    await expect(page.getByText('Zuidkamp')).toHaveCount(0);
    await page.goto('/fields');
    await expect(page.getByText('Noordpolder')).toHaveCount(0);
    void seeded; // seeded-farms.json's own farmOther ids aren't needed for this UI-only check
  });
});
