# Gross Margin resolver localization — Stage 7 report

## Result

Gross Margin has a canonical discriminated result and a shared four-locale presentation adapter. The established formula, record inclusion, signs, rounding, farm scope and persistence are unchanged.

## Validation record

- Baseline: resolver debt 460; unit tests 944; full-E2E reference 165 collected / 164 passed / 1 conditional skip.
- Final targeted audit: 3 → 0; global resolver debt: 457 (not globally complete).
- i18n validation: PASS, four locales and placeholder parity.
- option-value audit: PASS.
- TypeScript: PASS.
- Unit suite after implementation: 950/950 PASS.
- Focused Gross Margin E2E: 6/6 PASS, 0 flaky, retries=0, 1.4 minutes.
- Resolver regression E2E: 41/41 PASS, 0 flaky, retries=0, 6.2 minutes.
- Final unrestricted E2E: 170 collected / 169 passed / 1 documented conditional skip / 0 failed / 0 flaky, retries=0, exit code 0, 19.7 minutes.
- Clerk before and after: 5 total / 4 configured fixed-pool; 0 new users.
- Prisma: client generated; all 22 migrations applied.
- TypeScript and production build: PASS. Build retained the pre-existing non-blocking NFT trace warning for scouting photo storage.

## Integration evidence

Field Detail and Finance read the same `grossMarginResult`. The browser suite proves positive, zero, negative, unavailable and partial states, locale changes, Finance consistency, mobile layouts, canonical signs and no raw-code leakage. Financial Completeness remains authoritative. Cost Category, Budget Variance, Break-even, Field Health, Field Action and locale-hydration regression specs remain green.

The shared adapter supplies localized status, reason, action and locale-aware currency text for `nl-NL`, `en-GB`, `pl-PL` and `de-DE`. Field/crop names and farmer-entered values remain unchanged. No localized text is persisted. Historical records need no rewrite.

## Remaining work and release status

The full suite's offline isolation and service-worker safety scenarios passed in the same uninterrupted run. No IndexedDB or Service Worker state leakage, duplicate financial record, missing-to-zero conversion, or changed calculation was observed.

Physical-device validation remains a separate release requirement.

**Gross Margin resolver localization — full stage GO.**

**Global resolver localization — still NO-GO** pending Economic Signals, Weather Risk, Spray Window, User Error and other resolver groups.
