import { NextResponse } from 'next/server';
import { createActivity } from '@/lib/actions/activities';
import { isTrustedMutationOrigin } from '@/lib/origin';
import { translateErrorCode } from '@/i18n/error-codes';
import { newCorrelationId } from '@/lib/audit';
import { userError, type UserFacingError } from '@/lib/user-error';

export const dynamic = 'force-dynamic';

function errorResponse(error: UserFacingError, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const ALLOWED_FIELDS = new Set([
  'localDraftId', 'idempotencyKey', 'fieldSeasonId', 'type', 'date',
  'operatorName', 'certificateNumber', 'waterVolumePerHa', 'nozzleType',
  'machineId', 'areaHa', 'productId', 'dosePerHa', 'doseUnit',
  'weatherTempC', 'weatherWindKmh', 'weatherWindDir', 'weatherHumidity',
  'bbchStage', 'notes', 'status',
  'actualHours', 'machineHours', 'fuelUsed', 'fuelInventoryItemId',
  // Sprint 25 E2E fix — the ActivityDialog always submits through this draft
  // sync path (online AND offline). Omitting workOrderId here silently dropped
  // the WorkOrder link, so completing an activity from a WorkOrder never marked
  // the WorkOrder completed. createActivity's schema already accepts it.
  'workOrderId',
  'workOrderVersion',
]);

export async function POST(request: Request) {
  if (!isTrustedMutationOrigin(request)) return errorResponse(userError('REQUEST_NOT_ALLOWED', { correlationId: newCorrelationId() }), 403);
  let body: unknown;
  try { body = await request.json(); } catch {
    return errorResponse(userError('INVALID_VALUE', { field: 'formData', correlationId: newCorrelationId() }), 400);
  }
  if (!body || typeof body !== 'object' || !('formData' in body) || typeof body.formData !== 'object' || !body.formData) {
    return errorResponse(userError('REQUIRED_FIELD', { field: 'formData', correlationId: newCorrelationId() }), 400);
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(body.formData as Record<string, unknown>)) {
    if (ALLOWED_FIELDS.has(key) && typeof value === 'string') form.set(key, value);
  }
  const result = await createActivity({}, form);
  if (result.success && result.activityId) {
    return NextResponse.json({ success: true, activityId: result.activityId });
  }
  const category = result.safeErrorCategory ?? (result.fieldErrors ? 'validation' : 'server');
  const status = category === 'authorization' ? 403 : category === 'conflict' || category === 'insufficient_stock' || category === 'stale_reference' ? 409 : category === 'validation' ? 400 : 500;
  const fieldErrors = result.fieldErrors
    ? Object.fromEntries(Object.entries(result.fieldErrors).map(([field, error]) => [field, [translateErrorCode(error.code, 'en-GB')]]))
    : undefined;
  return NextResponse.json({
    error: translateErrorCode(result.error?.code ?? 'GENERIC', 'en-GB'),
    fieldErrors,
    category,
  }, { status });
}
