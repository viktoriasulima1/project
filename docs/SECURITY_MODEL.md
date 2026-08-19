# FarmOS security model

## Stage 18 offline error disclosure

Offline sync authorization uses a non-revealing canonical error, safe correlation IDs and allow-listed metadata. Cross-user/cross-farm identifiers, parser details, stack traces and raw provider/framework messages are neither returned as final UI prose nor persisted as trusted draft errors. Fixed-pool browser validation created no Clerk users.

## Stage 16 activity-parse errors

Auth/farm resolution precedes parsing, no farm/entity IDs are accepted, lookups remain farm-scoped, and foreign existence or provider/framework diagnostics are not exposed. Consumer metadata is allow-listed.

## Stage 15 activity errors

Foreign product, machine and field-season identifiers render only localized `NOT_FOUND`; ownership detail, caught/Zod/Prisma text and submitted IDs are not displayed. Offline transport categories are mapped without trusting or rendering server message text.

## Stage 13 Work Order errors (2026-08-01)

Nonexistent, inaccessible and foreign-farm Work Order-related records remain outwardly indistinguishable as `NOT_FOUND`. Responses contain no foreign IDs, ownership detail, Prisma constraints, SQL, stack, transaction text or private payload. Unknown exceptions are logged server-side with a correlation ID and returned as safe `GENERIC`.

## User-facing error boundary (Stage 11)

Canonical errors never contain raw Prisma/Zod/Clerk/provider messages, stack traces, SQL, tokens, secret configuration or foreign-farm identifiers. Unknown runtime errors become `GENERIC`. Ownership failures may be classified internally for observability but remain externally `NOT_FOUND` where the existing policy hides record existence. The application-wide legacy error migration is incomplete and remains a security hardening NO-GO with 150 measured findings.
# Stage 14 U2 security note (2026-08-01)

Inventory/Machine action failures no longer forward raw Zod, Prisma, database or caught messages. Unexpected failures expose only the canonical safe error plus correlation ID; farm identity remains server-derived and foreign-farm IDs/names are not included in metadata.
