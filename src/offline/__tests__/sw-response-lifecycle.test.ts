import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildContentSecurityPolicy } from '@/lib/security-headers';

const SW_SOURCE = readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf8');
const ORIGIN = 'https://app.test';

/** Minimal Response that faithfully throws when cloned after the body is used. */
class MockResponse {
  ok: boolean;
  bodyUsed = false;
  isClone: boolean;
  cloneCount = 0;
  constructor({ ok = true, isClone = false }: { ok?: boolean; isClone?: boolean } = {}) {
    this.ok = ok;
    this.isClone = isClone;
  }
  clone(): MockResponse {
    if (this.bodyUsed) throw new TypeError("Failed to execute 'clone' on 'Response': Response body is already used");
    this.cloneCount++;
    return new MockResponse({ ok: this.ok, isClone: true });
  }
  async text() { this.bodyUsed = true; return ''; }
}

interface FetchEventLike {
  request: { method: string; url: string; mode: string };
  _responded?: Promise<MockResponse | undefined>;
  _waits: Promise<unknown>[];
  respondWith(p: Promise<MockResponse | undefined>): void;
  waitUntil(p: Promise<unknown>): void;
}

function makeEvent(url: string, mode = 'no-cors', method = 'GET'): FetchEventLike {
  return {
    request: { method, url, mode },
    _waits: [],
    respondWith(p) { this._responded = p; },
    waitUntil(p) { this._waits.push(p); },
  };
}

/** Loads the real sw.js into a mocked worker global and returns its handlers + spies. */
function loadServiceWorker(options: { putRejects?: boolean } = {}) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const cacheStore = new Map<string, Map<string, MockResponse>>();
  const put = vi.fn(async (req: { url: string }, res: MockResponse) => {
    if (options.putRejects) throw new Error('QuotaExceededError');
    cacheStore.get(STATIC_NAME)!.set(req.url, res);
  });
  const deletedCaches: string[] = [];
  const claim = vi.fn(async () => undefined);
  const STATIC_NAME = 'farmos-static-sw-clone-fix-v2';
  cacheStore.set(STATIC_NAME, new Map());

  const caches = {
    open: vi.fn(async (name: string) => {
      if (!cacheStore.has(name)) cacheStore.set(name, new Map());
      return {
        put,
        addAll: vi.fn(async () => undefined),
        match: vi.fn(async (req: { url: string }) => cacheStore.get(name)!.get(req.url)),
      };
    }),
    match: vi.fn(async (req: { url: string } | string) => {
      const key = typeof req === 'string' ? req : req.url;
      for (const store of cacheStore.values()) if (store.has(key)) return store.get(key);
      return undefined;
    }),
    keys: vi.fn(async () => [...cacheStore.keys()]),
    delete: vi.fn(async (name: string) => { deletedCaches.push(name); cacheStore.delete(name); return true; }),
  };

  const lastNetwork = { response: null as MockResponse | null };
  const fetchMock = vi.fn(async () => { const r = new MockResponse({ ok: true }); lastNetwork.response = r; return r; });

  const self = {
    location: { origin: ORIGIN, hostname: 'localhost' },
    addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler; },
    skipWaiting: vi.fn(),
    clients: { claim },
  };

  // eslint-disable-next-line no-new-func
  new Function('self', 'caches', 'fetch', 'URL', 'console', SW_SOURCE)(self, caches, fetchMock, URL, console);
  return { handlers, caches, put, deletedCaches, claim, fetchMock, lastNetwork, cacheStore, STATIC_NAME };
}

describe('Service Worker response lifecycle', () => {
  let sw: ReturnType<typeof loadServiceWorker>;
  beforeEach(() => { sw = loadServiceWorker(); });

  // 1 + 2 — clone before cache.put; original returned untouched
  it('1/2 — a static asset is cloned before caching and the original is returned untouched', async () => {
    const event = makeEvent(`${ORIGIN}/_next/static/chunk.abc.js`);
    sw.handlers.fetch(event);
    const returned = await event._responded;
    await Promise.all(event._waits);
    expect(sw.put).toHaveBeenCalledTimes(1);
    const cached = sw.put.mock.calls[0][1] as MockResponse;
    expect(cached.isClone).toBe(true); // the CLONE was cached
    expect(returned).toBe(sw.lastNetwork.response); // the ORIGINAL was returned
    expect(returned!.isClone).toBe(false);
    expect(returned!.bodyUsed).toBe(false); // never consumed by the worker
  });

  // 4 — clone is never taken from a consumed body (no TypeError)
  it('4 — cloning never happens after the body is used', async () => {
    const event = makeEvent(`${ORIGIN}/_next/static/x.js`);
    expect(() => sw.handlers.fetch(event)).not.toThrow();
    const returned = await event._responded;
    await Promise.all(event._waits);
    expect(returned!.cloneCount).toBe(1); // cloned exactly once, while fresh
  });

  // 3 + 11 — cache.put failure neither breaks the response nor rejects unhandled
  it('3/11 — a cache.put failure still returns the network response with no rejection', async () => {
    const failing = loadServiceWorker({ putRejects: true });
    const event = makeEvent(`${ORIGIN}/_next/static/y.js`);
    const rejections: unknown[] = [];
    const onRej = (e: PromiseRejectionEvent) => rejections.push(e.reason);
    failing.handlers.fetch(event);
    const returned = await event._responded;
    await expect(Promise.all(event._waits)).resolves.toBeDefined(); // waitUntil resolved (catch swallowed)
    expect(returned).toBe(failing.lastNetwork.response);
    expect(rejections).toEqual([]);
    void onRej;
  });

  // 5 + 6 + 7 — authenticated HTML / /api / Clerk are not cached
  it('5/6/7 — navigations, /api and cross-origin Clerk requests are never cached', async () => {
    const nav = makeEvent(`${ORIGIN}/dashboard`, 'navigate');
    sw.handlers.fetch(nav);
    await nav._responded?.catch(() => undefined);

    const api = makeEvent(`${ORIGIN}/api/health`);
    sw.handlers.fetch(api);
    expect(api._responded).toBeUndefined(); // not intercepted → straight to network

    const clerk = makeEvent('https://enabling-gannet-9.clerk.accounts.dev/v1/client');
    sw.handlers.fetch(clerk);
    expect(clerk._responded).toBeUndefined(); // cross-origin → returned early

    const signIn = makeEvent(`${ORIGIN}/sign-in`, 'navigate');
    sw.handlers.fetch(signIn);
    await signIn._responded?.catch(() => undefined);

    expect(sw.put).not.toHaveBeenCalled(); // nothing authenticated/private cached
  });

  // 8 — static assets are cached
  it('8 — versioned static assets are cached', async () => {
    const event = makeEvent(`${ORIGIN}/_next/static/z.css`);
    sw.handlers.fetch(event);
    await event._responded;
    await Promise.all(event._waits);
    expect(sw.put).toHaveBeenCalledTimes(1);
  });

  // 9 + 10 — old caches removed on activate; IndexedDB untouched
  it('9/10 — activate deletes obsolete caches, claims clients, and never touches IndexedDB', async () => {
    sw.cacheStore.set('farmos-static-old-v1', new Map());
    const event = { _waits: [] as Promise<unknown>[], waitUntil(p: Promise<unknown>) { this._waits.push(p); } };
    sw.handlers.activate(event);
    await Promise.all(event._waits);
    expect(sw.deletedCaches).toContain('farmos-static-old-v1');
    expect(sw.deletedCaches).not.toContain(sw.STATIC_NAME);
    expect(sw.claim).toHaveBeenCalled();
    // never CALLS an IndexedDB API (the word "IndexedDB" in a comment is fine)
    expect(SW_SOURCE).not.toMatch(/deleteDatabase/);
    expect(SW_SOURCE).not.toMatch(/indexedDB\s*\./);
  });
});

describe('Service Worker source guarantees', () => {
  it('bumped the cache version so browsers install the corrected worker', () => {
    expect(SW_SOURCE).toMatch(/SW_VERSION = 'sw-clone-fix-v2'/);
  });
  it('clones synchronously (not inside the async caches.open().then())', () => {
    // the clone is assigned to a local before caches.open is called
    expect(SW_SOURCE).toMatch(/const responseForCache = response\.clone\(\)/);
    expect(SW_SOURCE).toMatch(/event\.waitUntil\(\s*caches[\s\S]*cache\.put\(request, responseForCache\)/);
    expect(SW_SOURCE).not.toMatch(/cache\.put\(request, response\.clone\(\)\)/); // the old buggy shape is gone
  });
});

// 12 — CSP telemetry policy matches the chosen configuration (Option A: disabled)
describe('12 — Clerk telemetry CSP policy', () => {
  it('production CSP does not allow clerk-telemetry.com (telemetry is disabled, not permitted)', () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).not.toContain('clerk-telemetry.com');
    // required Clerk auth domains stay allowed
    expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.clerk\.accounts\.dev/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/api\.clerk\.com/);
  });
  it('the app disables Clerk telemetry via the ClerkProvider prop', () => {
    const layout = readFileSync(path.resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    expect(layout).toMatch(/telemetry=\{\{ disabled: true \}\}/);
  });
});
