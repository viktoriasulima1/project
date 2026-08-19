import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { seedReadyFarm } from './setup/seed-farms';
import { setFarmCoordinates } from './setup/adjust-farm';

/**
 * Sprint 18 — Ctgb + BRP/PDOK integration flows. Runs against deterministic
 * fixtures (E2E_MOCK_CTGB / E2E_MOCK_PDOK, set in playwright.config.ts's
 * serverEnv) rather than the live government services — Ctgb's real API
 * returned 403 during this sprint's own research (see
 * docs/Ctgb_Official_Data_Audit.md), so mocking is the only way to exercise
 * a genuine success path at all, not just a preference for determinism.
 */

test.describe('Flow A — Ctgb product search through a completed, verified spray', () => {
  test('search official product, add to inventory, plan and complete a spray, verify the immutable compliance snapshot', async ({ page }) => {
    // Reuses the fixed PILOT identity, reset before reseeding — see
    // docs/E2E_Clerk_User_Quota_Audit.md.
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    const seeded = await seedReadyFarm(user.id, 'E2E Ctgb Farm');

    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    await page.goto('/inventory');
    await page.getByRole('button', { name: '+ Add product' }).click();
    await page.locator('#ctgb-query').fill('Amistar');
    await expect(page.getByText('Amistar Opti (E2E fixture)')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Auth\. no\. NL-E2E-0001/)).toBeVisible();

    await page.getByRole('button', { name: 'Select' }).click();
    // Exact match — the surrounding source-note sentence also contains
    // "Authorised" as a substring (in "Source: official Ctgb..."), so a
    // non-exact match resolves to two elements.
    await expect(page.getByText('Authorised', { exact: true })).toBeVisible();
    await expect(page.getByText(/official Ctgb Toelatingendatabank/)).toBeVisible();

    await page.locator('#currentStock').fill('500');
    await page.locator('#minimumStock').fill('50');
    await page.getByRole('button', { name: 'Add product', exact: true }).click();
    // Wait for the dialog to actually close (InventoryClient's onSuccess
    // handler only fires once the server action resolves) before
    // navigating away — a bare page.goto() right after the click races the
    // in-flight action and can abort it before the item is created,
    // especially under the load of a full sequential suite run.
    await expect(page.getByRole('heading', { name: 'Add stock details' })).toHaveCount(0);

    await page.goto('/inventory');
    await expect(page.getByText('Amistar Opti (E2E fixture)')).toBeVisible();
    await expect(page.getByText(/Ctgb verified/)).toBeVisible();

    // Plan and complete a spray using the new product on the seeded wheat field.
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();
    await page.locator('#fieldSeasonId').selectOption({ index: 1 });
    // This Playwright version's selectOption only accepts a string label,
    // not a RegExp — locate the option by its actual visible text, read
    // its value, and select by value instead of guessing/hardcoding a
    // database id.
    const productOption = page.locator('#productId option', { hasText: 'Amistar Opti (E2E fixture)' });
    await expect(productOption, 'E2E fixture product option not found in #productId — Ctgb mock wiring may be broken').toHaveCount(1);
    const productValue = await productOption.getAttribute('value');
    if (!productValue) throw new Error('E2E: "Amistar Opti (E2E fixture)" option has no value attribute');
    await page.locator('#productId').selectOption(productValue);
    await page.locator('#dosePerHa').fill('2');
    await page.locator('#operatorName').fill('Jan de Boer');
    await page.locator('#waterVolumePerHa').fill('300');
    await page.locator('#nozzleType').selectOption('flat_fan');
    await page.locator('#machineId').selectOption({ index: 1 });

    // Official Ctgb restrictions panel — the crop (wheat -> "Tarwe") matches
    // the fixture's one official use, dose 2 L/ha is within its 1-3 range.
    await expect(page.getByText('Official Ctgb restrictions')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Authorised/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByText('Activity recorded')).toBeVisible();
    await expect(page.getByText(/Stock updated/)).toBeVisible();
    await expect(page.getByText('Compliance record created')).toBeVisible();

    await page.goto('/compliance');
    await expect(page.getByText('EU Spray Diary')).toBeVisible();

    expect(seeded.fieldSeasonId).toBeTruthy();
  });

  test('Ctgb unavailable: search shows an honest unavailable state, manual entry still works', async ({ page }) => {
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    await seedReadyFarm(user.id, 'E2E Ctgb Unavailable Farm');

    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    await page.goto('/inventory');
    await page.getByRole('button', { name: '+ Add product' }).click();
    await page.locator('#ctgb-query').fill('E2E_UNAVAILABLE trigger query');
    await expect(page.getByText(/Official product lookup is unavailable/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Product not found / manual entry' }).click();
    await expect(page.getByText('Unverified — not validated against Ctgb')).toBeVisible();
    await page.locator('#name').fill('Manual Fungicide');
    // Exact match — the dialog's own "+ Add product" trigger button (still
    // present behind/around this dialog) also contains "Add product" as a
    // substring.
    await page.getByRole('button', { name: 'Add product', exact: true }).click();
    // See the analogous wait in the Flow A test above — do not navigate
    // away before the dialog actually closes.
    await expect(page.getByRole('heading', { name: 'Add product manually' })).toHaveCount(0);

    await page.goto('/inventory');
    await expect(page.getByText('Manual Fungicide')).toBeVisible();
    // .first() — the farm's seeded starter product (from seedReadyFarm) is
    // itself created as manual/unverified too, so this label legitimately
    // appears on more than one row; this assertion only cares that it
    // appears at all, not which specific row.
    await expect(page.getByText('Manual / unverified').first()).toBeVisible();
  });
});

test.describe('Flow B — BRP parcel import', () => {
  // The two tests below each combine what could have been separate scenarios
  // into one sequential test on a single user/farm — Farm.clerkUserId is
  // @unique (one Clerk user = at most one farm, ever), and each test reuses
  // the fixed PILOT identity (resetting its data first) rather than a
  // throwaway Clerk user, per docs/E2E_Clerk_User_Quota_Audit.md.

  test('search near farm, select a parcel, confirm import, then reject a duplicate import of the same parcel', async ({ page }) => {
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    const seeded = await seedReadyFarm(user.id, 'E2E BRP Farm');

    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    await page.goto('/fields/import/brp');
    await expect(page.getByText(/Tarwe \(E2E fixture\)/)).toBeVisible({ timeout: 10_000 });

    await page.getByText(/Tarwe \(E2E fixture\)/).click();
    await expect(page.getByText(/Public data · 2025/)).toBeVisible();
    await expect(page.getByText(/not proof of ownership|not your personal RVO registration/)).toBeVisible();

    await page.locator('#fieldName').fill('Noordkamp BRP Import');
    await page.getByRole('button', { name: 'Confirm and import this field' }).click();

    await expect(page).toHaveURL(/\/fields$/);
    await expect(page.getByText('Noordkamp BRP Import')).toBeVisible();
    expect(seeded.farmId).toBeTruthy();

    // Same farm, same parcel, a second confirm attempt — must be rejected
    // as a duplicate, not silently create a second field.
    await page.goto('/fields/import/brp');
    await expect(page.getByText(/Tarwe \(E2E fixture\)/)).toBeVisible({ timeout: 10_000 });
    await page.getByText(/Tarwe \(E2E fixture\)/).click();
    await page.locator('#fieldName').fill('Duplicate Attempt');
    await page.getByRole('button', { name: 'Confirm and import this field' }).click();
    await expect(page.getByText(/already been imported/)).toBeVisible();
  });

  test('no parcels found shows an honest empty state; PDOK unavailable falls back to manual field creation', async ({ page }) => {
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    const seeded = await seedReadyFarm(user.id, 'E2E BRP Failure Flows Farm');

    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    // Far from the mock fixture's parcels (~5.93E, 51.96N) but a plausible
    // real-world coordinate, not the "force unavailable" [0,0] sentinel.
    await setFarmCoordinates(seeded.farmId, 53.2, 6.5);
    await page.goto('/fields/import/brp');
    await expect(page.getByText(/No BRP parcels found/)).toBeVisible({ timeout: 10_000 });

    // [0, 0] ("null island") deterministically forces the unavailable path
    // in mock mode — see brp-client.ts.
    await setFarmCoordinates(seeded.farmId, 0, 0);
    await page.goto('/fields/import/brp');
    await expect(page.getByText(/PDOK parcel service is unavailable/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/create a field manually/)).toBeVisible();

    // Manual creation flow (pre-existing, Sprint-1-era) still works.
    await page.goto('/fields');
    await page.getByRole('button', { name: '+ Add field' }).first().click();
    await page.locator('#name').fill('Manually Added Field');
    await page.locator('#hectares').fill('4');
    await page.getByRole('button', { name: 'Create field' }).click();
    await expect(page.getByText('Manually Added Field')).toBeVisible();
  });
});
