import 'server-only';
import { cookies, headers } from 'next/headers';
import { resolveLocale } from './resolve';
import { LOCALE_COOKIE, type Locale } from './locales';
import { createTranslator, type Translate } from './translator';
import { pickNamespaces, type Namespace } from './catalog';

/**
 * Resolves the active locale on the server from the FarmOS cookie and
 * Accept-Language. A stored user preference (once the DB model lands) is passed
 * in by callers that have it. Kept dependency-free so it works in Server
 * Components, Server Actions and route handlers.
 */
export async function getServerLocale(userPreference?: string | null): Promise<Locale> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return resolveLocale({
    userPreference,
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  });
}

export interface ServerI18n {
  locale: Locale;
  t: Translate;
  /** Merged locale messages for the requested namespaces (safe to hand to a client provider). */
  messages: Partial<Record<Namespace, unknown>>;
  fallback: Partial<Record<Namespace, unknown>>;
}

/** Server-side translator for one namespace + the payload to hydrate a client provider. */
export async function getServerI18n(namespaces: readonly Namespace[], userPreference?: string | null): Promise<ServerI18n> {
  const locale = await getServerLocale(userPreference);
  const { messages, fallback } = pickNamespaces(locale, namespaces);
  const primary = namespaces[0];
  const t = createTranslator(locale, {
    messages: (messages[primary] ?? {}) as Record<string, never>,
    fallback: (fallback[primary] ?? {}) as Record<string, never>,
  });
  return { locale, t, messages, fallback };
}
