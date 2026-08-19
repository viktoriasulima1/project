import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';

const NEW_USER_EMAIL = process.env.E2E_USER_NEW_EMAIL ?? process.env.E2E_USER_PILOT_EMAIL!;

async function openFarmStep(page: Parameters<typeof clerk.signIn>[0]['page'], context: Parameters<typeof setAnonymousLocaleCookie>[0], baseURL: string | undefined, locale: 'nl-NL' | 'pl-PL') {
  const user = await resetNamedE2eUser(NEW_USER_EMAIL);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
  await page.goto('/onboarding?step=farm');
}

test.describe('User-facing error contract — migrated Onboarding slice', () => {
  for (const locale of ['nl-NL', 'pl-PL'] as const) {
    test(`${locale}: required fields use localized stable codes without raw Zod text`, async ({ page, context, baseURL }) => {
      const messages = loadTestMessages(locale);
      await openFarmStep(page, context, baseURL, locale);
      await page.getByRole('button', { name: messages.onboarding.buttons.continue }).click();

      const name = page.getByLabel(messages.onboarding.farm.nameLabel);
      const location = page.getByLabel(messages.onboarding.farm.locationLabel);
      await expect(name).toHaveAttribute('aria-describedby', 'farm-name-error');
      await expect(location).toHaveAttribute('aria-describedby', 'farm-location-error');
      await expect(page.locator('#farm-name-error')).toHaveText(messages.errors.FARM_NAME_REQUIRED);
      await expect(page.locator('#farm-location-error')).toHaveText(messages.errors.REQUIRED_FIELD);
      await expect(page.getByText(/Zod|Invalid option|expected one of|Prisma|FARM_NAME_REQUIRED|REQUIRED_FIELD/i)).toHaveCount(0);
      await expect(page).toHaveURL(/\/onboarding\?step=farm/);
    });
  }

  test('mobile Polish errors wrap without overflow and remain accessible', async ({ page, context, baseURL }) => {
    const messages = loadTestMessages('pl-PL');
    await page.setViewportSize({ width: 390, height: 844 });
    await openFarmStep(page, context, baseURL, 'pl-PL');
    await page.getByRole('button', { name: messages.onboarding.buttons.continue }).click();
    await expect(page.locator('#farm-name-error')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});
