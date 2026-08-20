import type { Locale } from './locales';
import { FALLBACK_LOCALE } from './locales';
import { getNamespace } from './catalog';
import { lookup } from './translator';

/**
 * Central safe error-code → translation mapper (Part 11).
 *
 * Server Actions should return one of these STABLE codes, never final English
 * text and never raw Zod/Prisma/provider strings. The UI maps the code to a
 * localized message. An unknown code degrades to GENERIC — a raw internal error
 * can never reach the farmer.
 */
export const SAFE_ERROR_CODES = [
  'GENERIC',
  'REQUIRED_FIELD',
  'INVALID_ENUM',
  'INVALID_VALUE',
  'INVALID_QUANTITY',
  'INVALID_DATE',
  'CTGB_PRODUCT_UNVERIFIED',
  'RATE_LIMITED',
  'INVALID_PLAN_ITEM',
  'INVALID_WORK_ORDER',
  'WORK_WINDOW_INVALID',
  'INVENTORY_SELECTION_REQUIRED',
  'NOT_FOUND',
  'CONDITION_REQUIRED',
  'LOCATION_TOO_LOW',
  'PHOTO_LOCAL_ONLY',
  'WORK_ORDER_COMPLETED',
  'OPERATOR_CERTIFICATE_EXPIRED',
  'OPERATOR_NOT_CERTIFIED',
  'INVALID_CTGB_USE',
  'INSUFFICIENT_STOCK',
  'PRODUCT_NOT_APPROVED',
  'AI_REQUIRES_CONNECTION',
  'OFFLINE_UNAVAILABLE',
  'PROVIDER_UNAVAILABLE',
  'UPLOAD_FAILED',
  'SYNC_CONFLICT',
  'DRAFT_SAVED_LOCALLY',
  'AUTH_REQUIRED',
  'REQUEST_NOT_ALLOWED',
  'FARM_NAME_REQUIRED',
  'INVALID_FARM_TYPE',
  'INVALID_AREA',
  'INVALID_COORDINATES',
  'SEASON_REQUIRED',
  'SEASON_ALREADY_EXISTS',
  'FIELD_NAME_REQUIRED',
  'INVALID_FIELD_AREA',
  'INVALID_SOIL_TYPE',
  'INVALID_CROP',
  'INVALID_INVENTORY_CATEGORY',
  'INVALID_UNIT',
  'INVALID_CERTIFICATE_DATE',
  'INVALID_MACHINE_TYPE',
  'DATABASE_UNAVAILABLE',
] as const;

export type SafeErrorCode = (typeof SAFE_ERROR_CODES)[number];

export function isSafeErrorCode(value: unknown): value is SafeErrorCode {
  return typeof value === 'string' && (SAFE_ERROR_CODES as readonly string[]).includes(value);
}

/** Translate a (possibly untrusted) code to a localized message; GENERIC on miss. */
export function translateErrorCode(code: string, locale: Locale): string {
  const safe: SafeErrorCode = isSafeErrorCode(code) ? code : 'GENERIC';
  const message = lookup(getNamespace(locale, 'errors'), safe) ?? lookup(getNamespace(FALLBACK_LOCALE, 'errors'), safe);
  return message ?? 'Something went wrong. Please try again.';
}
