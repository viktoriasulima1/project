import type { LocalActivityDraft, SafeErrorCategory } from './types';
import { userError, type UserFacingError } from '@/lib/user-error';

const NON_RETRYABLE = new Set<SafeErrorCategory>([
  'authorization', 'validation', 'conflict', 'insufficient_stock', 'stale_reference', 'schema',
]);

export function requiresReview(category: SafeErrorCategory): boolean {
  return NON_RETRYABLE.has(category);
}

export function markConflict(draft: LocalActivityDraft, category: SafeErrorCategory, error: UserFacingError | string = userError('SYNC_CONFLICT')): LocalActivityDraft {
  const safeError = typeof error === 'string' ? userError(category === 'authorization' ? 'NOT_FOUND' : 'SYNC_CONFLICT') : error;
  return {
    ...draft,
    status: 'conflict',
    safeErrorCategory: category,
    safeErrorMessage: undefined,
    safeError,
    conflictMetadata: { category, message: safeError.code },
    updatedAt: new Date().toISOString(),
  };
}
