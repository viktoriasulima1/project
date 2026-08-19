# Gross Margin resolver audit

## Scope and baseline

- Global resolver localization debt before Stage 7: **460**.
- Targeted Gross Margin findings before: **3**.
- Targeted Gross Margin findings after: **0**.
- Global resolver localization debt after: **457**.

## Findings

| Source | Function / field | Former presentation prose | Consumer | Canonical replacement | Persistence |
|---|---|---|---|---|---|
| `src/lib/field-economics.ts` | version comparison | `marginNote` English sentence | field history | `marginReasonCode: MISSING_REVENUE` | display-only |
| `src/lib/reallocation-preview.ts` | source-field impact | `marginNote` English sentence | reallocation preview | `marginReasonCode: MISSING_REVENUE` | display-only |
| `src/lib/reallocation-preview.ts` | target-field impact | `marginNote` English sentence | reallocation preview | `marginReasonCode: MISSING_COST` | display-only |

Gross Margin now consumes the existing Financial Completeness result. Cost Categories supply the unchanged included cost total. Break-even and Budget Variance remain independent canonical resolvers.

## Consumer audit

Field Detail and Finance consume `GrossMarginResult` through one presentation adapter. Dashboard, Insights, Daily Briefing and exports retain their existing selection, ranking, persistence and formula behavior; broad Economic Signals and report localization remain outside this narrowly scoped resolver change. No translated value is persisted.

