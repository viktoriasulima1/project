/**
 * Builds a valid ABSOLUTE URL for Playwright's `addCookies`, from the config's
 * baseURL. Playwright rejects a relative `url: '/'` with "Invalid URL"; this
 * fixes the Flow B harness bug and keeps the cookie scoped to the real origin.
 */
export function anonymousLocaleCookieUrl(baseURL: string | undefined): string {
  if (!baseURL) throw new Error('baseURL is required to build the locale cookie URL (from Playwright config).');
  return new URL('/', baseURL).toString();
}

export const LOCALE_COOKIE_NAME = 'farmos-locale';

export function buildLocaleCookie(baseURL: string | undefined, locale: string) {
  return { name: LOCALE_COOKIE_NAME, value: locale, url: anonymousLocaleCookieUrl(baseURL), sameSite: 'Lax' as const };
}
