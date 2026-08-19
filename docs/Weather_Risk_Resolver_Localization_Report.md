# Weather Risk resolver localization — Stage 9 report

## Outcome

The real `scouting-weather-v1` resolver now returns a language-independent contract: status/compatibility level, four reason codes, three action codes, confidence, freshness, structured metadata/evidence, model version, priority, `diagnostic: false` and `requiresFieldConfirmation: true`. Former `why`, `inputFacts`, `missingInputs` prose and `recommendedAction` fields were removed.

`buildWeatherRiskDisplayModel` owns localized status, explanation, action, confidence, freshness, evidence, units and non-diagnostic disclaimer for nl-NL, en-GB, pl-PL and de-DE. Unknown runtime values degrade to localized unavailable wording without exposing raw codes.

## Decision preservation

Fifteen characterization tests froze all actual thresholds and precedence before the refactor. The implementation still has only low, moderate, high and unavailable results. It does not contain frost, heat, wind, stale/provider/offline or disease-specific rules. `observedAt` remains decision-neutral. No new diagnosis or treatment language was introduced.

## Consumer audit

There is no production call to `resolveWeatherRisk`. Existing Field Health surfaces do not compute Weather Risk; Work Orders, Dashboard, Insights, Briefing, Weather, reports and exports do not consume it. Consequently no fake UI section, E2E database helper, fixtures, provider integration or persistence migration was added. Completed Field Health and Economic Signals contracts remain untouched.

## Validation ledger

- Baseline: resolver debt 437; unit 950/950; build/typecheck PASS.
- Baseline Economic Signals + Field Health E2E: 12/12 PASS, retries=0.
- Characterization: 15/15 PASS before contract change.
- Targeted Weather Risk findings: 6 → 0; global resolver findings: 437 → 431.
- Canonical/localization focused unit group: 50/50 PASS.
- Final TypeScript: PASS; full unit: 975/975 PASS in 88 files (57.40 s); production build: PASS.
- Focused localization regression: 40/40 PASS, retries=0, 5 min 41 s.
- Full regression E2E: 175 collected, 174 passed, 1 documented conditional skip, 0 failed/flaky, retries=0, exit 0, 19 min 54 s. `.last-run.json` is `passed` with no failed test IDs.
- Clerk before/after: 5 total, 4 fixed-pool of 4 configured, 0 users created.
- No Service Worker or IndexedDB isolation failure was reported.
- Final module audits (outside Stage 9): Weather 12, Fields 45, Scouting 32, Dashboard 14; Insights scanner found 0 files.

## Honest status

Weather Risk domain resolver localization is **GO**. User-visible Weather Risk E2E flows are **not applicable to the current product** because no production surface consumes this resolver; this report does not mislabel Field Health or Spray Window tests as Weather Risk UI coverage. Full-stage UI integration is therefore **NO-GO / not implemented**, and global resolver localization remains **NO-GO** pending Spray Window, User Error and other groups. Physical-device Weather Risk UI validation is likewise not applicable until a surface exists.
