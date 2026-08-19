export type FieldOperationalStatus =
  | 'critical'
  | 'blocked'
  | 'overdue'
  | 'due_soon'
  | 'in_progress'
  | 'planned'
  | 'completed'
  | 'unplanned'
  | 'no_active_season';

export type OperationalOrder = {
  status: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dueDate?: Date | string | null;
  blockerReason?: string | null;
};

const DAY = 86_400_000;

export function resolveFieldOperationalStatus(input: {
  hasActiveSeason: boolean;
  workOrders: OperationalOrder[];
  now?: Date;
}): FieldOperationalStatus {
  if (!input.hasActiveSeason) return 'no_active_season';
  const active = input.workOrders.filter((order) => !['completed', 'cancelled'].includes(order.status));
  if (active.some((order) => order.priority === 'critical')) return 'critical';
  if (active.some((order) => order.status === 'blocked' || order.blockerReason)) return 'blocked';
  const now = input.now ?? new Date();
  if (active.some((order) => order.dueDate && new Date(order.dueDate) < now)) return 'overdue';
  if (active.some((order) => order.dueDate && new Date(order.dueDate).getTime() <= now.getTime() + 3 * DAY)) return 'due_soon';
  if (active.some((order) => order.status === 'in_progress')) return 'in_progress';
  if (active.length) return 'planned';
  if (input.workOrders.some((order) => order.status === 'completed')) return 'completed';
  return 'unplanned';
}

export function resolveWorkOrderPriority(input: {
  explicit?: OperationalOrder['priority'] | null;
  status?: string;
  dueDate?: Date | string | null;
  blockerReason?: string | null;
  now?: Date;
}): OperationalOrder['priority'] {
  if (input.explicit === 'critical' || input.status === 'blocked') return 'critical';
  if (input.blockerReason) return 'high';
  if (!input.dueDate) return input.explicit ?? 'low';
  const days = (new Date(input.dueDate).getTime() - (input.now ?? new Date()).getTime()) / DAY;
  if (days < 0) return 'critical';
  if (days <= 1) return 'high';
  if (days <= 7) return input.explicit === 'high' ? 'high' : 'medium';
  return input.explicit ?? 'low';
}

export type ReadinessResult = {
  ready: boolean;
  blockers: string[];
  availableQuantity: number | null;
};

export function resolveResourceReadiness(input: {
  requiredQuantity?: number | null;
  currentStock?: number | null;
  reservedElsewhere?: number;
  needsMachine?: boolean;
  machineAvailable?: boolean;
  needsCertifiedOperator?: boolean;
  certifiedOperatorAssigned?: boolean;
}): ReadinessResult {
  const blockers: string[] = [];
  const available = input.currentStock == null ? null : Math.max(0, input.currentStock - (input.reservedElsewhere ?? 0));
  if (input.requiredQuantity != null && (available == null || available < input.requiredQuantity)) blockers.push('insufficient_inventory');
  if (input.needsMachine && !input.machineAvailable) blockers.push('machine_unavailable');
  if (input.needsCertifiedOperator && !input.certifiedOperatorAssigned) blockers.push('certified_operator_required');
  return { ready: blockers.length === 0, blockers, availableQuantity: available };
}

export function calculatePlanVariance(input: {
  plannedAreaHa?: number | null;
  actualAreaHa?: number | null;
  plannedQuantity?: number | null;
  actualQuantity?: number | null;
  plannedCostEur?: number | null;
  actualCostEur?: number | null;
}) {
  const difference = (planned?: number | null, actual?: number | null) =>
    planned == null || actual == null ? null : actual - planned;
  return {
    areaHa: difference(input.plannedAreaHa, input.actualAreaHa),
    quantity: difference(input.plannedQuantity, input.actualQuantity),
    costEur: difference(input.plannedCostEur, input.actualCostEur),
  };
}

export const FIELD_STATUS_LABELS: Record<FieldOperationalStatus, string> = {
  critical: 'Critical', blocked: 'Blocked', overdue: 'Overdue', due_soon: 'Due soon',
  in_progress: 'In progress', planned: 'Planned', completed: 'Completed',
  unplanned: 'No work planned', no_active_season: 'No active season',
};
