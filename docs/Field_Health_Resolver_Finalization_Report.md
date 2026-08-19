# Field Health Resolver Localization — Finalization Report (Stage 2B)

Date: 2026-07-27. Supersedes the "PARTIAL GO" of `Field_Health_Resolver_Stage2_Report.md`.
Companion: `Field_Health_Legacy_Consumer_Audit.md`.

## Verdict

**Field Health resolver localization — GO.**
**Global resolver localization — still NO-GO** pending break-even, completeness,
budget, cost categories and economic signals.
**Browser verification — NO-GO (not executed here):** Playwright specs are written
but need a live server + Postgres + Clerk pool; no physical-device retest.

## 1. Legacy consumer inventory (Part 1)

Recorded in `Field_Health_Legacy_Consumer_Audit.md`. The legacy prose fields
(`explanation`, `primaryEvidence`, `recommendedAction`) were consumed only by
`farm-insights.ts` and `scouting/page.tsx`; `FIELD_HEALTH_LABELS` by
`FieldOperationsMap.tsx` and `scouting/page.tsx`. The Daily Briefing and Dashboard
consume Field Health **transitively** through `getFarmInsights`, not the resolver
directly. 22 targeted prose hits recorded before change.

## 2. Characterization baseline (Part 2/15)

Decision→code mapping, priorities, freshness, confidence and structured evidence
are locked per branch in `field-health.test.ts` (25 tests). All pre-existing
decision assertions were preserved; none changed value.

## 3–7. Consumer migrations

- **Resolver (Part 10)** — `field-health.ts` is now **code-only**: `status`,
  `severity`, `reasonCode` (9), `actionCode` (5), `priority`, typed `metadata`,
  structured `evidence[]`, `freshness`, `confidence`. No `explanation` /
  `primaryEvidence` / `recommendedAction`; no `FIELD_HEALTH_LABELS`; no positional
  English. Decisions/thresholds/severity/priority **byte-for-byte unchanged**.
- **Field Detail** — already on `buildFieldHealthDisplayModel` (Stage 2).
- **Scouting page (Part 7)** — now builds a `fields`-bound translator and renders
  `statusLabel` / `reason` / `actionLabel` from the adapter.
- **Field Map (Part 6)** — `FieldOperationsMap` uses `useTranslations('fields')` →
  `health.status.<code>`. Geometry, selection, polygon colour mapping, GPS,
  ResizeObserver and the sidebar-stacking fix are untouched.
- **Farm Insights (Part 3)** — the two Field Health insights build their English
  grounding from `reasonCode` + `metadata` + structured `evidence` via local
  helpers (the module that already owns all ~15 insight prose strings). No
  resolver prose is read. Insight ids, priority scores, CTA hrefs and grounded
  facts (counts/freshness) are unchanged.
- **Daily Briefing (Part 4)** — grounds on the live `FarmInsight` list from
  `getFarmInsights`; now transitively code-derived. Priority, selected fields and
  evidence unchanged; the deterministic fallback and cache behavior are untouched.

## 8. Structured evidence (Part 8)

`primaryEvidence: string[]` (English) → `evidence: FieldHealthEvidence[]`, a typed
discriminated union (`severe_observations{count}`, `overdue_scouting{count}`,
`weather_risk{level}`, `open_observations{count}`, `stage_missing`,
`stage_stale{daysSinceStage}`, `no_active_season`, `clean`). Language-independent;
no sentences, notes or raw photo content; farm-scoping unchanged (evidence carries
counts/types only, no cross-farm references). Localized at the boundary by
`describeFieldHealthEvidence`.

## 9. Action contract (Part 9)

Every CTA uses `actionCode`; the adapter maps code→localized label, routes stay in
the components (unchanged hrefs, e.g. `/scouting?field=<id>`). Unknown runtime
action → safe empty label, never a raw code.

## 10. Legacy field removal (Part 10)

Done. No dual contract retained. `resolver-audit.test.ts` flipped from "documents
the prose blind spot" to a **regression guard** asserting the resolver contains no
prose or label map.

## 11–12. Historical / persisted data (Part 12)

No Prisma migration. No schema stores Field Health resolver prose: the Daily
Briefing grounds on the live insight list (not persisted resolver text), and audit
events store their own reasons. Nothing to back-fill; no historical record is
mutated. A legacy read adapter was **not** required.

## 13. Type safety (Part 11)

The adapter uses exhaustive `switch`es whose `default` assigns the code to `never`
— adding a reason/action code fails `tsc` until handled here and (via tests)
translated in four locales. Corrupted runtime codes degrade to a safe label. No
`reason: string` / `explanation: string` / `message: string` anywhere in the
contract.

## 14. Agronomic / localization quality (Part 13)

nl-NL / en-GB / pl-PL / de-DE reviewed: concise for mobile; weather risk phrased as
indicative ("indicate increased risk; this is not a diagnosis"), never a diagnosis;
no automatic treatment advice; `insufficient_data` renders as "Insufficient data /
Onvoldoende gegevens / Niewystarczające dane / Unzureichende Daten" — **Unknown,
never softened to Healthy**. Any residual wording uncertainty is logged in
`FarmOS_Translation_Review_Backlog.md`.

## 15. Unit results

- `npx tsc --noEmit` — clean.
- `npx vitest run` — **908 passed** (was 902; +6). Includes: decisions unchanged,
  code contract per branch, structured evidence, no-prose regression, adapter
  exhaustiveness + four-locale coverage + placeholder parity (via `diffNamespace`),
  unknown-code fallback, cross-surface determinism, and Farm Insights consuming the
  canonical code.
- `npm run build` — compiled successfully.
- `npx tsx scripts/i18n-validate.ts` — 4 locales, 9 namespaces, 0 warnings.

## 16. Resolver audit before/after (Part 14)

- Global resolver baseline **before: 522**.
- Field Health targeted **before: 22 → after: 0.**
- New global resolver total: **510** (net −12; the Field Health insight's inline
  grounding text lives in `farm-insights.ts`, already a flagged all-English module).

Targeted Field Health files: 0 prose, 0 positional English, 0 exported label maps,
0 explanation/recommendation/message strings, 0 undocumented suppressions.

## 17. Focused E2E (Part 16)

`e2e/i18n-field-health.spec.ts` written — Flows A (Field Detail labels vs canonical),
C (no-data = Unknown, not Healthy, no fake last visit), D (cross-surface),
E (map popup + geometry/selection + no sidebar overlap), G (mobile 390/430, no
overflow, code-leak + console guards). **Not executed here** (no live env).

## 18. Regression + full E2E (Part 17/18)

`i18n-field-action-reasons`, `field-map-sidebar-layout`, `locale-hydration`,
`i18n-onboarding` and the full suite were **not executed** (no live env). No browser
GO is claimed.

## 19. Remaining resolver groups (still English)

break-even / completeness / budget (~18), field-economics-detail (~23),
farm-economic-signals (~22), cost categories, plus `weather-risk`, `spray-window`,
`user-error`. Global resolver localization stays NO-GO. **Not started this
iteration**, per scope.

## 20. Physical-device status

No physical iPhone retest performed.

## Completion criteria check

| Criterion | Status |
|---|---|
| `field-health.ts` no final English prose | ✅ |
| all consumers use reasonCode/actionCode/metadata | ✅ |
| Field Detail / Dashboard / Insights / Map / Scouting / Briefing share one canonical result | ✅ (single resolver) |
| decisions and priorities unchanged | ✅ (tests) |
| no-data stays Unknown | ✅ |
| weather risk remains indicative | ✅ |
| historical data readable | ✅ (nothing persisted; no migration) |
| targeted Field Health audit = 0 | ✅ |
| no raw code reaches the UI | ✅ (adapter + tests; browser check pending) |
| browser tests pass before browser GO | ⛔ not executed — no browser GO claimed |

## Docs updated alongside this report

`Field_Health_Resolver_Stage2_Report.md` (marked finalized),
`Field_Health_Legacy_Consumer_Audit.md`, `FarmOS_Translation_Review_Backlog.md`.
This report is the canonical record of the Field Health finalization for
`FarmOS_Localization_Audit.md` / `FarmOS_Multilingual_Report.md` /
`BETA_ACCEPTANCE_CHECKLIST.md` / `FarmOS_Feature_Implementation_Matrix.md`.
