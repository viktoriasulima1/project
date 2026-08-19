export type ComparisonResult = 'match' | 'different' | 'not_mentioned' | 'unresolved';
export interface WorkOrderMatchInput {
  activityType: string | null; fieldSeasonId: string | null; productId: string | null;
  areaHa: number | null; occurredAt: Date | null; employeeId: string | null; machineId: string | null;
}
export interface MatchableWorkOrder {
  id: string; farmId: string; version: number; title: string; status: string; operationType: string; fieldSeasonId: string;
  plannedStart: Date | null; plannedEnd: Date | null; dueDate: Date | null; expectedAreaHa: number | null;
  expectedProductId: string | null; employeeIds: string[]; machineId: string | null;
  fieldName: string; crop: string;
}
export interface WorkOrderEvidence { field: string; expected: string | number | null; described: string | number | null; result: ComparisonResult; points: number; material: boolean }
export interface WorkOrderCandidate { workOrderId: string; version: number; title: string; status: 'strong_match' | 'possible_match' | 'conflict' | 'no_match'; totalScore: number; evidence: WorkOrderEvidence[]; materialConflicts: string[]; missingComparisonData: string[]; workOrder: MatchableWorkOrder }

function compare(field: string, expected: string | number | null, described: string | number | null, weight: number, material: boolean, tolerance = 0): WorkOrderEvidence {
  if (described == null) return { field, expected, described, result: 'not_mentioned', points: 0, material };
  if (expected == null) return { field, expected, described, result: 'unresolved', points: 0, material };
  const matches = typeof expected === 'number' && typeof described === 'number' ? Math.abs(expected - described) <= tolerance : expected === described;
  return { field, expected, described, result: matches ? 'match' : 'different', points: matches ? weight : material ? -weight : -Math.ceil(weight / 2), material };
}

export function matchActivityDraftToWorkOrders(input: WorkOrderMatchInput, activeFarmId: string, orders: MatchableWorkOrder[]): WorkOrderCandidate[] {
  return orders.filter((order) => order.farmId === activeFarmId && !['completed', 'cancelled'].includes(order.status)).map((order) => {
    const evidence: WorkOrderEvidence[] = [
      compare('Field', order.fieldSeasonId, input.fieldSeasonId, 35, true), compare('Operation', order.operationType, input.activityType, 25, true),
      compare('Product', order.expectedProductId, input.productId, 15, true), compare('Area', order.expectedAreaHa, input.areaHa, 10, false, order.expectedAreaHa ? Math.max(0.5, order.expectedAreaHa * 0.1) : 0),
      compare('Employee', order.employeeIds[0] ?? null, input.employeeId, 5, false), compare('Machine', order.machineId, input.machineId, 5, false),
    ];
    if (input.occurredAt) {
      const start = order.plannedStart ?? order.dueDate; const end = order.plannedEnd ?? order.dueDate;
      const within = start && end ? input.occurredAt >= new Date(new Date(start).setHours(0, 0, 0, 0)) && input.occurredAt <= new Date(new Date(end).setHours(23, 59, 59, 999)) : null;
      evidence.push({ field: 'Date/window', expected: start && end ? `${start.toISOString()}..${end.toISOString()}` : null, described: input.occurredAt.toISOString(), result: within == null ? 'unresolved' : within ? 'match' : 'different', points: within ? 5 : within === false ? -3 : 0, material: false });
    }
    const materialConflicts = evidence.filter((item) => item.material && item.result === 'different').map((item) => item.field);
    const missingComparisonData = evidence.filter((item) => item.result === 'not_mentioned' || item.result === 'unresolved').map((item) => item.field);
    const totalScore = Math.max(0, evidence.reduce((sum, item) => sum + item.points, 0));
    const status: WorkOrderCandidate['status'] = materialConflicts.length ? 'conflict' : totalScore >= 60 ? 'strong_match' : totalScore >= 30 ? 'possible_match' : 'no_match';
    return { workOrderId: order.id, version: order.version, title: order.title, status, totalScore, evidence, materialConflicts, missingComparisonData, workOrder: order };
  }).filter((candidate) => candidate.status !== 'no_match').sort((a, b) => b.totalScore - a.totalScore);
}

export function canExplicitlyLinkWorkOrder(candidate: WorkOrderCandidate) {
  return candidate.status !== 'conflict' && candidate.materialConflicts.length === 0 && !['completed', 'cancelled'].includes(candidate.workOrder.status);
}
