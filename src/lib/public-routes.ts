/**
 * Routes reachable without authentication. Single source shared by the Clerk
 * middleware (`proxy.ts`, via `createRouteMatcher`) and unit tests (via the pure
 * `isPublicPath` matcher below). `/dev/mobile-diagnostics` is public so it can be
 * opened on a phone before sign-in; it 404s in production regardless.
 */
export const PUBLIC_ROUTES = ['/', '/sign-in(.*)', '/sign-up(.*)', '/api/health', '/dev/mobile-diagnostics'] as const;

/** Pure equivalent of Clerk's createRouteMatcher for these simple patterns. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.some((pattern) =>
    pattern.endsWith('(.*)') ? pathname.startsWith(pattern.slice(0, -4)) : pathname === pattern,
  );
}
