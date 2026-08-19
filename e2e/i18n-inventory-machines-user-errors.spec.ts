import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedReadyFarm } from './setup/seed-farms';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';

type Locale = 'nl-NL' | 'en-GB' | 'pl-PL' | 'de-DE';

async function setup(page: Page, context: BrowserContext, baseURL: string | undefined, locale: Locale) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  await seedReadyFarm(user.id, `E2E U2 ${locale}`);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
}

async function openManualInventory(page: Page) {
  await page.goto('/inventory');
  await page.getByRole('button', { name: '+ Add product' }).click();
  await page.getByRole('button', { name: 'Product not found / manual entry' }).click();
  return page.getByRole('heading', { name: 'Add product manually' }).locator('..').locator('..');
}

test.describe('Stage 14 U2 — localized Inventory and Machine errors', () => {
  for (const locale of ['nl-NL', 'en-GB', 'pl-PL', 'de-DE'] as const) {
    test(`${locale}: invalid inventory quantity is localized, focused and preserves input`, async ({ page, context, baseURL }) => {
      const messages = loadTestMessages(locale);
      await setup(page, context, baseURL, locale);
      await openManualInventory(page);
      await page.locator('#name').fill('Rejected product');
      await page.locator('#currentStock').evaluate((input) => input.removeAttribute('min'));
      await page.locator('#currentStock').fill('-1');
      await page.getByRole('button', { name: 'Add product', exact: true }).click();
      const alert = page.getByRole('alert').filter({ hasText: messages.errors.INVALID_QUANTITY });
      await expect(alert).toHaveText(messages.errors.INVALID_QUANTITY);
      await expect(alert).toBeFocused();
      await expect(page.locator('#currentStock')).toHaveValue('-1');
      await expect(page.locator('#currentStock')).toHaveAttribute('aria-describedby', 'inventory-current-stock-error');
      await expect(page.locator('#inventory-current-stock-error')).toHaveText(messages.errors.INVALID_QUANTITY);
      await expect(page.getByText(/Zod|Prisma|INVALID_QUANTITY|too_small|P20\d\d/i)).toHaveCount(0);
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByText('Rejected product')).toHaveCount(0);
    });
  }

  test('Polish invalid machine name uses the shared localized contract and creates nothing', async ({ page, context, baseURL }) => {
    const messages = loadTestMessages('pl-PL');
    await setup(page, context, baseURL, 'pl-PL');
    await page.goto('/activities');
    await page.getByRole('button', { name: '+ Record activity' }).click();
    await page.getByRole('button', { name: 'Spraying' }).click();
    await page.locator('#machineId').selectOption('__add_new__');
    const rejectedName = `Rejected-${'x'.repeat(100)}`;
    await page.getByLabel('New sprayer name').fill(rejectedName);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: messages.errors.INVALID_VALUE })).toHaveText(messages.errors.INVALID_VALUE);
    await expect(page.getByLabel('New sprayer name')).toHaveValue(rejectedName);
    await expect(page.locator('#machineId option', { hasText: rejectedName })).toHaveCount(0);
    await expect(page.getByText(/Prisma|Zod|INVALID_VALUE|P20\d\d/i)).toHaveCount(0);
  });

  test('German mobile error presentation wraps without overflow and keeps actions reachable', async ({ page, context, baseURL }) => {
    const messages = loadTestMessages('de-DE');
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page, context, baseURL, 'de-DE');
    await openManualInventory(page);
    await page.locator('#name').fill('Mobil abgelehnt');
    await page.locator('#currentStock').evaluate((input) => input.removeAttribute('min'));
    await page.locator('#currentStock').fill('-1');
    await page.getByRole('button', { name: 'Add product', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: messages.errors.INVALID_QUANTITY })).toHaveText(messages.errors.INVALID_QUANTITY);
    await expect(page.getByRole('button', { name: 'Add product', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
});
