# Sprint 22 Deployment Audit

## Current architecture

FarmOS is Next.js 16.2.9 App Router with Node/Prisma server routes, PostgreSQL, Clerk middleware, a same-origin service worker and IndexedDB offline data. No `vercel.json`, Dockerfile or committed hosting binding exists. The application therefore remains provider-neutral.

## Findings

- Local assumptions: localhost database, Clerk development keys and relative auth routes. The old pilot example incorrectly permitted `pk_test_`/`sk_test_`; corrected in Sprint 22.
- Temporary tunnels: none are hardcoded. Quick tunnels proved unsuitable for iPhone Clerk validation and are explicitly rejected by pilot URL validation.
- Missing external state: no selected stable hostname, production Clerk keys, hosted pilot database, DNS, deployment project, backup provider or monitoring provider is configured.
- Database: eight migrations; hosted deployment must use `prisma migrate deploy`. Pilot scripts now require an isolated `PILOT_DATABASE_URL`, safe target validation and explicit migration confirmation.
- Auth: `/sign-in` and `/sign-up` are catch-all routes; proxy protects all non-public routes. Production startup rejects test Clerk keys unless explicitly running isolated E2E.
- Health: public and database-aware; raw database errors were removed.
- PWA: relative `start_url` and same-origin scope contain no localhost/tunnel dependency. Authenticated HTML/API are never stored in the service-worker cache. IndexedDB is not touched during service-worker updates.
- Security: baseline CSP, frame denial, nosniff, referrer and permissions headers are configured. HSTS remains deferred until the stable domain and rollback destination are confirmed.
- Serverless: no application path assumes durable server filesystem storage; exports stream from route handlers. Prisma connection limits/pooling must be configured at the selected database provider.

## Deployment blockers

Stable domain/provider, `pk_live_`/`sk_live_`, isolated hosted database, backup restore evidence, monitoring, pilot account and physical iPhone results are absent. Deployment and both pilot GO decisions remain blocked.
