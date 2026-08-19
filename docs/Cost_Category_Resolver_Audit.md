# Cost Category resolver audit

## Baseline and result

- Global resolver baseline: 473 findings.
- Targeted baseline: 13 findings in `field-economics.ts` and `field-economics-detail.ts` (one exported category-label map plus twelve source/attribution/version labels).
- Targeted result: 0 category/source/attribution/version presentation findings.
- Global result after the refactor: 460 findings. This is not global completion.

## Findings

| File / contract | Canonical input | Former output | Consumers | Persistence | Resolution |
|---|---|---|---|---|---|
| `field-economics.ts` / `COST_CATEGORY_LABEL` | `CostCategory` | English category name | Field cost breakdown | Display-only | Removed; shared locale adapter owns labels |
| `buildCostBreakdown` | category, amounts, attribution | `label` plus totals | Field Detail, future Finance/report consumers | Display-only | `label` removed; totals unchanged |
| `getFieldEconomicSourceRecords` | `EconomicSourceType`, allocation method, version | English module/allocation/badge strings | Field source table | Display-only | Separate canonical source/category/attribution/version codes |
| financial version history | database status and version | English version state | correction/allocation history | Display-only | `statusCode` returned and localized at UI boundary |

No translated category was found in the database, audit metadata, cached summary, briefing facts, or machine-readable economics CSV. No migration or historical rewrite is required. The existing CSV keeps canonical `source_type` and allocation status columns.

Remaining English timeline actions and Gross Margin explanation are explicitly outside Stage 6 and remain in the global resolver backlog.
