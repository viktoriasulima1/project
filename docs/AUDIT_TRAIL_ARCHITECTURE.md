# Audit Trail Architecture

## The model

`AuditEvent` (`prisma/schema.prisma`, `audit_events` table) is a single, generic, append-only table covering every regulated action in FarmOS — not one table per entity type.

| Field | Purpose |
|---|---|
| `farmId` | Every event belongs to exactly one farm — never nullable, always the authenticated request's own farm. |
| `actorUserId` | The Clerk user id who performed the action, or `null` for a system/API actor with no human in the loop. |
| `actorType` | `farmer` \| `system` \| `api` — see "Actor model" below for why `farmer` is the only human type today. |
| `entityType` / `entityId` | A generic pointer (`'Activity'`/`'ComplianceRecord'`/`'StockMovement'`/`'ComplianceExport'`, plus the row's own id) — deliberately strings, not a dozen nullable FK columns, so a new entity type never needs a schema change. |
| `action` | One of: `created`, `planned`, `completed`, `corrected`, `reversed`, `archived`, `restored`, `exported`, `verification_status_changed`, `inventory_adjusted`, `compliance_snapshot_created`. |
| `occurredAt` | UTC, always — see "Timezones" below. |
| `source` | `web` \| `mobile_web` \| `quick_log` \| `onboarding` \| `import` \| `system` \| `api` \| `e2e_test`. |
| `previousVersionId` | Optional — the entity's prior version, for entities that don't have their own dedicated versioning column. |
| `correlationId` | Shared by every event produced by one business transaction (see below). |
| `reason` | Optional — the farmer-entered explanation for a correction/reversal. Never required for `created`/`completed`/`exported`. |
| `metadataJson` | `{ schemaVersion: 1, ...safe fields }` — small, explicit, never a raw record dump. See "Privacy" below. |

## Correlation IDs

One correlation id is generated per business transaction (`newCorrelationId()`, `src/lib/audit.ts`) — one call to `createActivity`, `completeActivity`, `correctActivity`, `reverseActivity`, or one export request. Every `AuditEvent` and every `StockMovement` created as part of that one transaction carries the same id, so a reviewer can query `WHERE correlationId = X` and see the whole transaction's consequences — the activity status change, the compliance snapshot, and the inventory adjustment — without having to reconstruct them from separate timestamps.

## Append-only enforcement — two layers

1. **Application-level**: `src/lib/audit.ts` exports `recordAuditEvent()` and nothing else — there is no `updateAuditEvent`/`deleteAuditEvent` function anywhere in this codebase (grep-verified, and asserted by a unit test). Every write goes through `.create()`.
2. **Database-level**: the Sprint 19 migration installs two Postgres triggers on `audit_events` — `audit_events_no_update` unconditionally rejects any `UPDATE`, and `audit_events_guarded_delete` rejects any `DELETE` **unless** the session has explicitly set `app.allow_audit_hard_delete = 'true'` for that transaction. Normal application code never sets this. The one legitimate use is whole-farm teardown (`Farm` cascades onto `AuditEvent`) — this project's own E2E database-reset helpers set the flag inside the same transaction as the farm deletion; nothing else does.

This is deliberately defense in depth: even a future bug, a new script that forgets the rule, or a direct database session cannot silently rewrite or remove audit history through the normal application path.

## Actor model (Part 14)

FarmOS today has one owner per farm (`Farm.clerkUserId`, `@unique`) and no multi-user roles. `actorType: 'farmer'` means "the farm's own signed-in owner"; `'system'`/`'api'` are reserved for actions FarmOS itself takes without a human request (none exist yet this sprint — every action currently implemented is farmer-initiated). **Documented as future work**: when real multi-user roles exist (e.g. a farm employee with a scoped permission set), `actorType` and the authorization checks in every correction/reversal/export action will need to distinguish "owner" from "worker" — right now, anyone who can authenticate as the farm's own Clerk user can correct, reverse, and export, because there is only one such person by construction.

## Timezones

Every timestamp is stored and compared in UTC (`DateTime` columns, `occurredAt` defaults to `now()`). Display-layer formatting (the Compliance page, the PDF/CSV export) renders dates using `Intl`/`toLocaleString('nl-NL')`-style formatting, which the browser or server resolves against the farm's practical timezone (`Europe/Amsterdam`, per `Farm.timezone`'s default) — the stored value itself never changes; only how it's displayed does.

## Privacy (Part 15)

`assertSafeMetadata()` (`src/lib/audit.ts`) rejects any metadata key matching a secret/token/password/session/cookie/API-key pattern, and any string value shaped like a Clerk secret key or a JWT, before it ever reaches the database. Every real call site in this codebase passes a small, explicitly-named object (e.g. `{ activityType, fieldsChanged, significantProductChange }`) — never a spread of a raw form payload, a full Prisma row, or a request object. `reason`/`correctionReason` are farmer-authored free text stored in their own dedicated column, not `metadataJson` — they are expected to describe what changed, not to contain secrets, and are treated the same way any other farmer-entered text field in this app is.

Employee/operator certificate numbers are masked (`maskCertificateNumber`, `src/lib/pii-masking.ts`) wherever a human reads them in the PDF export — showing only the last 4 characters. The CSV export deliberately has no certificate-number column at all.

## What this sprint does not do

- No multi-user roles or granular permissions (see "Actor model" above).
- No statutory retention duration is invented — see `docs/COMPLIANCE_RECORD_CORRECTION_POLICY.md`'s "Audit retention" section.
- No offline sync.
- Correction/reversal is scoped to `type === 'spray'` activities only this sprint — see `docs/COMPLIANCE_RECORD_CORRECTION_POLICY.md`.
