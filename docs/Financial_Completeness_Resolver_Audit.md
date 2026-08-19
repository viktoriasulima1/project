# Financial Completeness resolver audit

## Final closure — 2026-07-28

- Targeted Financial Completeness resolver prose: **0**.
- Completeness UI slice in Field Detail, Finance and the shared adapter:
  **0 unexplained strings/raw codes**.
- Global `i18n:audit -- resolvers`: **486** unrelated findings remain (baseline
  before this stage was 505).
- Module audits: fields **66**, finance **102**; these totals are unrelated
  page/component debt outside the completeness slice and are not represented as
  resolved.
- Canonical order remains product, labour, machinery, contractor, harvest,
  revenue, overhead, units for recorded/reason/action outputs.

Date: 2026-07-27. Global resolver baseline before: **505**.

Targeted final prose sources were `resolveEconomicsCompleteness` (8 English
impact sentences), `field-economics-detail` (duplicated recorded/missing/action
prose), and the legacy `completenessActions` map (8 English actions).

The canonical contract preserves the existing statuses:
`insufficient_data`, `cost_tracking_active`, `partial_profitability`,
`profitability_ready`. It now returns ordered reason objects, ordered recorded
codes, ordered action codes, percentage, and numeric check metadata. No
translated text is persisted. FinanceData, Field Detail, exports, economic
signals, and Break-even inputs consume the canonical result.

Targeted completeness resolver prose: **16+ duplicated UI strings → 0**.
The global audit is not zero and remains the explicit backlog; budget variance,
cost categories, gross-margin/economic signals, weather-risk, spray-window and
general user errors were not refactored.
