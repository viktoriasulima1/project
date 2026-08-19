# Remaining Resolver and User-Error Debt Inventory

## Stage 19 refresh and next selection — 2026-08-08

Fresh evidence is **110 active user errors / 367 resolvers**. Runtime behavior was unchanged and Playwright was not rerun; the referenced browser baseline remains 210 collected / 209 passed / 1 conditional skip / 0 failed/flaky.

Completed batches removed from candidate calculations: Work Order transition/stock/exact-one (15 → 0), Inventory + Machines (4 → 0), Activities / Quick Log core (9 → 0), Activity Parse API boundary (2 → 0), and Offline Sync Center (10 → 0).

The remaining real production P0 inventory is **24 audit findings**: economics actions 10; Fields 2; compliance corrections 2; scouting photo upload 2; LocalPhotoAnnotationEditor 2 audit records for one rendered expression; and one each in BRP, Scouting action, Scouting offline sync, Seasons, photo annotations API, and economics export API. These are active user-visible Zod/caught/framework-forwarding records; logs, tests, fixtures, comments and development diagnostics are excluded.

Selected next batch: **Fields, exactly 7 findings in `src/lib/actions/fields.ts`**. The other two current leaders are Scouting action/sync (9 in two files) and Finance actions (11 in one dense file). Exact scope and constraints are in `Next_Bounded_Localization_Batch_Prompt.md`.

## Stage 17 refreshed evidence and selection — 2026-08-03

Machine-generated evidence is current at 120 active user-error and 367 resolver findings. Runtime code was unchanged.

| Eligible batch | Findings / exact files | Consumers | Raw findings | Readiness and impact |
|---|---|---|---:|---|
| **Offline Sync Center — selected** | 10: offline activity API 3; finance-sync API 3; `offline/db.ts` 2; OfflineQueueClient 2 | sync engines and `/offline` | 4 audit records / 3 expressions, with confirmed persisted/UI forwarding | shared API dependency ready; offline units + Sprint 20; high security/offline relevance, moderate four-file blast; full E2E + phones |
| Fields | 7: `actions/fields.ts` | NewFieldDialog, FieldsListClient, onboarding | 2 Zod forwarding findings; ORM handler is already masked | action units + failure/golden/field browser coverage; low one-file blast; unlocks BRP; full E2E |
| Scouting action/sync | 9: `actions/scouting.ts` 8; `offline/scouting-sync.ts` 1 | scouting form/sync | 2 | prerequisites complete; units + Sprint 27; regulated/offline, moderate two-file blast; full E2E + phones |

Finance has 11 findings and a high heuristic raw count, but inspected legacy `handleActionError` paths already mask caught ORM text; its wider financial blast radius ranks below these three. No confirmed secret/stack leak outside the selected batch requires expanding Stage 17.

Selected findings: activity-sync lines 24/27/30; finance-sync lines 19/21/23; IndexedDB migration catches lines 59/74; OfflineQueueClient line 20 counted as forwarding and visible rendering. All are production user-error records; resolver overlap is zero. Expected status: “Offline Sync Center user-error migration — bounded GO. Offline field pilot — NO-GO until physical phones pass. Application-wide user-error migration — PARTIAL / NO-GO.”

## Stage 16 baseline

Measured debt is 120 user-error and 367 resolver findings. Activity Parse API is zero. Next AI batch requires a fresh audit of 4 transcription API plus 3 briefing-action findings.

## Stage 15 baseline

Current measured debt is 122 active user-error findings and 367 resolver findings. Activities / Quick Log core is zero; activity-parse API contributes the next 2 user-error findings.

## Stage 13 snapshot (2026-08-01)

Verified JSON totals: resolver 379 (was 402), user errors 135 (was 150), and Work Order `field-operations.ts` target 0 (was 15). These totals, not older narrative snapshots below, are authoritative for the next batch selection.

Date: 2026-08-01

## 1. Executive summary

Stage 12 is an audit/tooling-only GO. Every one of the 402 resolver findings and 150 user-error findings has a machine-readable module, reachability, visibility and contract-family classification. No application runtime behaviour changed.

The audit separates 349 active resolver localization targets from 53 fixture/development/internal findings, and 146 active user-error targets from four development-only findings. Application-wide localization remains NO-GO.

Recommended next batch: **Work Order transition, stock and exact-one user errors — 15 active findings in `src/lib/actions/field-operations.ts`.** It is one production action file with deterministic Sprint 23 exact-one E2E and reuses the shared User Error contract.

## 2. Verified baseline

| Gate | Baseline |
|---|---|
| Resolver audit | 402 findings |
| User-error audit | 150 findings |
| Unit tests | 984/984 PASS before tooling changes |
| Prisma | 22 migrations, current |
| TypeScript | PASS |
| i18n / options | PASS / PASS; one pre-existing Dutch economics review warning |
| Production build | PASS at Stage 11 baseline |
| Git hash | Unavailable: this workspace exposes no `.git/HEAD` or Git executable |
| Browser evidence | NOT RUN for Stage 12; last clean run remains 178 collected / 177 passed / 1 conditional skip / 0 failed |

Final Stage 12 validation after adding tooling tests: 994/994 unit tests across 91 files, TypeScript PASS, production build PASS, Prisma 22 current, i18n validation PASS and option audit PASS. The build retains the pre-existing non-blocking NFT tracing warning.

## 3. Methodology

`npm run i18n:audit -- resolvers --json` and `npm run i18n:audit -- user-errors --json` now emit a stable schema. Evidence uses repository-relative paths, safe matched snippets, source audit, probable module, enclosing symbol where detectable, reachability, production classification, user-visible-target flag and contract family.

Classification is evidence-based: component, action, route, offline and provider paths receive distinct runtime classes; test/mock/dev/config paths are not assumed production. The audit rejects suppression comments without one of the documented reason categories.

Evidence:

- `docs/evidence/localization-resolver-findings.json` — 402 findings.
- `docs/evidence/localization-user-error-findings.json` — 150 findings.

## 4–5. Findings by product module

| Module | Resolver | User errors | Active visible | Internal/test/dev | Files |
|---|---:|---:|---:|---:|---:|
| Activities / Quick Log | 30 | 11 | 41 | 0 | 5 |
| Work Orders / Planning | 27 | 15 | 42 | 0 | 2 |
| Inventory | 4 | 2 | 6 | 0 | 1 |
| Fields | 14 | 7 | 21 | 0 | 3 |
| BRP import | 5 | 4 | 9 | 0 | 1 |
| Scouting | 36 | 10 | 46 | 0 | 7 |
| Scouting photo/storage | 25 | 28 | 51 | 2 | 13 |
| Offline Sync Center | 0 | 10 | 10 | 0 | 4 |
| Finance | 42 | 13 | 55 | 0 | 5 |
| Allocations | 34 | 11 | 45 | 0 | 2 |
| Compliance | 58 | 13 | 71 | 0 | 9 |
| Daily Briefing / AI | 15 | 7 | 22 | 0 | 6 |
| Dashboard / Farm Insights | 91 | 0 | 44 | 47 | 3 |
| Authentication / shared errors | 5 | 4 | 1 | 8 | 2 |
| Shared domain utilities | 16 | 15 | 31 | 0 | 4 |
| **Total** | **402** | **150** | **499** | **53** | — |

Production-consumer evidence and existing E2E:

- Activities: Activity dialog/Quick Log; `golden-path`, `failure-paths`, Sprint 16.
- Work Orders: planning/action consumers; Sprint 23 exact-one lifecycle.
- Offline: Sync Center, sync APIs and IndexedDB; Sprint 20.
- Scouting/photos: scouting UI/APIs/storage; Sprint 27.
- Finance/allocations: finance/forms/reports; Sprint 25 and localization specs.
- Compliance: correction/reversal/export surfaces; Sprint 19.
- Fields/BRP: field forms/import; Sprint 18 and field localization specs.
- AI: activity parse, transcription and briefing surfaces; Sprint 26.

## 6. Production reachability

Resolver findings: 175 `ACTIVE_SERVER_ACTION`, 140 `ACTIVE_DOMAIN`, 23 `ACTIVE_EXPORT_REPORT`, 11 `ACTIVE_PROVIDER_BOUNDARY`, 47 `FIXTURE_ONLY`, four `DEVELOPMENT_ONLY`, two `INTERNAL_DIAGNOSTIC`.

User errors: 96 `ACTIVE_SERVER_ACTION`, 41 `ACTIVE_API`, six `ACTIVE_UI`, three `ACTIVE_OFFLINE_SYNC`, four `DEVELOPMENT_ONLY`. No finding remains unclassified or `UNKNOWN_REQUIRES_REVIEW`.

## 7. User-visible versus internal

Normal localization targets are final UI/error prose, action/API responses, domain reasons and human-readable export/report copy. Canonical codes, server diagnostics, mock dashboard data and development demo messages are not normal production translation targets. The JSON `userVisibleTarget` flag records this decision per finding.

## 8. Raw technical leaks

The focused audit identifies 34 P0 raw-forwarding findings. All are active and potentially user-visible until migrated:

- Economics actions: 10.
- Work Order actions: 5.
- Fields, compliance correction, activity UI, Offline Queue, local annotation UI, offline DB and photo upload route: two each.
- Activities action, inventory, seasons, BRP, scouting action/sync, photo annotations API and economics export API: one each.

These include caught `error.message`, Zod issue/flatten output and API/provider forwarding. Stage 12 does not alter them because no new severe secret exposure was confirmed; existing Prisma masking remains intact.

## 9. Dead, test-only and false-positive findings

- 47 resolver findings in `src/lib/mock-data/farm-dashboard.ts` are `FIXTURE_ONLY`.
- Four resolver and four user-error findings in the development demo action are `DEVELOPMENT_ONLY`.
- Two storage-configuration findings are `INTERNAL_DIAGNOSTIC`.
- No test folder, documentation, SQL or migration finding is included in the active audit scopes.
- No broad suppression was added. Future exclusions must use a documented typed reason.

## 10. Existing contract adoption

| Area | Adoption |
|---|---|
| Shared `UserFacingError` and classifier | Fully migrated |
| Shared four-locale display adapter | Fully migrated |
| Onboarding actions and wizard | Fully migrated |
| Activities, Fields, Inventory, Seasons, BRP, Compliance, Economics, Machines, Spray suitability | Partial: shared handler exists, legacy English result remains |
| Work Orders, offline APIs, photo APIs, AI routes | Incompatible custom/legacy contracts |
| Internal diagnostics and mock data | Not applicable |

A thin compatibility adapter is enough where `handleActionError` is already present. Custom API shapes, Zod field paths, offline state and photo checkpoints need real domain/API migrations.

## 11. Duplicate contracts

High-confidence duplicate candidates include 13 “Farm not found” variants, five activity ownership/not-found messages, four stale-record messages, and repeated field-season, machine and product ownership messages. They should share canonical families, but security semantics stay distinct:

- foreign/inaccessible record → externally `NOT_FOUND`;
- stale version → conflict, retry only after refresh/review;
- duplicate idempotency → conflict or existing receipt according to current exact-one contract;
- offline unavailable → offline, not provider unavailable;
- insufficient stock → permanent until inventory changes, not generic validation.

## 12. Proposed bounded batches

The executable file/count roadmap is in `Remaining_Localization_Batch_Roadmap.md`. User-error batches range from 2–17 findings. Large resolver files are split by authoritative contract family or explicitly marked for a characterization sub-audit before migration.

## 13. Batch scoring

Scores use ten 1–5 dimensions: frequency (F), safety (S), workflow importance (W), visibility (V), E2E readiness (E), mobile/offline relevance (M), blast radius (B), unfinished dependency (D), effort (T) and regression risk (R). Priority = `F+S+W+V+E+M+(6-B)+(6-D)+(6-T)+(6-R)`, maximum 50.

| Batch | F | S | W | V | B | E | M | D | T | R | Priority |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Work Order operational errors (15) | 5 | 5 | 5 | 5 | 2 | 5 | 3 | 1 | 2 | 2 | **46** |
| Inventory + Machines (4) | 5 | 4 | 5 | 5 | 2 | 4 | 3 | 1 | 2 | 2 | 44 |
| Activities / Quick Log (11) | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 2 | 4 | 4 | 42 |
| Offline Sync Center (10) | 4 | 5 | 5 | 5 | 4 | 5 | 5 | 2 | 4 | 4 | 41 |
| BRP import (4) | 3 | 5 | 4 | 5 | 2 | 4 | 3 | 1 | 2 | 2 | 41 |
| Fields (7) | 5 | 5 | 5 | 5 | 3 | 4 | 3 | 2 | 3 | 3 | 41 |
| Scouting actions/sync (9) | 4 | 4 | 5 | 5 | 3 | 5 | 5 | 2 | 3 | 3 | 41 |
| Photo upload/access (11) | 4 | 5 | 5 | 5 | 4 | 5 | 5 | 3 | 4 | 4 | 38 |
| Photo annotation/AI (17) | 3 | 4 | 4 | 5 | 4 | 4 | 5 | 3 | 4 | 4 | 35 |
| Finance actions (11) | 4 | 5 | 5 | 5 | 4 | 5 | 2 | 3 | 4 | 4 | 35 |
| Allocations (11) | 3 | 5 | 5 | 5 | 4 | 5 | 2 | 3 | 4 | 4 | 34 |
| Compliance correction/detail (12) | 3 | 5 | 5 | 5 | 4 | 5 | 2 | 3 | 4 | 4 | 34 |
| AI/transcription (9) | 3 | 4 | 3 | 5 | 3 | 4 | 5 | 3 | 3 | 3 | 33 |
| Seasons (8) | 3 | 4 | 4 | 5 | 2 | 4 | 2 | 2 | 2 | 2 | 42 |
| Spray suitability action (5) | 4 | 5 | 5 | 5 | 3 | 5 | 4 | 2 | 3 | 3 | 42 |

## 14. Dependency graph

```text
shared UserFacingError + four-locale adapter
├─ shared validation/Zod issue mapper
│  ├─ Work Orders → Inventory/Machines → Activities
│  ├─ Fields → BRP
│  └─ Finance → Allocations → Compliance
├─ shared API error response helper
│  ├─ offline sync APIs → Sync Center
│  ├─ photo upload/access → annotations/suggestions
│  └─ AI/transcription
└─ resolver code/metadata adapters
   ├─ Farm Insights/Dashboard
   ├─ compliance/export reports
   └─ scouting reference/condition/provider families
```

## 15. Recommended order

1. Work Order operational user errors.
2. Inventory/Machines, then Activities/Quick Log.
3. Fields and BRP.
4. Offline Sync Center.
5. Scouting actions, then photo upload and annotation batches.
6. Finance, Allocations, Compliance.
7. AI/transcription and report/provider boundaries.
8. Remaining resolver families after characterization; close fixture/dev/internal audit classifications separately.

## 16. E2E coverage

Work Orders, Offline, Scouting, Compliance and Finance have deterministic sprint suites. Activities has golden/failure/Sprint 16 coverage. BRP has Sprint 18. AI has Sprint 26. Each runtime batch changing shared action/API/UI code requires its focused suite and a full serial E2E run; audit-classification-only batches do not.

## 17. Physical-device relevance

Physical devices remain required for microphone/transcription, camera/photo picker, touch annotations, offline reconnect, Service Worker update, IndexedDB quota/failure, Safari MIME/file-size behaviour, map/GPS errors and mobile error-summary focus/wrapping. No device PASS is claimed.

## 18. Remaining global UI debt

Resolver debt (402), user-error debt (150), ordinary component/UI strings, report/export prose, external Clerk UI and physical-device validation are separate ledgers. Closing resolver or error batches cannot by itself establish application-wide multilingual GO.

## 19. Risks

Primary risks are existence leakage from over-specific access errors, changed retryability, collapsing stale/duplicate conflicts, lost offline checkpoint metadata, raw provider leakage, and accidental translation of canonical tokens. Exact-one and farm isolation must remain characterization gates.

## 20. GO / NO-GO

- Remaining resolver and user-error inventory: **GO**.
- Application-wide user-error migration: **NO-GO**.
- Global resolver/application localization: **NO-GO**.
- Next bounded migration: **Work Order transition, stock and exact-one user errors — 15 active findings across one action file.**
# Stage 14 U2 delta (2026-08-01)

Inventory/Machines targeted overlap is closed (6 → 0); global resolver debt is now 373. Activities / Quick Log core remains the next dependency-ordered batch (9 user-error findings); activity-parse API remains a separate two-finding boundary.
