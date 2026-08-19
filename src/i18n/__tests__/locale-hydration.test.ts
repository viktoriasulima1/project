import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { LocaleProvider, useLocale, useTranslations } from '../LocaleProvider';
import { pickNamespaces } from '../catalog';
import { HTML_LANG, SUPPORTED_LOCALES, type Locale } from '../locales';
import { clerkLocaleFor } from '../clerk-locale';

const layoutSrc = readFileSync(path.resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
const sidebarSrc = readFileSync(path.resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');
const providerSrc = readFileSync(path.resolve(process.cwd(), 'src/i18n/LocaleProvider.tsx'), 'utf8');

function renderInProvider(locale: Locale, child: React.ReactElement) {
  const { messages, fallback } = pickNamespaces(locale, ['navigation']);
  return renderToStaticMarkup(
    createElement(LocaleProvider, { initialLocale: locale, initialMessages: messages as never, initialFallback: fallback as never, children: child }),
  );
}

// 1/2/3 — provider initial state equals initialLocale (never silently en-GB)
describe('LocaleProvider initial snapshot', () => {
  const Locale = () => createElement('span', null, useLocale());
  it('1/2 — useLocale returns the initialLocale, not en-GB, for nl-NL', () => {
    expect(renderInProvider('nl-NL', createElement(Locale))).toContain('nl-NL');
    expect(renderInProvider('nl-NL', createElement(Locale))).not.toContain('en-GB');
  });
  it('3 — every locale flows through unchanged', () => {
    for (const locale of SUPPORTED_LOCALES) expect(renderInProvider(locale, createElement(Locale))).toContain(locale);
  });
});

// 4/5/6/7 — the SAME locale yields the SAME nav labels (server === client render)
describe('Sidebar labels are a pure function of the provider locale', () => {
  const Nav = () => {
    const t = useTranslations('navigation');
    return createElement('span', null, `${t('today')}|${t('openNav')}`);
  };
  const expected: Record<Locale, string> = {
    'nl-NL': 'Vandaag|Navigatie openen',
    'en-GB': 'Today|Open navigation',
    'pl-PL': 'Dziś|Otwórz nawigację',
    'de-DE': 'Heute|Navigation öffnen',
  };
  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale} renders deterministically`, () => {
      // rendering twice must be identical (no window/navigator/time influence)
      const a = renderInProvider(locale, createElement(Nav));
      const b = renderInProvider(locale, createElement(Nav));
      expect(a).toBe(b);
      expect(a).toContain(expected[locale]);
    });
  }
});

// 8 — html lang matches provider locale
it('8 — html lang code matches the active locale', () => {
  expect(HTML_LANG['nl-NL']).toBe('nl');
  expect(HTML_LANG['de-DE']).toBe('de');
});

// 9 — Clerk locale matches provider locale
it('9 — Clerk localization key matches the active locale', () => {
  for (const locale of SUPPORTED_LOCALES) expect(clerkLocaleFor(locale)).toMatch(/^[a-z]{2}[A-Z]{2}$/);
  expect(clerkLocaleFor('nl-NL')).toBe('nlNL');
});

// 10 — no browser-language detection in Sidebar or provider during hydration
it('10 — Sidebar/provider never read navigator/window/cookie for locale', () => {
  // match actual usage (property access / calls), not the words in a comment
  for (const src of [sidebarSrc, providerSrc]) {
    expect(src).not.toMatch(/navigator\s*\.\s*language/);
    expect(src).not.toMatch(/document\s*\.\s*cookie/);
    expect(src).not.toMatch(/localStorage\s*\./);
  }
  // Sidebar gets labels only through the translator
  expect(sidebarSrc).toMatch(/useTranslations\('navigation'\)/);
});

// 12/13 — raw <script> removed; next/script with stable id + beforeInteractive
describe('12/13 — script rendering', () => {
  it('the layout no longer renders a raw <script> element', () => {
    expect(layoutSrc).not.toMatch(/<script\b/);
  });
  it('uses next/script with a stable id and beforeInteractive strategy', () => {
    expect(layoutSrc).toMatch(/import Script from "next\/script"/);
    expect(layoutSrc).toMatch(/<Script id="farmos-theme-init" strategy="beforeInteractive"/);
  });
  it('the init script is theme-only and static (never resolves locale)', () => {
    expect(layoutSrc).toMatch(/THEME_INIT_SCRIPT/);
    expect(layoutSrc).not.toMatch(/THEME_INIT_SCRIPT[^;]*locale/i);
  });
});

// 14 — no suppressHydrationWarning workaround added for locale
it('14 — suppressHydrationWarning is used once (html/theme only), not on the provider', () => {
  const count = (layoutSrc.match(/suppressHydrationWarning/g) ?? []).length;
  expect(count).toBe(1); // the pre-existing data-theme one on <html>
  expect(providerSrc).not.toMatch(/suppressHydrationWarning/);
  expect(sidebarSrc).not.toMatch(/suppressHydrationWarning/);
});
