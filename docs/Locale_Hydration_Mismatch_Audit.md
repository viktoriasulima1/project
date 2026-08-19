# Locale Hydration Mismatch — Audit

Date: 2026-07-23. Traces the locale snapshot for the reported hydration failure
(server rendered `nl-NL` "Vandaag" / "Navigatie openen"; client's first render
used `en-GB` "Today" / "Open navigation") and the raw-script warning at
`layout.tsx:45`.

## Snapshot trace (before fix)

| Stage | Source | Value |
| --- | --- | --- |
| Server locale | `getActiveLocale()` (DB pref → cookie → Accept-Language → nl-NL), called **once** in `RootLayout` | nl-NL |
| `<html lang>` | `HTML_LANG[locale]` | nl |
| LocaleProvider prop | `<LocaleProvider locale={locale}>` (same variable) | nl-NL |
| Clerk localization | `clerkLocalization(locale)` (same variable) | nlNL |
| LocaleProvider initial state | pure prop → `useMemo` (no useState/useEffect/window) | nl-NL |
| `useTranslations` first client render | `useContext(LocaleContext)?.locale ?? 'en-GB'` | **en-GB when context resolved null** |

Findings:
- The server side is internally consistent: one `getActiveLocale()` result drives
  `<html lang>`, messages, LocaleProvider and Clerk. There is **exactly one**
  `LocaleProvider` (no nested provider re-resolving locale).
- The **only** source of `en-GB` on the client path is the
  `?? 'en-GB'` fallback in `useLocale` / `useTranslations` (there is no
  `navigator.language` / `localStorage` / `document.cookie` locale read in the
  Sidebar or provider). So the client rendered English **only because the
  LocaleProvider context read as null during that render**.
- The trigger: `AppDocument` rendered a **raw `<script dangerouslySetInnerHTML>`
  inside `<head>`** (the theme anti-flash bootstrap). React 19 warns
  ("Encountered a script tag while rendering React component") and, with a raw
  `<script>` node inside React's hydrated document tree, document hydration is
  disrupted — React discards the server tree and re-renders on the client, where
  the transient null-context fallback surfaced English.

## Fix summary

1. **Script** — moved the theme bootstrap out of React's tree into
   `next/script` `strategy="beforeInteractive"` (id `farmos-theme-init`), which
   Next injects into `<head>` outside the hydrated tree. Removes the warning and
   the hydration disruption. Script stays theme-only and static; it never
   resolves locale.
2. **Snapshot** — the layout now names the single snapshot `activeLocale` and
   passes it as `initialLocale` / `initialMessages` / `initialFallback`;
   LocaleProvider stores exactly that (still pure props — no client-side flip).
3. **Invariant (dev)** — LocaleProvider logs one safe diagnostic if its locale
   and `<html lang>` disagree; the translation hooks log if used outside a
   provider (no cookies/user ids exposed).

Authority order unchanged: **DB preference → cookie → Accept-Language → nl-NL**;
en-GB remains only the per-key message fallback.
