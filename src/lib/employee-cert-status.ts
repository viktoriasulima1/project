/**
 * Single source of truth for "is this operator's spray certification usable
 * right now / soon" — mirrors the exact thresholds already enforced by the
 * spray-suitability engine (src/lib/spray-window.ts: expired if missing or
 * past today) and the dashboard's 30-day proactive warning
 * (src/lib/farm-insights.ts). Kept here as one pure function so a future
 * change to either threshold only needs to happen once.
 */
export type CertStatus = 'not_certified' | 'expired' | 'expiring_soon' | 'valid';

const WARNING_WINDOW_DAYS = 30;

export function resolveCertStatus(
  employee: { hasSpraying: boolean; certExpiry: Date | null },
  now: Date = new Date(),
): CertStatus {
  if (!employee.hasSpraying) return 'not_certified';
  if (!employee.certExpiry) return 'valid';
  const expiry = new Date(employee.certExpiry);

  // Matches spray-window.ts's own hard-blocker check exactly (raw timestamp,
  // not truncated to midnight) — this page must never show "valid" for an
  // operator the spray engine would already reject.
  if (expiry.getTime() < now.getTime()) return 'expired';

  // The 30-day warning window itself uses calendar days (matches
  // farm-insights.ts's proactive dashboard warning), so a same-day expiry
  // reads as "expiring soon" rather than swinging to "expired" purely from
  // time-of-day.
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const warningCutoff = new Date(today.getTime() + WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (expiry.getTime() <= warningCutoff.getTime()) return 'expiring_soon';
  return 'valid';
}
