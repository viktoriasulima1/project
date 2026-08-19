import type { SafeErrorCategory } from './types';
import { isSafeErrorCode } from '@/i18n/error-codes';
import { userError, type UserFacingError } from '@/lib/user-error';

export class OfflineSyncError extends Error {
  constructor(
    message: string,
    public readonly category: SafeErrorCategory,
    public readonly retryable: boolean,
    public readonly safeError: UserFacingError = userError('GENERIC'),
  ) { super(message); }
}

export function classifySyncResponse(status: number, body?: { category?: SafeErrorCategory; error?: unknown }): OfflineSyncError {
  const structured = body?.error && typeof body.error === 'object' ? body.error as Partial<UserFacingError> : null;
  const trusted = structured && isSafeErrorCode(structured.code)
    ? userError(structured.code, {
        field: typeof structured.field === 'string' ? structured.field : undefined,
        metadata: structured.metadata && typeof structured.metadata === 'object' ? structured.metadata : undefined,
        correlationId: typeof structured.correlationId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(structured.correlationId) ? structured.correlationId : undefined,
      })
    : null;
  const category = body?.category ?? (trusted?.category === 'authorization' || trusted?.category === 'authentication' || trusted?.category === 'not_found' ? 'authorization' : trusted?.category === 'conflict' ? 'conflict' : trusted?.category === 'validation' ? 'validation' : status === 401 || status === 403 ? 'authorization' : status === 409 ? 'conflict' : status >= 500 ? 'server' : 'validation');
  const retryable = category === 'network' || category === 'timeout' || category === 'server';
  const safeError = trusted ?? (category === 'authorization' ? userError('NOT_FOUND') : category === 'conflict' || category === 'insufficient_stock' || category === 'stale_reference' || category === 'schema' ? userError('SYNC_CONFLICT') : category === 'validation' ? userError('INVALID_VALUE') : userError('GENERIC'));
  return new OfflineSyncError('Offline synchronization failed.', category, retryable, safeError);
}
