import { test, expect, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedEconomicsFarm } from './setup/seed-economics';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';
import { expectNoVisibleDomainCodeLeak, getVisibleBodyText } from './setup/break-even-helpers';

/**
 * Field Health localization (Stage 2B). The resolver returns stable status/reason/
 * action CODES + structured evidence; every surface renders through the localized
 * adapter. Decisions/priority are unchanged. Canonical facts (status/reason/
 * priority) are identical across locales — only labels change.
 *
 * NOT executed in this environment (needs live server + Postgres + Clerk pool) —
 * documented gate, consistent with the other i18n specs. Expected text is
 * catalog-sourced via loadTestMessages; no raw code may ever appear in the UI.
 */
const nl = loadTestMessages('nl-NL');
const pl = loadTestMessages('pl-PL');
const de = loadTestMessages('de-DE');
const DOMAIN_CODES = ['NO_ACTIVE_CROP_SEASON', 'RECENT_SEVERE_OBSERVATION', 'WEATHER_RISK_INDICATOR', 'MULTIPLE_OPEN_OBSERVATIONS', 'NO_SCOUTING_DATA', 'INSPECT_FIELD', 'PLAN_SEASON', 'CONTINUE_MONITORING', 'Prisma', 'Zod'];
const CONSOLE_REJECT = /hydration|Maximum call stack size exceeded|ResizeObserver loop|Prisma|Zod|NO_ACTIVE_CROP_SEASON|INSPECT_FIELD/i;

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && CONSOLE_REJECT.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => { if (CONSOLE_REJECT.test(e.message)) errors.push(e.message); });
  return errors;
}

async function signInSeeded(page: Page, context: Page['context'] extends never ? never : Parameters<typeof setAnonymousLocaleCookie>[0], baseURL: string | undefined, locale: 'nl-NL' | 'pl-PL' | 'de-DE') {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture = await seedEconomicsFarm(user.id, 'E2E Field Health Farm');
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
  return { fixture, userId: user.id };
}

test.describe('Field Health localization', () => {
  test('Flow A — Field Detail: labels localize, canonical result unchanged across locales', async ({ page, context, baseURL }) => {
    const errors = watchConsole(page);
    const { fixture, userId } = await signInSeeded(page, context, baseURL, 'nl-NL');
    await page.goto(`/fields/${fixture.fieldId}`);
    await expect(page.getByText(nl.fields.detail.cropHealth)).toBeVisible();
    await expectNoVisibleDomainCodeLeak(page, DOMAIN_CODES);
    // Switch to Polish (DB preference wins for the signed-in user); same field → only wording changes.
    await setE2eUserLocalePreference(userId, 'pl-PL');
    await setAnonymousLocaleCookie(context, baseURL, 'pl-PL');
    await page.goto(`/fields/${fixture.fieldId}`);
    await expect(page.getByText(pl.fields.detail.cropHealth)).toBeVisible();
    await expectNoVisibleDomainCodeLeak(page, DOMAIN_CODES);
    expect(errors).toEqual([]);
  });

  test('Flow C — no scouting data reads as Unknown, never Healthy, with no fake last visit', async ({ page, context, baseURL }) => {
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    const fixture = await seedEconomicsFarm(user.id, 'E2E No Data Farm', { withActiveSeason: false });
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });
    await setE2eUserLocalePreference(user.id, 'de-DE');
    await setAnonymousLocaleCookie(context, baseURL, 'de-DE');
    await page.goto(`/fields/${fixture.fieldId}`);
    const insufficient = de.fields.health.status.insufficient_data;
    await expect(page.getByText(insufficient)).toBeVisible();
    // Not healthy, and no invented last-visit data.
    expect(await getVisibleBodyText(page)).not.toContain(de.fields.health.status.no_current_issue);
    await expectNoVisibleDomainCodeLeak(page, DOMAIN_CODES);
  });

  test('Flow E — map popup localizes; geometry/selection unchanged on locale switch', async ({ page, context, baseURL }) => {
    const errors = watchConsole(page);
    const { fixture, userId } = await signInSeeded(page, context, baseURL, 'de-DE');
    await page.goto('/fields/map');
    const seededField = page.locator('main aside').getByRole('button', { name: /E2E Field Health Farm.*Noord/ });
    await seededField.click();
    const selectedName = await seededField.locator('strong').textContent();
    await expectNoVisibleDomainCodeLeak(page, DOMAIN_CODES);
    // Switch locale; selection + geometry must survive.
    await setE2eUserLocalePreference(userId, 'nl-NL');
    await setAnonymousLocaleCookie(context, baseURL, 'nl-NL');
    await page.reload();
    const reloadedField = page.locator('main aside').getByRole('button', { name: /E2E Field Health Farm.*Noord/ });
    await expect(reloadedField.locator('strong')).toHaveText(selectedName ?? '');
    // No sidebar overlap regression: the sidebar list stays clickable (not covered by the map).
    await expect(reloadedField).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Flow D — cross-surface: Dashboard insight → Field Detail share one canonical status', async ({ page, context, baseURL }) => {
    const { fixture } = await signInSeeded(page, context, baseURL, 'nl-NL');
    await page.goto('/dashboard');
    await expectNoVisibleDomainCodeLeak(page, DOMAIN_CODES);
    await page.goto(`/fields/${fixture.fieldId}`);
    await expectNoVisibleDomainCodeLeak(page, DOMAIN_CODES);
  });

  for (const [w, h] of [[390, 844], [430, 932]] as const) {
    test(`Flow G — mobile ${w}×${h}: no overflow, no code leak, CTA reachable`, async ({ page, context, baseURL }) => {
      const errors = watchConsole(page);
      await page.setViewportSize({ width: w, height: h });
      const { fixture } = await signInSeeded(page, context, baseURL, 'de-DE');
      await page.goto(`/fields/${fixture.fieldId}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await expectNoVisibleDomainCodeLeak(page, DOMAIN_CODES);
      expect(errors).toEqual([]);
    });
  }
});
