import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyError, handleActionError, userError } from '../user-error';

describe('canonical user error contract', () => {
  it('builds stable definitions with accurate retryability', () => {
    expect(userError('REQUIRED_FIELD', { field: 'name' })).toEqual({
      code: 'REQUIRED_FIELD', category: 'validation', retryable: false, field: 'name',
    });
    expect(userError('PROVIDER_UNAVAILABLE').retryable).toBe(true);
    expect(userError('SYNC_CONFLICT').retryable).toBe(false);
  });

  it('maps known Prisma conditions without leaking ORM detail', () => {
    const unique = Object.assign(new Error('Unique constraint failed on clerkUserId'), { code: 'P2002' });
    const other = Object.assign(new Error('Invalid `db.farm.create()` invocation at db.example'), { code: 'P2025' });
    expect(classifyError(unique)).toMatchObject({ code: 'SEASON_ALREADY_EXISTS', category: 'conflict' });
    expect(classifyError(other)).toMatchObject({ code: 'DATABASE_UNAVAILABLE', category: 'database' });
    expect(JSON.stringify(classifyError(other))).not.toMatch(/db\.farm|db\.example|P2025/);
  });

  it('preserves hidden-existence semantics as NOT_FOUND', () => {
    expect(classifyError(new Error('Product does not belong to this farm.'))).toMatchObject({
      code: 'NOT_FOUND', category: 'authorization', retryable: false,
    });
    expect(classifyError(new Error('Record not found.'))).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('maps real conflict, stock, auth and provider conditions', () => {
    expect(classifyError(new Error('This work order already has an actual activity.')).code).toBe('WORK_ORDER_COMPLETED');
    expect(classifyError(new Error('Insufficient stock for product.')).code).toBe('INSUFFICIENT_STOCK');
    expect(classifyError(new Error('Sign in required.')).code).toBe('AUTH_REQUIRED');
    expect(classifyError(new Error('Photo storage provider unavailable.')).code).toBe('PROVIDER_UNAVAILABLE');
    expect(classifyError(new Error('Offline visit conflict requires review.')).code).toBe('SYNC_CONFLICT');
  });

  it('never forwards an unknown Error message, stack, or thrown value', () => {
    const raw = new Error('secret provider body with token abc');
    raw.stack = 'private stack';
    expect(classifyError(raw, 'corr-safe')).toEqual({
      code: 'GENERIC', category: 'unexpected', retryable: true, correlationId: 'corr-safe',
    });
    expect(classifyError('raw sql')).toMatchObject({ code: 'GENERIC' });
  });

  it('keeps only explicitly supplied safe metadata', () => {
    expect(userError('INVALID_AREA', { metadata: { minimum: 0, maximum: 99999, expectedUnit: 'ha' } })).toMatchObject({
      metadata: { minimum: 0, maximum: 99999, expectedUnit: 'ha' },
    });
  });

  it('marks authentication and database retryability accurately', () => {
    expect(userError('AUTH_REQUIRED').retryable).toBe(false);
    expect(userError('DATABASE_UNAVAILABLE').retryable).toBe(true);
  });
});

describe('handleActionError legacy boundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs diagnostics server-side and masks Prisma detail at the compatibility boundary', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = Object.assign(new Error('raw prisma detail'), { code: 'P2025' });
    const result = handleActionError('testAction', raw, 'corr-1');
    expect(consoleSpy).toHaveBeenCalledWith('[testAction]', raw);
    expect(result).toMatchObject({ code: 'DATABASE_UNAVAILABLE', category: 'database', retryable: true, correlationId: 'corr-1' });
    expect(result.message).not.toContain('raw prisma detail');
  });
});
