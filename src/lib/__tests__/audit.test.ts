import { describe, it, expect, vi } from 'vitest';
import * as auditModule from '../audit';
import { recordAuditEvent, assertSafeMetadata, newCorrelationId } from '../audit';

function makeTx() {
  return { auditEvent: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) } };
}

describe('recordAuditEvent', () => {
  it('creates exactly one audit_events row via .create(), never .update() or .delete()', async () => {
    const tx = makeTx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordAuditEvent(tx as any, {
      farmId: 'farm-1', actorUserId: 'user-1', entityType: 'Activity', entityId: 'act-1',
      action: 'completed', source: 'web', correlationId: newCorrelationId(),
    });
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
    // Structural guarantee (Part 2/17 test 3): this module has no update or
    // delete export at all — append-only is enforced by there being no
    // function capable of doing otherwise, not just by convention.
    expect((auditModule as Record<string, unknown>).updateAuditEvent).toBeUndefined();
    expect((auditModule as Record<string, unknown>).deleteAuditEvent).toBeUndefined();
  });

  it('stamps a schemaVersion onto metadataJson', async () => {
    const tx = makeTx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordAuditEvent(tx as any, {
      farmId: 'farm-1', actorUserId: null, entityType: 'Activity', entityId: 'act-1',
      action: 'created', source: 'system', correlationId: 'corr-1', metadata: { activityType: 'spray' },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ metadataJson: expect.objectContaining({ schemaVersion: 1, activityType: 'spray' }) }) }),
    );
  });

  it('preserves correlationId, reason, and previousVersionId exactly as given', async () => {
    const tx = makeTx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordAuditEvent(tx as any, {
      farmId: 'farm-1', actorUserId: 'user-1', entityType: 'Activity', entityId: 'act-2',
      action: 'corrected', source: 'web', correlationId: 'corr-xyz', previousVersionId: 'act-1', reason: 'Dose was wrong.',
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ correlationId: 'corr-xyz', previousVersionId: 'act-1', reason: 'Dose was wrong.' }) }),
    );
  });
});

describe('assertSafeMetadata (Part 15 — sensitive data excluded)', () => {
  it('rejects a metadata key that looks like a secret/token field', () => {
    expect(() => assertSafeMetadata({ sessionToken: 'abc' })).toThrow(/secret\/token/);
    expect(() => assertSafeMetadata({ clerkSessionId: 'abc' })).toThrow();
    expect(() => assertSafeMetadata({ password: 'abc' })).toThrow();
    expect(() => assertSafeMetadata({ apiKey: 'abc' })).toThrow();
  });

  it('rejects a value that looks like a Clerk secret key or a JWT', () => {
    expect(() => assertSafeMetadata({ note: 'sk_live_abcdefghijklmnop' })).toThrow();
    expect(() => assertSafeMetadata({ note: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dummy' })).toThrow();
  });

  it('accepts small, explicit, safe metadata', () => {
    expect(() => assertSafeMetadata({ activityType: 'spray', fieldsChanged: 'dosePerHa,areaHa', significantProductChange: false })).not.toThrow();
  });
});

describe('newCorrelationId', () => {
  it('returns a fresh UUID each call (Part 17 test 2 support — one id shared across one transaction, never reused across transactions)', () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
