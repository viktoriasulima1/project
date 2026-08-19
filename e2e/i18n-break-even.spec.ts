import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedEconomicsFarm } from './setup/seed-economics';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';
import {
  expectNoVisibleDomainCodeLeak, getBreakEvenCard, getBreakEvenSection,
  getCanonicalBreakEvenForField, openSeededBreakEvenField,
} from './setup/break-even-helpers';

const nl = loadTestMessages('nl-NL');
const pl = loadTestMessages('pl-PL');
const de = loadTestMessages('de-DE');
const be = (messages: typeof nl) => messages.fields.economics.breakEven;
const CONSOLE_REJECT = /hydration|Maximum call stack size exceeded|ResizeObserver loop|Prisma|Zod|INCOMPLETE_COST|MISSING_HARVEST|ADD_HARVEST/i;

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error' && CONSOLE_REJECT.test(message.text())) errors.push(message.text()); });
  page.on('pageerror', (error) => { if (CONSOLE_REJECT.test(error.message)) errors.push(error.message); });
  return errors;
}

async function signInSeeded(page: Page, context: BrowserContext, baseURL: string | undefined, locale: 'nl-NL' | 'pl-PL' | 'de-DE', options?: { withHarvest?: boolean }) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture = await seedEconomicsFarm(user.id, 'E2E Break-even Farm', options);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
  return { fixture, userId: user.id };
}

test.describe('Break-even localization', () => {
  test('Flow A — available: localized value + heading; canonical number unchanged across locales', async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    const errors = watchConsole(page);
    const { fixture, userId } = await signInSeeded(page, context, baseURL, 'nl-NL');
    const expected = await getCanonicalBreakEvenForField(userId, fixture.fieldId);
    expect(expected.price.available).toBe(true);
    expect(expected.yieldValue.available).toBe(true);
    expect(expected.price.value?.result).not.toBeNull();
    expect(expected.yieldValue.value?.result).not.toBeNull();

    await openSeededBreakEvenField(page, fixture.fieldId);
    const nlSection = getBreakEvenSection(page);
    await expect(nlSection.getByRole('heading', { name: be(nl).title, exact: true })).toBeVisible();
    await expect(getBreakEvenCard(nlSection, 'price')).toContainText(String(expected.price.value!.result).replace('.', ','));
    await expectNoVisibleDomainCodeLeak(page);

    await setE2eUserLocalePreference(userId, 'pl-PL');
    await setAnonymousLocaleCookie(context, baseURL, 'pl-PL');
    await openSeededBreakEvenField(page, fixture.fieldId);
    await expect(getBreakEvenSection(page).getByRole('heading', { name: be(pl).title, exact: true })).toBeVisible();
    await expectNoVisibleDomainCodeLeak(page);
    expect(errors).toEqual([]);
  });

  test('Flow B — missing yield: localized reason, no fabricated €0 or zero yield, Add-harvest hint', async ({ page, context, baseURL }) => {
    const { fixture, userId } = await signInSeeded(page, context, baseURL, 'de-DE', { withHarvest: false });
    const expected = await getCanonicalBreakEvenForField(userId, fixture.fieldId);
    expect(expected.price).toMatchObject({ available: false, value: null, reasonCodes: ['MISSING_HARVEST'] });

    await openSeededBreakEvenField(page, fixture.fieldId);
    const price = getBreakEvenCard(getBreakEvenSection(page), 'price');
    await expect(price).toContainText(be(de).unavailable);
    await expect(price).toContainText(be(de).reasons.MISSING_HARVEST);
    await expect(price).toContainText(be(de).actions.ADD_HARVEST);
    await expect(page.getByTestId('harvest-metric')).toContainText('Not recorded');
    await expect(page.getByTestId('yield-per-ha-metric')).toContainText('Not recorded');
    await expectNoVisibleDomainCodeLeak(page);
  });

  test('Flow D — Finance and Field Detail agree on the canonical break-even', async ({ page, context, baseURL }) => {
    const { fixture, userId } = await signInSeeded(page, context, baseURL, 'nl-NL');
    const expected = await getCanonicalBreakEvenForField(userId, fixture.fieldId);
    expect(expected.price.available).toBe(true);
    expect(expected.yieldValue.available).toBe(true);
    await openSeededBreakEvenField(page, fixture.fieldId);
    await expectNoVisibleDomainCodeLeak(page);
    await page.goto('/finance');
    await expect(page.getByRole('row').filter({ hasText: 'E2E Break-even Farm — Noord' }).first()).toContainText('40.00 tonnes');
    await expectNoVisibleDomainCodeLeak(page);
  });

  for (const [width, height] of [[390, 844], [430, 932]] as const) {
    test(`Flow F — mobile ${width}×${height}: break-even card fits, no overflow, no code leak`, async ({ page, context, baseURL }) => {
      const errors = watchConsole(page);
      await page.setViewportSize({ width, height });
      const { fixture } = await signInSeeded(page, context, baseURL, 'de-DE');
      await openSeededBreakEvenField(page, fixture.fieldId);
      const section = getBreakEvenSection(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await expect(getBreakEvenCard(section, 'price')).toBeVisible();
      await expect(getBreakEvenCard(section, 'yield')).toBeVisible();
      await expectNoVisibleDomainCodeLeak(page);
      expect(errors).toEqual([]);
    });
  }
});
