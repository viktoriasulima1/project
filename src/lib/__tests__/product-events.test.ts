import { describe, it, expect, vi, afterEach } from 'vitest';
import { logProductEvent } from '../product-events';

describe('logProductEvent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs a structured event with a timestamp added', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logProductEvent({ event: 'first_activity_completed', farmId: 'farm-1', activityType: 'spray', success: true });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [, payload] = consoleSpy.mock.calls[0];
    const parsed = JSON.parse(payload as string);
    expect(parsed.event).toBe('first_activity_completed');
    expect(parsed.farmId).toBe('farm-1');
    expect(parsed.activityType).toBe('spray');
    expect(parsed.success).toBe(true);
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('only includes the allowed fields — no way to smuggle extra sensitive data through the type', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logProductEvent({ event: 'onboarding_completed', farmId: 'farm-1' });

    const [, payload] = consoleSpy.mock.calls[0];
    const parsed = JSON.parse(payload as string);
    expect(Object.keys(parsed).sort()).toEqual(['event', 'farmId', 'timestamp'].sort());
  });
});
