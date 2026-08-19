import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedReadyFarm } from './setup/seed-farms';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';

type Locale = 'nl-NL' | 'en-GB' | 'pl-PL' | 'de-DE';

async function setup(page: Page, context: BrowserContext, baseURL: string | undefined, locale: Locale) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  await seedReadyFarm(user.id, `E2E Stage 16 ${locale}`);
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
  return user;
}

const QUICK_LOG: Record<Locale, string> = {
  'nl-NL': 'Snel loggen', 'en-GB': 'Quick Log', 'pl-PL': 'Szybki wpis', 'de-DE': 'Schnellerfassung',
};
const QUICK_LOG_ARIA: Record<Locale, string> = {
  'nl-NL': 'Snel een activiteit registreren', 'en-GB': 'Quick log an activity',
  'pl-PL': 'Szybko zarejestruj czynność', 'de-DE': 'Tätigkeit schnell erfassen',
};

async function openQuickLog(page: Page, locale: Locale) {
  await page.goto('/dashboard');
  const trigger = (page.viewportSize()?.width ?? 1280) <= 768
    ? page.getByRole('button', { name: QUICK_LOG_ARIA[locale], exact: true })
    : page.getByRole('button', { name: `+ ${QUICK_LOG[locale]}`, exact: true });
  await trigger.click();
  return page.getByRole('dialog');
}

test.describe('Stage 16 — Activity Parse API error boundary', () => {
  test.describe.configure({ mode: 'serial' });

  test('real API invalid input returns the canonical safe 400 contract', async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL, 'en-GB');
    const response = await page.request.post('/api/ai/activity-parse', { data: {} });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ ok: false, error: {
      code: 'INVALID_VALUE', category: 'validation', retryable: false, field: 'text', correlationId: expect.stringMatching(/^[a-zA-Z0-9_-]+$/),
    } });
    expect(JSON.stringify(body)).not.toMatch(/Zod|too_small|invalid_type|stack|prompt|secret/i);
  });

  for (const locale of ['nl-NL', 'en-GB', 'pl-PL', 'de-DE'] as const) {
    test(`${locale}: oversized text is localized and preserved without automatic Activity creation`, async ({ page, context, baseURL }) => {
      const messages = loadTestMessages(locale);
      await setup(page, context, baseURL, locale);
      const dialog = await openQuickLog(page, locale);
      const input = dialog.getByPlaceholder(/Sprayed North Field/);
      const text = 'x'.repeat(2001);
      await input.fill(text);
      await dialog.getByRole('button', { name: 'Parse into reviewed draft' }).click();
      await expect(dialog.getByRole('alert').filter({ hasText: messages.errors.INVALID_VALUE })).toHaveText(messages.errors.INVALID_VALUE);
      await expect(input).toHaveValue(text);
      await expect(dialog.getByText(/INVALID_VALUE|Zod|provider body|too_big|stack/i)).toHaveCount(0);
      await expect(page.getByText('Activity recorded')).toHaveCount(0);
    });
  }

  test('deterministic test provider preserves the successful response schema without a paid call', async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL, 'en-GB');
    const response = await page.request.post('/api/ai/activity-parse', { data: { text: 'Scouted field Noord over 3 hectares.' } });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({
      candidate: expect.any(Object), resolution: expect.any(Object), workOrders: expect.any(Array), multiActivity: expect.any(Object),
      mode: 'grounded_ai', safeguards: { draftOnly: true, authoritativeValidationRequired: true },
    }));
    expect(JSON.stringify(body)).not.toMatch(/provider.*(?:error|secret)|stack|api.?key/i);
    await page.goto('/activities');
    await expect(page.getByText('No activities logged')).toBeVisible();
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    test(`German ${viewport.width}×${viewport.height}: localized error wraps and manual form remains reachable`, async ({ page, context, baseURL }) => {
      const messages = loadTestMessages('de-DE');
      await page.setViewportSize(viewport);
      await setup(page, context, baseURL, 'de-DE');
      const dialog = await openQuickLog(page, 'de-DE');
      await dialog.getByPlaceholder(/Sprayed North Field/).fill('x'.repeat(2001));
      await dialog.getByRole('button', { name: 'Parse into reviewed draft' }).click();
      await expect(dialog.getByRole('alert').filter({ hasText: messages.errors.INVALID_VALUE })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Parse into reviewed draft' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Spraying' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  }
});
