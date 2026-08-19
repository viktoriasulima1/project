# Field Resolver Localization — Audit

## Financial Completeness closure — 2026-07-28

# Stage 10 update — Spray Window

# Stage 11 update — User Error contracts

# Stage 12 update — classified residual debt

The remaining 402 resolver findings are now classified as 349 active localization targets, 47 fixture-only, four development-only and two internal diagnostics. Counts did not change because Stage 12 is inventory-only. Global resolver localization remains NO-GO.

Shared error-domain prose was replaced by canonical codes and a four-locale adapter; Onboarding is the first fully migrated consumer slice. Global findings moved 415 → 402. The separate active error-path audit remains 150, so application-wide completion is not claimed.

The real Spray Window resolver and its Weather, Activity suitability and Farm Insights consumers now use canonical signals plus a shared four-locale adapter. Targeted findings moved 16 → 0 and global resolver debt moved 431 → 415. Thresholds, scoring, planned/advisory policy and best-window selection are unchanged. Work Orders and the separate simplified Dashboard status remain outside this resolver.

Financial Completeness is the fourth fully localized resolver slice: canonical
status/reason/recorded/action codes, deterministic order and a shared
Field/Finance adapter. Targeted debt is 0. The global resolver audit is 486 and
remains NO-GO for unrelated resolver groups. Final browser evidence: dedicated
11/11, focused regression 25/25, unrestricted 152 pass + 1 documented skip
from 153 collected.

Date: 2026-07-27. Measures the domain-layer English-prose blind spot that the
component audit (`i18n:audit`) cannot see, because pure resolvers return complete
English sentences through expressions rather than JSX literals.

## New tooling — `npm run i18n:audit -- resolvers`

Scans `src/lib/**/*.ts` (excluding tests) for final English prose a pure domain
module must not return:
- exported label maps (`*_LABEL` / `*Labels`),
- prose-field object props (`explanation`/`recommendedAction`/`recommendation`/
  `reason`/`message`/`title`/`note`/`summary`) with an English value,
- bare English-sentence string literals (catches prose passed **positionally**,
  e.g. `result(status, sev, 'No active crop season is available.', …)`).
Suppressible with `i18n-audit-ignore`.

## Baseline (measured)

**527 unexplained domain-prose strings across 98 files.** Largest offenders:

| File | Count | Kind |
| --- | ---: | --- |
| `lib/mock-data/farm-dashboard.ts` | 47 | fixture prose (likely suppressible) |
| `lib/actions/economics.ts` | 31 | server-action error/status prose |
| `lib/farm-insights.ts` | 30 | insight explanations/recommendations |
| `lib/actions/activities.ts` | 28 | action error prose |
| `lib/actions/compliance-corrections.ts` | 27 | action prose |
| `lib/field-economics.ts` | 23 | break-even / completeness / budget / action reasons, `COST_CATEGORY_LABEL` |
| `lib/field-economics-detail.ts` | 23 | detail resolver prose |
| `lib/actions/field-operations.ts` | 23 | action prose |
| `lib/farm-economic-signals.ts` | 22 | economics signal titles/explanations |
| `lib/scouting/field-health.ts` | 22 | health `explanation`/`recommendedAction`/`primaryEvidence`, `FIELD_HEALTH_LABELS` |
| … | … | (88 more files) |

## The Part-2..10 target subset (this brief's scope)

The resolvers this brief asks to refactor total ≈ **90+** prose strings:
`field-health` (22), `field-economics` (23, incl. break-even/completeness/budget/
cost-category/field-action), `field-economics-detail` (23), `farm-economic-signals`
(22), plus shared `economics`/`economics-insights`. The rest (server-action error
prose in `lib/actions/*`, fixtures) is related but out of this brief's scope.

## Representative return shapes (field-health)

`resolveFieldHealthStatus` (pure) returns, per branch, **positional English prose**:
- `explanation: 'No active crop season is available.'`
- `recommendedAction: 'Plan a crop season before assessing crop health.'`
- `primaryEvidence: ['No active field season']`
- interpolated: `` `${severe.length} severe unresolved observation(s) require review.` ``
- `FIELD_HEALTH_LABELS: Record<FieldHealthStatus, string>` (English map).

Consumers: Field Detail (`fields/[id]`), Dashboard Crop Health card, Farm Insights.
Each already renders these via `{expression}` (audit-blind).

## Classification

- **status label:** `FIELD_HEALTH_LABELS`, `COST_CATEGORY_LABEL` → move to enum namespaces / `getEnumLabel`.
- **explanation / recommendation:** health explanation + recommendedAction; break-even/completeness/budget messages → stable `code` + metadata + UI adapter.
- **reason code:** field-action availability `reason` → code + metadata.
- **calculation result:** numeric values are already canonical; only their prose wrappers are English.

## Conclusion

The refactor (Parts 2–13) is a large, resolver-by-resolver effort (≈90+ target
strings, 527 total) that must preserve every decision with characterization
tests. **This iteration delivered the measurement tool + baseline only** — see
`Field_Resolver_Localization_Report.md`.
# Stage 5 update — Budget Variance (2026-07-31)

Budget Variance Field Detail presentation now uses canonical codes and the shared four-locale adapter. Missing values remain distinct from explicit zero. Stable section/value/status/action selectors and mobile coverage are present. Targeted Budget Variance resolver audit: 0. General Field module audit remains 61 unrelated findings.
# Stage 6 update (2026-07-31)

Cost Category, source type, attribution, and version-state presentation now use canonical codes plus one shared four-locale adapter. `COST_CATEGORY_LABEL` was removed. Targeted findings are 0; global resolver audit moved 473 → 460 and Fields component audit moved 61 → 45. Gross Margin and timeline action prose remain separate future stages.
# Stage 7 update — Gross Margin

Gross Margin targeted findings are 0 after replacing three English domain-note fields with canonical reason codes. The global resolver audit moved from 460 to 457; global localization is not complete. See `Gross_Margin_Resolver_Audit.md`.

# Stage 8 update — Remaining Economic Signals

Economic Signals targeted resolver findings moved 20 → 0. Twelve canonical signal codes and stable action codes now serve Dashboard, Farm Insights and deterministic Daily Briefing through one four-locale adapter. Global resolver findings moved 457 → 437; unrelated resolver localization remains incomplete.

# Stage 9 update — Weather Risk

The isolated `scouting-weather-v1` resolver moved 6 → 0 targeted findings and global resolver debt moved 437 → 431. Thresholds and Field Health decisions are unchanged. No production Field surface currently invokes this resolver, so no Field UI integration is claimed.
