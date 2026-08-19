# Activity Parse API User Error Localization Report — Stage 16

Date: 2026-08-03

## Outcome

Activity Parse API error-boundary migration is a full bounded-batch GO. The two audited findings are zero. Application-wide user-error localization remains PARTIAL / NO-GO at 120 active user-error findings and 367 resolver findings.

## Exact scope and contract

Only `POST /api/ai/activity-parse` changed:

| Branch | Before | After | HTTP |
|---|---|---|---|
| malformed JSON, missing/empty/short/oversized `text` | English `{ error: string }` | `{ ok: false, error: UserFacingError(INVALID_VALUE, field=text) }` | 400 unchanged |
| farm/user daily parse limit | English `{ error: string }` | `{ ok: false, error: UserFacingError(RATE_LIMITED) }` | 429 unchanged |

Both responses have safe correlation IDs. They expose no input, Zod detail, provider payload, farm/user ID, stack, secret, or internal configuration. Existing four-locale `errors` translations cover both reused codes with placeholder parity; no duplicate AI-specific code was added.

## Preserved behavior and security

- Authentication and active-farm resolution still run through the shared existence-hiding boundary before parsing. The route accepts no caller-supplied farm/entity ID and all field, product, machine and Work Order queries remain scoped to the authenticated farm.
- Provider rejection, timeout, or invalid output still produces the successful deterministic `rule_based` draft-review response. These are not 503 branches. The successful payload schema is unchanged.
- Ambiguity, unresolved entities, dose review, Work Order candidates and multi-activity detection remain successful review data.
- The route creates no Activity and no server-side Activity draft. Only privacy-safe `AiRequestMetadata` is stored; farmer text is represented by its existing SHA-256 checksum.
- `ActivityDialog` validates the structured code, field and correlation ID before rebuilding a trusted `UserFacingError`; malformed/legacy bodies retain safe status-based compatibility. Entered text is preserved and no response auto-submits an Activity.
- CI used mocks/deterministic test adapters. Paid/live AI calls: 0.

## Automated evidence

| Gate | Result |
|---|---|
| Target audit | 2 → 0 |
| Global user-error audit | 122 → 120 (expected nonzero audit exit) |
| Global resolver audit | 367 → 367 (expected nonzero audit exit) |
| i18n validation | PASS, 4 locales / 9 namespaces; one pre-existing Dutch economics warning |
| option audit | PASS |
| Prisma | generate PASS; 22 migrations, schema current |
| TypeScript | PASS |
| Unit/contract | 1022/1022 PASS in 95 files |
| Focused API E2E | 9/9 PASS, retries=0, about 1.5 minutes |
| Regression E2E | 35/35 PASS, retries=0, 4m 49s |
| Full E2E | 203 collected; 202 passed; 1 documented conditional skip; 0 failed/flaky; retries=0; exit 0; 22m 55s |
| Production build | PASS; existing NFT trace warning only |

Focused coverage includes the real canonical 400 response, all four locales, oversized-input preservation/no Activity creation, deterministic-provider success-schema compatibility, and German mobile layouts at 390×844 and 430×932. Route unit tests additionally prove rate limiting, invalid JSON, provider rejection fallback, farm-scoped queries, safe metadata, and no Activity persistence.

Initial focused failures were test defects only: locale-specific trigger names, the German accessible name, deterministic-test mode expectation, and selecting a hidden desktop trigger on mobile. The final run is clean. Regression emitted transient Clerk development-CDN chunk warnings without a failed test, classified as infrastructure noise.

The fixed Clerk pool remained 4 configured accounts before and after; setup reused/reset those accounts and contains no user-creation path. No new users were created. Separate clean processes reset the isolated E2E database; no IndexedDB or Service Worker leakage, duplicate Activity, automatic draft persistence, or parser-behavior change was observed.

## Remaining validation and roadmap

No physical iPhone/Android run was performed for Stage 16. Native microphone/provider behavior remains outside this batch and physical-device status is unverified.

Next bounded batch: the remaining AI/transcription user-error boundary (4 transcription API findings plus 3 AI briefing-action findings), subject to a fresh exact-scope audit. It must not be merged with provider redesign or parser work.

Final status: **Activity Parse API error-boundary migration — full bounded batch GO. Application-wide user-error migration — still PARTIAL / NO-GO.**
