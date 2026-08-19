# User Error Resolver Audit

## Stage 16 update

Activity Parse API target is zero; user-error debt moved 122 → 120 and resolver debt stayed 367, with no overlap or suppression.

## Stage 15 update

The exact Activities / Quick Log core target is zero. Global resolver debt moved 373 → 367; global user-error debt moved 131 → 122. Activity-parse API remains 2 and was not included.

## Stage 13 verified delta (2026-08-01)

Regenerated evidence records 135 user-error findings and 379 resolver findings. The bounded `field-operations.ts` target is zero with no suppression. Work Order unknown exceptions map to safe `GENERIC`; recognized stock/completion/not-found conditions use stable codes.

## Stage 12 inventory update

Structured evidence confirms the audit remains 150: 96 active server-action, 41 active API, six active UI, three active offline-sync and four development-only findings. Application-wide completion remains NO-GO. See `Remaining_Resolver_Debt_Inventory.md`.

Date: 2026-08-01

## Contract audit

`src/lib/user-error.ts` now defines a language-independent `UserFacingError` with:

- stable `code`;
- explicit `category`;
- accurate `retryable` flag;
- optional field, safe metadata and correlation ID.

The pure `classifyError` maps only recognized safe conditions. Unknown errors become `GENERIC`; Prisma P2002 maps to the existing conflict code and other Prisma failures to `DATABASE_UNAVAILABLE`. Raw messages and stacks are not included in the canonical result.

## Preserved behaviour

- No validation rule, farm scope, transaction, idempotency, exact-one rule, retry policy or rate limit changed.
- Foreign-farm ownership failures still look like not-found to the farmer.
- Existing legacy action consumers retain their former application-authored string behaviour until individually migrated; Prisma/non-Error values remain masked.
- No historical audit/sync records were rewritten.

## Audit result

- Targeted active user-error findings: reconstructed 158 → 150.
- Targeted completion gate: NOT MET; required final is zero.
- Global resolver findings: 415 → 402.
- No audit suppressions were added.

The focused audit intentionally fails while debt remains. This is evidence for PARTIAL/NO-GO, not a broken audit gate.
# Stage 14 U2 closure (2026-08-01)

The Inventory/Machines resolver overlap is 6 → 0. Global resolver findings are 379 → 373 and global active user-error findings are 135 → 131. No suppression or compatibility shim hides a targeted finding.
