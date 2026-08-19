# Cloudflare Tunnel — Mobile Blank Screen Report

Date: 2026-07-22. Fix for FarmOS rendering blank through a
`https://*.trycloudflare.com` Quick Tunnel (desktop and iPhone), while
`/api/health` worked. Full audit: `Cloudflare_Tunnel_Mobile_Blank_Screen_Audit.md`.

## 1. Root cause

Next.js 16.2.9's dev server **blocks cross-origin requests to its internal dev
resources** (`/_next/*`, `/__nextjs*`, and the HMR WebSocket). In
`next/dist/.../router-utils/block-cross-site-dev.js`, `blockCrossSiteDEV` returns
**HTTP 403 "Unauthorized"** unless the request's Origin/Referer host is in
`['*.localhost', 'localhost', ...allowedDevOrigins, <hostname>]`. The tunnel host
`*.trycloudflare.com` was **not** in that list (no `allowedDevOrigins` was
configured), so every client JS chunk and the HMR socket was 403-blocked. The
server-rendered HTML arrived (hence `/api/health` and the shell worked), but the
client bundle never loaded → React never hydrated → **blank page**. The Clerk
preload warning was benign; the CSP, service worker, and redirects were not at
fault.

## 2. Files inspected

`next.config.ts`, `src/app/layout.tsx`, `src/app/sign-in/[[...sign-in]]/page.tsx`,
`src/app/sign-up/[[...sign-up]]/page.tsx`, `src/app/page.tsx`, `src/proxy.ts`,
`src/lib/clerk-config.ts`, `.env.local` (keys by prefix only), `public/sw.js`,
`src/offline/OfflineProvider.tsx` (SW registration), and the installed
`next/dist/.../block-cross-site-dev.js` + `csrf-protection.js` (to confirm the
block + that the wildcard matcher accepts `*.trycloudflare.com`).

## 3. Next.js origin changes (the fix)

- New pure module `src/lib/dev-origins.ts` → `devOriginConfig(isDev)` returns, in
  **development only**: `allowedDevOrigins: ['*.trycloudflare.com']` and
  `serverActions: { allowedOrigins: ['*.trycloudflare.com'] }`. Empty in
  production.
- `next.config.ts` spreads that config in (dev-only) alongside the existing
  headers — **all prior settings preserved**; production stays strict
  (no `allowedDevOrigins`, default same-origin Server Actions). The
  `serverActions.allowedOrigins` shape was confirmed against the installed
  Next 16.2.9 types (under `experimental`).

## 4. Clerk changes

None to keys or redirects. Verified: `pk_test_`/`sk_test_` dev keys are detected
by `isClerkConfigured`; `/sign-in`, `/sign-up`, `/dashboard` routes come from
`.env.local` and stay **relative**; the SignIn/SignUp pages use the correct
catch-all Clerk components; no tunnel hostname is hardcoded anywhere. Added a
**development-only** `ClerkBootBoundary` (mounted by the layout only when
`NODE_ENV=development`) that shows *"Authentication UI failed to load. Check the
browser console and Clerk development configuration."* instead of a blank body
if the auth UI throws during render. Production error handling is unchanged.

## 5. CSP findings

Not the cause. The existing CSP already permits `https://*.clerk.accounts.dev`
(script/connect/frame/form-action) and `img.clerk.com`, which covers the
`@clerk/ui`/`clerk-js` assets loaded from `enabling-gannet-9.clerk.accounts.dev`.
The CSP was **extracted** into a testable pure helper
(`src/lib/security-headers.ts`), a `worker-src 'self' blob:` directive added, and
same-origin `ws:`/`wss:` allowed in **development only** (for HMR). Production CSP
strength is unchanged (no `'unsafe-eval'`, no bare `*`).

## 6. Service worker findings

Safe. `public/sw.js` is **network-first for navigations** (`offline.html` only on
a real network failure), caches **only** `/_next/static/` + a 3-file static
allowlist, is same-origin scoped, and its caches are per-origin (a localhost
cache cannot leak to the tunnel origin). It is registered by `OfflineProvider`,
which is not mounted on `/sign-in`/`/sign-up`. So sign-in is never served from an
offline shell. `/dev/mobile-diagnostics` includes a dev cleanup button to
unregister the SW and clear caches.

## 7. Redirect findings

Safe. `app/page.tsx` does a server-side `redirect('/dashboard')` (relative,
`force-dynamic`); Clerk's protect-redirect to `/sign-in` uses the request origin.
No absolute/localhost origin, no loop. A regression test asserts the target is
relative, not absolute, not host-pinned, and not `/`.

## 8. HMR conclusion

The `wss://…trycloudflare.com/_next/webpack-hmr` failure is a **development-only**
limitation of the Quick Tunnel and is **not** the blank-page cause. With
`allowedDevOrigins` set, chunks load and the page renders even if HMR stays
unavailable. Not treated as an application failure; no security was changed to
make HMR work.

## 9. Tests added

`src/lib/__tests__/tunnel-mobile-config.test.ts` — **14 tests**: dev-key
detection, placeholder rejection, ClerkProvider mount gate, `/sign-in` + `/sign-up`
anonymous access, root redirect (relative, no loop), tunnel origin accepted in
dev, tunnel origin rejected in production, SW excludes sign-in from any HTML
cache, CSP permits Clerk dev assets, CSP strict in production, Clerk-failure
fallback is visible, and Server Actions accept the tunnel origin in dev only.

## 10–12. Automated validation (this machine)

- **TypeScript:** `tsc --noEmit` → exit 0.
- **Unit tests:** `vitest run` → **757 passed / 757** (743 + 14 new).
- **Build:** `npm run build` → exit 0, "Compiled successfully"; `/dev/mobile-diagnostics`
  present as a dynamic route; no `allowedDevOrigins` emitted in the production
  config (dev-only).

## 13. Desktop tunnel result

**Not run in this environment** (no `cloudflared` tunnel could be established
here). The fix is verified at the config/build/test level against the actual
installed Next.js block logic. Manual step for the developer:
`npm run dev`, start `cloudflared tunnel --url http://localhost:3000`, then open
the generated HTTPS URL's `/dev/mobile-diagnostics`, `/sign-in`, `/`, and
`/dashboard` in desktop Chrome — expect the SignIn UI, working redirects, no CSP
errors, and no blank screen (an HMR warning may remain).

## 14. iPhone result

**NOT TESTED on a physical iPhone.** No device was available; no iPhone success
is claimed. Repeat the desktop steps in iPhone Safari (and the installed PWA)
against the tunnel URL, starting at `/dev/mobile-diagnostics` to confirm secure
context, cookies, storage, and SW status.

## 15. Remaining limitations / notes

- HMR over the Quick Tunnel may still fail (dev-only; rendering is unaffected).
- The random tunnel subdomain changes each run — the fix uses the wildcard
  `*.trycloudflare.com`, so **no hostname is hardcoded** and no re-config is
  needed per tunnel.
- Physical iPhone/Android validation and a live desktop-through-tunnel pass
  remain the developer's manual steps.
- For a fully HMR-free check, also tunnel a production-like `npm run build &&
  npm run start` server (no `/_next/webpack-hmr` channel at all).

## Rules honored

No auth bypass; no production security weakening; no production Clerk keys; Clerk
not replaced; the tunnel hostname is not hardcoded (`*.trycloudflare.com` used in
development only); all existing Next.js configuration preserved; a visible dev
fallback replaces the blank page; HMR failure does not block rendering.
