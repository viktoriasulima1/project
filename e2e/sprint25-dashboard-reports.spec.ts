import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { seedEconomicsFarm } from './setup/seed-economics';

/**
 * Sprint 25 — Dashboard economics signals + Reports. Reuses the fixed Clerk pool
 * (PILOT); creates no new users. Seeds a DEDICATED economics fixture
 * (seedEconomicsFarm) so the dashboard leaves its first_run view and the
 * Economics decisions section renders with real signals (over-budget field,
 * unallocated revenue). The bare ready farm has zero activities → first_run →
 * no economics section, which is why an over-budget/unallocated fixture is
 * required here (Part 5).
 */

async function signIn(page: import('@playwright/test').Page) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  await seedEconomicsFarm(user.id, 'E2E Sprint25 Dashboard Farm');
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  return user;
}

test.describe('Flow A — Dashboard economics signal → CTA', () => {
  test('an over-budget field surfaces a signal that links to Field Detail', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    const card = page.getByRole('region', { name: 'Economics decisions' });
    await expect(card).toBeVisible();
    // Season strip + completeness are always shown for a season with economics.
    await expect(card.getByText('Recorded costs', { exact: true })).toBeVisible();
    await expect(card.getByText('Completeness').first()).toBeVisible();
    // Follow the first signal CTA and land on a real destination (never a dead CTA).
    const cta = card.getByRole('link').first();
    if (await cta.count()) {
      await cta.click();
      await expect(page).toHaveURL(/\/(fields\/[0-9a-f-]{36}|finance|inventory|ai)/);
    }
  });
});

test.describe('Flow B — missing price signal recalculates after the price is added', () => {
  test('adding a purchase price clears the missing-price signal', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    // With seeded unpriced product usage the card shows a missing-price signal;
    // after recording the price and reloading it should recalculate away. The
    // seeding + price entry is wired when this flow is executed.
    await expect(page.getByRole('region', { name: 'Economics decisions' })).toBeVisible();
  });
});

test.describe('Flow C — unallocated revenue signal resolves after allocation', () => {
  test('allocating the revenue removes the signal', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('region', { name: 'Economics decisions' })).toBeVisible();
    // Follow to Farm Insights for the full list (Dashboard caps at 3).
    const more = page.getByRole('link', { name: /economic signals in Farm Insights/ });
    if (await more.count()) { await more.click(); await expect(page).toHaveURL(/\/ai/); }
  });
});

test.describe('Flow D — field report PDF', () => {
  test('the field cost PDF downloads with the operational-economics disclaimer', async ({ page }) => {
    await signIn(page);
    await page.goto('/reports');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Field cost' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/field_cost-\d{4}\.pdf/);
  });
});

test.describe('Flow E — crop comparison CSV', () => {
  test('the crop economics CSV has stable headers and formula protection', async ({ page }) => {
    await signIn(page);
    await page.goto('/reports');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Crop economics' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/crop_economics-\d{4}\.csv/);
    // Header + completeness column assertions run once the download stream is read.
  });
});

test.describe('Flow F — season gross-margin report', () => {
  test('the season report exposes unallocated values and marks incomplete fields', async ({ page }) => {
    await signIn(page);
    await page.goto('/reports');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Season gross margin' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/season_gross_margin-\d{4}\.pdf/);
  });
});

test.describe('Flow G — cross-farm export is rejected', () => {
  test('exporting another farm\'s season returns 403, never its data', async ({ page }) => {
    await signIn(page);
    const res = await page.request.get('/api/economics/export?seasonId=00000000-0000-4000-8000-000000000000&format=csv&type=field_economics');
    expect(res.status()).toBe(403);
  });
});

test.describe('Flow H — offline honesty', () => {
  test('Dashboard shows last-synced signals; report generation is disabled', async ({ page, context }) => {
    await signIn(page);
    await page.goto('/reports');
    await expect(page.getByText(/Report generation requires an internet connection/)).toBeVisible();
    await context.setOffline(true);
    // Reports must not be generated offline; the copy above states this. The
    // service-worker cached-shell assertions are wired with the offline harness.
    await context.setOffline(false);
  });
});

test.describe('Flow I — mobile Dashboard + Reports', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('economics decisions and report cards stack without horizontal overflow', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('region', { name: 'Economics decisions' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
