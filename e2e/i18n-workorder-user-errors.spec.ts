import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedReadyFarm } from './setup/seed-farms';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';
import { countForFarm } from './setup/db-inspect';

type Locale = 'nl-NL' | 'en-GB' | 'pl-PL' | 'de-DE';

async function openSeeded(page: Page, context: BrowserContext, baseURL: string | undefined, locale: Locale) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const seeded = await seedReadyFarm(user.id, `E2E Work Order Errors ${locale}`);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
  return seeded;
}

function workOrderForm(page: Page) {
  return page.locator('form', { has: page.locator('input[name="reservationQuantity"]') });
}

test.describe('Stage 13 — localized Work Order user-error contract', () => {
  for (const locale of ['nl-NL', 'en-GB', 'pl-PL', 'de-DE'] as const) {
    test(`${locale}: insufficient stock is localized, safe, and creates no side effects`, async ({ page, context, baseURL }) => {
      const messages = loadTestMessages(locale);
      const seeded = await openSeeded(page, context, baseURL, locale);
      const before = await countForFarm(seeded.farmId);
      await page.goto('/work-orders');
      const form = workOrderForm(page);
      await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
      await form.locator('input[name="title"]').fill('Over-reserve safely');
      await form.locator('select[name="inventoryItemId"]').selectOption({ index: 1 });
      await form.locator('input[name="reservationQuantity"]').fill('9999');
      await form.locator('button').click();
      await expect(form.getByRole('alert')).toHaveText(messages.errors.INSUFFICIENT_STOCK);
      await expect(form.getByText(/Prisma|Zod|INSUFFICIENT_STOCK|P20\d\d/i)).toHaveCount(0);
      const after = await countForFarm(seeded.farmId);
      expect(after.workOrders).toBe(before.workOrders);
      expect(after.activeReservations).toBe(before.activeReservations);
      expect(after.auditEvents).toBe(before.auditEvents);
    });
  }

  test('Dutch invalid planning window is localized and writes nothing', async ({ page, context, baseURL }) => {
    const messages = loadTestMessages('nl-NL');
    const seeded = await openSeeded(page, context, baseURL, 'nl-NL');
    const before = await countForFarm(seeded.farmId);
    await page.goto('/planning');
    const form = page.locator('form', { has: page.locator('input[name="windowStart"]') });
    await form.locator('select[name="fieldSeasonId"]').selectOption({ index: 0 });
    await form.locator('input[name="title"]').fill('Ongeldig venster');
    await form.locator('input[name="windowStart"]').fill('2026-08-10');
    await form.locator('input[name="windowEnd"]').fill('2026-08-01');
    await form.locator('button').click();
    await expect(form.getByRole('alert')).toHaveText(messages.errors.WORK_WINDOW_INVALID);
    const after = await countForFarm(seeded.farmId);
    expect(after.seasonPlanItems).toBe(before.seasonPlanItems);
    expect(after.auditEvents).toBe(before.auditEvents);
  });

  test('German farm-scoped not-found does not reveal ownership or identifiers', async ({ page, context, baseURL }) => {
    const messages = loadTestMessages('de-DE');
    await openSeeded(page, context, baseURL, 'de-DE');
    await page.goto('/work-orders');
    const form = workOrderForm(page);
    const foreignId = 'f0000009-0000-4000-8000-000000000009';
    await form.locator('select[name="fieldSeasonId"]').evaluate((select, id) => {
      const option = document.createElement('option'); option.value = id; option.textContent = 'Hidden'; select.append(option);
    }, foreignId);
    await form.locator('select[name="fieldSeasonId"]').selectOption(foreignId);
    await form.locator('input[name="title"]').fill('Scoped');
    await form.locator('button').click();
    await expect(form.getByRole('alert')).toHaveText(messages.errors.NOT_FOUND);
    await expect(form).not.toContainText(foreignId);
    await expect(form.getByText(/other farm|belongs to|NOT_FOUND|Prisma/i)).toHaveCount(0);
  });
});
