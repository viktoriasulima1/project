import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedEconomicsFarm } from './setup/seed-economics';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';

const messages = { 'nl-NL': loadTestMessages('nl-NL'), 'pl-PL': loadTestMessages('pl-PL'), 'de-DE': loadTestMessages('de-DE') };

async function setup(page: Page, context: BrowserContext, baseURL: string | undefined, locale: keyof typeof messages) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture = await seedEconomicsFarm(user.id, `E2E Cost Categories ${locale}`);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
  await page.goto(`/fields/${fixture.fieldId}`);
  await expect(page.getByTestId('cost-breakdown')).toBeVisible();
  return { user, fixture };
}

test.describe('Cost Category localization', () => {
  test('canonical order and totals stay unchanged across Dutch and Polish', async ({ page, context, baseURL }) => {
    const { user } = await setup(page, context, baseURL, 'nl-NL');
    const ids = await page.locator('[data-testid^="cost-category-"]').evaluateAll((nodes) => nodes.filter((node) => /^cost-category-(?!label|amount)/.test(node.getAttribute('data-testid') ?? '')).map((node) => node.getAttribute('data-testid')));
    await expect(page.getByTestId('cost-category-field_expenses')).toContainText(messages['nl-NL'].enums.costCategory.field_expenses);
    await expect(page.getByTestId('cost-category-allocated_overhead')).toContainText(messages['nl-NL'].enums.costCategory.allocated_overhead);
    const amounts = await page.getByTestId('cost-category-amount').allTextContents();
    await setE2eUserLocalePreference(user.id, 'pl-PL'); await setAnonymousLocaleCookie(context, baseURL, 'pl-PL'); await page.reload();
    expect(await page.locator('[data-testid^="cost-category-"]').evaluateAll((nodes) => nodes.filter((node) => /^cost-category-(?!label|amount)/.test(node.getAttribute('data-testid') ?? '')).map((node) => node.getAttribute('data-testid')))).toEqual(ids);
    expect(await page.getByTestId('cost-category-amount').allTextContents()).toEqual(amounts);
    await expect(page.getByTestId('cost-category-field_expenses')).toContainText(messages['pl-PL'].enums.costCategory.field_expenses);
  });

  test('source type, category, attribution and corrected state remain distinct', async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL, 'nl-NL');
    await expect(page.getByText(messages['nl-NL'].enums.financialSourceType.field_rent, { exact: false })).toBeVisible();
    await expect(page.getByText(messages['nl-NL'].enums.costCategory.field_expenses, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(messages['nl-NL'].enums.financialAttribution.direct, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(messages['nl-NL'].enums.financialVersionState.corrected, { exact: true }).first()).toBeVisible();
  });

  test('long German labels fit supported mobile widths without raw codes', async ({ page, context, baseURL }) => {
    const { fixture } = await setup(page, context, baseURL, 'de-DE');
    for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
      await page.setViewportSize(viewport); await page.goto(`/fields/${fixture.fieldId}`);
      await expect(page.getByTestId('cost-breakdown')).toBeVisible();
      await expect(page.getByText('allocated_overhead', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    }
  });
});
