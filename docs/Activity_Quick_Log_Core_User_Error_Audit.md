# Activity / Quick Log Core User Error Audit — Stage 15

Date: 2026-08-02. This audit was completed before Stage 15 runtime changes.

## Exact evidence scope

The post-Stage-14 evidence matches the roadmap exactly: nine active findings, split `6 + 1 + 2`. The two findings in `src/app/api/ai/activity-parse/route.ts` are explicitly excluded and remain open for the next API-boundary stage.

| File / line | Function or path | Current outward text/shape | Consumer | Family | Proposed contract | Recovery |
|---|---|---|---|---|---|---|
| `src/lib/actions/activities.ts:113` | `createActivity` schema failure | raw Zod `flatten().fieldErrors`; `Record<string,string[]>` | `ActivityDialog`; offline sync route | validation/raw forwarding | field-specific `REQUIRED_FIELD`, `INVALID_ENUM`, `INVALID_DATE`, `INVALID_QUANTITY`, `INVALID_VALUE`; non-retryable; safe `field` metadata only | correct the associated field |
| `src/lib/actions/activities.ts:120` | `createActivity` farm lookup | `Farm not found. Please complete onboarding.`; `error: string` | dialog/offline sync | authentication | existing `AUTH_REQUIRED`; non-retryable; no farm metadata | sign in / complete setup |
| `src/lib/actions/activities.ts:141` | pre-transaction idempotency check | `This offline submission key was already used with different activity data.` | offline sync and dialog queue | conflict | existing `SYNC_CONFLICT`; non-retryable; no draft key in metadata | review retained local draft |
| `src/lib/actions/activities.ts:492` | concurrent idempotency recovery | `This offline submission key conflicts with different activity data.` | offline sync and dialog queue | conflict | existing `SYNC_CONFLICT`; non-retryable; no draft key in metadata | review retained local draft |
| `src/lib/actions/activities.ts:536` | `deleteActivity` farm lookup | `Farm not found.` | `ActivitiesClient` | authentication | existing `AUTH_REQUIRED`; non-retryable | sign in |
| `src/lib/actions/activities.ts:622` | `completeActivity` farm lookup | `Farm not found.` | `ActivitiesClient` | authentication | existing `AUTH_REQUIRED`; non-retryable | sign in |
| `src/lib/actions/quick-log.ts:27` | `getQuickLogOptions` farm/context lookup | `Set up your farm before recording an activity.` | `QuickLogButton` toast | authentication | existing `AUTH_REQUIRED`; non-retryable | sign in / complete setup |
| `src/components/activities/ActivityDialog.tsx:260` | AI description client catch/render | raw caught `error.message` rendered by `role=alert` | Activity dialog language-entry step | generic/provider display | structured `AI_REQUIRES_CONNECTION`, `PROVIDER_UNAVAILABLE`, `INVALID_VALUE` or safe `GENERIC`; never response/body/caught text | retry online or use reviewed manual form |
| same line, second audit rule | same path | raw framework/caught forwarding | same | raw technical forwarding | same structured display boundary through `buildUserErrorDisplayModel` | same |

All nine overlap the resolver audit at their action/component boundaries. The user-error completion filter is authoritative for the exact count; resolver prose elsewhere in `activities.ts`, Quick Log UI, the offline sync API and general Activity UI remains separate debt unless a compile-only compatibility change is necessary.

## Actual behavior characterized

`createActivity` validates canonical form values, derives the active farm on the server, checks offline/idempotency receipts before and inside one transaction, then performs the existing field/farm, Work Order, product, machine, fuel, stock, Ctgb, compliance, economics and audit operations. Identical replay returns the original Activity receipt; a different payload for the same receipt is rejected. Known transaction failures already include existence-hiding, insufficient stock and Work Order exact-one conditions. Stage 15 must change only their outward result representation.

`deleteActivity` handles planned-record removal and rejects regulated completed records through the existing reversal policy. `completeActivity` performs the existing one-way planned-to-completed transaction. Both already scope the Activity query through the active farm. Nonexistent and foreign-farm IDs therefore remain indistinguishable.

`getQuickLogOptions` is read-only. It lazily returns the same farm-scoped context used by the full form; no Activity, StockMovement, reservation, ComplianceRecord, Work Order completion or AuditEvent can be created by this action.

`ActivityDialog` keeps form fields in React state and local drafts in the existing offline namespace. The targeted raw catch is confined to the optional AI-description panel. Stage 15 will structure only its display boundary and will not modify the activity-parse API, parser, transcription API or provider behavior.

## Consumers, tests and dependency boundaries

- Direct production consumers: `ActivityDialog`, `QuickLogButton`, `ActivitiesClient`, and the existing offline sync route compatibility boundary.
- Existing unit characterization: `src/lib/actions/__tests__/activities.test.ts` covers create success, validation, idempotent receipt/conflict, farm/field/product/machine scope, stock, planned/completed behavior and transactional side effects. Quick Log has no dedicated action test at baseline.
- Existing browser characterization: Sprint 23 Work Order lifecycle, Work Order user errors, Sprint 20 offline sync, Sprint 16 close-the-loops, Inventory/Machines errors, field-action reasons, golden/failure paths and locale hydration.
- Stage 13 codes remain authoritative for Work Order/stock behavior; Stage 14 Inventory/Machines contracts and canonical values remain unchanged.
- The two `activity-parse` API findings, transcription/provider errors, application-wide Sync Center and full Activity UI localization are excluded.

## Security and safe metadata

No foreign farm, field, Activity, Work Order, product or machine identity may enter outward metadata. Validation metadata is limited to canonical field names and, only where already inherent to the schema, canonical bounds/allowed values. Offline draft IDs, idempotency keys, farmer notes, transcript text, cookies, tokens and database details are never returned as diagnostic metadata. Unexpected failures use a fresh correlation ID and retain detailed diagnostics server-side.
