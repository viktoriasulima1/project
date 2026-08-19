# Canonical user-facing error contract

## Stage 18 usage — 2026-08-08

The Offline Sync Center routes, IndexedDB repository and queue UI now use the canonical structured contract. `REQUEST_NOT_ALLOWED` is the shared non-revealing authorization code. Drafts persist additive `safeError`; legacy `safeErrorMessage` remains readable only for migration compatibility and is never trusted or rendered as final prose. The bounded audit moved 10 → 0; see `Offline_Sync_Center_User_Error_Localization_Report.md`.

## Stage 16 usage

`POST /api/ai/activity-parse` uses the shared shape for `INVALID_VALUE`/400 (`field: text`) and `RATE_LIMITED`/429. Safe correlation IDs reveal no input/provider/framework details; provider failure remains deterministic fallback.

## Stage 15 usage

Activities and Quick Log now return this structured contract end-to-end. Action code never owns translated prose; ActivityDialog, ActivitiesClient and QuickLogButton localize codes through the shared adapter. Unknown caught text is logged server-side and masked.

## Stage 13 extension (2026-08-01)

Work Order actions now use this contract directly. Added validation codes are `INVALID_PLAN_ITEM`, `INVALID_WORK_ORDER`, `WORK_WINDOW_INVALID`, and `INVENTORY_SELECTION_REQUIRED`; existing `NOT_FOUND`, `INSUFFICIENT_STOCK`, `WORK_ORDER_COMPLETED`, and `GENERIC` cover the real remaining branches. Safe stock metadata is limited to requested/available quantities. Direct consumers no longer use the deprecated string field.

## Domain shape

```ts
type UserFacingError = {
  code: SafeErrorCode;
  category: UserErrorCategory;
  retryable: boolean;
  field?: string;
  metadata?: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  correlationId?: string;
};
```

Expected failures are returned as data. Unexpected exceptions remain logged at the server boundary and are converted to `GENERIC`. New code must not use the legacy `message` compatibility field.

## Responsibilities

- Domain/server: choose code/category/retryability and only safe metadata.
- UI: call `buildUserErrorDisplayModel`, render localized title/message/actions, use `role="alert"` or a live region, and associate field errors with `aria-describedby`.
- API routes: future migrations should return `{ ok: false, error: UserFacingError }` with the existing meaningful HTTP status.

## Safe metadata

Permitted examples are minimum, maximum, expected unit, allowed canonical values, retry-after seconds, maximum bytes and pending count. SQL, ORM/provider bodies, tokens, cookies, storage keys/URLs, secret configuration, foreign-farm IDs and private notes are forbidden.

## Unknown and security policy

Unknown runtime input becomes localized `GENERIC`; raw codes are never a visible fallback. An ownership failure may retain internal authorization categorization, but the external code remains `NOT_FOUND` where existence hiding applies.

## Legacy boundary

`handleActionError` still returns a deprecated compatibility `message` for unmigrated actions. The focused audit enumerates those paths. Removal of that field is the application-wide completion gate.
# Stage 14 U2 update (2026-08-01)

Inventory and Machine create/search actions now return the shared structured contract, including safe field errors, authentication/rate/provider classifications and correlation IDs for unexpected failures. Submitted Inventory values are returned only for form recovery; raw caught/Zod/Prisma text is never serialized. U2 target: 4 → 0. Global active debt: 131.
