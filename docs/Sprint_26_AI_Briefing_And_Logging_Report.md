# Sprint 26 — Grounded AI briefing and Activity logging report

Date: 2026-07-17

## Status

Sprint 26 is **in progress / NO-GO for production AI**. The trustworthy core and
first reviewed text/voice entry surface exist; this report does not claim the
full sprint or physical mobile validation complete.

## Delivered in this iteration

- Previous reality audited: existing “AI” was deterministic rules/scoring.
- Hybrid contracts for grounded facts, briefing items and Activity candidates.
- Vendor-neutral production HTTP provider, deterministic/unavailable behavior,
  server-only configuration and structured-output validation.
- Deterministic briefing fallback, top-three/hard-blocker ordering guard,
  stable context checksum and persisted-snapshot comparison helper.
- `buildDailyFarmContext()` with bounded farm-scoped facts and freshness.
- Natural-language candidate parser (decimal/Dutch units), farm-scoped entity
  resolution, ambiguity handling and official-dose conflict helper.
- `/api/ai/activity-parse`: active farm comes from auth, rate-limited server-side,
  model IDs ignored, WorkOrder suggestions bounded to the same farm.
- Activity dialog “Describe what you did”, reviewed suggestions, ambiguity UI,
  offline local text recovery and progressive browser voice transcription.
  Raw audio is not retained and parsing never saves an Activity.
- Misleading Dashboard label corrected to “Rule-based farm facts”.
- Trust, privacy, evaluation and Activity policies documented.

## Safety and limitations

AI suggests; the farmer confirms. Existing stock, Ctgb, certificate, machine,
spray, WorkOrder and compliance validation remains authoritative. Missing facts
are not invented and model output is not trusted as a database ID.

Still required before Sprint 26 completion: persisted briefing history/feedback
and observability tables, production cost accounting/monthly circuit breaker,
complete Dashboard grounded-briefing interactive states, provider-specific
production adapter verification, all 30 required unit scenarios, Playwright
Flows A–J, two consecutive full E2E runs, Clerk count evidence, and physical
iPhone/Android voice/offline testing.

## Validation so far

- New AI core unit tests: **12/12 PASS**.
- Full unit suite: **672/672 PASS**, 63 files, 40.71 s.
- TypeScript: PASS.
- Production build: PASS (Next.js 16.2.9; compile 4.2 s, build-time
  TypeScript 10.4 s). The new `/api/ai/activity-parse` route is included.
- Prisma schema was not changed in this slice; generate/migrate status remain
  pending until the briefing history/feedback persistence model is implemented.
- Full Playwright runs were not started because Flows A–J and persistence are
  not complete; no misleading E2E pass is claimed for Sprint 26.

## Gate

**NO-GO.** Deterministic fallback makes the existing morning workflow safe, but
production external AI and the Sprint 26 completion claim remain blocked on the
remaining persistence, evaluation, E2E, privacy/provider and physical-device
evidence above.

## Persistence, product integration and stability iteration — 2026-07-18

### Completion audit and persistence

The evidence-based matrix is in `docs/Sprint_26_Completion_Audit.md`. Migration
`20260718090000_sprint26_grounded_ai_persistence` adds the minimum three models:
`AiBriefing`, `AiBriefingFeedback` and `AiRequestMetadata`. It stores bounded,
validated JSON snapshots and safe metadata only — never credentials, raw DB
records, unrestricted prompts or audio. Prisma Client 5.22.0 generated; **17
migrations applied and database current**.

### Cache, regeneration and concurrency

`getOrGenerateDailyBriefing()` is now the single shared service. It builds the
active-farm context, checksums it, reuses a matching snapshot for two hours,
honours a two-minute refresh cooldown, calls the provider only within policy,
persists fallback as a first-class mode and returns safe UI data. In-process
in-flight dedupe prevents duplicate provider work in one server instance;
`farmId + generatedForDate + contextChecksum` uniqueness and P2002 winner-read
prevent duplicate persisted briefings across concurrent instances. Prior
current snapshots become historical.

Provider wording is accepted only for the exact deterministic fact order.
Unknown facts/reordering trigger full fallback. Individual unsafe route,
HTML/script, blocker, entity or unsupported-financial fields are replaced with
the authoritative deterministic item. FarmOS reattaches entity, confidence,
freshness and route from context.

### Dashboard, evidence, history and feedback

Dashboard now renders the persisted Daily Farm Briefing: generation time,
Grounded AI/rule-based mode, weather/data freshness, up to three primary and two
secondary items, blocker/resource/financial fields when grounded, evidence
drawer, CTA, refresh, factual “What changed”, offline stale warning and history.
`/ai/briefings` is paginated/read-only and warns that historical advice is not
current. All four feedback types persist after server-side farm/item validation;
feedback never changes rules or retrains automatically.

### Natural-language, voice and offline review

Activity dialog now retains original text throughout a structured review and
shows status for type, field/FieldSeason, product, dose, area, machine and
WorkOrder candidate. Ambiguity blocks continuation; foreign/arbitrary IDs are
never accepted. Normal Activity/Ctgb/stock/certificate/machine/weather checks
remain the only save authority. Voice has visible timer, 60-second maximum,
stop, cancel, editable transcript and delete; no MediaRecorder/Blob/object URL
or audio persistence exists.

Text storage is namespaced by authenticated user+farm. Parsing is disabled
offline and reconnect never auto-sends. E2E found and fixed one real defect:
Quick Log used a fresh server action on every reopen, so an offline farmer could
not restore the local description after closing the dialog. It now reuses the
already server-scoped form context in memory; focused Flow H passes.

### Observability, cost and security

Safe request metadata now covers briefing and Activity parsing. Controls:
per-user/farm daily limits, duplicate-context cache, cooldown, timeout/output
cap, monthly estimated-cost ceiling and a three-failure circuit breaker.
Fallback always remains useful. Tests verify priority cannot change, unknown
entity cannot enter, invalid routes return to the authoritative route,
HTML/script is rejected and unsupported financial loss is removed. Remaining
production-provider work: cumulative daily token ceiling and provider-specific
retry/auth/quota classification with real contractual EU processing evidence.

### Validation

- `npx prisma generate`: PASS, Prisma Client 5.22.0.
- `npx prisma migrate status`: PASS, 17 migrations, current.
- `npx tsc --noEmit`: PASS.
- `npx vitest run`: **676/676 PASS**, 63 files, 40.59 s.
- `npm run build`: PASS, Next.js 16.2.9; compile 4.5 s, build TypeScript 10.0 s.
- Deterministic Sprint 26 focused E2E after fix: **5/5 PASS**, 1.1 m including setup.
- Full E2E run 1: **98 collected; 97 passed; 1 documented conditional skip;
  0 failed**, Playwright 9.9 m, process 595.0 s.
- Full E2E run 2: **98 collected; 97 passed; 1 documented conditional skip;
  0 failed**, Playwright 10.4 m, process 630.8 s.
- Blocking E2E uses `AI_PROVIDER_MODE=deterministic_test`; no paid/live model.
- Clerk: **5 total / 4 fixed-pool before and after; 0 new users**.
- Per-run DB reset plus repeated offline exact-count tests show no observed
  briefing, service-worker or IndexedDB leakage. Existing exact-one Activity /
  WorkOrder / inventory / compliance tests remain green.

### Remaining limitations and gate

The automated implemented slice is stable, but Sprint 26 remains **NO-GO for a
production external-AI pilot**. Full dedicated compliance-correction Flow F,
accepted WorkOrder-link exact-one Flow G, mocked voice Flow I/security injection
matrix, complete expected-vs-described WorkOrder UI, operator/date/water review
choices, two-draft split UI and production provider cost/retry evidence remain.

Physical iPhone/Android microphone, permission, offline restart and installed-PWA
validation is **NOT RUN**. Therefore the physical mobile/offline pilot remains
an explicit **NO-GO**, regardless of two clean browser runs.

## Finalization — WorkOrder, split drafts, voice and security (2026-07-18)

1. **WorkOrder matching:** `matchActivityDraftToWorkOrders()` deterministically
   scores field, operation, date/window, product, area tolerance, employee and
   machine. Completed/cancelled/foreign orders are excluded. UI shows expected
   vs described evidence, material conflicts and explicit Link/Continue without
   WorkOrder. AI never chooses the trusted ID.
2. **Link safety:** final save revalidates active farm, FieldSeason, compatible
   Activity type, open status, current WorkOrder version and exact-one absence;
   offline sync permits the validated version field. Existing serializable
   completion transaction preserves reservation, stock, compliance, plan and
   correlated audit effects.
3. **Multi-activity:** deterministic detection returns single/multiple/ambiguous,
   supports same operation over multiple fields, preserves up to five spans and
   never merges. Separate drafts have unique localDraftId/idempotency keys,
   shared group provenance and `unreviewed` status; no bulk confirmation exists.
4. **Compliance separation:** parser success is visibly separate from FarmOS
   authority; the form states that authoritative checks must be resolved and
   retains the original parsed dose/text.
5. **Security:** parser input is bounded to 2000 characters; Unicode controls
   are excluded from interpretation while original text remains visible; fake
   IDs cannot resolve, React renders plain text, provider output stays schema-
   constrained and no arbitrary action can occur.
6. **Voice lifecycle:** provider-neutral audio contract supports five MIME
   families, 8 MiB/60 s, 12 s timeout and per-user rate limit. Request bytes are
   memory-only and never persisted/logged/exported. CI voice remains mocked.
7. **Production readiness:** placeholder keys and production deterministic-test
   mode are refused unless explicitly allowed. `npm run test:ai:contract` is
   opt-in (`AI_CONTRACT_TEST=true`), external-provider-only and synthetic-data-
   only. **Not run** here: no explicit live-provider authorization/key.
8. **Tests:** final unit suite **691/691 PASS**, 64 files, 41.23 s; TypeScript
   PASS; Prisma Client generated, 17 migrations current; production build PASS
   (compile 4.3 s, build TypeScript 9.9 s).
9. **Focused E2E:** **8/8 PASS**, 1.4 m: briefing/history/feedback, NL review,
   offline restore, mobile, multi-draft, deterministic voice/no audio keys and
   adversarial injection/fake-ID/HTML/oversize flow. One prior failure was a
   test defect (safe continue button absent rather than disabled); expectation
   corrected without weakening no-merge behavior.
10. **Full E2E run 1:** **101 collected / 100 passed / 1 documented conditional
    skip / 0 failed**, Playwright 10.5 m, process 632.5 s.
11. **Full E2E run 2:** **101 collected / 100 passed / 1 documented conditional
    skip / 0 failed**, Playwright 10.8 m, process 649.6 s.
12. **Isolation:** deterministic provider only, no paid model; Clerk 5 total /
    fixed pool 4/4 before and after, 0 new users. Repeated DB reset, offline and
    mobile projects show no observed IndexedDB/service-worker/split-state leak.

### Final GO / NO-GO

**Automated grounded-assistance gate: GO for the implemented browser slice.**
Deterministic authority, fallback, matcher, split identities, security bounds,
voice data contract and all existing regression scenarios pass twice.

**Production external-provider pilot: NO-GO** until the optional live synthetic
contract records structured output, timeout, invalid-key/quota classification,
tokens/cost and EU processor settings. **Physical mobile/offline pilot: NO-GO.**
iPhone Safari/PWA and Android Chrome/PWA microphone, restart, reconnect and
exact-one flows were not run on real devices. Automated emulation cannot close
those gates.
