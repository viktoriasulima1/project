import type { Prisma, AuditAction, AuditActorType, AuditSource } from '@prisma/client';
import { randomUUID } from 'node:crypto';

type TxClient = Prisma.TransactionClient;

export interface AuditEventInput {
  farmId: string;
  /** The Clerk user id who performed the action, or null for a system/API
   * actor with no human in the loop. Never a session token or JWT — see
   * assertSafeMetadata below for the same rule applied to metadata. */
  actorUserId: string | null;
  actorType?: AuditActorType;
  entityType: string;
  entityId: string;
  action: AuditAction;
  source: AuditSource;
  correlationId: string;
  previousVersionId?: string | null;
  reason?: string | null;
  /** Small, structured, explicitly-named fields only — never a spread of a
   * raw form payload, DB row, or request object (Sprint 19 Part 15). */
  metadata?: Record<string, string | number | boolean | null>;
}

const SCHEMA_VERSION = 1;

// Defense in depth: even though every call site in this codebase passes a
// small, explicitly-named metadata object (never a raw spread), this guard
// catches an accidental token/secret ending up in one of those fields
// before it ever reaches the database.
const FORBIDDEN_METADATA_KEY = /token|secret|password|clerk_?session|authoriz|cookie|api[_-]?key/i;
const SECRET_LOOKING_VALUE = /^(sk_[a-z]+_|pk_live_|eyJ[a-zA-Z0-9_-]{10,}\.)/;

export function assertSafeMetadata(metadata: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEY.test(key)) {
      throw new Error(`Refusing to write audit metadata key "${key}" — looks like a secret/token field.`);
    }
    if (typeof value === 'string' && SECRET_LOOKING_VALUE.test(value)) {
      throw new Error(`Refusing to write audit metadata — value for "${key}" looks like a secret key or JWT.`);
    }
  }
}

/** A fresh id for one business transaction (one correction, one reversal,
 * one export request, ...) — pass the SAME value to every AuditEvent and
 * StockMovement created as part of that one transaction, so they can later
 * be queried together (Sprint 19 Part 2: "preserve a correlationId across
 * one business transaction"). */
export function newCorrelationId(): string {
  return randomUUID();
}

/**
 * Writes one append-only audit event, inside the SAME database transaction
 * as the entity mutation it describes — either both commit or neither does.
 * Never call this outside a transaction for a mutating action; read-only
 * actions (e.g. viewing a record) do not get an audit event at all.
 *
 * There is deliberately no `updateAuditEvent`/`deleteAuditEvent` exported
 * from this module, and none anywhere else in this codebase (grep-verified)
 * — application-level append-only enforcement. The database itself also
 * refuses UPDATE/DELETE on `audit_events` via a trigger (see the Sprint 19
 * migration and docs/AUDIT_TRAIL_ARCHITECTURE.md) — this function is not
 * the only thing standing between the app and a mutated audit event.
 */
export async function recordAuditEvent(tx: TxClient, input: AuditEventInput): Promise<void> {
  const metadata = input.metadata ?? {};
  assertSafeMetadata(metadata);

  await tx.auditEvent.create({
    data: {
      farmId: input.farmId,
      actorUserId: input.actorUserId,
      actorType: input.actorType ?? 'farmer',
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      source: input.source,
      correlationId: input.correlationId,
      previousVersionId: input.previousVersionId ?? null,
      reason: input.reason ?? null,
      metadataJson: { schemaVersion: SCHEMA_VERSION, ...metadata },
    },
  });
}
