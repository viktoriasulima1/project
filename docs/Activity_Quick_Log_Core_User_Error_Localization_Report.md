# Activities / Quick Log Core User Error Localization Report — Stage 15

Date: 2026-08-02

## Decision

**Activities / Quick Log core user-error migration — full bounded batch GO.**

**Application-wide user-error migration — still PARTIAL / NO-GO.**

Next bounded batch: activity-parse API error boundary (2 findings). Stage 15 does not claim full Activities UI, Sync Center, AI/transcription/provider, or application-wide localization.

## Exact scope and audit

The pre-change inventory contained exactly nine findings: six in `src/lib/actions/activities.ts`, one in `src/lib/actions/quick-log.ts`, and two overlapping raw-catch findings in `src/components/activities/ActivityDialog.tsx`. All nine are zero after migration. The two findings in `src/app/api/ai/activity-parse/route.ts` remain open and unchanged.

| Audit | Before | After | Delta |
|---|---:|---:|---:|
| Stage 15 target | 9 | 0 | -9 |
| Activity-parse API exclusion | 2 | 2 | 0 |
| Global active user errors | 131 | 122 | -9 |
| Global resolver findings | 373 | 367 | -6 |

The audit-first consumer and behavior inventory is in `Activity_Quick_Log_Core_User_Error_Audit.md`.

## Contract and behavior

- Activity validation, authentication, not-found, stock, idempotency and unknown failures return structured `UserFacingError`. Raw Zod, Prisma, SQL, caught messages, stack traces, ownership details and provider text are not rendered.
- Quick Log setup/authentication returns `AUTH_REQUIRED`; its existing consumer localizes through the shared adapter.
- ActivityDialog uses canonical codes for local validation, action failures, AI parse failures and offline conflicts. Controls use `aria-describedby`, the summary receives focus, and entered values/local drafts remain intact.
- Offline sync keeps wire compatibility through a safe English API adapter. The UI maps authorization to non-enumerating `NOT_FOUND`, stock to `INSUFFICIENT_STOCK`, validation/schema to `INVALID_VALUE`, and true conflicts to `SYNC_CONFLICT`.
- Reused codes include `AUTH_REQUIRED`, `REQUIRED_FIELD`, `INVALID_ENUM`, `INVALID_VALUE`, `INVALID_QUANTITY`, `INVALID_DATE`, `NOT_FOUND`, `INSUFFICIENT_STOCK`, `SYNC_CONFLICT`, `AI_REQUIRES_CONNECTION`, `OFFLINE_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, and `RATE_LIMITED`. No persistence schema or canonical option changed.
- Every reused contract renders in `nl-NL`, `en-GB`, `pl-PL`, and `de-DE` through the shared adapter.

## Compatibility and security

Characterization tests preceded runtime changes. Authentication and validation failures still stop before transactions and create no Activity, StockMovement, ComplianceRecord, audit event, or Work Order side effect. Transaction, reservation, inventory deduction/restoration, compliance snapshot, correction/reversal, idempotency and farm-scoping logic was not changed.

Cross-farm browser tests submit real foreign product, machine and field-season IDs. The server rejects all three, the UI shows only localized `NOT_FOUND`, and neither ownership prose nor the identifier appears. A regression-discovered presentation defect that collapsed authorization into `SYNC_CONFLICT` was fixed without weakening the server boundary.

Work Order regression proves exact-one completion, reservation consumption/release and one offline replay result. Offline regression proves a local draft synchronizes once and the Service Worker does not cache API responses. The clean suite reported no IndexedDB/Service Worker leakage or duplicate Activity, StockMovement, ComplianceRecord, or Work Order completion.

Natural-language parsing remains draft-only. Injection, HTML, fake-ID and oversized-input coverage confirms no Activity is created. The two activity-parse API responses are explicitly deferred.

## Automated validation

| Gate | Result |
|---|---|
| Prisma generate/status | PASS; 22 migrations; schema current |
| i18n validate | PASS; 4 locales, 9 namespaces; one pre-existing Dutch economics warning |
| option-value audit | PASS |
| TypeScript | PASS |
| Unit tests | 1014/1014 PASS across 94 files |
| Production build | PASS; existing NFT tracing warning only |
| Focused Stage 15 E2E | 6/6 PASS including setup; 5/5 browser scenarios; 1.2 min; retries=0 |
| Relevant regression | 38/38 PASS; 4.8 min; retries=0 |
| Corrected legacy assertions | 16/16 PASS; 2.2 min; retries=0 |
| Final full E2E | 195 collected; 194 passed; 1 documented conditional skip; 0 failed/flaky; 22 min 17 s; workers=1; retries=0; exit 0 |

The first full run classified two failures as test defects: both asserted English strings intentionally removed by Stage 15. Their focused rerun passed 16/16, followed by the clean full rerun. An earlier regression exposed three stale cross-farm assertions and the real presentation defect above; the final regression rerun passed 38/38.

Clerk reference before Stage 15 was 5 total / 4 configured fixed-pool users. Read-only preflight confirmed four identities configured and Clerk reachable. Every setup reused fixed identities; no throwaway-user path ran and no new-user creation was reported. A destructive-named cleanup command was not used as a counting mechanism, so no independent post-run tenant-wide recount is claimed.

## Physical-device and final status

No physical iPhone or Android validation occurred. Chromium covers the 390×844 layout, but physical touch, keyboard, assistive technology and network transitions remain unverified.

Global debt remains 122 active user-error and 367 resolver findings. Therefore Stage 15 is bounded GO, while application-wide localization remains NO-GO. Confirmed next batch: activity-parse API error boundary — 2 findings.
