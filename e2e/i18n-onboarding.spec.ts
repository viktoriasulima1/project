import { test, expect } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser, setE2eUserLocalePreference, getE2eUserLocalePreference } from './setup/reset-user-data';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';
import { loadTestMessages } from './setup/test-messages';
import { PrismaClient } from '@prisma/client';

/**
 * Onboarding localization E2E. A NEW (un-onboarded) fixed-pool Clerk user — no
 * users are created. `resetNamedE2eUser` now also clears the user's
 * UserLocalePreference, so DB-over-cookie precedence is deterministic per test.
 *
 * Locale is switched by seeding the authenticated user's DB preference (the
 * authoritative, highest-precedence source) + mirroring the cookie for fast
 * render — onboarding has no in-page switcher. This RESPECTS the DB-over-cookie
 * precedence; it does not make the cookie override the DB.
 *
 * Expected UI text is sourced from the real message catalog (loadTestMessages),
 * not hardcoded phrases, so it can never drift from the approved translation.
 */

const NEW_USER_EMAIL = process.env.E2E_USER_NEW_EMAIL ?? process.env.E2E_USER_PILOT_EMAIL!;
const nl = loadTestMessages('nl-NL');
const de = loadTestMessages('de-DE');

test.describe('Onboarding localization', () => {
  test('Flow A — switch locale mid-flow: step preserved, saved data + canonical values unchanged', async ({ page, context, baseURL }) => {
    const user = await resetNamedE2eUser(NEW_USER_EMAIL); // clears farm AND locale preference
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    // Authoritative authenticated locale = DB preference; cookie mirrors it.
    await setE2eUserLocalePreference(user.id, 'nl-NL');
    await setAnonymousLocaleCookie(context, baseURL, 'nl-NL');
    await page.goto('/onboarding');
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
    await expect(page.getByRole('heading', { name: nl.onboarding.welcome.title })).toBeVisible();
    await page.getByRole('button', { name: nl.onboarding.buttons.getStarted }).click();
    await expect(page.getByRole('heading', { name: nl.onboarding.farm.title })).toBeVisible();

    // PERSIST the farm step so the wizard legitimately advances (Part 5): a
    // reload/switch keeps only persisted state, never unsaved in-memory input.
    const farmName = 'Testbedrijf Nederland';
    await page.getByLabel(nl.onboarding.farm.nameLabel).fill(farmName);
    await page.getByLabel(nl.onboarding.farm.locationLabel).fill('Westervoort, Gelderland');
    await page.getByRole('button', { name: nl.onboarding.buttons.continue }).click();

    // Farm persisted → wizard advances to Season; capture the logical step.
    await expect(page.getByRole('heading', { name: nl.onboarding.season.title })).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\?step=season/);

    // Switch to German via the authoritative DB preference (Season is data-less,
    // so nothing unsaved is at risk).
    await setE2eUserLocalePreference(user.id, 'de-DE');
    await setAnonymousLocaleCookie(context, baseURL, 'de-DE');
    await page.reload();

    // html lang, route AND the SAME logical step are all preserved, now in German.
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page).toHaveURL(/\/onboarding\?step=season/);
    await expect(page.getByRole('heading', { name: de.onboarding.season.title })).toBeVisible();

    // Persisted DB values unchanged; DB preference actually persisted.
    const prisma = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });
    const farm = await prisma.farm.findUnique({ where: { clerkUserId: user.id } });
    await prisma.$disconnect();
    expect(farm?.name).toBe(farmName); // farmer-entered name unchanged
    expect(await getE2eUserLocalePreference(user.id)).toBe('de-DE');
  });

  test('Flow B — invalid submit shows friendly German validation, no raw internals', async ({ page, context, baseURL }) => {
    const user = await resetNamedE2eUser(NEW_USER_EMAIL);
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: user.email });

    await setE2eUserLocalePreference(user.id, 'de-DE');
    await setAnonymousLocaleCookie(context, baseURL, 'de-DE'); // valid absolute URL now
    await page.goto('/onboarding?step=farm');
    await expect(page.getByRole('heading', { name: de.onboarding.farm.title })).toBeVisible();

    await page.getByRole('button', { name: de.onboarding.buttons.continue }).click(); // empty farm name
    // no raw internals leak to the farmer
    await expect(page.getByText(/Invalid option|expected one of|Prisma|Zod|at Object\./i)).toHaveCount(0);
  });
});
