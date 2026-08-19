# Spray Window Resolver Localization Report

Date: 2026-07-31

## Outcome

Spray Window resolver localization is GO. The existing Case A implementation now emits canonical codes and structured metadata, while one shared adapter presents all real resolver output in nl-NL, en-GB, pl-PL and de-DE. No agronomic rule, threshold, score, workflow, provider, persistence model or authorization boundary changed.

Global resolver localization remains NO-GO: targeted findings moved 16 → 0, while the global count moved 431 → 415.

## Automated validation

| Gate | Result |
|---|---|
| Prisma | 22 migrations; schema current |
| TypeScript | PASS |
| Unit tests | 984/984 PASS (89 files) |
| Production build | PASS; existing non-blocking NFT tracing warning only |
| Focused resolver/localization tests | 46/46 PASS |
| Focused browser regression | 21/21 PASS, retries 0, 3 min 6 s |
| Full browser suite | 175 collected; 174 passed; 1 documented conditional skip; 0 failed/flaky; 20 min 7 s wall time |
| Clerk users | Before 5 total / 4 fixed-pool; after 5 / 4; 0 created |
| Browser isolation | No Service Worker state leak or IndexedDB isolation failure reported |
| Resolver audit | Spray Window 16 → 0; global 431 → 415 |

The first focused browser run exposed a case-sensitive assertion against the localized “Indicative only” label. This was a test defect, not an application decision defect; the assertion was made case-insensitive and the complete focused set then passed without retries.

## Evidence

- All 32 existing signal branches are covered across four locales, including safe empty/unavailable and unknown-code fallbacks.
- Existing resolver and action tests continue to characterize scores, thresholds, blockers, warnings and planned/advisory context behaviour.
- The real Activity suitability path and existing multilingual regression paths passed in Chromium.
- Weather, Activity suitability and Farm Insights now consume the shared adapter; raw canonical signal codes are not user-visible.

## Honest scope

- Work Orders have no Spray Window resolver caller; no readiness integration is claimed.
- The Dashboard weather card uses a separate simplified status and was not changed in this stage.
- No physical-phone validation is claimed by this localization stage.
- Native agronomic review of localized wording remains advisable before field use.
