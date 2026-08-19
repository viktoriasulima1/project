# Activity Parse API User Error Audit — Stage 16

Date: 2026-08-03

## Verified boundary before runtime changes

The fresh user-error evidence and route inspection confirm exactly two active findings, both in `POST /api/ai/activity-parse`. There is no resolver-audit overlap because the route is outside `src/lib`. Transcription, Activity actions, Quick Log actions, ActivityDialog and briefing endpoints are excluded.

| Finding | File / line | Branch | Current response | Consumer | Origin | Proposed contract |
|---|---|---|---|---|---|---|
| 1 | `src/app/api/ai/activity-parse/route.ts:21` | `POST`, failed `inputSchema.safeParse` after JSON parse failure, missing/empty/short/oversized text | HTTP 400, `{ "error": "Enter a short description of one activity." }` | `ActivityDialog.parseActivityDescription`; it currently maps any non-401/403/429/5xx status to `INVALID_VALUE` and does not render the body string | Request/Zod validation | `INVALID_VALUE`, category `validation`, retryable `false`, no input echo or schema metadata, optional safe correlation ID only |
| 2 | `src/app/api/ai/activity-parse/route.ts:30` | `POST`, in-memory farm/day limit or persisted user/day limit reached | HTTP 429, `{ "error": "Daily AI parsing limit reached. You can still use the normal Activity form." }` after safe rate-limit metadata row | Same ActivityDialog consumer; it maps 429 to `RATE_LIMITED` | Server-side cost/rate limit | `RATE_LIMITED`, category `rate_limit`, retryable `true`, no farm/user/provider detail, optional safe correlation ID only |

## Existing surrounding behavior

- Authentication/farm resolution occurs before request parsing through `getActiveFarmOrThrow`; Stage 16 does not redesign that shared boundary.
- Invalid JSON is caught and becomes the same 400 validation branch as missing/empty/short/oversized text.
- The schema accepts trimmed text from 3 through 2000 characters. No locale parameter exists.
- Provider failure, timeout or invalid output is deliberately swallowed and retains the deterministic parser result (`mode: rule_based`); it is not an API error branch and must not be converted into 503.
- Entity ambiguity/unresolved field, product or machine, dose conflicts and multi-activity detection are successful draft-review payloads, not error responses.
- Queries are scoped to the authenticated farm. No submitted farm or entity ID is accepted by this route.
- The route never creates an Activity or server-side Activity draft. It writes only `AiRequestMetadata` for observability/rate limiting.
- The successful response contains `candidate`, `resolution`, `workOrders`, `multiActivity`, `mode`, and draft-only safeguards; Stage 16 must preserve it.
- Provider diagnostics are not returned. Observability retains the existing SHA-256 checksum rather than farmer text.

## Characterization plan

Route-level tests will freeze both actual failures plus successful deterministic fallback, provider rejection, scoped entity queries, ambiguity/multi-activity payload preservation, metadata-only persistence and absence of Activity writes or live paid provider calls. Consumer and browser tests will verify canonical response handling, four-locale rendering, input preservation and no automatic submission.
