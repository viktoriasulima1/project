# Budget Variance resolver localization report

Date: 2026-07-31

## Result

**Budget Variance resolver localization — full stage GO.**

**Global resolver localization — still NO-GO** pending Cost Categories, Gross Margin, remaining Economic Signals and other resolver groups.

## Implementation

- Replaced the two-number legacy result with an exhaustive discriminated `BudgetVarianceResult`.
- Preserved `actual - budget`, denominator, sign, cents reconciliation, missing/zero and currency policy.
- Added exhaustive four-locale presentation mapping for nl-NL, en-GB, pl-PL and de-DE.
- Field Detail exposes stable selectors and localized budget, actual, variance, status, reason and action.
- Finance uses the exact same `FieldEconomicsRow.costVariance` result; it has no second formula.
- Dashboard and Farm Insights carry the canonical result, preserve selected field, priority inputs and CTA route, and localize at presentation.
- Machine CSV exports stable codes and canonical numbers. Human Budget PDF uses the active locale and the shared adapter. Checksums, counts, identifiers and audit provenance remain unchanged.
- The grounded briefing architecture was audited. No destructive rewrite of historical briefing records was made; the legacy mock daily-briefing generator remains separate documented localization debt.

## Missing-data and record-policy evidence

- Missing budget and missing actual render “Not recorded” equivalents, not EUR 0.
- Explicit zero budget and actual remain formatted zero.
- Unpriced activity cost produces `ACTUAL_COST_INCOMPLETE` and no precise variance.
- Seeded actual EUR 1,250 includes the current corrected EUR 450 entry, excludes reversed EUR 200, and keeps existing allocation behavior.
- Guarded E2E helper refuses a non-E2E database and scopes by Clerk user, farm, active season and exact field ID.

## Validation evidence

| Gate | Result |
|---|---|
| Initial global resolver audit | 486 |
| Targeted Budget Variance audit | 13 → 0 |
| Final global resolver audit | 473 (remaining unrelated debt) |
| i18n validate | PASS, 4 locales, 9 namespaces, 0 warnings |
| i18n option audit | PASS |
| Fields audit | 61 unrelated findings |
| Finance audit | 102 unrelated findings |
| Dashboard audit | 14 unrelated findings |
| Prisma | generated; 22 migrations current |
| TypeScript | PASS |
| Unit tests | 940/940 PASS in 86 files |
| Production build | PASS; existing unrelated NFT trace warning |
| Budget Variance Playwright | 10/10 PASS, 0 failed/flaky, retries=0, 2.0 min |
| Focused regression | 31/31 PASS, 0 failed/flaky, retries=0, 4.6 min |
| Full E2E before final PDF wiring | 162 collected, 161 passed, 1 documented conditional skip, 0 failed/flaky, retries=0, exit 0, 1117.3 s |
| Final full E2E after all runtime changes | **162 collected, 161 passed, 1 documented conditional skip, 0 failed/flaky, retries=0, exit 0, 1088.4 s (18.1 min)** |

Clerk reference before was 5 total / 4 fixed-pool users. Read-only count after the final full run is 5 total / 4 fixed; no new user was created. No IndexedDB, Service Worker or duplicate-record leakage was observed by the passing full suite.

Physical iPhone/Android execution was not part of this resolver-only stage; mobile browser viewports 390×844 and 430×932 passed, but that is not a physical-device claim.
