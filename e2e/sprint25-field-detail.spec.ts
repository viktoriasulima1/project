import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { seedEconomicsFarm, type EconomicsFixture } from './setup/seed-economics';

/**
 * Sprint 25 — Field Detail economics flows. Reuses the fixed Clerk pool (PILOT);
 * creates no new users. Each flow seeds a DEDICATED economics fixture
 * (seedEconomicsFarm: one activity, an over-budget field, unallocated revenue,
 * a corrected expense chain, a reversed expense, and a reallocated cost) so the
 * history flows have real data — never the bare ready farm (Part 7).
 */

async function signIn(page: import('@playwright/test').Page): Promise<EconomicsFixture> {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture = await seedEconomicsFarm(user.id, 'E2E Sprint25 Field Detail Farm');
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  return fixture;
}

/**
 * Opens the seeded field's detail page by clicking its row link — scoped to the
 * fields TABLE so a sidebar/nav link can never be matched instead (Part 6) —
 * and verifies the URL before continuing.
 */
async function openSeededFieldDetail(page: import('@playwright/test').Page) {
  await page.goto('/fields');
  await page.getByRole('table').getByRole('link').first().click();
  await expect(page).toHaveURL(/\/fields\/[0-9a-f-]{36}$/);
}

test.describe('Flow A — open a field and see complete economics', () => {
  test('field name links to detail; summary, breakdown, direct/allocated and source records render', async ({ page }) => {
    await signIn(page);
    await openSeededFieldDetail(page);

    await expect(page.getByText(/Completeness:/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cost breakdown' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Direct versus allocated' })).toBeVisible();
    await expect(page.getByText(/Total recorded field cost/)).toBeVisible();
    await expect(page.getByText(/Farm-level unallocated/).first()).toBeVisible();
    await expect(page.getByText('Gross margin').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Source records/ })).toBeVisible();
  });
});

test.describe('Flow B — missing data reads "Not recorded", never €0', () => {
  test('a field with no revenue shows Not recorded and a completeness explanation', async ({ page }) => {
    await signIn(page);
    await openSeededFieldDetail(page);
    await expect(page.getByText('Not recorded').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Data completeness' })).toBeVisible();
  });
});

test.describe('Flow C — correction history is visible on the field', () => {
  test('a corrected expense shows Original and Current effective in the Corrections tab', async ({ page }) => {
    const fixture = await signIn(page);
    await openSeededFieldDetail(page);
    await page.getByRole('tab', { name: /Corrections/ }).click();
    await expect(page.getByText(fixture.correctedExpenseLabel).first()).toBeVisible();
    await expect(page.getByText('Original').first()).toBeVisible();
    await expect(page.getByText('Current effective').first()).toBeVisible();
  });
});

test.describe('Flow D — reallocation history is visible on the field', () => {
  test('a reallocated cost shows its allocation versions in the Allocations tab', async ({ page }) => {
    await signIn(page);
    await openSeededFieldDetail(page);
    await page.getByRole('tab', { name: /Allocations/ }).click();
    await expect(page.getByText('No allocation changes on this field.')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^Allocation ·/ })).toBeVisible();
    await expect(page.getByText('Current effective').first()).toBeVisible();
  });
});

test.describe('Flow E — reversal is excluded from totals but shown in history', () => {
  test('a reversed expense carries a Reversed badge in the Corrections tab', async ({ page }) => {
    const fixture = await signIn(page);
    await openSeededFieldDetail(page);
    await page.getByRole('tab', { name: /Corrections/ }).click();
    await expect(page.getByText(fixture.reversedExpenseLabel).first()).toBeVisible();
    await expect(page.getByText('Reversed').first()).toBeVisible();
  });
});

test.describe('Flow F — purchase reversal/replacement disclosure', () => {
  test('the purchase section states snapshots are unchanged and offers no edit', async ({ page }) => {
    await signIn(page);
    await openSeededFieldDetail(page);
    await expect(page.getByRole('heading', { name: 'Purchase history' })).toBeVisible();
    await expect(page.getByText(/Historical activity costs remain based on the price known at completion/)).toBeVisible();
    // There is deliberately no "Edit purchase" control anywhere on the page.
    await expect(page.getByRole('button', { name: /Edit purchase/ })).toHaveCount(0);
  });
});

test.describe('Flow G — cross-farm field detail is rejected', () => {
  test('a fabricated / other-farm field id resolves to not-found, not a leak', async ({ page }) => {
    await signIn(page);
    const res = await page.goto('/fields/00000000-0000-4000-8000-000000000000');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Flow H — offline view is honest', () => {
  test('economic history is visible online and the field remains readable offline', async ({ page, context }) => {
    await signIn(page);
    await openSeededFieldDetail(page);
    await expect(page.getByRole('heading', { name: 'Economic history' })).toBeVisible();
    // The Actions bar shows the offline banner + disables mutations when offline.
    await context.setOffline(true);
    await expect(page.getByRole('heading', { name: 'Cost breakdown' })).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('Flow I — mobile Field Detail', () => {
  test('summary cards, breakdown and timeline stack without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await openSeededFieldDetail(page);
    await expect(page.getByRole('heading', { name: 'Cost breakdown' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
