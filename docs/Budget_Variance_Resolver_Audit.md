# Budget Variance resolver audit

Date: 2026-07-31

## Scope and baseline

- Global resolver audit before: **486** findings.
- Targeted Budget Variance findings before: **13** final-English findings: four Field Detail row notes/labels, four evidence-driver sentences, and five over-budget signal title/explanation/why/evidence/action strings.
- Targeted final: **0** final-English findings in the Budget Variance resolver and signal branch.
- Global resolver audit after: **473** findings. This is not global completion.

## Findings and disposition

| Source | Function | Consumer | Previous behavior/prose | Canonical replacement | Metadata | Persistence |
|---|---|---|---|---|---|---|
| `src/lib/economics.ts` | former `budgetVariance` | Finance, Field Detail, signals, exports | `{ amount, percentage }` without availability/reason | `resolveBudgetVariance`, stable status/reason/action unions | integer cents, numeric percentage, currency, recorded/completeness flags | display-only result |
| `src/lib/field-economics-detail.ts` | `getFieldEconomicsDetail` | Field Detail | English row labels and missing-data notes | `BudgetRowCode`, `BudgetRowNoteCode` | planned/actual plus canonical result | display-only |
| `src/lib/economics.ts` | `financialDrivers` | Field Detail | four final-English evidence sentences | `FinancialDriverCode` | none added | display-only |
| `src/lib/farm-economic-signals.ts` | `buildEconomicSignals` | Dashboard, Farm Insights | English budget signal prose/action | translation keys plus canonical result and affected count | selected field, variance result, unchanged priority | display-only |
| `src/lib/economics-export/csv.ts` | `buildEconomicsCsv` | machine export | amount/percentage only | status/reason/action/currency plus canonical numbers | canonical numeric columns | exported, not DB-persisted |
| `src/lib/economics-export/pdf.ts` | `buildEconomicsPdf` | human report | English Budget/Actual/Variance | localized display adapter | localized formatted values, canonical source | exported, not DB-persisted |

No budget formula, allocation, effective-version, reversal, farm scope or security rule changed.

## Existing-policy decisions

- No tolerance or magnitude band existed, so none was invented.
- Unallocated farm expenses remain excluded from field actual cost.
- Partial allocations contribute only their existing active field entry; allocation policy was not changed.
- Corrected records use the existing active effective entry; reversed entries remain excluded.
- Currency mismatch is a canonical unavailable reason, not an implicit conversion.
- The legacy mock `src/modules/ai/generateDailyBriefing.ts` is not the persisted grounded briefing pipeline; its general Finance prose remains documented legacy localization debt and was not treated as canonical Budget Variance evidence.

