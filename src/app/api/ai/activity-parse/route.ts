import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveFarmOrThrow } from '@/lib/farm';
import { getClerkUserId } from '@/lib/farm';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { configuredAIProvider } from '@/lib/ai/configured-provider';
import { activityParseRequest } from '@/lib/ai/provider';
import { parseActivityTextDeterministically, resolveEntity } from '@/lib/ai/activity-parser';
import { detectMultipleActivities } from '@/lib/ai/multi-activity';
import { matchActivityDraftToWorkOrders } from '@/lib/ai/work-order-matcher';
import { newCorrelationId } from '@/lib/audit';
import { userError, type UserFacingError } from '@/lib/user-error';

const inputSchema = z.object({ text: z.string().trim().min(3).max(2000) });
const requests = new Map<string, { day: string; count: number }>();

function errorResponse(error: UserFacingError, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const startedAt = new Date();
  const farm = await getActiveFarmOrThrow();
  const actor = await getClerkUserId() ?? farm.clerkUserId;
  const parsedInput = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsedInput.success) return errorResponse(userError('INVALID_VALUE', { field: 'text', correlationId: newCorrelationId() }), 400);
  const day = new Date().toISOString().slice(0, 10);
  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const limit = Math.min(Number(process.env.AI_DAILY_FARM_LIMIT ?? 50), 100);
  const rate = requests.get(farm.id);
  const count = rate?.day === day ? rate.count : 0;
  const userCount = await db.aiRequestMetadata.count({ where: { farmId: farm.id, userReference: actor, requestType: 'activity_parse', createdAt: { gte: dayStart } } });
  if (count >= limit || userCount >= Math.min(Number(process.env.AI_DAILY_USER_PARSE_LIMIT ?? 30), 60)) {
    const ended = new Date(); await db.aiRequestMetadata.create({ data: { farmId: farm.id, userReference: actor, requestType: 'activity_parse', provider: 'not_called', model: 'not_called', promptVersion: 'activity-parse-v1', schemaVersion: 'activity-parse-v1', startedAt, completedAt: ended, durationMs: ended.getTime() - startedAt.getTime(), result: 'rate_limited' } });
    return errorResponse(userError('RATE_LIMITED', { correlationId: newCorrelationId() }), 429);
  }
  requests.set(farm.id, { day, count: count + 1 });

  const [fieldSeasons, products, machines, workOrders] = await Promise.all([
    db.fieldSeason.findMany({ where: { field: { farmId: farm.id, deletedAt: null }, season: { isActive: true, farmId: farm.id } }, select: { id: true, field: { select: { name: true } } } }),
    db.inventoryItem.findMany({ where: { farmId: farm.id }, select: { id: true, name: true } }),
    db.machine.findMany({ where: { farmId: farm.id }, select: { id: true, name: true } }),
    db.workOrder.findMany({ where: { farmId: farm.id, status: { in: ['ready', 'assigned', 'in_progress'] } }, take: 30, include: { fieldSeason: { include: { field: { select: { name: true } } } }, sourcePlanItem: { select: { expectedAreaHa: true, expectedProductId: true } }, employees: { select: { employeeId: true } } } }),
  ]);

  let candidate = parseActivityTextDeterministically(parsedInput.data.text);
  let mode: 'grounded_ai' | 'rule_based' = 'rule_based';
  const provider = configuredAIProvider();
  let inputTokens: number | undefined; let outputTokens: number | undefined;
  try {
    const response = await provider.generate(activityParseRequest(parsedInput.data.text));
    candidate = response.output; inputTokens = response.inputTokens; outputTokens = response.outputTokens;
    mode = 'grounded_ai';
  } catch { /* safe deterministic candidate remains */ }

  const field = resolveEntity(candidate.fieldText, fieldSeasons.map((row) => ({ id: row.id, name: row.field.name })));
  const product = resolveEntity(candidate.productText, products);
  const machine = resolveEntity(candidate.machineText, machines);
  const multiActivity = detectMultipleActivities(parsedInput.data.text);
  const matchingOrders = matchActivityDraftToWorkOrders({ activityType: candidate.activityType, fieldSeasonId: field.id, productId: product.id, areaHa: candidate.areaHa, occurredAt: null, employeeId: null, machineId: machine.id }, farm.id, workOrders.map((order) => ({
    id: order.id, farmId: order.farmId, version: order.version, title: order.title, status: order.status, operationType: order.operationType,
    fieldSeasonId: order.fieldSeasonId, plannedStart: order.plannedStart, plannedEnd: order.plannedEnd, dueDate: order.dueDate,
    expectedAreaHa: order.sourcePlanItem?.expectedAreaHa == null ? null : Number(order.sourcePlanItem.expectedAreaHa), expectedProductId: order.sourcePlanItem?.expectedProductId ?? null,
    employeeIds: order.employees.map((employee) => employee.employeeId), machineId: order.machineId, fieldName: order.fieldSeason.field.name, crop: order.fieldSeason.crop,
  }))).slice(0, 3);

  const ended = new Date();
  await db.aiRequestMetadata.create({ data: {
    farmId: farm.id, userReference: actor, requestType: 'activity_parse', provider: provider.name, model: process.env.AI_PARSE_MODEL ?? process.env.AI_MODEL ?? provider.name,
    contextChecksum: createHash('sha256').update(parsedInput.data.text).digest('hex'), promptVersion: 'activity-parse-v1', schemaVersion: 'activity-parse-v1',
    startedAt, completedAt: ended, durationMs: ended.getTime() - startedAt.getTime(), inputTokenCount: inputTokens, outputTokenCount: outputTokens,
    result: mode === 'grounded_ai' ? 'success' : 'fallback',
  } });
  return NextResponse.json({ candidate, resolution: { field, product, machine }, workOrders: matchingOrders, multiActivity, mode, safeguards: { draftOnly: true, authoritativeValidationRequired: true } });
}
