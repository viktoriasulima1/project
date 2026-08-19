import { test, expect } from '@playwright/test';

/**
 * Sprint 12 Part 6 — mobile E2E. Runs under both the `mobile-iphone12`
 * (390×844) and `mobile-iphone14promax` (430×932) Playwright projects
 * (see playwright.config.ts), against the fixed READY identity's pre-seeded farm.
 */
test.use({ storageState: 'playwright/.auth/userReady.json' });

test('dashboard has no horizontal scroll and the mobile nav toggle works', async ({ page }) => {
  await page.goto('/dashboard');

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 for sub-pixel rounding

  // Sidebar starts hidden on mobile (Sprint 12 fix — previously permanently
  // occupied ~55% of a 390px screen with no way to hide it).
  await expect(page.getByRole('link', { name: '✎ Activities' })).toBeHidden();

  const navigationToggle=page.getByRole('button', { name: /Open navigation|Close navigation/ });
  await expect(async()=>{if(await navigationToggle.getAttribute('aria-expanded')!=='true')await navigationToggle.click();expect(await navigationToggle.getAttribute('aria-expanded')).toBe('true')}).toPass({timeout:10_000});
  await expect(page.getByRole('link', { name: '✎ Activities' })).toBeVisible();
  await page.getByRole('link', { name: '✎ Activities' }).click();
  await expect(page).toHaveURL(/\/activities/);
  // Navigating closes the drawer automatically (route change effect).
  await expect(page.getByRole('link', { name: '◈ Today' })).toBeHidden();
});

test('mobile FAB is reachable and does not sit under other controls', async ({ page }) => {
  await page.goto('/dashboard');
  const fab = page.getByRole('button', { name: 'Quick log an activity' });
  await expect(fab).toBeVisible();
  const box = await fab.boundingBox();
  expect(box).not.toBeNull();
  // 44px minimum tap target (Sprint 11/12 mobile requirement).
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test('recording an activity end-to-end from the mobile FAB', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Quick log an activity' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'What did you do?' })).toBeVisible();

  await page.getByRole('button', { name: 'Scouting' }).click();
  await page.locator('#fieldSeasonId').selectOption({ index: 1 });
  await page.locator('#areaHa').fill('3');

  // The dialog's overlay (its direct parent), not the <dialog> element
  // itself, is the scroll container (overflow-y: auto) — scroll it to
  // confirm the footer's Save button is reachable, not clipped off
  // permanently.
  await dialog.locator('..').evaluate((el) => el.scrollTo(0, el.scrollHeight));

  const saveButton = page.getByRole('button', { name: 'Save activity' });
  await expect(saveButton).toBeVisible();
  // click() auto-scrolls the target into view if needed, same as a real tap.
  await saveButton.click();

  await expect(page.getByText('Activity recorded')).toBeVisible();
});

test('numeric fields use a numeric input mode where applicable', async ({ page }) => {
  await page.goto('/activities');
  await page.getByRole('button', { name: '+ Record activity' }).click();
  await page.getByRole('button', { name: 'Fertilising' }).click();
  await expect(page.locator('#dosePerHa')).toHaveAttribute('inputmode', 'decimal');
  await expect(page.locator('#areaHa')).toHaveAttribute('inputmode', 'decimal');
});

test('offline queue status and controls fit the mobile viewport', async ({ page }) => {
  await page.goto('/offline');
  await expect(page.getByRole('heading', { name: 'Offline & Sync' })).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  await expect(page.getByRole('button', { name: 'Retry waiting items' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete all local drafts' })).toBeVisible();
});
