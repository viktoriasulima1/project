import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { isClerkConfigured } from '../clerk-config';
import { isPublicPath, PUBLIC_ROUTES } from '../public-routes';
import { devOriginConfig, tunnelOriginAcceptedInDev, hostMatchesWildcard, TRYCLOUDFLARE_DEV_ORIGIN } from '../dev-origins';
import { buildContentSecurityPolicy } from '../security-headers';
import { ClerkBootBoundary } from '@/components/dev/ClerkBootBoundary';

const TUNNEL_HOST = 'costume-therapist-rolling-munich.trycloudflare.com';
const VALID_DEV_KEY = 'pk_test_ZW5hYmxpbmctZ2FubmV0LTkuY2xlcmsuYWNjb3VudHMuZGV2JA';

describe('1/2/3 — Clerk key detection', () => {
  it('1 — development pk_test_ keys are detected', () => {
    expect(isClerkConfigured(VALID_DEV_KEY)).toBe(true);
    expect(isClerkConfigured('sk_live_shouldNotMatchPublishable')).toBe(false);
  });
  it('2 — placeholder / empty keys are rejected', () => {
    for (const k of [undefined, '', 'pk_test_', 'pk_test_REPLACE_ME', 'xxx', 'pk_test_short']) {
      expect(isClerkConfigured(k as string | undefined)).toBe(false);
    }
  });
  it('3 — layout mounts ClerkProvider when a valid dev key is configured (gate is true)', () => {
    expect(isClerkConfigured(VALID_DEV_KEY)).toBe(true);
  });
});

describe('4/5 — public auth routes reachable anonymously', () => {
  it('4 — /sign-in and its catch-all subpaths are public', () => {
    expect(isPublicPath('/sign-in')).toBe(true);
    expect(isPublicPath('/sign-in/factor-one')).toBe(true);
  });
  it('5 — /sign-up and its subpaths are public', () => {
    expect(isPublicPath('/sign-up')).toBe(true);
    expect(isPublicPath('/sign-up/verify-email-address')).toBe(true);
  });
  it('a protected route is not public', () => {
    expect(isPublicPath('/dashboard')).toBe(false);
    expect(PUBLIC_ROUTES).toContain('/dev/mobile-diagnostics');
  });
});

describe('6/7 — root redirect', () => {
  it('6/7 — redirects to a relative /dashboard (no loop through /, no absolute/localhost origin)', async () => {
    const redirect = vi.fn();
    vi.doMock('next/navigation', () => ({ redirect }));
    const { default: RootPage } = await import('@/app/page');
    RootPage();
    expect(redirect).toHaveBeenCalledWith('/dashboard');
    const target = redirect.mock.calls[0][0] as string;
    expect(target.startsWith('/')).toBe(true);       // relative
    expect(target).not.toMatch(/^https?:\/\//);       // not absolute
    expect(target).not.toContain('localhost');        // not host-pinned
    expect(target).not.toBe('/');                     // does not loop back to /
    vi.doUnmock('next/navigation');
  });
});

describe('8/9/14 — tunnel dev origin acceptance', () => {
  it('8 — the tunnel wildcard matches a real tunnel host and is configured in dev', () => {
    expect(hostMatchesWildcard(TUNNEL_HOST, TRYCLOUDFLARE_DEV_ORIGIN)).toBe(true);
    expect(tunnelOriginAcceptedInDev(TUNNEL_HOST, true)).toBe(true);
    expect(devOriginConfig(true).allowedDevOrigins).toContain('*.trycloudflare.com');
  });
  it('9 — production rejects the tunnel wildcard (strict)', () => {
    expect(tunnelOriginAcceptedInDev(TUNNEL_HOST, false)).toBe(false);
    expect(devOriginConfig(false)).toEqual({});
  });
  it('14 — Server Actions accept the tunnel origin only in dev', () => {
    expect(devOriginConfig(true).serverActions?.allowedOrigins).toContain('*.trycloudflare.com');
    expect(devOriginConfig(false).serverActions).toBeUndefined();
    // wildcard never matches the bare domain
    expect(hostMatchesWildcard('trycloudflare.com', TRYCLOUDFLARE_DEV_ORIGIN)).toBe(false);
  });
});

describe('10 — service worker never serves sign-in from an offline shell', () => {
  const sw = readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf8');
  it('caches only /_next/static + a tiny static allowlist; navigations are network-first', () => {
    expect(sw).toContain("url.pathname.startsWith('/_next/static/')");
    expect(sw).toContain("request.mode === 'navigate'");
    expect(sw).toContain("fetch(request).catch(() => caches.match('/offline.html'))");
    // sign-in/up are not part of any precache/static allowlist
    expect(sw).not.toContain('/sign-in');
    expect(sw).not.toContain('/sign-up');
  });
});

describe('11/12 — CSP', () => {
  it('11 — development CSP permits the required Clerk assets', () => {
    const csp = buildContentSecurityPolicy(true);
    expect(csp).toMatch(/script-src[^;]*https:\/\/\*\.clerk\.accounts\.dev/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.clerk\.accounts\.dev/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/api\.clerk\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/\*\.clerk\.accounts\.dev/);
    expect(csp).toMatch(/form-action[^;]*https:\/\/\*\.clerk\.accounts\.dev/);
    expect(csp).toMatch(/img-src[^;]*https:\/\/img\.clerk\.com/);
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("'unsafe-eval'"); // dev-only, for Next HMR
  });
  it('12 — production CSP stays strict (no unsafe-eval, no bare wildcard source, no ws:)', () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain(' ws:');
    expect(csp).not.toMatch(/(^|[;\s])\*($|[;\s])/); // no bare '*' source
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe('13 — Clerk init failure shows a visible dev fallback (not a blank page)', () => {
  it('getDerivedStateFromError flags failure and renders a clear message', () => {
    expect(ClerkBootBoundary.getDerivedStateFromError()).toEqual({ failed: true });
    const instance = new ClerkBootBoundary({ children: null });
    instance.state = { failed: true };
    const html = renderToStaticMarkup(instance.render() as React.ReactElement);
    expect(html).toContain('Authentication UI failed to load');
    expect(html).not.toContain('pk_test'); // no secrets/keys in the fallback
  });
});
