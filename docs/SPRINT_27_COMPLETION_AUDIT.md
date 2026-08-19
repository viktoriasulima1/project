# Sprint 27 completion audit

## Continuation evidence (2026-07-20)

Sync Center local-photo annotations now persist in the namespaced IndexedDB graph and survive page reload. Focused Flow L proves local rectangle save, reload, forced transient failure, selected-item retry, one finalized DB photo and one annotation version. Unit is 727/727; TypeScript/build pass.

One post-integration full run passed (106 collected / 105 passed / 1 conditional skip / 0 failed, 411.0 s). A subsequent mobile-nav failure was classified as a hydration-sensitive test defect, passed in isolation, and was hardened. The first post-fix full run passed with the same counts in 391.6 s. The second post-fix run could not start because the execution environment exhausted its tool-usage allowance until 2026-07-25. It is explicitly **NOT PASSED / NOT RUN**. Automated and physical decisions remain NO-GO.

## Final integration gap audit (2026-07-18)

| Blocker | User-visible behavior | Server / database | Offline behavior | Acceptance and test status |
|---|---|---|---|---|
| Persisted touch annotations | Real photo detail opens point/rectangle/text editor; Save/Reopen and version list are wired | Farm-scoped API validates normalized finite coordinates, relationship and stable IDs; creates one effective `PhotoAnnotationVersion`, retains predecessor and audit event | Existing draft graph retains Blob + annotations; post-upload editor currently requires connectivity | Desktop real-photo pointer persistence PASS in Flow K; dedicated mobile/offline-photo-detail proof pending |
| Finalized correction | UI says saving creates a corrected version and requires a reason | Serializable transaction rejects stale base version, preserves previous version, updates effective projection | Offline conflict representation is not yet wired into the photo-detail editor | Original/Corrected/Current effective PASS in Flow K; offline conflict E2E pending |
| Per-item retry | Each failed photo has its own Retry action, category, last attempt, count and local-safety wording | Retry reuses `localPhotoId`; visit/observation dependencies are created only when missing | Selected IndexedDB row is updated; successful sibling photos are untouched | Forced transient direct retry and exact-one DB photo PASS in Flow L; later-checkpoint interruptions pending |
| Interrupted upload | Retry resumes selected evidence and reports aggregate progress | Persistent statuses: authorization_created, binary_uploaded, checksum_verified, db_attached, finalized/failed; finalized response loss deduplicates | Local Blob and idempotency key remain until success | Checkpoint implementation exists; forced-stage Playwright proof and orphan cleanup execution pending |
| Production storage | Production rejects local/unavailable provider | Provider-neutral gateway adapter, HTTPS/config validation, authenticated safe diagnostic and opt-in contract command exist | Local adapter remains development-only | Real provider contract **NOT RUN**; bucket privacy/encryption/lifecycle/restore remain deployment evidence blockers |
| Photo-AI review | Explicit consent, unconfirmed candidates, suspected/rejected/unknown and consultation WorkOrder actions | Farm scope, rate limit, bounded context checksum, persisted review/action and treatment=false audit | Requires uploaded finalized photo and connectivity | Deterministic CI path implemented. Safe resized derivative is not yet produced; live vision contract **NOT RUN** |
| Reports | PDF/CSV disclose sync state, effective annotation version and suggestion review | Only finalized photos count as synchronized evidence; no key/signed URL emitted | Local-only/failed photos are explicitly omitted | Generator integration implemented; browser export assertions pending |

Components are not classified complete merely because their internal state works. Physical iPhone/Android remains untested.

Final executed evidence: Prisma/TypeScript/build PASS; unit 725/725; focused 6/6; two consecutive full runs each collected 106 with 105 passed, 1 documented conditional skip and 0 failed (651.8 s / 657.0 s). Storage and vision external contracts were NOT RUN. Overall remains automated NO-GO and physical field-pilot NO-GO.

Final-closure update: pointer/touch annotation tools, sync status center, failure classification, production shared gateway validation, dry-run cleanup and explicit-consent deterministic photo review are implemented as foundations. `PhotoAnnotationVersion` provides the append-only correction schema, but the editor is not connected to the evidence save flow and correction persistence is not yet exposed. Physical-device validation remains pending and is not inferred. The object gateway must still pass a real pilot-environment connectivity/restore drill before production GO.

Classification dated 2026-07-18. Models and documents are not counted as user functionality.

| Requirement | Classification | Evidence / remaining gate |
|---|---|---|
| Structured visits, observations, BBCH history | Complete; unit/browser tested | `/scouting`, server actions, Field Detail |
| Shared crop-health resolver and map | Complete; unit/browser tested | Field Detail, map list and polygons |
| Private binary storage | Complete for configured single-node private provider; production-provider configuration pending | Temporary upload, checksum, finalization, signed access; no public URL |
| Camera/gallery and multiple previews | Browser implemented; physical-device pending | `capture=environment`, multiple input, remove/preview/state |
| Photo annotations | Partial/browser foundation | Standalone pointer editor and normalized point/rectangle/text domain tested; save workflow and version API pending |
| Authenticated photo detail | Complete for stored evidence | Farm-scoped page, short-lived signed binary, context/annotations/suggestions |
| Offline visit/photo persistence | Browser implemented; focused recovery E2E pending | Separate IndexedDB graph stores Blob and annotations; user/farm namespace |
| Exact-one visit/photo | Server implemented; unit/browser partial | localVisitId/localPhotoId/checksum; full restart/partial-upload E2E pending |
| Recovery export | Partial | Metadata manifest explicitly excludes binaries; device queue is binary recovery path |
| Photo AI | Partial/browser implemented | Explicit consent and deterministic safe review UI exist; detailed feedback, consultation WorkOrder and live-provider contract pending |
| Daily Briefing/Farm Insights | Implemented through shared Insights → daily context | Severe/stale/photo-review facts; dedicated E2E pending |
| Today/map upload attention CTAs | Partial | Health map present; upload attention remains on `/scouting` |
| Scouting PDF/CSV | Server implemented; UI link/dedicated E2E pending | Farm scope, export provenance, disclaimer, no signed URLs |
| iPhone / Android | Physical-device pending | No physical success claimed |

Automated closure gates: Prisma generate/status PASS (20 migrations), TypeScript PASS, unit PASS (720/720), build PASS, focused scouting PASS (4/4), and two consecutive full E2E runs PASS (104 collected; 103 passed; 1 documented conditional skip; 0 failed) in 696.7 s and 674.6 s. The first pre-pair attempt found a real Sync Center hydration defect; it was fixed before restarting the clean pair. No user-creation path ran, and existing reset/isolation coverage showed no service-worker or IndexedDB leakage.

Overall: automated foundation is materially improved, but Sprint 27 remains **PARTIAL / NO-GO** until the editor and per-item retry are integrated, physical devices pass, a production storage deployment/restore drill succeeds, full offline restart/partial-upload E2E exists, and the remaining photo-AI review requirements pass.

## Certification-prep evidence levels (2026-07-21)

Frozen baseline in `docs/Sprint_27_Certification_Evidence.md`: version 0.2.0, 21
migrations (current), **tsc clean, 727/727 unit, build compiled** (all verified
this session). The E2E and storage-contract levels below are **not** re-executed
this session (env capacity deferred to 2026-07-25; no real storage provider). Each
capability is tagged by the highest evidence level it has actually reached:

| Capability | implemented | unit-tested | browser once | browser twice | storage-contract | physical |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Touch annotation editor (create/resize/move/text/undo) | ✓ | ✓ | ✓ (reported) | — | n/a | — |
| Persisted/versioned annotations, exact-one | ✓ | ✓ | ✓ (reported) | — | n/a | — |
| Direct per-item photo retry (same idempotency key) | ✓ | ✓ | ✓ (reported) | — | n/a | — |
| Cross-farm photo/record rejection | ✓ | ✓ | ✓ (reported) | — | n/a | — |
| Photo storage adapter + config safety | ✓ | ✓ | n/a | n/a | **NOT RUN** | — |
| Production storage rejections (local/public/http/placeholder/lifetime) | ✓ | ✓ (`final-closure.test.ts`) | n/a | n/a | n/a | — |
| Storage **preflight** (read-only) | ✓ (new) | run this session (FAIL here / PASS-path verified) | n/a | n/a | n/a | — |
| Safe-unavailable degradation (`UnavailablePhotoStorage`, `classifyPhotoFailure`) | ✓ | ✓ | n/a | n/a | n/a | — |
| Full two-pass certification E2E | — | — | ✓ | **✓ (2026-07-21)** | — | — |
| Physical iPhone / Android | — | — | — | — | — | **NOT RUN** |

**Update 2026-07-21:** "browser twice" is now met — **two consecutive full E2E
passes** on the current commit (105 passed / 1 documented skip / **0 failed / 0
flaky** each, `--retries=0`, Playwright-owned server alive, no new Clerk users),
plus focused scouting 6/0/0/0. Machine-verified via JSON `stats` + directly-read
exit codes (`test-results/cert-full-{1,2}.json`, `cert-focused.json`). The
**storage-contract** and **physical** columns remain the outstanding gates —
nothing is marked passed that was not actually executed. Automated GO is blocked
**solely** on the real storage-contract PASS (no provider configured here).

**Update 2026-07-21 (S3 adapter):** a direct **`s3_compatible`** production
photo-storage adapter is now implemented (`s3-compatible-storage.ts`,
self-contained AWS SigV4, no SDK) against the existing `PrivatePhotoStorage`
interface — **no change to scouting domain services**. Config validation extended
(rejects local/in_memory/http/placeholder/public/excessive-lifetime/missing
region+bucket for both shared providers); the contract is provider-aware; signed
reads stay the FarmOS route (S3 URLs/keys never reach a client). **16 new unit
tests**; tsc clean · **vitest 743/743** · build compiled · focused scouting E2E
re-run **6/0/0/0** (local path unaffected). The **real storage contract is still
NOT RUN** (no provider credentials) — GO stays blocked there.
