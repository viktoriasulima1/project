import { describe, expect, it } from 'vitest';
import { calculatePlanVariance, resolveFieldOperationalStatus, resolveResourceReadiness, resolveWorkOrderPriority } from '../field-operations';

const now = new Date('2026-07-15T12:00:00Z');

describe('field operational status precedence', () => {
  const cases = [
    ['no active season', false, [], 'no_active_season'],
    ['unplanned', true, [], 'unplanned'],
    ['completed only', true, [{ status: 'completed', priority: 'low' }], 'completed'],
    ['draft is planned', true, [{ status: 'draft', priority: 'low' }], 'planned'],
    ['ready is planned', true, [{ status: 'ready', priority: 'low' }], 'planned'],
    ['assigned is planned', true, [{ status: 'assigned', priority: 'low' }], 'planned'],
    ['in progress', true, [{ status: 'in_progress', priority: 'low' }], 'in_progress'],
    ['due soon', true, [{ status: 'ready', priority: 'low', dueDate: '2026-07-17' }], 'due_soon'],
    ['overdue', true, [{ status: 'ready', priority: 'low', dueDate: '2026-07-14' }], 'overdue'],
    ['blocked', true, [{ status: 'blocked', priority: 'low' }], 'blocked'],
    ['blocker text', true, [{ status: 'ready', priority: 'low', blockerReason: 'wet' }], 'blocked'],
    ['critical', true, [{ status: 'ready', priority: 'critical' }], 'critical'],
    ['critical beats blocked', true, [{ status: 'blocked', priority: 'low' }, { status: 'ready', priority: 'critical' }], 'critical'],
    ['blocked beats overdue', true, [{ status: 'blocked', priority: 'low' }, { status: 'ready', priority: 'low', dueDate: '2026-07-14' }], 'blocked'],
    ['cancelled ignored', true, [{ status: 'cancelled', priority: 'critical' }], 'unplanned'],
  ] as const;
  it.each(cases)('%s', (_name, hasActiveSeason, workOrders, expected) => {
    expect(resolveFieldOperationalStatus({ hasActiveSeason, workOrders: [...workOrders], now })).toBe(expected);
  });
});

describe('work-order priority', () => {
  const cases = [
    ['explicit critical', { explicit: 'critical' }, 'critical'],
    ['blocked', { status: 'blocked' }, 'critical'],
    ['blocker reason', { blockerReason: 'weather' }, 'high'],
    ['overdue', { dueDate: '2026-07-14' }, 'critical'],
    ['due today', { dueDate: '2026-07-15T15:00:00Z' }, 'high'],
    ['due tomorrow', { dueDate: '2026-07-16T12:00:00Z' }, 'high'],
    ['due this week', { dueDate: '2026-07-20' }, 'medium'],
    ['later', { dueDate: '2026-08-20' }, 'low'],
    ['no date', {}, 'low'],
    ['keeps explicit high', { explicit: 'high', dueDate: '2026-08-20' }, 'high'],
  ] as const;
  it.each(cases)('%s', (_name, input, expected) => expect(resolveWorkOrderPriority({ ...input, now })).toBe(expected));
});

describe('resource readiness', () => {
  const cases = [
    ['nothing required', {}, true, []],
    ['enough stock', { requiredQuantity: 5, currentStock: 10 }, true, []],
    ['exact stock', { requiredQuantity: 10, currentStock: 10 }, true, []],
    ['reserved stock excluded', { requiredQuantity: 6, currentStock: 10, reservedElsewhere: 5 }, false, ['insufficient_inventory']],
    ['missing stock', { requiredQuantity: 1, currentStock: null }, false, ['insufficient_inventory']],
    ['machine ready', { needsMachine: true, machineAvailable: true }, true, []],
    ['machine missing', { needsMachine: true, machineAvailable: false }, false, ['machine_unavailable']],
    ['operator ready', { needsCertifiedOperator: true, certifiedOperatorAssigned: true }, true, []],
    ['operator missing', { needsCertifiedOperator: true, certifiedOperatorAssigned: false }, false, ['certified_operator_required']],
    ['all blockers', { requiredQuantity: 3, currentStock: 1, needsMachine: true, machineAvailable: false, needsCertifiedOperator: true, certifiedOperatorAssigned: false }, false, ['insufficient_inventory', 'machine_unavailable', 'certified_operator_required']],
  ] as const;
  it.each(cases)('%s', (_name, input, ready, blockers) => expect(resolveResourceReadiness(input)).toMatchObject({ ready, blockers }));
});

describe('plan variance', () => {
  it('calculates positive variance', () => expect(calculatePlanVariance({ plannedAreaHa: 5, actualAreaHa: 6, plannedQuantity: 10, actualQuantity: 12, plannedCostEur: 100, actualCostEur: 125 })).toEqual({ areaHa: 1, quantity: 2, costEur: 25 }));
  it('calculates negative variance', () => expect(calculatePlanVariance({ plannedAreaHa: 5, actualAreaHa: 4, plannedQuantity: 10, actualQuantity: 8, plannedCostEur: 100, actualCostEur: 90 })).toEqual({ areaHa: -1, quantity: -2, costEur: -10 }));
  it('calculates zero variance', () => expect(calculatePlanVariance({ plannedAreaHa: 5, actualAreaHa: 5 })).toMatchObject({ areaHa: 0 }));
  it('does not invent missing actuals', () => expect(calculatePlanVariance({ plannedAreaHa: 5 })).toMatchObject({ areaHa: null }));
  it('does not invent missing plans', () => expect(calculatePlanVariance({ actualQuantity: 5 })).toMatchObject({ quantity: null }));
});
