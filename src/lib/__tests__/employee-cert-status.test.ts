import { describe, expect, it } from 'vitest';
import { resolveCertStatus } from '../employee-cert-status';

const NOW = new Date('2026-08-19T12:00:00Z');

describe('resolveCertStatus', () => {
  it('is not_certified when the employee is not marked hasSpraying', () => {
    expect(resolveCertStatus({ hasSpraying: false, certExpiry: null }, NOW)).toBe('not_certified');
  });

  it('is valid when certified with no expiry on file', () => {
    expect(resolveCertStatus({ hasSpraying: true, certExpiry: null }, NOW)).toBe('valid');
  });

  it('is expired when the certificate expiry is in the past', () => {
    expect(resolveCertStatus({ hasSpraying: true, certExpiry: new Date('2026-08-01') }, NOW)).toBe('expired');
  });

  it('is expiring_soon within the 30-day warning window', () => {
    expect(resolveCertStatus({ hasSpraying: true, certExpiry: new Date('2026-09-10') }, NOW)).toBe('expiring_soon');
  });

  it('is valid when the certificate expires well beyond 30 days', () => {
    expect(resolveCertStatus({ hasSpraying: true, certExpiry: new Date('2027-01-01') }, NOW)).toBe('valid');
  });

  it('treats an expiry timestamp earlier today as already expired — matches the spray-window hard blocker exactly, never shows valid when a spray would already be rejected', () => {
    const midnightToday = new Date('2026-08-19T00:00:00Z');
    expect(resolveCertStatus({ hasSpraying: true, certExpiry: midnightToday }, NOW)).toBe('expired');
  });
});
