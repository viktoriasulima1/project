import type { SafeErrorCode } from '@/i18n/error-codes';
import { translateErrorCode } from '@/i18n/error-codes';

export type UserErrorCategory =
  | 'authentication'
  | 'validation'
  | 'not_found'
  | 'authorization'
  | 'permission'
  | 'conflict'
  | 'offline'
  | 'rate_limit'
  | 'provider_unavailable'
  | 'database'
  | 'unexpected';

/** @deprecated Product-event compatibility while action consumers migrate. */
export type ErrorCategory = UserErrorCategory;

export type UserErrorMetadata = Readonly<Record<string, string | number | boolean | readonly string[]>>;

export interface UserFacingError {
  code: SafeErrorCode;
  category: UserErrorCategory;
  retryable: boolean;
  field?: string;
  metadata?: UserErrorMetadata;
  correlationId?: string;
}

export type LegacyUserFacingError = UserFacingError & { message: string };

type ErrorDefinition = Pick<UserFacingError, 'category' | 'retryable'>;

const DEFINITIONS: Record<SafeErrorCode, ErrorDefinition> = {
  GENERIC: { category: 'unexpected', retryable: true },
  REQUIRED_FIELD: { category: 'validation', retryable: false },
  INVALID_ENUM: { category: 'validation', retryable: false },
  INVALID_VALUE: { category: 'validation', retryable: false },
  INVALID_QUANTITY: { category: 'validation', retryable: false },
  INVALID_DATE: { category: 'validation', retryable: false },
  CTGB_PRODUCT_UNVERIFIED: { category: 'provider_unavailable', retryable: true },
  RATE_LIMITED: { category: 'rate_limit', retryable: true },
  INVALID_PLAN_ITEM: { category: 'validation', retryable: false },
  INVALID_WORK_ORDER: { category: 'validation', retryable: false },
  WORK_WINDOW_INVALID: { category: 'validation', retryable: false },
  INVENTORY_SELECTION_REQUIRED: { category: 'validation', retryable: false },
  NOT_FOUND: { category: 'not_found', retryable: false },
  CONDITION_REQUIRED: { category: 'validation', retryable: false },
  LOCATION_TOO_LOW: { category: 'validation', retryable: true },
  PHOTO_LOCAL_ONLY: { category: 'offline', retryable: true },
  WORK_ORDER_COMPLETED: { category: 'conflict', retryable: false },
  OPERATOR_CERTIFICATE_EXPIRED: { category: 'validation', retryable: false },
  OPERATOR_NOT_CERTIFIED: { category: 'validation', retryable: false },
  INVALID_CTGB_USE: { category: 'validation', retryable: false },
  INSUFFICIENT_STOCK: { category: 'conflict', retryable: false },
  PRODUCT_ALREADY_EXISTS: { category: 'conflict', retryable: false },
  PRODUCT_NOT_APPROVED: { category: 'validation', retryable: false },
  AI_REQUIRES_CONNECTION: { category: 'offline', retryable: true },
  OFFLINE_UNAVAILABLE: { category: 'offline', retryable: true },
  PROVIDER_UNAVAILABLE: { category: 'provider_unavailable', retryable: true },
  UPLOAD_FAILED: { category: 'provider_unavailable', retryable: true },
  SYNC_CONFLICT: { category: 'conflict', retryable: false },
  DRAFT_SAVED_LOCALLY: { category: 'offline', retryable: true },
  AUTH_REQUIRED: { category: 'authentication', retryable: false },
  REQUEST_NOT_ALLOWED: { category: 'authorization', retryable: false },
  FARM_NAME_REQUIRED: { category: 'validation', retryable: false },
  INVALID_FARM_TYPE: { category: 'validation', retryable: false },
  INVALID_AREA: { category: 'validation', retryable: false },
  INVALID_COORDINATES: { category: 'validation', retryable: false },
  SEASON_REQUIRED: { category: 'validation', retryable: false },
  SEASON_ALREADY_EXISTS: { category: 'conflict', retryable: false },
  FIELD_NAME_REQUIRED: { category: 'validation', retryable: false },
  INVALID_FIELD_AREA: { category: 'validation', retryable: false },
  INVALID_SOIL_TYPE: { category: 'validation', retryable: false },
  INVALID_CROP: { category: 'validation', retryable: false },
  INVALID_INVENTORY_CATEGORY: { category: 'validation', retryable: false },
  INVALID_UNIT: { category: 'validation', retryable: false },
  INVALID_CERTIFICATE_DATE: { category: 'validation', retryable: false },
  INVALID_MACHINE_TYPE: { category: 'validation', retryable: false },
  DATABASE_UNAVAILABLE: { category: 'database', retryable: true },
};

export function userError(
  code: SafeErrorCode,
  details: Pick<UserFacingError, 'field' | 'metadata' | 'correlationId'> = {},
): UserFacingError {
  return { code, ...DEFINITIONS[code], ...details };
}

/** @deprecated Legacy string adapter for actions not yet migrated to the
 * structured contract. It never forwards caught/provider/ORM text. */
export function toUserFacingError(category: UserErrorCategory, detail?: string): LegacyUserFacingError {
  const code: SafeErrorCode = category === 'authentication' ? 'AUTH_REQUIRED'
    : category === 'not_found' || category === 'permission' ? 'NOT_FOUND'
      : category === 'conflict' ? 'SEASON_ALREADY_EXISTS'
        : category === 'database' ? 'DATABASE_UNAVAILABLE'
          : category === 'provider_unavailable' ? 'PROVIDER_UNAVAILABLE'
            : 'GENERIC';
  return { ...userError(code), message: detail ?? translateErrorCode(code, 'en-GB') };
}

function isPrismaError(error: unknown): error is Error & { code?: string } {
  if (!(error instanceof Error)) return false;
  const code = 'code' in error ? (error as { code?: unknown }).code : undefined;
  return (typeof code === 'string' && /^P\d{4}$/.test(code)) || error.constructor.name.startsWith('Prisma');
}

/** Maps only recognized safe conditions. Unknown application/provider text is
 * deliberately not forwarded or guessed into a validation error. */
export function classifyError(error: unknown, correlationId?: string): UserFacingError {
  if (isPrismaError(error)) {
    const code = 'code' in error ? (error as { code?: string }).code : undefined;
    return userError(code === 'P2002' ? 'SEASON_ALREADY_EXISTS' : 'DATABASE_UNAVAILABLE', { correlationId });
  }
  if (error instanceof Error) {
    if (/sign in|required authentication/i.test(error.message)) return userError('AUTH_REQUIRED', { correlationId });
    if (/certificate expired/i.test(error.message)) return userError('OPERATOR_CERTIFICATE_EXPIRED', { correlationId });
    if (/not recorded as certified/i.test(error.message)) return userError('OPERATOR_NOT_CERTIFIED', { correlationId });
    if (/insufficient stock|not enough (?:unreserved )?inventory|stock was exhausted/i.test(error.message)) return userError('INSUFFICIENT_STOCK', { correlationId });
    if (/already completed|already has an actual activity/i.test(error.message)) return userError('WORK_ORDER_COMPLETED', { correlationId });
    if (/only a planned activity|completed activities cannot be deleted directly/i.test(error.message)) return userError('INVALID_VALUE', { correlationId });
    if (/offline submission key conflicts|offline visit conflict|sync conflict/i.test(error.message)) return userError('SYNC_CONFLICT', { correlationId });
    if (/does not belong to this farm/i.test(error.message)) return { ...userError('NOT_FOUND', { correlationId }), category: 'authorization' };
    if (/not found|already deleted/i.test(error.message)) return userError('NOT_FOUND', { correlationId });
    if (/provider unavailable|service unavailable|storage is unavailable/i.test(error.message)) return userError('PROVIDER_UNAVAILABLE', { correlationId });
  }
  return userError('GENERIC', { correlationId });
}

/** Logs diagnostics server-side and returns only the canonical safe contract. */
export function handleActionError(context: string, error: unknown, correlationId?: string): LegacyUserFacingError {
  // eslint-disable-next-line no-console
  console.error(`[${context}]`, error);
  const safe = classifyError(error, correlationId);
  // Compatibility only: unmigrated legacy actions still own deliberately
  // written application messages. Their callers are enumerated by the
  // user-errors audit and must move to `code`; Prisma/non-Error input is always
  // masked here. Do not use this field in new code.
  const legacyMessage = error instanceof Error && !isPrismaError(error)
    ? error.message
    : translateErrorCode(safe.code, 'en-GB');
  return { ...safe, message: legacyMessage };
}
