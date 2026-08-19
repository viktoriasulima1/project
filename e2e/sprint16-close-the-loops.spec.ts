import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { seedReadyFarm } from './setup/seed-farms';
import { setInventoryItemFields } from './setup/adjust-inventory';
import { setFarmCoordinates } from './setup/adjust-farm';

/**
 * Sprint 16 — closing the half-built loops found in
 * docs/Sprint_16_Half_Built_Loops_Audit.md: the spray suitability engine
 * wired into the real activity flow, planned vs completed activities, a
 * real Finance page, and a real Farm Insights page. See
 * docs/Sprint_16_Close_The_Loops_Report.md for the full writeup.
 */

test.describe('golden flow 1 — spray suitability inside the real activity flow', () => {
  test.use({ storageState: 'playwright/.auth/userReady.json' });

  test('shows a real suitability review before saving, then completes the activity end-to-end', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();

    await page.locator('#fieldSeasonId').selectOption({ index: 1 });
    await page.locator('#productId').selectOption({ label: 'Amistar Opti (L)' });
    await page.locator('#dosePerHa').fill('2');
    await page.locator('#operatorName').fill('Jan de Boer');
    await page.locator('#waterVolumePerHa').fill('300');
    await page.locator('#nozzleType').selectOption('flat_fan');
    await page.locator('#machineId').selectOption({ index: 1 });

    // The real spray-window engine runs in 'planned-application' mode with
    // this exact field/product/operator/machine/date — since no real
    // product registration or matching Employee record exists for this
    // farm, it must honestly show a blocker rather than a silent green
    // light (Sprint 16 Part 2: "no silent recommendation when required
    // information is missing").
    await expect(page.getByText(/⛔ Blocked|Suitability:/).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/No verified product registration/).first()).toBeVisible();
    await expect(page.getByText(/indicative only/i).first()).toBeVisible();

    // A hard blocker does not gate submission (live weather is inherently
    // variable — see ActivityDialog.tsx's comment on this design choice).
    await page.getByRole('button', { name: 'Save activity' }).click();

    await expect(page.getByText('Activity recorded')).toBeVisible();
    await expect(page.getByText(/Stock updated/)).toBeVisible();
    await expect(page.getByText('Compliance record created')).toBeVisible();
  });

  test('completed activity appears in Activities history and Compliance, dashboard reflects it', async ({ page }) => {
    await page.goto('/activities');
    await expect(page.getByRole('cell', { name: 'spray' }).first()).toBeVisible();

    await page.goto('/compliance');
    await expect(page.getByText('EU Spray Diary')).toBeVisible();

    await page.goto('/dashboard');
    await expect(page.getByText('Finance Snapshot')).toBeVisible();
  });
});

test.describe('golden flow 2 — real Finance cost tracking', () => {
  test('recorded cost and completeness reflect a real priced activity', async ({ page }) => {
    // Reuses the fixed PILOT identity, reset to a clean farm-less state
    // right here — see docs/E2E_Clerk_User_Quota_Audit.md. PILOT is shared
    // sequentially across this file's and sprint18-ctgb-brp.spec.ts's
    // scenarios (safe under this suite's single-worker config), so each one
    // resets before reseeding its own fixture farm.
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    const seeded = await seedReadyFarm(user.id, 'E2E Finance Farm');
    await setInventoryItemFields(seeded.productId, { purchasePricePerUnit: 25 });

    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    await page.goto('/finance');
    await expect(page.getByRole('heading', { name: 'Field economics' })).toBeVisible();
    await expect(page.getByText('Not recorded').first()).toBeVisible();

    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();
    await page.locator('#fieldSeasonId').selectOption({ index: 1 });
    await page.locator('#productId').selectOption({ label: 'Amistar Opti (L)' });
    await page.locator('#areaHa').fill('10');
    await page.locator('#dosePerHa').fill('2');
    await page.locator('#operatorName').fill('Jan de Boer');
    await page.locator('#waterVolumePerHa').fill('300');
    await page.locator('#nozzleType').selectOption('flat_fan');
    await page.locator('#machineId').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByText('Activity recorded')).toBeVisible();

    await page.goto('/finance');
    // 10 ha x 2 L/ha x €25/L = €500,00 recorded cost, 100% price coverage
    // (nl-NL currency formatting — comma decimal, so match the digits, not
    // the exact euro-sign spacing which varies by ICU data version).
    await expect(page.getByText(/500[,.]00/).first()).toBeVisible();
    await expect(page.getByText('Field profitability')).toBeVisible();
    await expect(page.getByText('Crop comparison')).toBeVisible();
    await expect(page.getByTestId('finance-completeness-section')).toBeVisible();
    await expect(page.getByTestId('finance-completeness-reasons')).toBeVisible();
  });
});

test.describe('golden flow 3 — real Farm Insights from a low-stock condition', () => {
  test('a low-stock insight appears and its action leads to Inventory', async ({ page }) => {
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    const seeded = await seedReadyFarm(user.id, 'E2E Insights Farm');

    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    // Consume most of the seeded 500L stock in one spray (240ha x 2L/ha =
    // 480L, leaving 20L — below the seeded 50L minimum) to create a real,
    // unmocked low-stock condition.
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();
    await page.locator('#fieldSeasonId').selectOption({ index: 1 });
    await page.locator('#productId').selectOption({ label: 'Amistar Opti (L)' });
    await page.locator('#areaHa').fill('240');
    await page.locator('#dosePerHa').fill('2');
    await page.locator('#operatorName').fill('Jan de Boer');
    await page.locator('#waterVolumePerHa').fill('300');
    await page.locator('#nozzleType').selectOption('flat_fan');
    await page.locator('#machineId').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByText('Activity recorded')).toBeVisible();

    await page.goto('/ai');
    await expect(page.getByText('Farm Insights').first()).toBeVisible();
    await expect(page.getByText(/below minimum stock/)).toBeVisible();
    await expect(page.getByText(/Rule-based insight \(no AI\/ML model involved\)/).first()).toBeVisible();

    await page.getByRole('link', { name: 'View inventory' }).first().click();
    await expect(page).toHaveURL(/\/inventory/);
    expect(seeded.fieldId).toBeTruthy(); // sanity: seeded fixture was actually used
  });
});

test.describe('failure flow — missing weather and missing product constraints', () => {
  test('a real weather-fetch failure surfaces an honest message, not a silent crash', async ({ page }) => {
    // `evaluateSpraySuitability` runs server-side, so a browser-level
    // page.route() intercept would never reach it — instead this forces a
    // REAL Open-Meteo 400 by giving the farm an out-of-range coordinate,
    // a genuine failure rather than a mocked one.
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    const seeded = await seedReadyFarm(user.id, 'E2E Weather Failure Farm');
    await setFarmCoordinates(seeded.farmId, 999, 999);

    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();
    await page.locator('#fieldSeasonId').selectOption({ index: 1 });
    await page.locator('#productId').selectOption({ label: 'Amistar Opti (L)' });
    await page.locator('#dosePerHa').fill('2');
    await page.locator('#operatorName').fill('Jan de Boer');
    await page.locator('#waterVolumePerHa').fill('300');
    await page.locator('#nozzleType').selectOption('flat_fan');
    await page.locator('#machineId').selectOption({ index: 1 });

    await expect(page.getByText(/Could not check spray suitability|Weather suitability cannot be calculated/)).toBeVisible({ timeout: 20_000 });
  });
});
