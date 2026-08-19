# FarmOS Localization Stage 20 — Fields user errors

## Verified baseline

- Stage 19 is selection/audit only; it changed no production runtime behavior.
- User-error evidence: 110; resolver evidence: 367.
- Previous gates: Prisma 22 migrations current; TypeScript PASS; unit 1031/1031 PASS; production build PASS.
- Latest browser baseline only (not rerun in Stage 19): 210 collected, 209 passed, 1 documented conditional skip, 0 failed/flaky, retries 0, exit 0, 23m 13.6s.
- Clerk baseline: 5 total / 4 fixed-pool; no IndexedDB or Service Worker leakage.
- Physical iPhone/Android offline field pilot: NOT RUN / NO-GO.

## Objective and exact scope

Migrate exactly **7 active user-error findings in one production action file**, `src/lib/actions/fields.ts`, to the shared structured `UserFacingError` contract. Targeted user-error audit must move 7 → 0. Do not implement adjacent features.

| # | File:line | Function | Current visible value | Audit source | Production consumer | Canonical code | Category / retry | Safe metadata | Security |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `fields.ts:35` | `createField` validation | raw `parsed.error.flatten().fieldErrors` Zod messages | user-errors / raw forwarding | NewFieldDialog; OnboardingWizard | `FIELD_NAME_REQUIRED`, `INVALID_FIELD_AREA`, or `INVALID_SOIL_TYPE`, with field path | validation / false | none | never reveal Zod issues/input |
| 2 | `fields.ts:42` | `createField` farm lookup | `Farm not found. Please complete onboarding.` | user-errors / final English | NewFieldDialog; OnboardingWizard | existing `NOT_FOUND` (or `AUTH_REQUIRED` only when authentication is actually absent) | not_found / false | none | do not reveal farm/account state |
| 3 | `fields.ts:70` | `updateField` validation | raw `parsed.error.flatten().fieldErrors` Zod messages | user-errors / raw forwarding | direct update action consumer | same three field validation codes | validation / false | none | never reveal Zod issues/input |
| 4 | `fields.ts:77` | `updateField` farm lookup | `Farm not found.` | user-errors / final English | direct update action consumer | `NOT_FOUND` | not_found / false | none | non-revealing |
| 5 | `fields.ts:84` | `updateField` ownership lookup | `Field not found.` | user-errors / final English | direct update action consumer | `NOT_FOUND` | authorization externally represented as not-found / false | none | foreign and nonexistent indistinguishable |
| 6 | `fields.ts:101` | `deleteField` farm lookup | `Farm not found.` | user-errors / final English | FieldsListClient | `NOT_FOUND` | not_found / false | none | non-revealing |
| 7 | `fields.ts:108` | `deleteField` ownership lookup | `Field not found.` | user-errors / final English | FieldsListClient | `NOT_FOUND` | authorization externally represented as not-found / false | none | foreign and nonexistent indistinguishable |

Line numbers refer to the Stage 19 evidence snapshot and must be re-audited if the file moves. ORM/caught failures below these findings must return only the canonical classifier result; raw Prisma/database text, `error.message`, `String(error)`, stack/configuration details and Zod issue prose must never reach consumers.

## Allowed files

Primary runtime scope:

- `src/lib/actions/fields.ts`
- direct consumers only as needed: `src/components/fields/NewFieldDialog.tsx`, `src/components/fields/FieldsListClient.tsx`, and the field step in `src/components/onboarding/OnboardingWizard.tsx`

Narrow supporting scope only: shared UserError/display types and adapters, four locale `errors`/`fields` resources, Fields action tests, a focused Fields localization Playwright spec, and documentation/evidence.

## Explicit exclusions

Do not change BRP import, Seasons/crop assignment, Field Map/geolocation, field health/economics resolvers, database schema, deletion/retention rules, compliance history, hectares calculations, onboarding step order, authentication, offline queues, Service Worker, Clerk setup, or unrelated UI. Do not combine BRP merely because Fields unlocks it.

## Characterization tests first

Before runtime edits, freeze create/update/delete success behavior, validation preservation, hard-versus-soft deletion, compliance/activity retention, revalidation paths, missing farm, nonexistent and foreign field behavior, database failure masking, and absence of cross-farm writes. Characterization must prove that foreign and nonexistent IDs are indistinguishable and that no raw Zod/Prisma/caught text is required by a legitimate consumer.

## Contract and direct-consumer migration

Reuse `UserFacingError`, `userError`, canonical safe codes and `buildUserErrorDisplayModel`; do not create a parallel Fields error shape. Preserve success/field IDs. Return structured field errors with safe field names only. Consumers localize codes in nl-NL, en-GB, pl-PL and de-DE and must never render raw codes or legacy `message` prose. Unknown values fall back to `GENERIC`.

Keep inaccessible field/farm results non-revealing. Log diagnostics server-side only. No field, farm, user, Prisma constraint, payload, stack, token, cookie or configuration value may appear in error metadata. No safe metadata is required for these seven findings.

## Accessibility and presentation

Global errors use an accessible alert; field errors are associated through `aria-describedby`/`aria-invalid`, focus the first invalid field after submit, and preserve farmer input. Delete errors must be announced without removing the row. Verify wrapping and no horizontal overflow at 390×844 and 430×932, including German and Polish.

## Required validation

- Targeted Fields user-error audit: 7 → 0; explain any unrelated global delta.
- i18n validation and option audit; four-locale key/placeholder parity.
- Unit tests for all seven findings, safe classification, database masking, ownership equivalence, retention and success behavior.
- Focused Playwright: create validation in all four locales, missing/foreign/nonexistent behavior, delete error announcement, input preservation/focus, mobile German/Polish layout.
- Regression Playwright using actual repository filenames discovered at execution time: onboarding, golden/founder field creation, isolation, field deletion/retention and BRP navigation compatibility where relevant.
- Full serial E2E is mandatory after focused/regression pass: `npx playwright test --workers=1 --retries=0`.
- Record collected/passed/skipped/failed/flaky/retries/duration/exit code, Clerk before/after/new users, and IndexedDB/Service Worker leakage.
- Run Prisma generate/status, TypeScript, full Vitest and production build. Update the error contract, current audit, debt inventory/roadmap, multilingual/audit report, beta checklist, module map and feature matrix.

## Honest decision wording

> Fields user-error migration — bounded GO only if the exact 7 → 0 audit and every required automated gate pass. Application-wide user-error migration — still PARTIAL / NO-GO. Physical iPhone/Android offline field pilot — NOT RUN / NO-GO until real-device validation passes.
