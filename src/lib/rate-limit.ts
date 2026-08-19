/**
 * Minimal in-memory sliding-window rate limiter for server actions that
 * proxy an external service on the user's behalf (Ctgb/PDOK search —
 * Sprint 18 Part 16: "rate-limit proxy endpoints if used"). Per-process
 * only — fine for a single-instance dev/pilot deployment; a real
 * multi-instance production deployment would need a shared store (Redis
 * etc.), not implemented here since no such deployment exists yet (see
 * docs/Sprint_17_Pilot_Environment_Check.md).
 */
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, maxRequests = 10, windowMs = 10_000): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  timestamps.push(now);
  hits.set(key, timestamps);
  return timestamps.length > maxRequests;
}
