# Financial Completeness preflight regression triage

## Final closure — 2026-07-28

The unrestricted 153-test run initially exposed ten test/harness defects and
one later offline-event timing defect. They were classified and corrected
without changing Financial Completeness decisions:

- stale/locale-specific accessible names in founder, scouting, mobile,
  work-order and dashboard assertions;
- repeated Clerk sign-in in one mobile loop;
- 60-second timeout on the 21-step walkthrough and global auth setup;
- fixture harvest state not cleared on an idempotent reseed;
- Playwright offline event timing and checkbox-unmount assumptions;
- decimal-separator and strict text-locator assumptions.

The first attempted focused run was blocked before scenarios by Clerk HTTPS
unavailability. A second setup run timed out at 60 seconds. Neither was counted
as a pass. Final evidence: Financial Completeness 11/11, regression gate 25/25,
and unrestricted E2E 152 passed + 1 documented conditional skip from 153
collected; 0 failed, 0 flaky, retries=0.

Date: 2026-07-27.

| Spec/flow | Classification | Evidence and fix |
|---|---|---|
| Field Health C | Test isolation defect | Authenticated DB locale overrode the anonymous cookie. Sign in and set the fixed user's locale explicitly. |
| Field Health E | Selector + state defect | `aside button:first()` selected global navigation, not the exact seeded map field; cookie-only locale change could not override DB preference. Scope to `main aside`, match the seeded field, and update DB locale. |
| Field Actions A | Expected offline navigation limitation | Reload after `context.setOffline(true)` returned `ERR_INTERNET_DISCONNECTED`. Load online, then assert already-rendered action state offline. |
| Field Actions E | Offline navigation + isolation defect | `goto()` while offline failed; the mobile loop also signed the same Clerk session in twice. Sign in/seed once, navigate online, enter offline only for assertions, restore and wait for `navigator.onLine`. |

No product action-availability, localization, service-worker, or farm-scoping
defect was found. Authenticated HTML was not added to the service-worker cache.

Final preflight: Field Health **7/7**, Field Actions **4/4**, Locale hydration
**5/5**, retries 0.
