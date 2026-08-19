# Sprint 26 completion audit

Date: 2026-07-18

| Requested capability | Status | Evidence / mismatch |
| --- | --- | --- |
| Honest current-state classification | complete | `Sprint_26_AI_Current_State_Audit.md`; UI says rule-based when applicable |
| Vendor-neutral provider + unavailable mode | complete | `src/lib/ai/provider.ts`, `configured-provider.ts` |
| Deterministic E2E provider | complete | `AI_PROVIDER_MODE=deterministic_test`; no paid CI call |
| Grounded context | partial | farm-scoped, bounded facts/recent activities; richer typed resource/deadline facts still desirable |
| Structured output and priority guard | complete | schema, route/HTML/blocker/financial grounding, full fallback on reorder/unknown fact |
| Persisted briefing/history | complete | `AiBriefing`, migration, shared service, paginated read-only history |
| Cache/concurrency | complete | checksum/date uniqueness, TTL, cooldown, in-process in-flight reuse, P2002 winner read |
| What changed | partial | factual added/resolved/value-changed snapshots persisted; UI is compact rather than entity-rich |
| Feedback | partial | all four types persist; Incorrect reason/comment UI remains minimal |
| Observability | partial | safe metadata persists for briefing/parse; retry/token cost estimation depends on provider usage response |
| Cost controls | partial | daily user/farm, monthly cost guard, cooldown and circuit breaker; daily token ceiling is not complete |
| Dashboard briefing | complete | persisted primary/secondary/evidence/mode/freshness/refresh/history/fallback/offline state |
| NL Activity parsing | complete core | draft-only parser, active-farm resolution and normal Activity validation |
| Structured Activity review | partial | visible status matrix/original text/ambiguity; complete operator/date/water and two-draft split UI remain |
| WorkOrder matching | partial | farm-scoped suggestion; full expected-vs-described accept-link UI remains |
| Compliance conflict | complete authority, partial AI-specific UX | existing form blocks authoritatively; dedicated parser-vs-authority banner remains limited |
| Voice | partial | permission, indicator, timer, stop/cancel/delete/edit; physical microphone evidence pending |
| Offline | complete core | namespaced text restore, parse disabled, no auto-send/audio; physical restart evidence pending |
| Unit matrix | partial | core expanded; full 41-scenario named matrix pending |
| Playwright A–J | missing | must be written and run twice |
| Physical iPhone/Android | intentionally deferred | requires real devices; mandatory NO-GO gate |

## Finalization reclassification — 2026-07-18

- WorkOrder matcher and server linking safety: **fully implemented + unit-tested**.
- WorkOrder comparison/explicit selection: **implemented in UI; focused browser
  exact-one Flow G still pending**.
- Multi-activity detection/split identities: **implemented + unit-tested**;
  end-to-end independent review/save of both drafts remains browser-test pending.
- Compliance separation: **implemented authority + dedicated wording**; full
  dose-correct-and-save Flow F pending.
- Voice provider contract: **implemented + unit-tested**; mocked MediaRecorder
  Flow I and physical devices pending.
- Production provider: **runbook/guard/opt-in contract command implemented**;
  live contract status pending because no explicit authorization/key was used.
- Security inputs: **bounded/schema/farm-scoped/React-escaped/control-stripped**;
  full browser adversarial matrix pending.

The previous report correctly said persistence/history/E2E were missing. It
slightly overstated “reviewed suggestions”: the first UI moved values directly
into the normal form after only field ambiguity resolution. This iteration adds
a structured review gate but does not claim the full requested WorkOrder and
multi-activity UX complete.
