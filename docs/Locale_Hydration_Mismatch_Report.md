# Locale Hydration Mismatch — Report

Date: 2026-07-23. Companion: `Locale_Hydration_Mismatch_Audit.md`.

## 1. Confirmed mismatch evidence
`layout.tsx:45` raw-script warning ("Encountered a script tag…"), and a
hydration failure: server `aria-label="Navigatie openen"` / "Vandaag" vs client
initial `aria-label="Open navigation"` / "Today"; React discarded the
server-rendered tree and re-rendered client-side.

## 2. Server locale
`nl-NL` — `getActiveLocale()` (DB pref → cookie → Accept-Language → nl-NL),
called once in `RootLayout`, driving `<html lang>`, messages, LocaleProvider and
Clerk consistently.

## 3. Client initial locale
`en-GB` — sourced **only** from the `?? 'en-GB'` fallback in
`useLocale`/`useTranslations`, i.e. the LocaleProvider context read as null
during the client's re-render. No `navigator`/`localStorage`/`cookie` locale
read exists in the Sidebar or provider.

## 4. Exact root cause
A raw `<script dangerouslySetInnerHTML>` rendered inside `<head>` by
`AppDocument`. In React 19 a `<script>` inside the hydrated document tree
triggers the warning and disrupts document hydration, so React discards the
server tree and re-renders on the client — where the transient null-context
fallback rendered English. The locale pipeline itself was already single-snapshot
(no nested provider, no client-side locale detection).

## 5. LocaleProvider fix
Props renamed to the explicit server snapshot `initialLocale` /
`initialMessages` / `initialFallback`; stored via `useMemo` (still pure props —
no `useState` seeded from a browser value, no `useEffect` locale swap). First
client render therefore uses exactly the server locale. A dev invariant logs one
safe diagnostic if provider locale ≠ `<html lang>`, and the hooks warn if used
outside a provider.

## 6. Clerk consistency
`clerkLocalization(activeLocale)` uses the same snapshot variable. Mapping
verified unchanged: nl-NL→nlNL, en-GB→enGB, pl-PL→plPL, de-DE→deDE.

## 7. Raw script purpose
Theme anti-flash bootstrap: reads `localStorage['farmos-theme']` (or
`prefers-color-scheme`) and sets `data-theme` before paint. It does **not**
touch locale.

## 8. Script replacement
`next/script` `strategy="beforeInteractive"`, id `farmos-theme-init`, static
`THEME_INIT_SCRIPT` via `dangerouslySetInnerHTML`. Per the installed Next docs,
beforeInteractive scripts live in the root layout and are injected into `<head>`
**outside** React's hydrated tree — removing the warning and the hydration
disruption. CSP already allows inline scripts via `script-src 'unsafe-inline'`
(no CSP change; no wildcard added). `suppressHydrationWarning` on `<html>` is
retained ONLY for the `data-theme` attribute the theme script flips — it is not
used to hide the locale mismatch.

## 9. Sidebar regression
Verified (unit) that Sidebar navigation labels + toggle aria are a **pure
function of the provider locale** — rendering twice per locale is byte-identical
and yields: nl "Vandaag"/"Navigatie openen", en "Today"/"Open navigation", pl
"Dziś"/"Otwórz nawigację", de "Heute"/"Navigation öffnen". Sidebar reads labels
only through `useTranslations('navigation')`; no `window`/`navigator`/`cookie`.

## 10. Unit results
`src/i18n/__tests__/locale-hydration.test.ts` — 13 tests: provider initial state
= initialLocale (never en-GB for nl-NL), all locales flow unchanged, deterministic
per-locale Sidebar labels, html-lang mapping, Clerk mapping, no browser-language
detection, raw `<script>` absent, `next/script` id + beforeInteractive present,
theme script is locale-free, `suppressHydrationWarning` used once (html/theme
only). Full suite: **848 passed**.

## 11. Build result
`tsc --noEmit` 0 · `npm run build` exit 0, "Compiled successfully".

## 12. Playwright result
`e2e/locale-hydration.spec.ts` written (per-locale: nav survives hydration,
`<html lang>` matches, console free of hydration/script noise, client-nav keeps
locale). **NOT executed here** (needs live server + Postgres + Clerk pool).

## 13. Manual browser result
**NOT run** (no browser here). Steps: stop dev, delete `.next`, `npm run dev`,
unregister the old Service Worker, clear Cache Storage (not IndexedDB), reload,
switch all four locales, confirm zero hydration errors and no raw-script warning.

## 14. Remaining warnings
Clerk development-key notice remains (expected, not this defect). Service Worker
was **not** modified (no evidence tied it to this mismatch; the earlier
Response.clone fix stands).

## 15. GO / NO-GO
**GO** for the code-level fix: single server snapshot drives html-lang +
provider + Clerk; no client-side locale detection; raw script replaced with
`next/script`; no `suppressHydrationWarning` workaround for locale; 848 unit
tests + build green. **Gated:** the Playwright hydration spec and the manual
four-locale browser check were **not executed** in this environment — run them
(delete `.next` first) to confirm zero runtime hydration errors before declaring
the runtime fixed.
