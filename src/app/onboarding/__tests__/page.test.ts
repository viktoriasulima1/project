import { describe, it, expect } from 'vitest';
import { shouldRedirectReadyUserToDashboard } from '../page';

describe('shouldRedirectReadyUserToDashboard', () => {
  it('redirects a ready user visiting bare /onboarding with no params', () => {
    expect(shouldRedirectReadyUserToDashboard('ready', undefined, undefined)).toBe(true);
  });

  it('does not redirect a non-ready user, regardless of params', () => {
    expect(shouldRedirectReadyUserToDashboard('no_farm', undefined, undefined)).toBe(false);
    expect(shouldRedirectReadyUserToDashboard('no_fields', undefined, undefined)).toBe(false);
  });

  it('does not redirect a ready user landing with done=1 (post-completion one-time screen)', () => {
    expect(shouldRedirectReadyUserToDashboard('ready', '1', undefined)).toBe(false);
  });

  it('does not redirect a ready user who explicitly requested a step (e.g. Inventory empty-state link)', () => {
    expect(shouldRedirectReadyUserToDashboard('ready', undefined, 'inventory')).toBe(false);
  });

  it('redirects a ready user even if done is present but not the literal "1"', () => {
    expect(shouldRedirectReadyUserToDashboard('ready', '0', undefined)).toBe(true);
  });
});
