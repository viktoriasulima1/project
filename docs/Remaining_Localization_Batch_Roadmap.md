# Remaining Localization Batch Roadmap

## Stage 19 authoritative selection — 2026-08-08

Evidence was regenerated without production runtime changes: **110 active user-error findings** and **367 resolver findings**. Completed and removed from eligibility are Work Order transition/stock/exact-one, Inventory + Machines, Activities / Quick Log core, Activity Parse API boundary, and Offline Sync Center.

Exactly three eligible leaders remain:

| Rank | Batch | Exact scope | Consumers | P0 raw forwarding | Readiness / coverage / blast | Required browser gate |
|---:|---|---|---|---:|---|---|
| 1 | **Fields — selected** | 7 in `src/lib/actions/fields.ts` | NewFieldDialog, FieldsListClient, OnboardingWizard | 2 Zod-message sinks | shared contract ready; field action units plus golden path, founder walkthrough, isolation and onboarding coverage; security-sensitive ownership; mobile-relevant; low one-file action blast | focused Fields + onboarding/isolation regression + full serial E2E |
| 2 | Scouting action/sync | 9: `src/lib/actions/scouting.ts` 8; `src/offline/scouting-sync.ts` 1 | ScoutingVisitForm and local scouting sync | 2 | shared/offline prerequisites ready; Sprint 27 coverage; high regulated/offline/mobile relevance; moderate two-file sync blast | focused Sprint 27 + full serial E2E; phones remain separate |
| 3 | Finance actions | 11 in `src/lib/actions/economics.ts` | EconomicsForms and offline finance route | 10 | shared contract available and finance tests exist; highest raw count/security relevance, but dense multi-record accounting and offline exact-one behavior create high regression blast | focused Sprint 25/offline finance + full serial E2E |

Fields wins on farmer exposure, dependency readiness, deterministic testability, bounded file count and ability to reach target zero without combining BRP, Seasons, Field Map or economics. Its two raw Zod sinks and ownership/not-found responses are directly visible. BRP remains a separate dependent batch.

The remaining machine-counted P0 inventory is **24 active audit findings**. This counts two distinct audit records for the same LocalPhotoAnnotationEditor expression because it is both forwarding and rendered; no server-only log, test, fixture, comment or development-only diagnostic is included.

## Stage 18 closure — 2026-08-08

U6 Offline Sync Center is closed at 10 → 0. Fresh evidence is 110 user-error findings and 367 resolver findings. Automated browser validation is GO (focused 8/8, regression 29/29, full 209 passed + 1 conditional skip from 210 collected), while the physical iPhone/Android offline field pilot is still NOT RUN / NO-GO. The next batch must be freshly audited; Fields (7) is the leading bounded candidate, with Scouting action/sync an alternative.

## Stage 17 authoritative selection — 2026-08-03

Fresh evidence remains 120 user-error / 367 resolver findings. Completed and removed from eligibility: U1 Work Orders (15 → 0), U2 Inventory/Machines (4 → 0), Activities/Quick Log core (9 → 0), and Activity Parse API (2 → 0).

The earlier Stage 16 AI/transcription recommendation was provisional and is superseded. **Selected: U6 Offline Sync Center, 10 findings across four files**: activity-sync API 3, finance-sync API 3, IndexedDB repository 2, OfflineQueueClient 2. Its shared API dependency is ready after Stage 16 and confirmed raw migration/import errors can reach persisted local state and visible UI. Required target: 10 → 0; focused Sprint 20 regression and full serial E2E; physical phones required for offline-field-pilot GO.

Next eligible alternatives, not selected: Fields (7 findings, one file, unlocks BRP) and Scouting action/sync (9 findings, two files, physical-device relevant). Exact implementation contract: `docs/Next_Bounded_Localization_Batch_Prompt.md`.

## Next after Stage 16

Activity Parse API is closed at 2 → 0. Next candidate: remaining AI/transcription boundary (4 transcribe API + 3 briefing action), subject to fresh audit; provider/parser redesign remains excluded.

## Next after Stage 15

Stage 15 Activities / Quick Log core is closed at 9 → 0. Next bounded batch: `/api/ai/activity-parse` error boundary, exactly 2 findings. Full Activities UI, Sync Center and AI/provider localization remain separate inventories.

## Stage 14 U2 progress (2026-08-01)

Inventory and Machines is complete: user-error 4 → 0, resolver overlap 6 → 0, global totals 131/373. The next batch is Activities / Quick Log core (9). The activity-parse API (2) remains separate and was not touched.

## Stage 13 progress (2026-08-01)

Work Order transition/stock/exact-one user errors are complete and removed from the roadmap (15 → 0). The recommended next bounded lifecycle-adjacent batch is Activities / Quick Log user errors, subject to a fresh exact audit; do not treat the remaining 135 user-error or 379 resolver findings as complete.

Date: 2026-08-01

Each count below is taken from the Stage 12 JSON evidence. “Target 0” means the batch-specific filtered audit, not the global audit.

## User-error batches

| Batch | Exact files and findings | Codes / namespace | Consumers and tests | Gates |
|---|---|---|---|---|
| U1 Work Order operational errors | `src/lib/actions/field-operations.ts` — 15 | NOT_FOUND, INSUFFICIENT_STOCK, INVALID_VALUE, UNSUPPORTED_TRANSITION, ALREADY_COMPLETED; `errors`/`workOrders` | Planning/Work Orders; Sprint 23 exact-one | Target 0; unit + focused + full E2E; no device required |
| U2 Inventory and Machines | `actions/inventory.ts` — 2; `actions/machines.ts` — 2 | INVALID_ENUM, INVALID_UNIT, DATABASE_UNAVAILABLE, NOT_FOUND | Inventory/dialog and machine form; failure/golden | Target 0; focused + full; mobile review |
| U3 Activities / Quick Log | `actions/activities.ts` — 6; `actions/quick-log.ts` — 1; ActivityDialog — 2; activity-parse API — 2 | validation, NOT_FOUND, STALE_VERSION, SYNC_CONFLICT, provider | Activity/Quick Log; golden, failure, Sprint 16 | Target 0; full E2E; mobile/offline relevant; depends U1/U2 |
| U4 Fields | `actions/fields.ts` — 7 | REQUIRED_FIELD, INVALID_AREA, NOT_FOUND, conflict/database | Fields/NewField/delete; field localization | Target 0; focused + full; mobile |
| U5 BRP import | `actions/brp-import.ts` — 4 | AUTH_REQUIRED, RATE_LIMITED, INVALID_BOUNDARY, DUPLICATE_IMPORT | BRP Import; Sprint 18 | Target 0; focused + full; depends U4 |
| U6 Offline Sync Center | offline sync API — 3; finance-sync API — 3; `offline/db.ts` — 2; OfflineQueueClient — 2 | OFFLINE_UNAVAILABLE, SYNC_CONFLICT, LOCAL_STORAGE_UNAVAILABLE, RETRY_LATER | Sync Center; Sprint 20 | Target 0; focused + full; physical phone required |
| U7 Scouting action/sync | `actions/scouting.ts` — 8; `offline/scouting-sync.ts` — 1 | validation, NOT_FOUND, SYNC_CONFLICT, provider | Scouting; Sprint 27 | Target 0; focused + full; phone required |
| U8 Photo upload/access | photos route — 9; photo access route — 1; photo `[id]` route — 1 | INVALID_FILE_TYPE, FILE_TOO_LARGE, UPLOAD_FAILED, PROVIDER_UNAVAILABLE, NOT_FOUND | Scouting photos; Sprint 27 | Target 0; focused + full + iPhone/Android |
| U9 Photo annotations/suggestions | annotations route — 8; suggestions route — 7; LocalPhotoAnnotationEditor — 2 | INVALID_ANNOTATION, STALE_VERSION, PROVIDER_UNAVAILABLE, GENERIC | Annotation/photo AI UI; Sprint 27 | Target 0; focused + full + touch devices; depends U8 |
| U10 Finance actions | `actions/economics.ts` — 11 | validation, NOT_FOUND, STALE_VERSION, duplicate, database | Finance forms; Sprint 25 | Target 0; focused + full |
| U11 Allocations | `actions/reallocation.ts` — 11 | INVALID_ALLOCATION, CONFLICTING_ALLOCATION, STALE_VERSION, NOT_FOUND | allocation forms; Sprint 25 reallocation | Target 0; focused + full; depends U10 |
| U12 Compliance | corrections action — 10; detail action — 2 | NOT_FOUND, STALE_VERSION, ALREADY_REVERSED, UNSUPPORTED_TRANSITION | Compliance dialogs; Sprint 19 | Target 0; focused + full; depends U3/U11 |
| U13 Reports/export APIs | economics export API — 2; scouting export API — 1; compliance export-preview action — 1 | REPORT_UNAVAILABLE, NOT_FOUND, GENERIC | exports/reports | Target 0; focused + full if shared API changes |
| U14 AI/transcription | transcribe API — 4; AI briefing action — 3; activity-parse API — 2 | AI_PROVIDER_UNAVAILABLE, TRANSCRIPTION_UNAVAILABLE, RATE_LIMITED, INVALID_VALUE | Activity/Briefing; Sprint 26 | Target 0; focused + full + physical microphone |
| U15 Seasons | `actions/seasons.ts` — 8 | NOT_FOUND, SEASON_ALREADY_EXISTS, INVALID_DATE, INVALID_CROP | Onboarding/season forms | Target 0; onboarding + full |
| U16 Spray suitability | `actions/spray-suitability.ts` — 5 | NOT_FOUND, PROVIDER_UNAVAILABLE, INVALID_VALUE | Activity suitability | Target 0; Sprint 16 + full |
| U17 Development demo exclusions | `actions/dev-demo-farm.ts` — 4 | typed `development-only` classification, not translations | dev-only button | Target classified 0; tooling tests only; no full E2E |

## Resolver batches

| Batch | Exact files / count | Closure strategy |
|---|---|---|
| R0 False-positive classification | `mock-data/farm-dashboard.ts` 47; dev-demo action 4; storage config internal diagnostics 2 | Typed fixture/development/internal classification; no runtime translation |
| R1 Farm Insights operational families | `farm-insights.ts` 8 non-generic findings | Existing economic/field-health/provider adapters; unit + economic/field-health E2E |
| R2 Farm Insights remaining prose | `farm-insights.ts` 32 generic/status findings | Characterize and split by insight builder before migration; do not one-shot rewrite |
| R3 Activity domain/action | `actions/activities.ts` 28; quick-log 1; activity versions 1 | Split validation (7), ownership (11), Work Order (4), stock/offline/conflict (8); follow U1/U2 |
| R4 Work Order domain/action | field-operations action 23; domain helper 4 | Split transition (9), stock (5), ownership (5), validation/status (8); follow U1 |
| R5 Finance recording/action/export | economics action 31; economics-recording 3; export PDF 7; export data 1 | Split ownership, conflict/offline, validation, recording and export presentation; follow U10 |
| R6 Allocations | reallocation action 20; preview 14 | Canonical allocation reason/conflict/preview codes; follow U11 |
| R7 Compliance correction/export | correction action 27; completeness 8; Ctgb check 4; correction preview 1; export PDF 11/data 2/types 2/detail 2/preview 1 | Separate correction/reversal from human-readable reports; follow U12 |
| R8 Scouting domain/action | scouting action 11; reference library 13; condition 5; errors 5; GPS 2 | Separate external/reference verbatim from localized conditions/errors; follow U7 |
| R9 Photo/storage domain | photo AI 8; policy 5; storage 3; S3 3; config 4; token/object gateway 1 each | Separate internal provider diagnostics from user policy codes; follow U8/U9 |
| R10 AI/briefing | briefing 9; AI action 3; provider/transcription/daily service 1 each | Provider/status/action codes; follow U14 |
| R11 Fields/BRP/shared | field label 5; field economics detail 4; fields action 5; BRP 5; seasons 7; spray suitability 5; inventory 4; machines 2; operational costing 2; farm 1 | Execute U4/U5/U15/U16/U2 first, then resolve remaining display prose |

## Dependency and exact next stage

U1 has no unfinished runtime dependency: the shared error contract and `workOrders` namespace already exist, and Sprint 23 supplies exact-one browser coverage. It must finish with:

> Work Order operational error localization — GO. Targeted Work Order user-error audit: 15 → 0. Application-wide user-error localization — still NO-GO.

No other batch is implemented by Stage 12.
