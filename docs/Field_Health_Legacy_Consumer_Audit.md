# Field Health — Legacy Consumer Audit (Stage 2B)

Date: 2026-07-27. Precondition for removing the legacy English prose contract from
`src/lib/scouting/field-health.ts`. Scope: **Field Health only.**

## Legacy surface being removed from the resolver

| Symbol | Kind |
|---|---|
| `FieldHealthResult.explanation` | final English sentence |
| `FieldHealthResult.primaryEvidence: string[]` | final English evidence phrases |
| `FieldHealthResult.recommendedAction` | final English CTA sentence |
| `FIELD_HEALTH_LABELS: Record<status,string>` | exported English label map |
| positional English strings in the 6 `result(...)` calls | final English |

## The 22 targeted prose hits (baseline, `i18n:audit -- resolvers`)

Recorded verbatim before change (all in `src/lib/scouting/field-health.ts`):

- L81 `"No active crop season is available."`, `"No active field season"`, `"Plan a crop season before assessing crop health."`
- L85 `"Current measured conditions may favour crop-health…"`, `"A scouting inspection is overdue."`, `"High explainable weather-risk signal"`, `"Inspect the crop and record observed evidence."`
- L87 `"Open evidence or moderate risk should be monitored"`, `"Continue monitoring and update the observation if …"`
- L89 `"Crop growth stage and recent scouting evidence are…"`, `"The recorded crop stage is stale."`, `"No current stage record"`, `"Record a crop stage and scouting visit."`
- L91 `"No unresolved issue is present in the current reco…"`, `"Recent stage record"`, `"No unresolved observations"`, `"Continue the planned scouting schedule."`
- L98 exported label map; L99–100 `"Attention required"`, `"Inspect soon"`, `"No current issue"`, `"Insufficient data"`

Global resolver baseline: **522** across 99 files. Field Health targeted: **22**.

## Consumer inventory

| # | Source file | Legacy field used | Visible? | Canonical replacement | Adapter | Behavior to preserve |
|---|---|---|---|---|---|---|
| 1 | `src/app/(farm)/fields/[id]/page.tsx` | (already migrated) `statusLabel`/`reason`/`actionLabel` | Field Detail card | `reasonCode`/`actionCode`/`status` | `buildFieldHealthDisplayModel` (fields ns) | localized status + reason + CTA; `healthMeta` confidence/freshness unchanged |
| 2 | `src/app/(farm)/scouting/page.tsx` | `explanation`, `recommendedAction`, `FIELD_HEALTH_LABELS[status]` | Scouting "Field health priority" list | same adapter, fields translator built from `messages.fields` | `getServerI18n(['scouting','fields'])` | per-field badge + reason + action; field order unchanged |
| 3 | `src/components/operations/FieldOperationsMap.tsx` | `FIELD_HEALTH_LABELS[status]` (×2) | Map sidebar list + selected-field badge | `useTranslations('fields')` → `health.status.<code>` | client `t` | polygon colour/status mapping, geometry, selection, stacking, GPS, ResizeObserver all unchanged |
| 4 | `src/app/(farm)/fields/map/page.tsx` | `resolveFieldHealthStatus(...).status` only (passes `healthStatus` to client) | — (data) | unchanged — already a code | n/a | still passes the status code |
| 5 | `src/lib/farm-insights.ts` (L152) | `explanation`, `primaryEvidence.join`, `status` | Insights / AI Briefing grounding facts (English) | `reasonCode`/`metadata`/structured `evidence` → **English built inline in farm-insights** (the module that already owns all ~15 insight prose strings; 30 flagged hits) | none (stays English by design) | same insight ids, priority scores, evidence facts (counts/freshness), CTA hrefs |
| 6 | `src/lib/scouting/__tests__/field-health.test.ts` | `.explanation` assertions | test | assert codes/evidence + no prose | — | decisions locked |
| 7 | `src/i18n/__tests__/resolver-audit.test.ts` | asserts resolver **contains** prose (blind-spot doc) | test | flip to assert prose **gone** | — | audit heuristic still guarded |

### Not consumers of the legacy fields

- **Daily Briefing** (`src/lib/ai/briefing.ts`, `GroundedBriefingCard.tsx`): consumes `FarmInsight` (title/recommendedAction/evidence) from `getFarmInsights`, **not** `FieldHealthResult` directly. Once farm-insights stops embedding resolver prose, the briefing's Field Health facts are code-derived transitively. No Field Health prose is persisted by the briefing (it grounds on the live `FarmInsight` list). No Prisma migration needed (Part 12).
- **Dashboard**: renders `getFarmInsights` output via `AIBriefingCard`; there is **no separate Dashboard-only Field Health resolver** — it shares the same canonical result transitively. (There is no dedicated "Crop Health card" component; Crop Health reaches the dashboard through the shared insights list.)
- `FieldsOverviewCard` / reports / exports: do **not** import Field Health prose or `FIELD_HEALTH_LABELS`.

## Cross-surface consistency (Part 5/Flow D)

Field Detail, Scouting, Field Map, Farm Insights, Dashboard and the Briefing all
obtain Field Health from the single `resolveFieldHealthStatus` resolver — the
canonical `status`/`reasonCode`/`priority` is identical for a given field; only the
presentation wording differs by surface/locale. No surface recomputes health.

## Honest scope note

Fully **localizing the Insights and AI-Briefing display pages** is out of scope
this iteration (Field Health is 3 of ~15 all-English insight types; `getFarmInsights`
takes no locale). Those pages stay English — the Field Health facts feeding them are
now canonical-code-derived rather than resolver prose. Documented NO-GO carried into
the finalization report.
