/**
 * Development-only cross-origin allowances for a temporary Cloudflare Quick
 * Tunnel (`https://*.trycloudflare.com`). Pure module (no imports), so both
 * next.config.ts and unit tests can use it. The wildcard is NEVER applied in
 * production — the strict same-origin defaults are preserved there.
 */
export const TRYCLOUDFLARE_DEV_ORIGIN = '*.trycloudflare.com';

/** The dev-only Next config fragment: allowedDevOrigins (for /_next/* + HMR
 * cross-origin protection) and serverActions.allowedOrigins (Server Action CSRF
 * allow-list). Returns an empty object in production. */
export function devOriginConfig(isDev: boolean): {
  allowedDevOrigins?: string[];
  serverActions?: { allowedOrigins: string[] };
} {
  if (!isDev) return {};
  return {
    allowedDevOrigins: [TRYCLOUDFLARE_DEV_ORIGIN],
    serverActions: { allowedOrigins: [TRYCLOUDFLARE_DEV_ORIGIN] },
  };
}

/** Pure re-implementation of Next's `matchWildcardDomain` (see
 * next/dist/.../csrf-protection.js) for our single pattern — wildcards match
 * subdomain segments only, never the bare domain. */
export function hostMatchesWildcard(host: string, pattern: string): boolean {
  const h = host.toLowerCase().split('.');
  const p = pattern.toLowerCase().split('.');
  if (p.length < 1 || h.length < p.length) return false;
  if (p.length === 1 && (p[0] === '*' || p[0] === '**')) return false; // no bare-domain wildcard
  while (p.length) {
    const pp = p.pop();
    const hp = h.pop();
    if (pp === '*') { if (!hp) return false; continue; }
    if (pp === '') return false;
    if (pp !== hp) return false;
  }
  return h.length === 0;
}

/** Whether a request host is accepted as a dev tunnel origin — true only in
 * development, false in production (Server Actions + dev assets stay strict). */
export function tunnelOriginAcceptedInDev(host: string, isDev: boolean): boolean {
  return isDev && hostMatchesWildcard(host, TRYCLOUDFLARE_DEV_ORIGIN);
}
