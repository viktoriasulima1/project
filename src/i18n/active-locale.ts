import 'server-only';
import { cookies, headers } from 'next/headers';
import { resolveLocale } from './resolve';
import { LOCALE_COOKIE, type Locale } from './locales';
import { getUserLocalePreference } from './preference';

/**
 * The single source of truth for the active locale in Server Components/layouts
 * (Part 2). Composes the full resolution order: authenticated DB preference →
 * cookie → Accept-Language → nl-NL. The DB read is best-effort (defensive), so
 * anonymous pages and a pending migration both degrade gracefully to the cookie.
 */
export async function getActiveLocale(): Promise<Locale> {
  let userPreference: string | null = null;
  try {
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    if (userId) userPreference = await getUserLocalePreference(userId);
  } catch {
    // anonymous / Clerk disabled — fall through to cookie + Accept-Language
  }
  const cookieStore = await cookies();
  const headerStore = await headers();
  return resolveLocale({
    userPreference,
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  });
}
