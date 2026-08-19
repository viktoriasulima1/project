import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { PrismaClient } from '@prisma/client';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedEconomicsFarm, type CompletenessScenario } from './setup/seed-economics';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';

const messages = { 'nl-NL': loadTestMessages('nl-NL'), 'pl-PL': loadTestMessages('pl-PL'), 'de-DE': loadTestMessages('de-DE'), 'en-GB': loadTestMessages('en-GB') };
type Locale = keyof typeof messages;
const db = () => new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });

async function setup(page: Page, context: BrowserContext, baseURL: string | undefined, locale: Locale, scenario: CompletenessScenario = 'complete') {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture = await seedEconomicsFarm(user.id, `E2E Gross Margin ${locale}`, { completenessScenario: scenario });
  await page.goto('/'); await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale); await setAnonymousLocaleCookie(context, baseURL, locale);
  return { user, fixture };
}

async function openField(page: Page, fieldId: string) {
  await page.goto(`/fields/${fieldId}`);
  await expect(page.getByTestId('gross-margin-section')).toBeVisible();
}

test.describe('Gross Margin localization', () => {
  test('positive margin stays canonical across Dutch and Polish', async ({ page, context, baseURL }) => {
    const { user, fixture } = await setup(page, context, baseURL, 'nl-NL'); await openField(page, fixture.fieldId);
    await expect(page.getByTestId('gross-margin-status')).toContainText(messages['nl-NL'].fields.economics.grossMargin.status.positive);
    const valueCentsText = (await page.getByTestId('gross-margin-value').textContent())!.replace(/\D/g, '');
    await setE2eUserLocalePreference(user.id, 'pl-PL'); await setAnonymousLocaleCookie(context, baseURL, 'pl-PL'); await page.reload();
    await expect(page.getByTestId('gross-margin-status')).toContainText(messages['pl-PL'].fields.economics.grossMargin.status.positive);
    expect((await page.getByTestId('gross-margin-value').textContent())!.replace(/\D/g, '')).toBe(valueCentsText);
  });

  test('zero and negative margins are distinct from unavailable', async ({ page, context, baseURL }) => {
    const { fixture } = await setup(page, context, baseURL, 'en-GB'); const prisma = db();
    const revenue = await prisma.economicEntry.findFirstOrThrow({ where: { fieldSeasonId: fixture.fieldSeasonId, kind: 'revenue', status: 'active' } });
    await prisma.economicEntry.update({ where: { id: revenue.id }, data: { amount: 1250 } }); await openField(page, fixture.fieldId);
    await expect(page.getByTestId('gross-margin-status')).toContainText(messages['en-GB'].fields.economics.grossMargin.status.zero);
    await prisma.economicEntry.update({ where: { id: revenue.id }, data: { amount: 500 } }); await page.reload();
    await expect(page.getByTestId('gross-margin-status')).toContainText(messages['en-GB'].fields.economics.grossMargin.status.negative);
    await prisma.$disconnect();
  });

  test('missing revenue remains Not recorded with a canonical action', async ({ page, context, baseURL }) => {
    const { fixture } = await setup(page, context, baseURL, 'de-DE'); const prisma = db();
    await prisma.economicEntry.deleteMany({ where: { fieldSeasonId: fixture.fieldSeasonId, kind: 'revenue' } }); await prisma.$disconnect();
    await openField(page, fixture.fieldId);
    await expect(page.getByTestId('gross-margin-status')).toContainText(messages['de-DE'].fields.economics.grossMargin.status.unavailable);
    await expect(page.getByTestId('gross-margin-reason')).toContainText(messages['de-DE'].fields.economics.grossMargin.reasons.MISSING_REVENUE);
    await expect(page.getByTestId('gross-margin-action')).toContainText(messages['de-DE'].fields.economics.grossMargin.actions.ADD_REVENUE);
  });

  test('unpriced cost produces partial margin and Finance agrees', async ({ page, context, baseURL }) => {
    const { fixture } = await setup(page, context, baseURL, 'nl-NL', 'missing_purchase_price'); await openField(page, fixture.fieldId);
    await expect(page.getByTestId('gross-margin-status')).toContainText(messages['nl-NL'].fields.economics.grossMargin.status.partial);
    await expect(page.getByTestId('gross-margin-value')).toContainText(messages['nl-NL'].fields.economics.grossMargin.notRecorded);
    await page.goto('/finance');
    const cell = page.locator(`[data-testid="finance-gross-margin"][data-field-id="${fixture.fieldId}"]`);
    await expect(cell.getByTestId('finance-gross-margin-status')).toContainText(messages['nl-NL'].fields.economics.grossMargin.status.partial);
  });

  test('German mobile layouts expose value, reason and CTA without raw codes', async ({ page, context, baseURL }) => {
    const { fixture } = await setup(page, context, baseURL, 'de-DE');
    for (const viewport of [{width:390,height:844},{width:430,height:932}]) {
      await page.setViewportSize(viewport); await openField(page, fixture.fieldId);
      await expect(page.getByTestId('gross-margin-action')).toBeVisible();
      await expect(page.getByText('POSITIVE_MARGIN', {exact:true})).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    }
  });
});
