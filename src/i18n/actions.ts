'use server';

import { cookies } from 'next/headers';
import { isSupportedLocale, LOCALE_COOKIE } from './locales';
import { saveUserLocalePreference } from './preference';

export type SetLocaleResult = { success: true; locale: string } | { error: string };

/**
 * Shared language-switch action (Part 4).
 *   1. validate supported locale
 *   2. resolve authenticated user if present
 *   3. persist DB preference (authenticated; best-effort)
 *   4. set the locale cookie (mirrors preference for fast rendering)
 *   5. return a safe result
 * Anonymous callers get cookie-only. The caller revalidates the route. Never
 * stores a translated label — only the canonical locale token.
 */
export async function setUserLocale(locale: string): Promise<SetLocaleResult> {
  if (!isSupportedLocale(locale)) return { error: 'Unsupported language.' };

  try {
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    if (userId) await saveUserLocalePreference(userId, locale);
  } catch {
    // anonymous, or Clerk unavailable → cookie only
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', httpOnly: false });
  return { success: true, locale };
}

/** Back-compat alias for the earlier cookie-only action. */
export async function setLocalePreference(locale: string): Promise<SetLocaleResult> {
  return setUserLocale(locale);
}
