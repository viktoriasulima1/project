import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedEconomicsFarm, type CompletenessScenario } from './setup/seed-economics';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';

type Locale = 'nl-NL' | 'en-GB' | 'pl-PL' | 'de-DE';
async function setup(page: Page, context: BrowserContext, baseURL: string | undefined, locale: Locale, scenario: CompletenessScenario = 'complete') {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture = await seedEconomicsFarm(user.id, `E2E Economic Signals ${locale}`, { completenessScenario: scenario });
  await page.goto('/'); await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale); await setAnonymousLocaleCookie(context, baseURL, locale);
  return { user, fixture };
}

test.describe('Economic Signals localization', () => {
  test('top-three codes and order stay unchanged across Dutch and Polish', async ({ page, context, baseURL }) => {
    const { user } = await setup(page, context, baseURL, 'nl-NL'); await page.goto('/dashboard');
    const card = page.getByTestId('economics-decisions-card'); await expect(card).toBeVisible();
    const before = await card.locator('[data-testid^="economic-signal-"][data-testid*="_"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));
    expect(before.length).toBe(3);
    await setE2eUserLocalePreference(user.id, 'pl-PL'); await setAnonymousLocaleCookie(context, baseURL, 'pl-PL'); await page.reload();
    expect(await card.locator('[data-testid^="economic-signal-"][data-testid*="_"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')))).toEqual(before);
  });

  test('missing purchase price is localized and never rendered as zero', async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL, 'de-DE', 'missing_purchase_price'); await page.goto('/dashboard');
    const signal = page.getByTestId('economic-signal-MISSING_PURCHASE_PRICE');
    await expect(signal).toBeVisible(); await expect(signal.getByTestId('economic-signal-action')).toHaveAttribute('href', '/inventory');
    await expect(signal).not.toContainText('MISSING_PURCHASE_PRICE'); await expect(signal).not.toContainText('€0.00');
  });

  test('budget signal follows the unchanged field CTA', async ({ page, context, baseURL }) => {
    const { fixture } = await setup(page, context, baseURL, 'en-GB'); await page.goto('/dashboard');
    const signal = page.getByTestId('economic-signal-BUDGET_OVER_LIMIT'); await expect(signal).toBeVisible();
    await expect(signal.getByTestId('economic-signal-action')).toHaveAttribute('href', `/fields/${fixture.fieldId}`);
  });

  test('Dashboard and Farm Insights share canonical economic codes', async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL, 'nl-NL'); await page.goto('/dashboard');
    const dashboardCodes = await page.locator('[data-testid^="economic-signal-"][data-testid*="_"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')?.replace('economic-signal-', '')));
    await page.goto('/ai');
    for (const code of dashboardCodes) await expect(page.getByText(code!, { exact: true })).toHaveCount(0);
    await expect(page.getByText('Allocate cost')).toHaveCount(0);
  });

  test('German economic cards fit both supported mobile widths without raw codes', async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL, 'de-DE', 'missing_machine_rate');
    for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
      await page.setViewportSize(viewport); await page.goto('/dashboard');
      await expect(page.getByTestId('economics-decisions-card')).toBeVisible();
      await expect(page.getByText('MISSING_MACHINE_RATE', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    }
  });
});
