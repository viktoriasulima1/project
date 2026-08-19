export function isTrustedMutationOrigin(request: Request, configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL): boolean {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') return false;
  if (!origin) return true; // non-browser/server-action clients still require authentication
  const expected = configuredAppUrl ? new URL(configuredAppUrl).origin : new URL(request.url).origin;
  return origin === expected;
}
