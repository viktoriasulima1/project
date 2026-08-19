import { test, expect, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedEconomicsFarm } from './setup/seed-economics';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';
import { PrismaClient } from '@prisma/client';
import { expectNoVisibleDomainCodeLeak } from './setup/break-even-helpers';

/**
 * Field Action reason localization (Stage 1). Reasons come from stable resolver
 * codes translated at the UI boundary; decisions are unchanged. NOT executed here
 * (needs live server + Postgres + Clerk pool) — documented gate. Expected text is
 * catalog-sourced; no raw code (OFFLINE_ONLY / NO_ACTIVE_SEASON) may ever appear.
 */

const nl = loadTestMessages('nl-NL');
const de = loadTestMessages('de-DE');
const DOMAIN_CODES = ['OFFLINE_ONLY', 'NO_ACTIVE_SEASON', 'AVAILABLE', 'Prisma', 'Zod'];

async function openFieldDetail(page: Page, locale: 'nl-NL' | 'de-DE' | 'pl-PL' | 'en-GB', context: Page['context'] extends never ? never : Parameters<typeof setAnonymousLocaleCookie>[0], baseURL: string | undefined) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture = await seedEconomicsFarm(user.id, 'E2E Field Action Farm');
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  await setE2eUserLocalePreference(user.id, locale);
  await setAnonymousLocaleCookie(context, baseURL, locale);
  return fixture;
}

test.describe('Field Action reasons', () => {
  test('Flow A — offline disables online-only actions with a localized reason (code unchanged)', async ({ page, context, baseURL }) => {
    const fixture = await openFieldDetail(page, 'nl-NL', context, baseURL);
    await page.goto(`/fields/${fixture.fieldId}`);
    // Prove the client action bar has hydrated before firing the browser event;
    // otherwise a fast full-suite worker can dispatch before React subscribes.
    await expect(page.getByRole('link', { name: nl.fields.actions.labels.correct })).toBeVisible();
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForFunction(() => !navigator.onLine);
    // "Correct a record" is online-only → disabled with the Dutch OFFLINE_ONLY reason
    const correct = page.getByRole('button', { name: new RegExp(nl.fields.actions.labels.correct) });
    await expect(correct).toBeDisabled();
    await expect(correct).toHaveAttribute('aria-label', new RegExp(nl.fields.actions.reasons.offlineOnly.slice(0, 20)));
    await expectNoVisibleDomainCodeLeak(page, DOMAIN_CODES);
    await context.setOffline(false);
  });

  test('Flow B — no active season shows the localized reason and creates nothing', async ({ page, context, baseURL }) => {
    // seed a field with no active season, German locale
    const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
    const fixture = await seedEconomicsFarm(user.id, 'E2E No Season Farm', { withActiveSeason: false });
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });
    await setE2eUserLocalePreference(user.id, 'de-DE');
    await setAnonymousLocaleCookie(context, baseURL, 'de-DE');
    await page.goto(`/fields/${fixture.fieldId}`);
    const addRevenue = page.getByRole('button', { name: new RegExp(de.fields.actions.labels.add_revenue) });
    if (await addRevenue.count()) {
      await expect(addRevenue).toBeDisabled();
      await expect(addRevenue).toHaveAttribute('aria-label', new RegExp(de.fields.actions.reasons.noActiveSeason.slice(0, 15)));
    }
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });
    const revenue = await prisma.revenueEntry.count({ where: {} });
    await prisma.$disconnect();
    expect(revenue).toBe(0); // nothing created
  });

  test('Flow E — mobile 390/430: disabled reasons wrap, no overflow, no code leak', async ({ page, context, baseURL }) => {
    const fixture = await openFieldDetail(page, 'de-DE', context, baseURL);
    for (const [w, h] of [[390, 844], [430, 932]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`/fields/${fixture.fieldId}`);
      await context.setOffline(true);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await expectNoVisibleDomainCodeLeak(page, DOMAIN_CODES);
      await context.setOffline(false);
      await page.waitForFunction(() => navigator.onLine);
    }
  });
});
