import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Sprint 12 Part 8 — lightweight automated accessibility checks via
 * axe-core. Runs as the fixed READY identity (own farm) for most pages; sign-in is checked
 * unauthenticated. Not a full WCAG certification — flags the specific
 * critical categories the brief names: unlabeled inputs, keyboard traps,
 * inaccessible dialogs, focus management, missing error association,
 * unnamed buttons, color-only status. `critical`/`serious` violations fail
 * the test; `moderate`/`minor` are logged, not blocking.
 */

function reportableViolations(results: Awaited<ReturnType<AxeBuilder['analyze']>>) {
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

test('sign-in page has no critical/serious accessibility violations', async ({ page }) => {
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = reportableViolations(results);
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

test.describe('authenticated pages (READY)', () => {
  test.use({ storageState: 'playwright/.auth/userReady.json' });

  test('dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    const results = await new AxeBuilder({ page }).analyze();
    expect(reportableViolations(results)).toEqual([]);
  });

  test('activities empty/list page', async ({ page }) => {
    await page.goto('/activities');
    const results = await new AxeBuilder({ page }).analyze();
    expect(reportableViolations(results)).toEqual([]);
  });

  test('inventory empty state', async ({ page }) => {
    await page.goto('/inventory');
    const results = await new AxeBuilder({ page }).analyze();
    expect(reportableViolations(results)).toEqual([]);
  });

  test('weather empty state', async ({ page }) => {
    await page.goto('/weather');
    const results = await new AxeBuilder({ page }).analyze();
    expect(reportableViolations(results)).toEqual([]);
  });

  test('compliance empty state', async ({ page }) => {
    await page.goto('/compliance');
    const results = await new AxeBuilder({ page }).analyze();
    expect(reportableViolations(results)).toEqual([]);
  });

  test('onboarding inventory form (revisited post-setup)', async ({ page }) => {
    await page.goto('/onboarding?step=inventory');
    const results = await new AxeBuilder({ page }).analyze();
    expect(reportableViolations(results)).toEqual([]);
  });

  test('Quick Log dialog (type picker)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: '+ Quick Log' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const results = await new AxeBuilder({ page }).include('dialog').analyze();
    expect(reportableViolations(results)).toEqual([]);
  });

  test('activity form (spraying)', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();
    const results = await new AxeBuilder({ page }).include('dialog').analyze();
    expect(reportableViolations(results)).toEqual([]);
  });

  test('activity success dialog', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Scouting' }).click();
    await page.locator('#fieldSeasonId').selectOption({ index: 1 });
    await page.locator('#areaHa').fill('4');
    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByText('Activity recorded')).toBeVisible();
    const results = await new AxeBuilder({ page }).include('dialog').analyze();
    expect(reportableViolations(results)).toEqual([]);
  });

  test('keyboard: Tab does not trap focus outside the activity dialog', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Tab through a generous number of times — if focus is properly
    // managed, it cycles within the dialog's own interactive elements and
    // the page never ends up scrolled/focused on background sidebar links.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
    }
    const activeInDialog = await page.evaluate(() => {
      const dialog = document.querySelector('dialog');
      return dialog ? dialog.contains(document.activeElement) : false;
    });
    expect(activeInDialog).toBe(true);
  });

  test('close button dismisses the activity dialog', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Escape dismisses the activity dialog', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
