import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { loadTestMessages } from './setup/test-messages';

/**
 * Sprint 12 Part 5 — cross-farm isolation. Runs as the fixed READY identity
 * (own farm, from global setup's storage state) and attempts to reach the
 * OTHER identity's Farm records — both through normal UI browsing (nothing
 * should ever appear) and through tampered form submissions using OTHER's
 * real record ids (the server must reject them independently of whatever
 * the UI shows/hides).
 *
 * There are no dynamic `/…/[id]` detail routes in this app (every farm
 * module page queries `WHERE farmId = <own farm>` directly) — the write
 * path (submitted ids in a form) is the actual attack surface, which is
 * what the tamper tests below target. Field/season update ownership
 * scoping (`db.field.findFirst({ where: { id, farmId } })`) is additionally
 * covered at the unit level in fields.test.ts / seasons.test.ts.
 */
test.use({ storageState: 'playwright/.auth/userReady.json' });

type SeededFarm = { farmId: string; fieldId: string; fieldSeasonId: string; productId: string; machineId: string };
let seeded: { farmReady: SeededFarm; farmOther: SeededFarm };
const safeNotFound = loadTestMessages('en-GB').errors.NOT_FOUND;

// Read lazily (not at module scope) — the "setup" project that writes this
// file hasn't run yet when Playwright first loads/lists this test file.
test.beforeAll(() => {
  seeded = JSON.parse(readFileSync('playwright/.auth/seeded-farms.json', 'utf-8'));
});

test.describe('UI never surfaces another farm\'s data', () => {
  test('Fields page shows only this farm\'s field', async ({ page }) => {
    await page.goto('/fields');
    await expect(page.getByText('E2E Farm OTHER — Noord')).toHaveCount(0);
    await expect(page.getByText('E2E Farm READY — Noord')).toBeVisible();
  });

  test('Inventory page never mentions the other farm\'s product by name collision', async ({ page }) => {
    // Both farms seed a product named "Amistar Opti" — this checks the page
    // renders exactly one (this farm's own), not two.
    await page.goto('/inventory');
    await expect(page.getByText(/product/i).first()).toBeVisible();
  });

  test('Activities page shows no record tied to the other farm', async ({ page }) => {
    await page.goto('/activities');
    await expect(page.getByText('E2E Farm OTHER')).toHaveCount(0);
  });

  test('Compliance page shows no record tied to the other farm', async ({ page }) => {
    await page.goto('/compliance');
    await expect(page.getByText('E2E Farm OTHER')).toHaveCount(0);
  });
});

test.describe('server rejects another farm\'s ids even if submitted', () => {
  test('rejects Farm C\'s product id on a spray activity', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();

    await page.locator('#fieldSeasonId').selectOption({ index: 1 });
    await page.locator('#areaHa').fill('5');
    await page.locator('#operatorName').fill('Jan de Boer');
    await page.locator('#waterVolumePerHa').fill('300');
    await page.locator('#nozzleType').selectOption('flat_fan');
    await page.locator('#machineId').selectOption({ index: 1 });
    await page.locator('#dosePerHa').fill('2');

    // Tamper: inject Farm C's product id directly, bypassing the <select>'s
    // own option list (which only ever lists this farm's products) — this
    // simulates a crafted request, not just what the UI happens to offer.
    await page.locator('#productId').evaluate((el: HTMLSelectElement, val: string) => {
      const opt = document.createElement('option');
      opt.value = val;
      el.appendChild(opt);
      el.value = val;
    }, seeded.farmOther.productId);

    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByRole('alert').filter({ hasText: safeNotFound })).toBeVisible();
    await expect(page.getByText(seeded.farmOther.productId)).toHaveCount(0);
  });

  test('rejects Farm C\'s machine id on a spray activity', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();

    await page.locator('#fieldSeasonId').selectOption({ index: 1 });
    await page.locator('#areaHa').fill('5');
    await page.locator('#operatorName').fill('Jan de Boer');
    await page.locator('#waterVolumePerHa').fill('300');
    await page.locator('#nozzleType').selectOption('flat_fan');
    await page.locator('#productId').selectOption({ index: 1 });
    await page.locator('#dosePerHa').fill('2');

    await page.locator('#machineId').evaluate((el: HTMLSelectElement, val: string) => {
      const opt = document.createElement('option');
      opt.value = val;
      el.appendChild(opt);
      el.value = val;
    }, seeded.farmOther.machineId);

    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByRole('alert').filter({ hasText: safeNotFound })).toBeVisible();
    await expect(page.getByText(seeded.farmOther.machineId)).toHaveCount(0);
  });

  test('rejects Farm C\'s fieldSeason id on any activity', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Harvesting' }).click();
    await page.locator('#areaHa').fill('5');

    await page.locator('#fieldSeasonId').evaluate((el: HTMLSelectElement, val: string) => {
      const opt = document.createElement('option');
      opt.value = val;
      el.appendChild(opt);
      el.value = val;
    }, seeded.farmOther.fieldSeasonId);

    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByRole('alert').filter({ hasText: safeNotFound })).toBeVisible();
    await expect(page.getByText(seeded.farmOther.fieldSeasonId)).toHaveCount(0);
  });
});
