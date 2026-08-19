import { describe, expect, it } from 'vitest';
import { resolveServiceStatus } from '../machine-service-status';

describe('resolveServiceStatus', () => {
  it('is not_certified when the machine is not marked certified, regardless of hours', () => {
    expect(resolveServiceStatus({ isCertified: false, hoursSinceService: 0, nextServiceDueHours: 250 })).toBe('not_certified');
  });

  it('is ok when service hours are not tracked at all', () => {
    expect(resolveServiceStatus({ isCertified: true, hoursSinceService: null, nextServiceDueHours: null })).toBe('ok');
  });

  it('is overdue once the due threshold has been reached', () => {
    expect(resolveServiceStatus({ isCertified: true, hoursSinceService: 250, nextServiceDueHours: 250 })).toBe('overdue');
  });

  it('is due_soon within the warning window before the threshold', () => {
    expect(resolveServiceStatus({ isCertified: true, hoursSinceService: 235, nextServiceDueHours: 250 })).toBe('due_soon');
  });

  it('is ok well before the service threshold', () => {
    expect(resolveServiceStatus({ isCertified: true, hoursSinceService: 50, nextServiceDueHours: 250 })).toBe('ok');
  });
});
