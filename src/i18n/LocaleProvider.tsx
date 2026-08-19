'use client';

import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { HTML_LANG, FALLBACK_LOCALE, type Locale } from './locales';
import { createTranslator, IS_DEV, type MessageTree, type Translate } from './translator';

interface LocaleContextValue {
  locale: Locale;
  messages: Record<string, MessageTree>;
  fallback: Record<string, MessageTree>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Holds the SINGLE server-resolved locale snapshot for the whole client tree.
 *
 * There is no useState seeded from a browser value, no navigator/localStorage/
 * cookie read, and no useEffect that swaps the locale — the first client
 * (hydration) render uses exactly `initialLocale`/`initialMessages`, which are
 * the same values the server rendered with. Language changes happen only via the
 * `setUserLocale` action + `router.refresh()`, which produces a fresh server
 * snapshot (new props here) — never an in-place client-only locale flip.
 */
export function LocaleProvider({
  initialLocale,
  initialMessages,
  initialFallback,
  children,
}: {
  initialLocale: Locale;
  initialMessages: Record<string, MessageTree>;
  initialFallback: Record<string, MessageTree>;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ locale: initialLocale, messages: initialMessages, fallback: initialFallback }),
    [initialLocale, initialMessages, initialFallback],
  );

  // Dev invariant (Part 4): if the provider locale and <html lang> disagree,
  // something re-resolved locale inconsistently — log ONE safe diagnostic (no
  // cookies, no user ids). No-op in production.
  const warned = useRef(false);
  useEffect(() => {
    if (!IS_DEV || warned.current) return;
    const htmlLang = document.documentElement.lang;
    if (htmlLang && htmlLang !== HTML_LANG[initialLocale]) {
      warned.current = true;
      // eslint-disable-next-line no-console
      console.error(`[FarmOS i18n] locale snapshot mismatch: provider="${initialLocale}" (${HTML_LANG[initialLocale]}) vs <html lang="${htmlLang}">. Server and client resolved different locales.`);
    }
  }, [initialLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Reads the active locale. Falls back only if used outside a provider (a bug we
 *  surface loudly in development rather than silently rendering English). */
function useLocaleContext(): LocaleContextValue | null {
  const ctx = useContext(LocaleContext);
  if (!ctx && IS_DEV) {
    // eslint-disable-next-line no-console
    console.error('[FarmOS i18n] a translation hook was used outside <LocaleProvider>; falling back to the English message set. This causes a hydration mismatch — wrap the tree in LocaleProvider.');
  }
  return ctx;
}

export function useLocale(): Locale {
  return useLocaleContext()?.locale ?? FALLBACK_LOCALE;
}

export function useTranslations(namespace: string): Translate {
  const ctx = useLocaleContext();
  return useMemo(
    () => createTranslator(ctx?.locale ?? FALLBACK_LOCALE, { messages: ctx?.messages?.[namespace] ?? {}, fallback: ctx?.fallback?.[namespace] ?? {} }),
    [ctx, namespace],
  );
}
