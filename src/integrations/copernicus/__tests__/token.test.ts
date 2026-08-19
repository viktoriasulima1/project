import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAccessToken, resetTokenCacheForTests } from '../token';
import { CopernicusAuthError } from '../errors';

const ORIGINAL_ENV = { ...process.env };

describe('getAccessToken', () => {
  beforeEach(() => {
    resetTokenCacheForTests();
    process.env.COPERNICUS_CLIENT_ID = 'test-client-id';
    process.env.COPERNICUS_CLIENT_SECRET = 'test-client-secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it('requests a token from the real Copernicus identity endpoint with client-credentials grant', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'tok-1', expires_in: 3600 }) });
    vi.stubGlobal('fetch', fetchMock);

    const token = await getAccessToken();
    expect(token).toBe('tok-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBe('test-client-secret');
  });

  it('reuses a cached token instead of requesting a new one before it expires', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'tok-1', expires_in: 3600 }) });
    vi.stubGlobal('fetch', fetchMock);

    await getAccessToken();
    await getAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws without calling the network when credentials are not configured', async () => {
    delete process.env.COPERNICUS_CLIENT_ID;
    delete process.env.COPERNICUS_CLIENT_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAccessToken()).rejects.toThrow(CopernicusAuthError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('wraps a non-ok token response in CopernicusAuthError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(getAccessToken()).rejects.toThrow(CopernicusAuthError);
  });

  it('wraps a network failure in CopernicusAuthError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(getAccessToken()).rejects.toThrow(CopernicusAuthError);
  });
});
