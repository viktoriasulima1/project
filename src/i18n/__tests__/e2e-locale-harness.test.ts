import { describe, it, expect, vi } from 'vitest';
import { anonymousLocaleCookieUrl, buildLocaleCookie } from '../../../e2e/setup/cookie-url';
import { resetLocalePreference, writeLocalePreference, readLocalePreference, localePrefDelegate, type LocalePrefDelegate } from '../../../e2e/setup/locale-preference-core';
import { loadTestMessages } from '../../../e2e/setup/test-messages';
import { resolveLocale } from '../resolve';

/** In-memory delegate standing in for the Prisma UserLocalePreference table. */
function fakeDelegate(seed: Record<string, string> = {}) {
  const rows = new Map(Object.entries(seed));
  const deleteMany = vi.fn(async ({ where }: { where: { clerkUserId: string } }) => {
    const had = rows.delete(where.clerkUserId);
    return { count: had ? 1 : 0 };
  });
  const upsert = vi.fn(async ({ where, create }: { where: { clerkUserId: string }; create: { locale: string } }) => {
    rows.set(where.clerkUserId, create.locale);
    return { locale: create.locale };
  });
  const findUnique = vi.fn(async ({ where }: { where: { clerkUserId: string } }) => {
    const locale = rows.get(where.clerkUserId);
    return locale ? { locale } : null;
  });
  return { rows, delegate: { deleteMany, upsert, findUnique } as unknown as LocalePrefDelegate };
}

// 1/2 — reset removes only the target user's preference
describe('E2E locale-preference reset is user-scoped', () => {
  it('1/2 — deletes only the target user; others untouched', async () => {
    const { rows, delegate } = fakeDelegate({ user_a: 'pl-PL', user_b: 'de-DE' });
    const count = await resetLocalePreference(delegate, 'user_a');
    expect(count).toBe(1);
    expect(rows.has('user_a')).toBe(false);
    expect(rows.get('user_b')).toBe('de-DE'); // untouched
    expect((delegate.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({ where: { clerkUserId: 'user_a' } });
  });
  it('write validates the locale and reads it back; unsupported rejected', async () => {
    const { delegate } = fakeDelegate();
    expect(await writeLocalePreference(delegate, 'u', 'pl-PL')).toBe(true);
    expect(await readLocalePreference(delegate, 'u')).toBe('pl-PL');
    expect(await writeLocalePreference(delegate, 'u', 'ru-RU')).toBe(false); // unsupported
    expect(await writeLocalePreference(delegate, 'u', 'ru-RU')).toBe(false);
  });
  it('a missing delegate (table pending migration) is a safe no-op', async () => {
    expect(localePrefDelegate({})).toBeNull();
    expect(await resetLocalePreference(null, 'u')).toBe(0);
    expect(await readLocalePreference(null, 'u')).toBeNull();
  });
});

// 3 — anonymous cookie helper builds a valid absolute URL (never url: '/')
describe('anonymous locale cookie URL', () => {
  it('3 — derives an absolute URL from baseURL', () => {
    expect(anonymousLocaleCookieUrl('http://localhost:3100')).toBe('http://localhost:3100/');
    expect(anonymousLocaleCookieUrl('https://app.test/base')).toBe('https://app.test/');
    const cookie = buildLocaleCookie('http://localhost:3100', 'de-DE');
    expect(cookie).toEqual({ name: 'farmos-locale', value: 'de-DE', url: 'http://localhost:3100/', sameSite: 'Lax' });
    expect(() => anonymousLocaleCookieUrl(undefined)).toThrow(/baseURL is required/);
    expect(() => anonymousLocaleCookieUrl('/')).toThrow(); // the old invalid value is rejected
  });
});

// 5 — DB preference takes precedence over a conflicting cookie (unchanged)
it('5 — stored DB preference wins over a conflicting cookie', () => {
  expect(resolveLocale({ userPreference: 'de-DE', cookieLocale: 'nl-NL' })).toBe('de-DE');
  expect(resolveLocale({ userPreference: null, cookieLocale: 'nl-NL' })).toBe('nl-NL');
});

// 8 — expected UI text comes from the real catalog, not a hardcoded phrase
it('8 — loadTestMessages returns the approved translations', () => {
  expect(loadTestMessages('de-DE').onboarding.farm.title).toBe('Ihr Betrieb');
  expect(loadTestMessages('nl-NL').onboarding.season.title).toBe('Actief seizoen');
  expect(loadTestMessages('de-DE').onboarding.season.title).toBe('Aktive Saison');
});
