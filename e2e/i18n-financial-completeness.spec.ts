import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedEconomicsFarm, type CompletenessScenario } from './setup/seed-economics';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';
import {
  expectNoVisibleDomainCodeLeak,
  getCanonicalAllocationEvidenceForField,
  getCanonicalFinancialCompletenessForField,
  openSeededBreakEvenField,
} from './setup/break-even-helpers';

const messages = {
  'en-GB': loadTestMessages('en-GB'),
  'nl-NL': loadTestMessages('nl-NL'),
  'pl-PL': loadTestMessages('pl-PL'),
  'de-DE': loadTestMessages('de-DE'),
};
type TestedLocale = keyof typeof messages;
const CODES = [
  'MISSING_PRODUCT_PRICE', 'MISSING_LABOUR_RATE', 'MISSING_MACHINE_RATE',
  'MISSING_CONTRACTOR_COST', 'MISSING_HARVEST', 'MISSING_REVENUE',
  'MISSING_OVERHEAD_CHOICE', 'INCOMPATIBLE_UNITS', 'ADD_PURCHASE_PRICE',
  'ADD_LABOUR_RATE', 'ADD_MACHINE_RATE', 'ADD_HARVEST', 'ADD_REVENUE',
  'ALIGN_UNITS',
];

async function setLocale(
  context: BrowserContext,
  baseURL: string | undefined,
  userId: string,
  locale: TestedLocale,
) {
  await setE2eUserLocalePreference(userId, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
}

async function setup(
  page: Page,
  context: BrowserContext,
  baseURL: string | undefined,
  locale: TestedLocale,
  options: { withHarvest?: boolean; completenessScenario?: CompletenessScenario } = {},
) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture = await seedEconomicsFarm(user.id, 'E2E Financial Completeness Farm', options);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setLocale(context, baseURL, user.id, locale);
  return { user, fixture };
}

async function expectFieldCompleteness(
  page: Page,
  locale: TestedLocale,
  reasonCode?: 'MISSING_PRODUCT_PRICE' | 'MISSING_LABOUR_RATE' | 'MISSING_MACHINE_RATE' | 'MISSING_HARVEST',
) {
  const section = page.getByTestId('financial-completeness-section');
  await expect(section).toContainText(messages[locale].fields.economics.completeness.title);
  if (reasonCode) {
    await expect(page.getByTestId('completeness-reasons')).toContainText(
      messages[locale].fields.economics.completeness.reasons[reasonCode],
    );
  }
}

async function expectFinanceCompleteness(
  page: Page,
  fieldId: string,
  percentage: number,
  locale: TestedLocale,
  reasonCode?: 'MISSING_PRODUCT_PRICE' | 'MISSING_LABOUR_RATE' | 'MISSING_MACHINE_RATE',
) {
  await page.goto('/finance');
  const section = page.getByTestId('finance-completeness-section');
  const field = section.locator(`[data-field-id="${fieldId}"]`);
  await expect(field.getByTestId('finance-completeness-status')).toContainText(String(percentage));
  if (reasonCode) {
    await expect(field.getByTestId('finance-completeness-reasons')).toContainText(
      messages[locale].fields.economics.completeness.reasons[reasonCode],
    );
  }
  await expectNoVisibleDomainCodeLeak(page, CODES);
}

test.describe('Financial Completeness localization', () => {
  test('Flow A — complete contract, deterministic ordering, and Finance consistency', async ({ page, context, baseURL }) => {
    const { user, fixture } = await setup(page, context, baseURL, 'nl-NL');
    const canonical = await getCanonicalFinancialCompletenessForField(user.id, fixture.fieldId);
    expect(canonical).toMatchObject({
      status: 'profitability_ready',
      percentage: 100,
      reasonCodes: [],
      actionCodes: [],
      recordedCodes: [
        'PRODUCT_PRICES_RECORDED', 'LABOUR_RATES_RECORDED', 'MACHINE_RATES_RECORDED',
        'CONTRACTOR_COSTS_RECORDED', 'HARVEST_RECORDED', 'REVENUE_RECORDED',
        'OVERHEAD_CHOICE_RECORDED', 'UNITS_COMPATIBLE',
      ],
    });
    await openSeededBreakEvenField(page, fixture.fieldId);
    await expectFieldCompleteness(page, 'nl-NL');
    await expect(page.getByTestId('completeness-status')).toContainText('100');
    await expectFinanceCompleteness(page, fixture.fieldId, canonical.percentage, 'nl-NL');
  });

  test('Flow B — missing purchase price is isolated, never fabricated as zero, and localized in four locales', async ({ page, context, baseURL }) => {
    const { user, fixture } = await setup(page, context, baseURL, 'en-GB', { completenessScenario: 'missing_purchase_price' });
    const canonical = await getCanonicalFinancialCompletenessForField(user.id, fixture.fieldId);
    expect(canonical).toMatchObject({
      status: 'insufficient_data',
      percentage: 88,
      reasonCodes: ['MISSING_PRODUCT_PRICE'],
      actionCodes: ['ADD_PURCHASE_PRICE'],
      relevantCanonicalMetadata: {
        unpricedRecordCount: 1,
        fieldCostTotal: null,
        productNames: [fixture.productName],
      },
    });
    for (const locale of Object.keys(messages) as TestedLocale[]) {
      await setLocale(context, baseURL, user.id, locale);
      await openSeededBreakEvenField(page, fixture.fieldId);
      await expectFieldCompleteness(page, locale, 'MISSING_PRODUCT_PRICE');
      await expect(page.locator('main')).not.toContainText(/€\s*0(?:[,.]00)?/);
      await expectFinanceCompleteness(page, fixture.fieldId, canonical.percentage, locale, 'MISSING_PRODUCT_PRICE');
      await expect(page.getByTestId('finance-completeness-actions').getByRole('link')).toHaveAttribute('href', '/inventory');
    }
  });

  test('Flow C — missing labour rate remains an incomplete cost, not free labour', async ({ page, context, baseURL }) => {
    const { user, fixture } = await setup(page, context, baseURL, 'pl-PL', { completenessScenario: 'missing_labour_rate' });
    const canonical = await getCanonicalFinancialCompletenessForField(user.id, fixture.fieldId);
    expect(canonical).toMatchObject({
      status: 'insufficient_data',
      percentage: 88,
      reasonCodes: ['MISSING_LABOUR_RATE'],
      actionCodes: ['ADD_LABOUR_RATE'],
      relevantCanonicalMetadata: {
        labourActivitiesWithoutRecordedRate: 1,
        operatorNames: [fixture.operatorName],
      },
    });
    await openSeededBreakEvenField(page, fixture.fieldId);
    await expectFieldCompleteness(page, 'pl-PL', 'MISSING_LABOUR_RATE');
    await expect(page.getByTestId('completeness-actions')).toContainText(messages['pl-PL'].fields.economics.completeness.actions.ADD_LABOUR_RATE);
    await expectFinanceCompleteness(page, fixture.fieldId, canonical.percentage, 'pl-PL', 'MISSING_LABOUR_RATE');
  });

  test('Flow D — missing machinery rate remains incomplete and preserves machine identity', async ({ page, context, baseURL }) => {
    const { user, fixture } = await setup(page, context, baseURL, 'de-DE', { completenessScenario: 'missing_machine_rate' });
    const canonical = await getCanonicalFinancialCompletenessForField(user.id, fixture.fieldId);
    expect(canonical).toMatchObject({
      status: 'insufficient_data',
      percentage: 88,
      reasonCodes: ['MISSING_MACHINE_RATE'],
      actionCodes: ['ADD_MACHINE_RATE'],
      relevantCanonicalMetadata: {
        machineActivitiesWithoutRecordedRate: 1,
        machineNames: [fixture.machineName],
      },
    });
    await openSeededBreakEvenField(page, fixture.fieldId);
    await expectFieldCompleteness(page, 'de-DE', 'MISSING_MACHINE_RATE');
    await expectFinanceCompleteness(page, fixture.fieldId, canonical.percentage, 'de-DE', 'MISSING_MACHINE_RATE');
  });

  test('Flow E — two missing rates keep unique deterministic order across locales', async ({ page, context, baseURL }) => {
    const { user, fixture } = await setup(page, context, baseURL, 'pl-PL', { completenessScenario: 'missing_labour_and_machine_rates' });
    const canonical = await getCanonicalFinancialCompletenessForField(user.id, fixture.fieldId);
    expect(canonical.reasonCodes).toEqual(['MISSING_LABOUR_RATE', 'MISSING_MACHINE_RATE']);
    expect(canonical.actionCodes).toEqual(['ADD_LABOUR_RATE', 'ADD_MACHINE_RATE']);
    expect(new Set(canonical.reasonCodes).size).toBe(2);
    for (const locale of ['pl-PL', 'de-DE'] as const) {
      await setLocale(context, baseURL, user.id, locale);
      await openSeededBreakEvenField(page, fixture.fieldId);
      const text = await page.getByTestId('completeness-reasons').innerText();
      const labour = messages[locale].fields.economics.completeness.reasons.MISSING_LABOUR_RATE;
      const machine = messages[locale].fields.economics.completeness.reasons.MISSING_MACHINE_RATE;
      expect(text.indexOf(labour)).toBeGreaterThanOrEqual(0);
      expect(text.indexOf(machine)).toBeGreaterThan(text.indexOf(labour));
      await expectNoVisibleDomainCodeLeak(page, CODES);
    }
  });

  test('Flows F–H — allocation evidence stays exact without inventing unsupported completeness reasons', async ({ page, context, baseURL }) => {
    const { user, fixture } = await setup(page, context, baseURL, 'nl-NL');
    const before = await getCanonicalAllocationEvidenceForField(user.id, fixture.fieldId);
    const canonical = await getCanonicalFinancialCompletenessForField(user.id, fixture.fieldId);
    expect(before).toMatchObject({
      fieldCostTotal: 1250,
      fieldRevenueTotal: 2000,
      unallocatedCostTotal: 275,
      unallocatedRevenueTotal: 1200,
    });
    expect(before.activeAllocations).toHaveLength(1);
    expect(before.activeAllocations[0]).toMatchObject({ amount: 180, originalAmount: 300, remainder: 120, percentage: 60, version: 2 });
    expect(canonical.reasonCodes).not.toContain('UNALLOCATED_COSTS');
    await page.goto('/finance');
    await expect(page.getByText(/Costs:\s*€\s*275[,.]00/)).toBeVisible();
    await expect(page.getByText(/Revenue:\s*€\s*1[,.]200[,.]00/)).toBeVisible();
    const after = await getCanonicalAllocationEvidenceForField(user.id, fixture.fieldId);
    expect(after).toEqual(before);
  });

  test('Flow I — Field Detail and Finance expose the same missing-harvest canonical result', async ({ page, context, baseURL }) => {
    const { user, fixture } = await setup(page, context, baseURL, 'de-DE', { withHarvest: false });
    const canonical = await getCanonicalFinancialCompletenessForField(user.id, fixture.fieldId);
    expect(canonical.reasonCodes).toEqual(['MISSING_HARVEST']);
    await openSeededBreakEvenField(page, fixture.fieldId);
    await expectFieldCompleteness(page, 'de-DE', 'MISSING_HARVEST');
    await expect(page.getByTestId('harvest-metric')).toContainText('Not recorded');
    await expect(page.getByTestId('yield-per-ha-metric')).toContainText('Not recorded');
    await page.goto('/finance');
    const field = page.getByTestId('finance-completeness-section').locator(`[data-field-id="${fixture.fieldId}"]`);
    await expect(field.getByTestId('finance-completeness-status')).toContainText(String(canonical.percentage));
    await expect(field.getByTestId('finance-completeness-reasons')).toContainText(messages['de-DE'].fields.economics.completeness.reasons.MISSING_HARVEST);
  });

  test('Flow J — Break-even complete and missing-harvest behavior is unchanged', async ({ page, context, baseURL }) => {
    const complete = await setup(page, context, baseURL, 'nl-NL');
    await openSeededBreakEvenField(page, complete.fixture.fieldId);
    await expect(page.getByTestId('break-even-section')).not.toContainText(messages['nl-NL'].fields.economics.breakEven.unavailable);
    const missing = await seedEconomicsFarm(complete.user.id, 'E2E Financial Completeness Farm', { withHarvest: false });
    await openSeededBreakEvenField(page, missing.fieldId);
    await expect(page.getByTestId('break-even-section')).toContainText(messages['nl-NL'].fields.economics.breakEven.reasons.MISSING_HARVEST);
    await expect(page.getByTestId('harvest-metric')).toContainText('Not recorded');
  });

  for (const [width, height] of [[390, 844], [430, 932]] as const) {
    test(`Flow K — mobile ${width}×${height} keeps long reason lists and actions visible`, async ({ page, context, baseURL }) => {
      await page.setViewportSize({ width, height });
      const { fixture } = await setup(page, context, baseURL, width === 390 ? 'de-DE' : 'pl-PL', {
        completenessScenario: 'missing_labour_and_machine_rates',
      });
      await openSeededBreakEvenField(page, fixture.fieldId);
      await expect(page.getByTestId('financial-completeness-section')).toBeVisible();
      await expect(page.getByTestId('completeness-reasons')).toBeVisible();
      await expect(page.getByTestId('completeness-actions')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await expectNoVisibleDomainCodeLeak(page, CODES);
    });
  }
});
