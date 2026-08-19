import { describe, it, expect } from 'vitest';
import { isClerkConfigured, checkClerkProductionSafety } from '../clerk-config';

describe('isClerkConfigured', () => {
  it('rejects undefined', () => {
    expect(isClerkConfigured(undefined)).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isClerkConfigured('')).toBe(false);
  });

  it('rejects the .env.local.example placeholder', () => {
    expect(isClerkConfigured('pk_test_...')).toBe(false);
  });

  it('rejects a "REPLACE_ME"-style placeholder even with the correct prefix', () => {
    expect(isClerkConfigured('pk_test_REPLACE_ME')).toBe(false);
  });

  it('rejects a key with the wrong prefix entirely', () => {
    expect(isClerkConfigured('sk_test_abcdefghijklmnopqrstuvwxyz1234')).toBe(false);
  });

  it('accepts a realistic-looking test key', () => {
    expect(isClerkConfigured('pk_test_Y2xlcmsuZXhhbXBsZS5jb20kMTIzNDU2Nzg')).toBe(true);
  });

  it('accepts a realistic-looking live key', () => {
    expect(isClerkConfigured('pk_live_Y2xlcmsuZXhhbXBsZS5jb20kMTIzNDU2Nzg')).toBe(true);
  });
});

describe('checkClerkProductionSafety', () => {
  const TEST_PK = 'pk_test_Y2xlcmsuZXhhbXBsZS5jb20kMTIzNDU2Nzg';
  const LIVE_PK = 'pk_live_Y2xlcmsuZXhhbXBsZS5jb20kMTIzNDU2Nzg';

  it('is safe outside production, even with test keys', () => {
    const result = checkClerkProductionSafety({
      nodeEnv: 'development',
      publishableKey: TEST_PK,
      secretKey: 'sk_test_abc',
      isE2eRun: false,
    });
    expect(result.safe).toBe(true);
  });

  it('is safe in production when isE2eRun is true, even with test keys', () => {
    const result = checkClerkProductionSafety({
      nodeEnv: 'production',
      publishableKey: TEST_PK,
      secretKey: 'sk_test_abc',
      isE2eRun: true,
    });
    expect(result.safe).toBe(true);
  });

  it('is safe in production with live keys', () => {
    const result = checkClerkProductionSafety({
      nodeEnv: 'production',
      publishableKey: LIVE_PK,
      secretKey: 'sk_live_abc',
      isE2eRun: false,
    });
    expect(result.safe).toBe(true);
  });

  it('is safe in production when Clerk is not configured at all', () => {
    const result = checkClerkProductionSafety({
      nodeEnv: 'production',
      publishableKey: undefined,
      secretKey: undefined,
      isE2eRun: false,
    });
    expect(result.safe).toBe(true);
  });

  it('rejects a real production run using a test-mode publishable key', () => {
    const result = checkClerkProductionSafety({
      nodeEnv: 'production',
      publishableKey: TEST_PK,
      secretKey: 'sk_live_abc',
      isE2eRun: false,
    });
    expect(result.safe).toBe(false);
    expect(result.message).toContain('pk_test_');
  });

  it('rejects a real production run using a test-mode secret key even if the publishable key looks live', () => {
    const result = checkClerkProductionSafety({
      nodeEnv: 'production',
      publishableKey: LIVE_PK,
      secretKey: 'sk_test_abc',
      isE2eRun: false,
    });
    expect(result.safe).toBe(false);
  });
});
