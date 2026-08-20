import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { isClerkConfigured } from "@/lib/clerk-config";
import { ClerkBootBoundary } from "@/components/dev/ClerkBootBoundary";
import { getActiveLocale } from "@/i18n/active-locale";
import { HTML_LANG, LOCALE_DIR, type Locale } from "@/i18n/locales";
import { pickNamespaces, type Namespace } from "@/i18n/catalog";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { clerkLocalization } from "@/i18n/clerk-localization";
import type { MessageTree } from "@/i18n/translator";
import "./globals.css";

const isDev = process.env.NODE_ENV === 'development';

// Namespaces every route's Client Components may need. Small, shared, and
// loaded once here rather than shipping the whole catalog (Part 2/8). Route
// segments can layer additional namespaces via their own LocaleProvider later.
const GLOBAL_NAMESPACES: readonly Namespace[] = ['common', 'navigation', 'validation', 'enums', 'errors', 'workOrders', 'scouting', 'onboarding', 'fields', 'team', 'machines', 'soil', 'nutrients'];

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FarmOS — AI Farm Operating System",
  description: "AI-first farm management for European farmers",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FarmOS", statusBarStyle: "default" },
};

const clerkEnabled = isClerkConfigured(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Static, anti-flash THEME bootstrap only. It sets `data-theme` from the local
// display preference before paint. It NEVER resolves the application locale and
// never writes LocaleProvider state — locale authority stays server-side
// (DB → cookie → Accept-Language → nl-NL). Kept a stable, non-interpolated
// constant so its content is safe.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('farmos-theme');var t=s==='light'||s==='dark'?s:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`;

function AppDocument({ lang, dir, children }: { lang: string; dir: 'ltr' | 'rtl'; children: React.ReactNode }) {
  // The hydration-warning suppression below is ONLY for the `data-theme`
  // attribute the theme script flips before hydration (server renders "dark").
  // It does NOT hide the locale/text mismatch this change fixes — that fix is the
  // single server locale snapshot + moving the init script out of React's tree.
  return (
    <html lang={lang} dir={dir} data-theme="dark" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {/* next/script beforeInteractive is injected into <head> by Next OUTSIDE
            React's hydrated tree, so React no longer "encounters a script tag"
            and document hydration is not disrupted. */}
        <Script id="farmos-theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ONE server-resolved locale snapshot per request. The same value drives
  // <html lang>, dir, the message catalogs, the LocaleProvider initial state and
  // Clerk localization — nothing re-resolves locale in a nested provider, so the
  // server render and the client's first (hydration) render are identical.
  const activeLocale: Locale = await getActiveLocale();
  const lang = HTML_LANG[activeLocale];
  const dir = LOCALE_DIR[activeLocale];
  const { messages, fallback } = pickNamespaces(activeLocale, GLOBAL_NAMESPACES);

  // Dev-only: a visible fallback if the auth UI fails to initialize, so the page
  // is never a silent blank body. Production keeps Next's normal error handling.
  const guarded = isDev ? <ClerkBootBoundary>{children}</ClerkBootBoundary> : children;
  const localized = (
    <LocaleProvider initialLocale={activeLocale} initialMessages={messages as Record<string, MessageTree>} initialFallback={fallback as Record<string, MessageTree>}>
      {guarded}
    </LocaleProvider>
  );

  if (clerkEnabled) {
    const { ClerkProvider } = await import('@clerk/nextjs');
    return (
      // Telemetry disabled (Option A): its request to https://clerk-telemetry.com
      // is intentionally not in connect-src, so leaving it on only produces a
      // benign but noisy CSP-blocked request. Disabling it keeps the CSP strict
      // (no clerk-telemetry.com allowance) and the console clean. Auth FAPI /
      // api.clerk.com / challenge domains are unaffected.
      //
      // signInUrl/signUpUrl pin every Clerk component (SignInButton,
      // UserButton, RedirectToSignIn, ...) to this app's own pages instead
      // of Clerk's hosted Account Portal (accounts.<domain>) — on a shared
      // *.vercel.app domain we don't control DNS for, so that subdomain
      // never resolves. proxy.ts's auth.protect() carries the matching
      // unauthenticatedUrl override for the same reason.
      <ClerkProvider
        afterSignOutUrl="/"
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        localization={clerkLocalization(activeLocale)}
        telemetry={{ disabled: true }}
      >
        <AppDocument lang={lang} dir={dir}>{localized}</AppDocument>
      </ClerkProvider>
    );
  }

  return <AppDocument lang={lang} dir={dir}>{localized}</AppDocument>;
}
