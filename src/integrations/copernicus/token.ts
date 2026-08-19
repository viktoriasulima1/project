import { CopernicusAuthError } from './errors';

// Confirmed against official Copernicus Data Space Ecosystem documentation
// (documentation.dataspace.copernicus.eu/APIs/Token.html) this sprint —
// not independently tested live from this environment (see types.ts header).
const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const FETCH_TIMEOUT_MS = 8000;
// Refresh a little before actual expiry so a request never races a token
// that's valid at read-time but expired by the time it reaches Sentinel Hub.
const EXPIRY_SAFETY_MARGIN_SECONDS = 60;

interface RawTokenResponse {
  access_token: string;
  expires_in: number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;

async function requestNewToken(): Promise<CachedToken> {
  const clientId = process.env.COPERNICUS_CLIENT_ID;
  const clientSecret = process.env.COPERNICUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new CopernicusAuthError('COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new CopernicusAuthError('network error or timeout reaching the token endpoint', e);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) throw new CopernicusAuthError(`token endpoint returned ${res.status}`);

  const body = (await res.json()) as RawTokenResponse;
  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + (body.expires_in - EXPIRY_SAFETY_MARGIN_SECONDS) * 1000,
  };
}

export async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;
  cached = await requestNewToken();
  return cached.accessToken;
}

/** Test-only: the in-memory cache would otherwise leak state between test
 * cases in the same worker. */
export function resetTokenCacheForTests(): void {
  cached = null;
}
