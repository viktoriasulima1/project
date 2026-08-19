import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedReadyFarm } from './setup/seed-farms';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';

type Locale = 'nl-NL' | 'en-GB' | 'pl-PL' | 'de-DE';

async function setup(page: Page, context: BrowserContext, baseURL: string | undefined, locale: Locale) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  await seedReadyFarm(user.id, `E2E Stage 15 ${locale}`);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
  await page.goto('/activities');
  await page.getByRole('button', { name: '+ Record activity' }).click();
  await page.getByRole('button', { name: 'Scouting' }).click();
}

test.describe('Stage 15 — localized Activities / Quick Log core errors', () => {
  test.describe.configure({ mode: 'serial' });

  for (const locale of ['nl-NL', 'en-GB', 'pl-PL', 'de-DE'] as const) {
    test(`${locale}: required activity field is localized, focused, associated and preserves input`, async ({ page, context, baseURL }) => {
      const messages = loadTestMessages(locale);
      await setup(page, context, baseURL, locale);
      const notes = `Stage 15 preserved ${locale}`;
      await page.locator('#userNotes').fill(notes);
      await page.getByRole('button', { name: 'Save activity' }).click();

      const alert = page.getByRole('alert').filter({ hasText: messages.errors.INVALID_VALUE });
      await expect(alert).toContainText(messages.errors.INVALID_VALUE);
      await expect(alert).toBeFocused();
      await expect(page.locator('#fieldSeasonId')).toHaveAttribute('aria-describedby', 'activity-field-season-error');
      await expect(page.locator('#activity-field-season-error')).toHaveText(messages.errors.REQUIRED_FIELD);
      await expect(page.locator('#userNotes')).toHaveValue(notes);
      await expect(page.getByText(/Zod|Prisma|REQUIRED_FIELD|too_small|P20\d\d/i)).toHaveCount(0);
    });
  }

  test('German mobile presentation remains usable without horizontal overflow', async ({ page, context, baseURL }) => {
    const messages = loadTestMessages('de-DE');
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page, context, baseURL, 'de-DE');
    await page.getByRole('button', { name: 'Save activity' }).click();
    await expect(page.getByRole('alert').filter({ hasText: messages.errors.INVALID_VALUE })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save activity' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
});
