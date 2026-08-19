import { test, expect, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference } from './setup/reset-user-data';
import { seedEconomicsFarm } from './setup/seed-economics';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { PrismaClient } from '@prisma/client';

async function signIn(page: Page) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  const fixture = await seedEconomicsFarm(user.id, 'E2E i18n Farm');
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
  return { fixture, user };
}

test.describe('FarmOS localization', () => {
  test('Flow A — switch nl → en → pl → de, route preserved, persists on reload', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    const switcher = page.getByLabel('Language');
    await switcher.selectOption('nl-NL');
    await expect(page.getByRole('link', { name: 'Vandaag' })).toBeVisible();
    await switcher.selectOption('en-GB');
    await expect(page.getByRole('link', { name: 'Today' })).toBeVisible();
    await switcher.selectOption('pl-PL');
    await expect(page.getByRole('link', { name: 'Dziś' })).toBeVisible();
    await switcher.selectOption('de-DE');
    await expect(page.getByRole('link', { name: 'Heute' })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.reload();
    await expect(page.getByRole('link', { name: 'Heute' })).toBeVisible();
  });

  test('Flow B — scouting condition label localizes but the DB value stays canonical', async ({ page, context, baseURL }) => {
    const { user } = await signIn(page);
    await setE2eUserLocalePreference(user.id, 'nl-NL');
    await setAnonymousLocaleCookie(context, baseURL, 'nl-NL');
    await page.goto('/scouting');
    const condition = page.getByLabel(/Algemene conditie|Overall condition/);
    await expect(condition.getByRole('option', { name: 'Voldoende' })).toBeAttached();
    await condition.selectOption('satisfactory');
    await page.getByLabel(/Omschrijving|Description/).fill('Conditie waarneming.');
    await page.getByRole('button', { name: /controleren en opslaan|Review and save visit/i }).click();
    await expect(page.getByText(/1 observation\(s\)/).first()).toBeVisible({ timeout: 30_000 });

    const prisma = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });
    const saved = await prisma.scoutingVisit.findFirst({ orderBy: { createdAt: 'desc' }, select: { overallCondition: true } });
    await prisma.$disconnect();
    expect(saved?.overallCondition).toBe('satisfactory');

    await setE2eUserLocalePreference(user.id, 'pl-PL');
    await setAnonymousLocaleCookie(context, baseURL, 'pl-PL');
    await page.goto('/scouting');
    const polishCondition = page.getByLabel(/kondycja|Overall condition/i);
    await expect(polishCondition.locator('option[value="satisfactory"]')).toBeAttached();
    await expect(polishCondition.locator('option[value="satisfactory"]')).not.toHaveText('satisfactory');
  });

  test('Flow H — mobile 390 & 430: language switcher usable, no horizontal overflow', async ({ page }) => {
    await signIn(page);
    for (const width of [390, 430]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 932 });
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /navigation/i }).click();
      await expect(page.getByLabel('Language')).toBeVisible();
      await page.getByLabel('Language').selectOption('de-DE');
      await expect(page.getByRole('link', { name: 'Arbeitsaufträge' })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.getByRole('button', { name: /navigation/i }).click();
    }
  });
});
