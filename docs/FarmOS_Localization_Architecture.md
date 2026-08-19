# FarmOS Localization Architecture

Date: 2026-07-23. Native, dependency-free i18n for the App Router. No runtime
machine translation. No URL locale prefix in this stage (existing routes like
`/dashboard`, `/scouting` are unchanged).

## Why a dependency-free core (not next-intl)

`next-intl` is not installed, and this project's `AGENTS.md` warns the Next
16.2.9 build's internals differ from upstream, so a framework's documented Next
integration carries real compatibility risk. A small tailored core keeps the
"do not break existing tests/URLs/Clerk/offline" constraints safe and is fully
replaceable by next-intl later (the message files and enum-label contract are
framework-agnostic). Decision recorded with the user.

## Modules (`src/i18n/`)

| File | Responsibility |
| --- | --- |
| `locales.ts` | Supported locales, default (nl-NL), fallback (en-GB), cookie name, endonyms, `<html lang>` map, `isSupportedLocale` |
| `resolve.ts` | `resolveLocale` (pref → cookie → Accept-Language → nl-NL), `matchLocale`, `parseAcceptLanguage` (q-ordered) |
| `catalog.ts` | Static JSON imports; `getNamespace`, `pickNamespaces` (ship only what a route needs) |
| `translator.ts` | `createTranslator` (locale → English fallback → `[missing: key]` in dev), `interpolate`, `selectPlural` |
| `format.ts` | `formatNumber/Currency/Date/DateTime` via `Intl`, timezone-honouring |
| `enum-labels.ts` | Canonical value → localized label (`getEnumLabel`, `getEnumLabels`) |
| `error-codes.ts` | Stable safe error codes → localized message (`translateErrorCode`) |
| `server.ts` | `getServerLocale`, `getServerI18n` (RSC/actions; `server-only`) |
| `actions.ts` | `setLocalePreference` (validated cookie write) |
| `LocaleProvider.tsx` | Client context + `useTranslations(ns)` + `useLocale()` |
| `clerk-locale.ts` | FarmOS locale → Clerk locale key (Part 12) |
| `export-locale.ts` | Report/export locale + provenance (Part 13) |
| `ai-locale.ts` | Briefing locale directive; facts/priorities untouched (Part 14) |
| `validate-core.ts` | Pure diff logic behind `i18n:validate` |

## Message structure

`messages/<locale>/<namespace>.json`. Namespaces this stage: `common`,
`navigation`, `validation`, `enums`, `errors`. Semantic, namespaced keys
(`navigation.today`, `enums.condition.satisfactory`, `validation.required.overallCondition`)
— never English sentences as keys. en-GB is the authoritative schema.

## Locale resolution

1. stored user preference (DB model — follow-up)
2. `farmos-locale` cookie
3. `Accept-Language`
4. `nl-NL` default
5. en-GB per-key fallback for any missing message

E2E stays green because Playwright's `en-US` Accept-Language resolves to en-GB,
whose messages equal the pre-existing English UI exactly.

## Server vs. client (Part 8)

Server Components/Actions call `getServerLocale` / `getServerI18n`. Client
components receive only the namespaces their route needs via `LocaleProvider`
props (no full dictionary shipped), so server and client render the same locale
— no hydration mismatch. `<html lang>` uses `HTML_LANG[locale]`.

## Canonical-value safety (the iPhone fix, generalized)

Every enum control binds `option.value` to the canonical token and shows
`getEnumLabel(locale, kind, value)` as text. Labels are derived FROM values,
never the reverse, so browser translation (or a wrong human label) can never
change what is submitted. Server input is still normalized + validated.

## Preference persistence (this stage)

Cookie-based (`setLocalePreference`), surviving logout/login on the same device.
Cross-device persistence lands with a `UserLocalePreference` Prisma model
(deferred to avoid a migration this iteration; the resolver already accepts a
`userPreference` argument).

## Validation

`npm run i18n:validate` — JSON validity, missing/extra keys, empty translations,
placeholder mismatches, and warns on untranslated-looking strings. Gate before
tsc/vitest/build.
