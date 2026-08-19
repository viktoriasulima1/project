# User-facing error current-state audit

## Stage 18 verified update — 2026-08-08

Offline Sync Center moved 10 → 0 across four files. Global active user-error debt is now 110; resolver findings remain 367. Focused E2E is 8/8, relevant regression 29/29, and the clean full run is 209 passed / 1 conditional skip / 0 failed from 210 collected. Application-wide status remains PARTIAL / NO-GO; physical iPhone/Android offline validation remains NOT RUN / NO-GO.

## Stage 16 update — 2026-08-03

Activity Parse API moved 2 → 0. Global debt is 120 user errors and 367 resolvers. Transcription/briefing remain excluded.

## Stage 15 update — 2026-08-02

Activities / Quick Log core moved 9 → 0. Global active user-error debt is now 122. The two activity-parse API findings remain the confirmed next bounded batch.

## Stage 14 U2 verified delta (2026-08-01)

Inventory/Machines targeted findings are 4 → 0. Global active-path findings are 131 (from 135); global resolver findings are 373 (from 379). Actual create/search branches were migrated without inventing stock, reservation, scheduling or MachineUsage behavior. Application-wide status remains PARTIAL / NO-GO; next is Activities / Quick Log core (9), with activity-parse API (2) separate.

## Stage 13 verified delta (2026-08-01)

The Work Orders / planning row is migrated for `field-operations.ts`: targeted findings 15 → 0. Global active-path findings are now 135 (from 150). Application-wide status remains PARTIAL / NO-GO; Activities, Finance, offline, scouting/photo, AI/API and other legacy consumers remain.

## Stage 12 inventory update

The 150 remaining findings now have machine-readable production reachability and family classifications. Of these, 146 are active production targets and four belong to the development demo action. Thirty-four active findings forward raw technical/framework text. No runtime migration occurred. Next batch: 15 Work Order operational findings in `src/lib/actions/field-operations.ts`.

Date: 2026-08-01

## Classification

This is Case A with a broad migration boundary. FarmOS already had a shared `user-error.ts`, a four-locale `errors` namespace, server actions, API responses, offline recovery and photo-upload failures. The former shared mapper masked Prisma errors but forwarded arbitrary application `Error.message` text. Application-wide migration is too broad for one safe rewrite, so Stage 11 delivers a bounded shared-contract and Onboarding slice.

## Baseline and method

- Global resolver baseline: 415 findings.
- The new focused `npm run i18n:audit -- user-errors` scans active server actions, route handlers, offline code and client render paths for raw caught/framework text and final English error responses.
- Reconstructed active baseline before the Onboarding migration: 158 findings.
- Final active count: 150 findings across 114 scanned production files.

## Active inventory

| Area | Origin and caller | Current risk | Category / retry | Stage 11 disposition |
|---|---|---|---|---|
| Shared action mapper | `src/lib/user-error.ts`; 29 action catch paths | Legacy compatibility text can still pass application-authored English | mixed | Canonical classifier added; legacy string explicitly retained only for unmigrated callers |
| Onboarding | farm, optional inventory and employee actions → OnboardingWizard | raw Zod field prose and English catch/auth text | validation/auth/not-found; non-retryable except database | Migrated to stable codes and localized field association |
| Activities / Quick Log | activity actions and dialog | English validation/conflict and some raw API text | validation/conflict/provider | Active, not migrated |
| Work Orders / planning | field-operation actions/forms | final English validation, stock and state conflicts | validation/conflict | Active, not migrated |
| Finance / allocations | economics/reallocation actions/forms | raw Zod issue text and many domain errors | validation/not-found/conflict/database | Active, not migrated |
| Offline / sync | sync routes, IndexedDB recovery and queue UI | raw local migration/storage and retry messages | offline/sync/conflict | Active, not migrated |
| Scouting photos | upload/annotation/suggestion routes and clients | provider/policy detail and raw caught messages | validation/provider/conflict | Active, not migrated |
| AI/transcription | parse/transcribe routes and dialog | English provider/rate/unsupported responses | provider/rate-limit/unsupported | Active, not migrated |
| Error boundary | farm route error UI | renders runtime `error.message` | unexpected | Active, not migrated |

## Security findings

Prisma errors continue to be masked. The canonical mapper never serializes raw messages, stack traces, provider bodies, SQL, constraint names, tokens or foreign-farm IDs. Ownership-shaped failures keep internal `authorization` observability but present canonical `NOT_FOUND`, preserving existence-hiding semantics. No database migration or historical record rewrite is required.

## Conclusion

Shared contract and Onboarding migration: GO. Application-wide user-error localization: PARTIAL / NO-GO with 150 measured findings remaining.
