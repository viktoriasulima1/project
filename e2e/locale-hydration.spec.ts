import { test, expect, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { seedEconomicsFarm } from './setup/seed-economics';

/**
 * Locale hydration regression (Part 11). For each locale, the server-rendered
 * navigation must survive hydration unchanged, `<html lang>` must match, and the
 * console must be free of hydration / raw-script messages.
 *
 * NOT executed in this environment (needs live server + Postgres + Clerk pool).
 */

const CASES = [
  { cookie: 'nl-NL', lang: 'nl', today: 'Vandaag' },
  { cookie: 'en-GB', lang: 'en', today: 'Today' },
  { cookie: 'pl-PL', lang: 'pl', today: 'Dziś' },
  { cookie: 'de-DE', lang: 'de', today: 'Heute' },
] as const;

const HYDRATION_NOISE = [/Hydration failed/i, /did(n't| not) match/i, /Encountered a script tag/i, /Text content does not match/i];

async function signIn(page: Page) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  await seedEconomicsFarm(user.id, 'E2E Hydration Farm');
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
}

test.describe('locale hydration', () => {
  for (const c of CASES) {
    test(`${c.cookie} — navigation survives hydration with no console errors`, async ({ page, context }) => {
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(e.message));

      await signIn(page);
      await context.addCookies([{ name: 'farmos-locale', value: c.cookie, url: page.url() }]);
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

      // server-rendered nav text captured before hydration settles
      const navLink = page.getByRole('link', { name: c.today });
      await expect(navLink).toBeVisible();
      await page.waitForLoadState('networkidle');
      // still the same after hydration — no English flash / no re-render swap
      await expect(page.getByRole('link', { name: c.today })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', c.lang);

      // client-side navigation keeps the locale
      await page.getByRole('link', { name: c.today }).click().catch(() => undefined);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('lang', c.lang);

      const hydrationErrors = errors.filter((e) => HYDRATION_NOISE.some((re) => re.test(e)));
      expect(hydrationErrors, hydrationErrors.join('\n')).toEqual([]);
    });
  }
});
