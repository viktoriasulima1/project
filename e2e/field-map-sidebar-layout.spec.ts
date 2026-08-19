import { test, expect, type Page } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { resetNamedE2eUser } from './setup/reset-user-data';
import { seedEconomicsFarm } from './setup/seed-economics';
import { setAnonymousLocaleCookie } from './setup/locale-helpers';

/**
 * Field Map ↔ sidebar layout/stacking regression (Part 13). NOT executed in this
 * environment (needs live server + Postgres + Clerk pool) — documented gate.
 */

const LAYOUT_NOISE = [/ResizeObserver loop/i, /Maximum call stack size exceeded/i, /Hydration failed/i, /Maximum update depth/i];

async function signInMap(page: Page) {
  const user = await resetNamedE2eUser(process.env.E2E_USER_PILOT_EMAIL!);
  await seedEconomicsFarm(user.id, 'E2E Map Layout Farm');
  await page.goto('/');
  await clerk.signIn({ page, emailAddress: user.email });
}

/** Is the DOM element at (x,y) inside the Leaflet map? */
function elementIsMapAt(page: Page, x: number, y: number) {
  return page.evaluate(([px, py]) => !!(document.elementFromPoint(px, py) as Element | null)?.closest('.leaflet-container'), [x, y]);
}

test.describe('Field Map / sidebar layout', () => {
  test('Flow A — desktop: map starts after the permanent sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInMap(page);
    await page.goto('/fields/map');
    const sidebar = page.locator('aside').first();
    const map = page.locator('.leaflet-container').first();
    await expect(map).toBeVisible();
    const sb = await sidebar.boundingBox();
    const mb = await map.boundingBox();
    expect(sb).not.toBeNull();
    expect(mb!.x).toBeGreaterThanOrEqual(sb!.x + sb!.width - 1); // map left edge ≥ sidebar right edge
  });

  test('Flow B — 732×847: open drawer covers + disables the map', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewportSize({ width: 732, height: 847 });
    await signInMap(page);
    await page.goto('/fields/map');
    await page.getByRole('button', { name: /navigation/i }).click(); // open drawer
    await expect(page.locator('aside').first()).toBeVisible();
    // a point over the map now resolves to the backdrop/sidebar, not Leaflet
    expect(await elementIsMapAt(page, 500, 400)).toBe(false);
    await page.getByRole('button', { name: /navigation/i }).click(); // close
    expect(await elementIsMapAt(page, 500, 400)).toBe(true); // interactive again
    expect(errors.filter((e) => LAYOUT_NOISE.some((re) => re.test(e)))).toEqual([]);
  });

  test('Flow C — 390×844: open/close 5× stays stable; Escape closes', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await signInMap(page);
    await page.goto('/fields/map');
    const toggle = page.getByRole('button', { name: /navigation/i });
    for (let i = 0; i < 5; i++) { await toggle.click(); await toggle.click(); }
    await toggle.click();
    await page.keyboard.press('Escape'); // Escape closes
    await expect(page.locator('aside').first()).not.toBeVisible();
    await expect(toggle).toBeFocused(); // focus returned
    expect(errors.filter((e) => LAYOUT_NOISE.some((re) => re.test(e)))).toEqual([]);
  });

  test('Flow E — Polish/German: no horizontal overflow on the map route', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInMap(page);
    for (const locale of ['pl-PL', 'de-DE'] as const) {
      await setAnonymousLocaleCookie(context, baseURL, locale);
      await page.goto('/fields/map');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, locale).toBeLessThanOrEqual(1);
    }
  });
});
