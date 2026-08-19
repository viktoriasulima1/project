/**
 * Security headers + Content-Security-Policy, extracted from next.config so the
 * policy is unit-testable (dev permits the exact Clerk development assets;
 * production stays strict — no '*', no 'unsafe-eval'). Pure module: no
 * side-effect imports, safe to import from next.config.ts.
 */

export function buildContentSecurityPolicy(isDev: boolean): string {
  // Next.js dev/HMR needs 'unsafe-eval'; production must not have it.
  const devEval = isDev ? " 'unsafe-eval'" : '';
  // Same-origin WebSocket for HMR in development only (harmless if the tunnel
  // cannot carry the WS; never widens production).
  const devWs = isDev ? ' ws: wss:' : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${devEval} https://*.clerk.accounts.dev`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    `connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com https://api.open-meteo.com${devWs}`,
    "frame-src https://*.clerk.accounts.dev",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.clerk.accounts.dev",
  ].join('; ');
}

export function securityHeaders(isDev: boolean): Array<{ key: string; value: string }> {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(isDev) },
  ];
}
