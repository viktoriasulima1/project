# Economic Signals resolver audit

## Baseline and result

- Global resolver debt before Stage 8: **457**.
- Targeted Economic Signals findings before: **20**.
- Targeted findings after: **0**.
- Global resolver debt after: **437**.

The findings were final titles, explanations, evidence sentences, formatted money, recommendations and action labels in `farm-economic-signals.ts` and its `economics-insights.ts` compatibility mapper. They were display-only, not stored financial decisions.

All were replaced by `EconomicSignalCode`, `EconomicSignalActionCode`, canonical cents/percentages, structured evidence and references to the completed Budget Variance, Financial Completeness and Gross Margin results. Break-even selection preserves the existing complete-field rule and values.

Dashboard, Farm Insights and new Daily Briefing facts consume the shared canonical list. Legacy persisted briefing output remains readable; no destructive rewrite or Prisma migration was made.

