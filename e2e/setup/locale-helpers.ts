import { expect, type BrowserContext, type Page } from '@playwright/test';
import { HTML_LANG, type Locale } from '../../src/i18n/locales';
import { buildLocaleCookie } from './cookie-url';

/**
 * Sets the FarmOS locale cookie for ANONYMOUS-resolution tests, using a valid
 * absolute URL derived from the Playwright baseURL (never `url: '/'`). For
 * authenticated tests prefer `setLocaleThroughUi` or seeding the DB preference —
 * the cookie alone does not, and must not, override an authenticated user's
 * stored DB preference.
 */
export async function setAnonymousLocaleCookie(context: BrowserContext, baseURL: string | undefined, locale: Locale): Promise<void> {
  await context.addCookies([buildLocaleCookie(baseURL, locale)]);
}

/**
 * Switches language through the REAL application flow (the shared
 * LanguageSwitcher): selects the endonym, waits for the setUserLocale action +
 * router.refresh() to settle, and asserts <html lang> matches. Preserves the
 * current pathname. Use on routes that render the switcher (sidebar / sign-in).
 */
export async function setLocaleThroughUi(page: Page, locale: Locale): Promise<void> {
  const before = new URL(page.url()).pathname;
  await page.getByLabel('Language').selectOption(locale);
  await expect(page.locator('html')).toHaveAttribute('lang', HTML_LANG[locale]);
  await page.waitForLoadState('networkidle');
  expect(new URL(page.url()).pathname).toBe(before); // route preserved
}
