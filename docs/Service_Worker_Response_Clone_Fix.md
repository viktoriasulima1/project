# Service Worker `Response.clone` Fix

Date: 2026-07-23. Fixes the repeated `TypeError: Failed to execute 'clone' on
'Response': Response body is already used` at `sw.js:30`, and disables the noisy
Clerk telemetry CSP-blocked request. No offline behaviour, auth, or CSP weakened.

## 1. Exact root cause

The static-asset branch cloned the response **inside an asynchronous
`caches.open(...).then()` callback**, which runs *after* `return response` has
already handed the original body to the browser:

```js
// OLD (buggy) — public/sw.js:30
if (response.ok) caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
return response;
```

`caches.open(...)` returns a promise; its `.then` callback is a microtask. By the
time it runs, `return response` has completed and the browser has begun reading
the body, so `response.bodyUsed === true` and `response.clone()` throws. Because
the clone lived in a floating promise chain with no `.catch`, every static fetch
during navigation / Fast Refresh produced an **unhandled** rejection.

## 2. Old response lifecycle

1. `fetch(request)` → `response`.
2. `caches.open(STATIC_CACHE)` scheduled (async).
3. `return response` → browser starts consuming the body → `bodyUsed = true`.
4. microtask: `cache.put(request, response.clone())` → `clone()` throws
   "Response body is already used" → unhandled promise rejection.

Single response, consumed by the browser, then cloned too late = crash.

## 3. Corrected response lifecycle

Clone **synchronously**, before returning; move the write into
`event.waitUntil` with a `.catch`:

```js
return fetch(request).then((response) => {
  if (response.ok) {
    const responseForCache = response.clone();   // taken while body is untouched
    event.waitUntil(
      caches.open(STATIC_CACHE)
        .then((cache) => cache.put(request, responseForCache))
        .catch((error) => { if (IS_DEV) console.warn('[FarmOS SW] cache write skipped:', error && error.message); }),
    );
  }
  return response;                                // original, untouched, to the page
});
```

Each body now has exactly one owner: the **clone** belongs to the cache, the
**original** is returned to the browser. `event.waitUntil` keeps the worker alive
for the write; the `.catch` guarantees a failed write can never reject.

## 4. Cache scope (unchanged, re-verified)

Cached: only `/_next/static/*` (versioned, immutable) + the 3-file public shell
allowlist (`/offline.html`, `/manifest.webmanifest`, `/window.svg`). **Never
cached:** authenticated HTML, RSC payloads, Server Actions, `/api/*`, Clerk
requests (cross-origin → returned early), `/sign-in`, `/sign-up`, private scouting
photos, signed URLs, health endpoints, dynamic user/farm data. Navigations stay
network-first; `/offline.html` is served only on a real network failure. Tests
5–8 assert this against the real worker.

## 5. Upgrade behaviour (Part 5)

`SW_VERSION` bumped `sprint22-v1` → `sw-clone-fix-v2` (cache name
`farmos-static-sw-clone-fix-v2`), so browsers install the corrected worker.
`activate` deletes every cache whose name ≠ the current one, **then**
`clients.claim()`. IndexedDB (offline drafts + sync queue) is never touched — the
worker only manages Cache Storage. A stale broken worker upgrades cleanly.

## 6. Clerk telemetry decision (Part 7)

**Option A — telemetry disabled.** `@clerk/nextjs`'s `ClerkOptions.telemetry`
(verified in the installed types: `false | { disabled?: boolean; debug?: boolean;
… }`) is set via the provider: `<ClerkProvider … telemetry={{ disabled: true }}>`.
The request to `https://clerk-telemetry.com/v1/event` is not made, so the CSP
stays strict — **no** `clerk-telemetry.com` added to `connect-src`, no wildcard.
Auth FAPI (`*.clerk.accounts.dev`), `api.clerk.com`, and protect/challenge
domains are unchanged. Chosen over Option B (permit the domain) because telemetry
is optional analytics and disabling keeps CSP tightest for both dev and prod.

## 7. Unit tests

`src/offline/__tests__/sw-response-lifecycle.test.ts` — 12 checks, the lifecycle
ones running the **real** `public/sw.js` in a mocked worker global whose
`MockResponse.clone()` throws if `bodyUsed`:
1/2 clone-before-cache + original returned untouched · 4 clone never on a used
body · 3/11 cache.put failure returns the network response with no rejection ·
5/6/7 navigations/`/api`/cross-origin Clerk not cached · 8 static cached · 9/10
activate deletes old caches + claims + no IndexedDB API · version bump + synchronous
clone (source) · 12 CSP omits clerk-telemetry and the provider disables telemetry.

## 8. Build result

`npx tsc --noEmit` → 0 · `npx vitest run` → **818 passed** (+10) · `npm run build`
→ exit 0, "Compiled successfully". Existing `tunnel-mobile-config` SW assertions
still pass (network-first, static-only, no sign-in).

## 9. Manual browser result

**NOT run in this environment** (no browser). Developer steps (Part 9):
`npm run dev` → DevTools → Application → Service Workers → confirm
`sw-clone-fix-v2` active → clear old SW caches once → reload → navigate
`/dashboard`, `/work-orders`, `/scouting`, `/offline` → console shows **zero**
"Response body is already used" and no blocked `clerk-telemetry.com` request.

## 10. Offline regression result

**NOT run here.** The worker still caches only static assets and serves
`/offline.html` on navigation failure; IndexedDB drafts + sync queue are
untouched by the SW, so offline draft persistence and exact-one sync are
unaffected by this change. Verify manually: create a draft, go offline, reload
(shell serves), reconnect, confirm exact-one sync.

## Rules honored

Clone before consuming; the clone error is fixed at its source, not caught and
hidden; no authenticated HTML or private API cached; IndexedDB never deleted;
production CSP not weakened (telemetry disabled instead of permitted).
