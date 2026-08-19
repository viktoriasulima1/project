/** Mirrors employee-cert-status.ts's shape for machinery: a single pure
 * function so the "is this machine due for service / certified" read is
 * computed the same way everywhere it's shown. */
export type ServiceStatus = 'overdue' | 'due_soon' | 'ok' | 'not_certified';

const DUE_SOON_HOURS = 20;

export function resolveServiceStatus(machine: {
  isCertified: boolean;
  hoursSinceService: number | null;
  nextServiceDueHours: number | null;
}): ServiceStatus {
  if (!machine.isCertified) return 'not_certified';
  if (machine.hoursSinceService == null || machine.nextServiceDueHours == null) return 'ok';
  const remaining = machine.nextServiceDueHours - machine.hoursSinceService;
  if (remaining <= 0) return 'overdue';
  if (remaining <= DUE_SOON_HOURS) return 'due_soon';
  return 'ok';
}
