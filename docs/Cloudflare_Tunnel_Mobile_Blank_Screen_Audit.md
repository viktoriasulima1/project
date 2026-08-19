# Cloudflare Tunnel — Mobile Blank Screen Audit (Part 1)

Date: 2026-07-22. Why `/` and `/sign-in` render blank through a
`https://*.trycloudflare.com` Quick Tunnel while `/api/health` works.

## Root cause (confirmed in the installed Next.js source)

**Missing `allowedDevOrigins`.** Next.js 16.2.9's dev server blocks cross-origin
requests to its internal dev resources. In
`node_modules/next/dist/esm/server/lib/router-utils/block-cross-site-dev.js`,
`blockCrossSiteDEV` returns **HTTP 403 "Unauthorized"** for any request to
`/_next/*` or `/__nextjs*` whose Origin/Referer host is not in
`['*.localhost', 'localhost', ...allowedDevOrigins, <server hostname>]`.

Through the tunnel the browser sends `Origin/Referer:
costume-therapist-rolling-munich.trycloudflare.com`, which is **not** in that
list, so **every `/_next/static/chunks/*.js` request and the
`/_next/webpack-hmr` WebSocket is 403-blocked**. The server-rendered HTML shell
arrives (that is why `/api/health`, a route handler, works), but the client
bundle never loads → React never hydrates → **blank screen**. The failing HMR
WebSocket in the console is the same protection, not a separate bug.

The matcher `isCsrfOriginAllowed` (`app-render/csrf-protection.js`) supports
wildcards (`*.localhost` is a built-in default), and
`matchWildcardDomain('costume-….trycloudflare.com', '*.trycloudflare.com')`
returns **true**, so `allowedDevOrigins: ['*.trycloudflare.com']` is the correct,
minimal, dev-only fix. `next.config.ts` currently sets **no** `allowedDevOrigins`.

## What is NOT the cause (verified)

| Area | Finding |
| --- | --- |
| ClerkProvider mounted | ✅ `layout.tsx` wraps the app in `ClerkProvider` when `isClerkConfigured` (dynamic import). |
| Dev Clerk keys detected | ✅ `.env.local` has `pk_test_…`/`sk_test_…`; `isClerkConfigured` matches `pk_(test\|live)_[A-Za-z0-9]{20,}` — dev keys pass. |
| `/sign-in` public | ✅ `proxy.ts` public routes: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/health`; middleware matcher excludes `_next` + static. |
| Production safety check | ✅ `checkClerkProductionSafety` only blocks in `NODE_ENV=production` with test keys (not E2E). In dev it is a no-op — it does **not** blank the page. |
| CSP blocking Clerk | ❌ Not blocking. `script-src`/`connect-src`/`frame-src`/`form-action` allow `https://*.clerk.accounts.dev` (the `@clerk/ui` preload host `enabling-gannet-9.clerk.accounts.dev` matches); `img-src` allows `img.clerk.com`/`*.clerk.com`. The Clerk preload *warning* is benign, as the brief suspected. (We still add `worker-src` defensively and make the CSP unit-testable.) |
| Service worker offline shell | ✅ `public/sw.js` is **network-first** for navigations (`offline.html` only on network failure), caches **only** `/_next/static/` + a tiny static allowlist, and is same-origin scoped. `/sign-in` is never served from the offline shell; caches are per-origin so a localhost cache can't leak to the tunnel origin. The SW is registered by `OfflineProvider`, which is not mounted on `/sign-in`/`/sign-up`. |
| Root redirect | ✅ `app/page.tsx` `redirect('/dashboard')` — server-side, **relative** route, `force-dynamic`; Clerk's protect redirect to `/sign-in` uses the request origin. No localhost hardcoding, no loop. |

## HMR WebSocket

`wss://…trycloudflare.com/_next/webpack-hmr` failing is a **development-only**
limitation (the Quick Tunnel + the same cross-origin protection). Once
`allowedDevOrigins` is set, chunk loading succeeds and the page renders even if
HMR remains unavailable. This is also confirmable by tunnelling a production-like
`npm run build && npm run start` server, which has no HMR channel at all.

## Fix plan

1. **`allowedDevOrigins: ['*.trycloudflare.com']`** (dev only) + **`experimental.serverActions.allowedOrigins: ['*.trycloudflare.com']`** (dev only) in `next.config.ts` — preserving all existing settings; production stays strict.
2. Extract the CSP into a testable helper; add `worker-src`; keep production strict.
3. Dev-only visible fallback if Clerk fails to initialize (never a blank body).
4. `/dev/mobile-diagnostics` (dev-only) for safe on-device diagnostics + a SW/cache reset control.
5. Regression tests including a tunnel-style HTTPS host.

No auth bypass, no production Clerk keys, no weakened production security.
