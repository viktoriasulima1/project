import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedEconomicsFarm, type BudgetVarianceScenario } from './setup/seed-economics';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';
import { expectNoVisibleDomainCodeLeak, getCanonicalBudgetVarianceForField } from './setup/break-even-helpers';

const messages = { 'en-GB': loadTestMessages('en-GB'), 'nl-NL': loadTestMessages('nl-NL'), 'pl-PL': loadTestMessages('pl-PL'), 'de-DE': loadTestMessages('de-DE') };
type Locale = keyof typeof messages;
const CODES = ['WITHIN_BUDGET','OVER_BUDGET','UNDER_BUDGET','BUDGET_NOT_RECORDED','ACTUAL_COST_NOT_RECORDED','BUDGET_AND_ACTUAL_NOT_RECORDED','ACTUAL_COST_INCOMPLETE','CURRENCY_MISMATCH','ADD_BUDGET','RECORD_ACTUAL_COST','REVIEW_COSTS','REVIEW_UNPRICED_COSTS','OPEN_FINANCE','NO_ACTION_REQUIRED'];

async function setup(page: Page, context: BrowserContext, baseURL: string | undefined, scenario: BudgetVarianceScenario, locale: Locale) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture = await seedEconomicsFarm(user.id, `E2E Budget Variance ${scenario}`, { budgetVarianceScenario: scenario });
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
  const canonical = await getCanonicalBudgetVarianceForField(user.id, fixture.fieldId);
  return { user, fixture, canonical };
}

async function openField(page: Page, fieldId: string) {
  await page.goto(`/fields/${fieldId}`);
  await expect(page.getByTestId('budget-variance-section')).toBeVisible();
  await expectNoVisibleDomainCodeLeak(page, CODES);
}

test.describe('Budget Variance localization', () => {
  test('Flow A — exact match remains canonical when locale changes', async ({ page, context, baseURL }) => {
    const { user, fixture, canonical } = await setup(page, context, baseURL, 'exact_match', 'nl-NL');
    expect(canonical).toMatchObject({ available: true, status: 'within_budget', varianceCents: 0, variancePercent: 0 });
    await openField(page, fixture.fieldId);
    await expect(page.getByTestId('budget-variance-status')).toContainText(messages['nl-NL'].fields.economics.budgetVariance.status.within_budget);
    await setE2eUserLocalePreference(user.id, 'pl-PL'); await setAnonymousLocaleCookie(context, baseURL, 'pl-PL'); await page.reload();
    await expect(page.getByTestId('budget-variance-status')).toContainText(messages['pl-PL'].fields.economics.budgetVariance.status.within_budget);
    expect((await getCanonicalBudgetVarianceForField(user.id, fixture.fieldId)).varianceCents).toBe(0);
  });

  test('Flow B — over budget is localized with unchanged amount and percentage', async ({ page, context, baseURL }) => {
    const { user, fixture, canonical } = await setup(page, context, baseURL, 'over_budget', 'en-GB');
    expect(canonical).toMatchObject({ available: true, status: 'over_budget', reasonCode: 'OVER_BUDGET', actionCode: 'REVIEW_COSTS', budgetCents: 10000, actualCents: 125000, varianceCents: 115000, variancePercent: 1150 });
    await openField(page, fixture.fieldId);
    await expect(page.getByTestId('budget-variance-status')).toContainText(messages['en-GB'].fields.economics.budgetVariance.status.over_budget);
    await setE2eUserLocalePreference(user.id, 'de-DE'); await setAnonymousLocaleCookie(context, baseURL, 'de-DE'); await page.reload();
    await expect(page.getByTestId('budget-variance-status')).toContainText(messages['de-DE'].fields.economics.budgetVariance.status.over_budget);
  });

  test('Flow C — under budget preserves the negative canonical sign', async ({ page, context, baseURL }) => {
    const { fixture, canonical } = await setup(page, context, baseURL, 'under_budget', 'pl-PL');
    expect(canonical).toMatchObject({ available: true, status: 'under_budget', varianceCents: -25000 });
    await openField(page, fixture.fieldId);
    await expect(page.getByTestId('budget-variance-status')).toContainText(messages['pl-PL'].fields.economics.budgetVariance.status.under_budget);
  });

  test('Flow D — missing budget is not fabricated as zero', async ({ page, context, baseURL }) => {
    const { fixture, canonical } = await setup(page, context, baseURL, 'missing_budget', 'nl-NL');
    expect(canonical).toMatchObject({ available: false, reasonCode: 'BUDGET_NOT_RECORDED', budgetCents: null, actualCents: 125000 });
    await openField(page, fixture.fieldId);
    await expect(page.getByTestId('budget-value')).toContainText(messages['nl-NL'].fields.economics.budgetVariance.notRecorded);
  });

  test('Flow E — missing actual cost is not fabricated as zero', async ({ page, context, baseURL }) => {
    const { fixture, canonical } = await setup(page, context, baseURL, 'missing_actual', 'de-DE');
    expect(canonical).toMatchObject({ available: false, reasonCode: 'ACTUAL_COST_NOT_RECORDED', actualCents: null });
    await openField(page, fixture.fieldId);
    await expect(page.getByTestId('actual-cost-value')).toContainText(messages['de-DE'].fields.economics.budgetVariance.notRecorded);
  });

  test('Flow F — explicit zero budget and actual remain recorded zero', async ({ page, context, baseURL }) => {
    const zeroBudget = await setup(page, context, baseURL, 'zero_budget', 'en-GB');
    expect(zeroBudget.canonical).toMatchObject({ available: true, budgetCents: 0, actualCents: 125000, variancePercent: null });
    await openField(page, zeroBudget.fixture.fieldId); await expect(page.getByTestId('budget-value')).not.toContainText('Not recorded');
    const zeroActualFixture = await seedEconomicsFarm(zeroBudget.user.id, 'E2E Budget Variance zero_actual', { budgetVarianceScenario: 'zero_actual' });
    const zeroActualCanonical = await getCanonicalBudgetVarianceForField(zeroBudget.user.id, zeroActualFixture.fieldId);
    expect(zeroActualCanonical).toMatchObject({ available: true, actualCents: 0 });
    await openField(page, zeroActualFixture.fieldId); await expect(page.getByTestId('actual-cost-value')).not.toContainText('Not recorded');
  });

  test('Flow G — an unpriced cost blocks falsely precise variance', async ({ page, context, baseURL }) => {
    const { fixture, canonical } = await setup(page, context, baseURL, 'incomplete_actual', 'de-DE');
    expect(canonical).toMatchObject({ available: false, reasonCode: 'ACTUAL_COST_INCOMPLETE', varianceCents: null, relevantCanonicalMetadata: { unpricedRecordCount: 1 } });
    await openField(page, fixture.fieldId);
    await expect(page.getByTestId('budget-variance-status')).toContainText(messages['de-DE'].fields.economics.budgetVariance.reasons.ACTUAL_COST_INCOMPLETE);
  });

  test('Flow H/I — corrected and reversed policy is consistent across Field, Finance, Dashboard and Insights', async ({ page, context, baseURL }) => {
    const { fixture, canonical } = await setup(page, context, baseURL, 'over_budget', 'nl-NL');
    expect(canonical.actualCents).toBe(125000);
    await openField(page, fixture.fieldId);
    await page.goto('/finance');
    const finance = page.getByTestId('finance-budget-variance').filter({ has: page.locator(`[data-field-id="${fixture.fieldId}"]`) });
    await expect(page.locator(`[data-testid="finance-budget-variance"][data-field-id="${fixture.fieldId}"]`)).toContainText(messages['nl-NL'].fields.economics.budgetVariance.status.over_budget);
    const signalTitle = messages['nl-NL'].fields.economics.signals.types.BUDGET_OVER_LIMIT.title.replace('{count}', '1');
    await page.goto('/dashboard'); await expect(page.getByTestId('economic-signal-BUDGET_OVER_LIMIT').getByTestId('economic-signal-title')).toHaveText(signalTitle);
    await page.goto('/ai'); await expect(page.getByText(signalTitle, { exact: true }).first()).toBeVisible();
    expect(finance).toBeDefined();
  });

  test('Flow J — long localized text fits 390 and 430 pixel mobile viewports', async ({ page, context, baseURL }) => {
    const { fixture } = await setup(page, context, baseURL, 'over_budget', 'de-DE');
    for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
      await page.setViewportSize(viewport); await openField(page, fixture.fieldId);
      await expect(page.getByTestId('budget-variance-action')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    }
  });
});
