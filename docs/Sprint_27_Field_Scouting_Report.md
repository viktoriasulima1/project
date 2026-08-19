# Sprint 27 — Field Scouting report

## Continuation update (2026-07-20)

Offline annotations are now editable from the real Sync Center local-photo row. The user can add a touch rectangle, save it to the user/farm-scoped IndexedDB draft, reload the page, see the same annotation, force a transient upload failure, retry only that photo and obtain exactly one finalized photo plus exactly one server annotation version. Flow L verifies this complete local -> reopen -> retry -> server chain.

Production configuration now also rejects detectably public buckets and non-finite signed URL lifetimes. Unit coverage increased to **727/727**. Prisma remains at 21 current migrations; TypeScript and production build pass. Focused Sprint 27 remains **6/6** and includes the expanded offline annotation lifecycle.

Updated full-suite evidence:

- clean run after the offline integration: 106 collected; 105 passed; 1 documented conditional skip; 0 failed; 411.0 s;
- the next run found one hydration-sensitive mobile navigation test defect; the exact test passed in isolation and the test was hardened to confirm `aria-expanded` with bounded interaction retry;
- clean run after that test fix: 106 collected; 105 passed; 1 documented conditional skip; 0 failed; 391.6 s;
- the required second consecutive post-fix run was **NOT STARTED** because the execution environment rejected the command after its tool-usage limit was exhausted until 2026-07-25. This is an execution-capacity blocker, not a test result, and is not counted as passed.

Therefore the latest code has one clean full run after the final test change, not the required consecutive pair. Automated status remains **NO-GO** until the second post-fix full run completes, in addition to the existing real-storage and physical-device blockers.

## Final integration validation (2026-07-19)

### Delivered integration

- Real private photo detail now opens the pointer/touch editor and persists normalized point, rectangle and text annotations through a farm-scoped API.
- Every save creates an auditable effective `PhotoAnnotationVersion`; a finalized photo requires a correction reason, retains Original/Corrected history and rejects a stale base version as conflict.
- The Sync Center now retries the selected photo rather than navigating/restarting the queue. It reuses `localPhotoId`, resolves missing visit/observation dependencies, increments retry count and leaves synchronized siblings untouched.
- Upload recovery persists `authorization_created`, `binary_uploaded`, `checksum_verified`, `db_attached`, `finalized`/`failed` checkpoints. A retry reads existing provider/DB state and a lost finalized response deduplicates.
- Production rejects local/unavailable storage. A shared gateway adapter, authenticated safe diagnostic and opt-in synthetic contract command exist.
- Explicit-consent Photo-AI review persists bounded context/model/schema/action, remains unconfirmed, rate-limits requests and can create an agronomist consultation WorkOrder without authorizing treatment.
- Scouting PDF/CSV now disclose synchronized photo status, effective annotation version and suggestion review status; local/failed photos are omitted and no signed URL/storage key is exported.

### Executed gates

| Gate | Result |
|---|---|
| Prisma generate | PASS — normal local engine restored |
| Prisma migrate status | PASS — **21 migrations current** |
| TypeScript | PASS |
| Unit | PASS — **725/725**, 67 files, 42.91 s |
| Production build | PASS — final compile 4.6 s, TypeScript 10.4 s, total process 27.3 s |
| Focused Sprint 27 | PASS — **6/6 including setup**, 85.3 s |
| Full E2E run 1 | PASS — **106 collected; 105 passed, 1 documented conditional skip, 0 failed**, 651.8 s |
| Full E2E run 2 | PASS — **106 collected; 105 passed, 1 documented conditional skip, 0 failed**, 657.0 s |
| Storage provider contract | **NOT RUN** — command correctly refuses without `STORAGE_CONTRACT_TEST=true`; no real provider credentials supplied |
| Vision provider contract | **NOT RUN** — command correctly refuses without `VISION_CONTRACT_TEST=true`; no paid/live call made |

Focused browser evidence covers real upload, touch rectangle/text pointer events, save/reopen, finalized correction versions, explicit-consent deterministic suggestion review, suspected state, consultation WorkOrder, offline local Blob, a forced transient selected-photo failure, direct retry, retry count and one finalized DB photo. Two clean full runs then repeated database reset and all existing Service Worker/IndexedDB isolation coverage without contamination. The fixed Clerk pool remained the established 4 named users (5 total tenant users); no user-creation test path or new user was introduced.

Before the clean focused/full results, failures were classified and corrected: one Clerk preflight was `network_unreachable` infrastructure; early Flow K failures were test defects (waiting on text already present, strict multi-element locator, closed details, off-viewport/synthetic pointer coordinates); the pointer normalization guard was a real editor robustness defect. No failing result was hidden.

### Remaining limitations and decisions

- Complete offline annotation edit/reopen/conflict/sync from the photo-detail editor is not yet browser-proven; current offline annotation data is retained in the visit draft graph.
- Forced interruption after `binary_uploaded` and after `db_attached`, plus provider orphan cleanup, are implemented as checkpoints but not separately exercised in Playwright.
- The real multi-node object provider contract, invalid-credential/outage/expiry cases, bucket privacy, encryption, lifecycle and restore drill were not executed.
- External Photo-AI still lacks a genuinely resized/compressed metadata-stripped derived-image pipeline; deterministic CI does not send the original externally.
- Dedicated cross-farm annotation/retry, expired signed-read and mobile 430x932 integration specs remain missing, although existing farm scoping and isolation suites are green.
- Physical iPhone: **NOT TESTED**. Physical Android: **NOT TESTED**. HEIC/camera, touch ergonomics, termination/restart, interrupted real-network upload, signed view and PDF remain pending.

Automated decision: **NO-GO for declaring Sprint 27 complete**, because the real storage contract and several required interruption/offline/security browser proofs remain pending.

Physical field-pilot decision: **EXPLICIT NO-GO** until the iPhone and Android runbooks pass with recorded evidence. Automated tests do not substitute for physical phones.

## Final closure update

Browser/product additions: touch/mouse pointer annotation editor (point, rectangle, text, move, resize, edit, delete, undo/cancel/save), annotation-version schema, detailed Offline & Sync center, retry classification/progress, production-only shared object-gateway validation, dry-run orphan diagnostics, explicit photo-processing consent, deterministic safe suggestion contract and review actions (suspected/rejected/unknown). No analysis occurs during upload and no treatment action exists.

Final-closure unit gate: **720/720 in 67 files**. Production storage is automatically NO-GO if configured as local/unavailable or with placeholder/non-HTTPS settings. Optional live vision contract was not run because no explicit `VISION_CONTRACT_TEST=true` synthetic-provider authorization was supplied.

Physical iPhone: pending. Physical Android: pending. Therefore automated browser closure can pass, but the physical field pilot remains **NO-GO** until real camera/HEIC, touch resize, termination/restart, interrupted upload/retry, signed view, consent and PDF evidence are recorded on both platforms.

### Final closure validation (2026-07-18)

| Gate | Result |
|---|---|
| `npx prisma generate` | PASS |
| `npx prisma migrate status` | PASS - 20 migrations current |
| `npx tsc --noEmit` | PASS |
| `npx vitest run` | PASS - **720/720**, 67 files, 42.91 s |
| `npm run build` | PASS - production compilation 4.5 s; TypeScript phase 11.4 s |
| Focused `sprint27-scouting.spec.ts` | PASS - **4/4 including setup**, 1.1 min |
| Clean full E2E run 1 | PASS - **104 collected; 103 passed, 1 documented conditional skip, 0 failed**, process 696.7 s |
| Clean full E2E run 2 | PASS - **104 collected; 103 passed, 1 documented conditional skip, 0 failed**, process 674.6 s |

The first attempted full run exposed a real hydration mismatch in the new Sync Center: the initial render read `navigator.onLine`. It was fixed by using a stable server/client initial state and updating connectivity after mount. The required consecutive clean pair was restarted after that fix. Both clean runs reset the isolated E2E database successfully. Existing offline/isolation coverage showed no service-worker state leak or IndexedDB namespace contamination. The fixed Clerk pool was reused; no user-creation path ran and no new users were created. Development-Clerk retry warnings occurred after tests had ended but did not fail either run.

Cross-tab/sync logic, normalized annotation operations, production storage configuration rejection and safe photo-suggestion output are covered by unit tests. Recovery JSON remains metadata-only and cannot auto-submit regulated activity. Photo analysis requires explicit per-request consent and its review choices do not authorize treatment. The optional external vision-provider contract was not run because explicit `VISION_CONTRACT_TEST=true` authorization and a synthetic provider reference were not supplied.

### Honest closure gaps

- The touch annotation editor exists as a standalone component, but is not yet connected to the actual capture/detail save workflow; annotation-version persistence has schema support but no correction API/UI.
- Sync Center classifies and displays failures, but its retry action currently navigates back to scouting rather than retrying an individual queued item in place.
- The shared object-gateway adapter and strict production configuration gate are implemented, but no real production object service connectivity, signed-read, cleanup or restore drill was executed. Confirmed orphan deletion remains deliberately disabled in the cleanup utility.
- Photo-AI consent and suspected/rejected/unknown review work, but detailed feedback capture and agronomist-consultation WorkOrder creation are not implemented.
- The focused Sprint 27 Playwright file validates the established scouting flow; it does not yet exercise the new touch editor, item retry, or photo-AI review end to end.
- No physical iPhone or Android validation occurred. HEIC/camera behavior, touch ergonomics, app termination/restart, interrupted uploads, reconnect recovery and outdoor network behavior remain unverified.

Decision: **PARTIAL / NO-GO**. Automated gates are green, but Sprint 27 must not be marked complete and the offline field pilot must not begin until the missing browser integrations, a real production object-storage drill and the physical iPhone/Android checklist pass.

## Finalization update — private photos, offline graph, reports and briefing

Implemented on 2026-07-18:

- vendor-neutral `PrivatePhotoStorage` with deterministic/private local provider and unavailable-provider fallback;
- server-generated farm/visit/observation/object keys, byte-magic MIME validation, 8 MB limit, SHA-256 verification, temporary upload, DB attachment, atomic finalization and pre-finalization cleanup;
- authenticated photo page and five-minute signed binary access; no public object URLs or client-authorized storage keys;
- camera/gallery multiple input, local thumbnails, remove-before-save, explicit Local only/upload/failed states and accessible point-annotation text;
- separate IndexedDB scouting graph holding visits, independent observation/photo IDs, Blob originals and normalized annotations, with 100 MB local quota and honest JSON recovery manifest excluding binaries;
- farm-scoped scouting PDF/CSV generators, export checksum/provenance and an unconfirmed-evidence disclaimer; CSV contains no signed photo URL;
- shared scouting rules added to Farm Insights, and therefore to `buildDailyFarmContext()` used by Daily Briefing;
- migration `20260718200000_sprint27_photo_finalization` (19 migrations current).

Validation:

| Gate | Finalization result |
|---|---|
| Prisma generate/status | PASS — 19 migrations current |
| TypeScript | PASS |
| Unit | PASS — 708/708, 66 files, 42.35 s |
| Production build | PASS — 73.2 s combined unit/build command; build compiled in 4.4 s |
| Focused Sprint 27 | PASS — 4/4 including setup, 1.0 min |
| Clean full run 1 | PASS — 104 collected; 103 passed, 1 documented conditional skip, 0 failed; 646.1 s |
| Clean full run 2 | PASS — 104 collected; 103 passed, 1 documented conditional skip, 0 failed; 647.5 s |

Before the consecutive clean pair, one Activity accessibility test hit a transient Clerk/network sync fallback and one legacy WorkOrder test hit a validation race. Each exact test passed in isolation (2/2 including setup) without code changes. They are classified as infrastructure/test flakiness, not hidden from the result. Fixed Clerk pool remained unchanged; no paid vision calls or new users were used. Repeated database reset and existing offline suites showed no service-worker/IndexedDB contamination.

Storage provider status: the private single-node provider is implemented and suitable for deterministic E2E or a controlled single-node pilot. A multi-node production adapter backed by a configured private object service and a restore drill are still pending. HEIC is rejected honestly until safe conversion exists.

Remaining functional limitations: the UI currently exposes point annotations; rectangle/text exist in the normalized domain/tests but still need the complete touch editor. Dedicated explicit retry/sync controls and full app-restart/partial-photo-upload Playwright flows are not yet in the focused suite. Photo-AI request/review remains schema/policy-only; no diagnosis or treatment feature was introduced. Report API exists, but the dedicated report-selection UI and thumbnail embedding remain pending.

iPhone status: **not physically tested**. Android status: **not physically tested**.

Decision: **NO-GO for completing Sprint 27 or starting the offline field pilot** until multi-node production storage (or an explicitly approved single-node pilot), touch annotation, full offline restart/partial-upload E2E, photo-suggestion review flow, report UX and the real iPhone/Android checklist pass. Automated tests do not substitute for physical evidence.

Status: **PARTIAL / NO-GO for field pilot** (18 July 2026). The structured evidence foundation and initial workflow are implemented and automated gates are green. Production photo delivery, dedicated offline scouting/photo synchronization, reports, briefing/insight integration and physical phones are not validated; Sprint 27 is therefore not complete.

## 1–5. Previous gaps, model, growth stages, visits and observations

The pre-sprint audit is in `Sprint_27_Field_Scouting_Audit.md`. Sprint 27 adds farm-owned `ScoutingVisit`, `ScoutingObservation`, `CropStageRecord`, `ScoutingPhoto` and `PhotoSuggestion` models. A visit is evidence, not an immutable completed Activity. A visit accepts multiple observations across the bounded category list, severity, affected percentage, description, confidence and explicit certainty. “Unknown leaf spots” is valid; no diagnosis is forced.

Growth stages support BBCH initially and other systems by string identifier. Stage recording requires explicit code/label confirmation. Corrections create linked versions, preserve prior records, require a reason and switch the effective record. Calendar time never advances stage silently.

The new `/scouting` responsive workflow selects/confirm a field/crop, captures foreground GPS when permitted, records an optional stage and multiple observations, and saves an audited visit. Field Detail links into it and shows health, stage history and recent visits.

## 6–8. Photos, suggestions and reference library

The database model separates original private object key, checksum, capture/GPS metadata and annotation JSON. `PhotoSuggestion` keeps candidates/features/alternatives and an awaiting-review state. The bounded Dutch arable reference structure is source/provenance/review-date aware and explicitly separates identification guidance from Ctgb authorization.

**Not implemented/validated:** production private object storage, authenticated/signed binary delivery, camera upload UI, MIME/content sanitization, annotation editor, deterministic vision-provider route, retention jobs and cross-farm photo download tests. No full binaries are stored in PostgreSQL. These are pilot blockers, not silently treated as complete.

## 9–10. Weather risk and Field Health

`resolveWeatherRisk()` is deterministic (`scouting-weather-v1`) and returns low/moderate/high/unavailable, facts, missing inputs, reason, action and confidence. It says conditions *may favour* disease and never says disease is present.

`resolveFieldHealthStatus()` is the shared resolver with `attention_required`, `inspect_soon`, `monitoring`, `no_current_issue` and `insufficient_data`. It returns severity, explanation, evidence, action, freshness and confidence. Severe unresolved observations outrank overdue inspection/high weather risk, which outrank monitoring evidence. The map, accessible list, Field Detail and `/scouting` use this resolver.

## 11–13. Map, Work Orders, briefing and insights

Field Map has Crop Health labels in addition to colour and an accessible list showing open count, current stage and latest visit. Field Detail has Crop Health, current-stage history and recent visits. `createObservationWorkOrder()` is farm-scoped, idempotent per observation and marks only `action_planned`; completion does not claim biological resolution and never selects a pesticide.

Daily Briefing and Farm Insights integration is **not yet wired**. The resolver is ready to be consumed, but no duplicate UI health logic was added as a shortcut.

## 14–15. Offline and reports

`localVisitId` + submission hash provides server exact-one retry semantics and conflict detection. Policies define user/farm/visit/observation photo scope and partial-upload handling. The current Activity IndexedDB queue does **not** yet persist/reopen a complete scouting/photo graph, so offline scouting/photo recovery and exact-one photo/WorkOrder sync remain unverified.

Scouting PDF/CSV reports and the reports data dictionary are not implemented in this slice.

## 16. Privacy and security

Ownership comes from the authenticated farm session. FieldSeason is checked through its farm-owned Field; client farm/observer/provider IDs are not accepted. Visit mutation, stage correction, resolution and observation-to-WorkOrder are farm scoped. Original evidence is not destructively deleted. The audit trail records visit creation, stage correction, status changes and derived WorkOrder creation. Production photo authorization remains a blocker noted above.

## 17–20. Automated validation

| Gate | Result |
|---|---|
| `npx prisma generate` | PASS |
| `npx prisma migrate status` | PASS — 18 migrations, current |
| `npx tsc --noEmit` | PASS |
| `npx vitest run` | PASS — **701/701**, 65 files, 44.24 s |
| `npm run build` | PASS — 27.8 s; first sandbox attempt was infrastructure-only Google Fonts network denial, unrestricted retry passed |
| Focused `sprint27-scouting.spec.ts` | PASS — **4/4 including setup**, 56.3 s |
| Full E2E run 1 | PASS — **104 collected; 103 passed, 1 pre-existing documented skip, 0 failed**, process 681.4 s |
| Full E2E run 2 | PASS — **104 collected; 103 passed, 1 pre-existing documented skip, 0 failed**, process 688.3 s |

Focused E2E found and fixed two real defects: a Client Component importing a value from a `'use server'` module, and fixed-pool database reset ordering for new RESTRICT relations. Both full consecutive runs remained clean. Fixed Clerk pool remained 4/4 (5 total tenant users), no user-creation path was used, and no new users were created. Global reset succeeded on both runs; no service-worker or IndexedDB contamination appeared in existing isolation/offline suites.

## 21–24. Physical devices, limitations, competitive impact and decision

Unverified on real iPhone and Android: GPS field suggestion/choice accuracy, camera capture, multiple photos, annotation usability, growth-stage entry outdoors, offline visit after app restart, photo recovery, reconnect upload/exact-one sync, map health mode, and pending Sprint 26 microphone/live-AI checks.

The delivered foundation closes the largest data-model gap: scouting is now comparable structured evidence with observed stages and one shared health-priority resolver instead of notes and mock scores. It does not yet reach production parity for photo/offline/report workflows.

**Explicit NO-GO:** do not start the offline field pilot and do not mark Sprint 27 complete until production private photo handling, dedicated offline scouting sync, remaining integrations/reports, cross-farm binary tests and the physical iPhone/Android checklist pass. Symptoms are not diagnoses; AI never authorizes treatment; Ctgb remains authoritative.

---

# Sprint 27 Certification (2026-07-21)

Baseline frozen in `docs/Sprint_27_Certification_Evidence.md`: version 0.2.0, 21
migrations (DB current), **tsc clean, 727/727 unit tests, build compiled**
(all verified this session). Git hash unavailable (no git CLI).

**Update 2026-07-21 — E2E now executed and clean.** The port was free (no manual
dev server), Clerk was reachable, so the certification E2E ran with Playwright
owning its own server (`CI=1`, `--workers=1 --retries=0`, JSON reporter,
directly-read exit codes): **focused scouting 6/0/0/0** and **two consecutive
full passes 105 passed / 1 documented skip / 0 failed / 0 flaky** (exit 0 each,
server alive). See `Sprint_27_Certification_Evidence.md` §1b. The **real storage
contract remains NOT RUN** (no `object_gateway` provider/credentials configured —
the user's action), so it stays the single automated-GO blocker. Nothing below
is claimed as executed unless tagged so.

**Update 2026-07-21 — direct S3 adapter.** A `s3_compatible` production
photo-storage adapter (self-contained AWS SigV4, no SDK) now implements the
existing `PrivatePhotoStorage` interface with **no scouting-UX / domain change**;
the contract is provider-aware and 16 unit tests were added (tsc clean, **vitest
743/743**, build compiled). The refactor was confirmed non-breaking by re-running
the focused scouting E2E (**6/0/0/0**, exit 0). The **real storage contract still
requires the user to configure provider credentials**, so the automated gate
remains blocked there.

## Part 5 — Final post-fix E2E plan (run on/after 2026-07-25, same frozen commit)

```
npx prisma generate
npx prisma migrate status
npx tsc --noEmit
npx vitest run
npm run build
# then two complete certification passes:
npx playwright test --workers=1 --retries=0
npx playwright test --workers=1 --retries=0
```

Both passes must show, from an **unchanged** commit: same collected count · **0
failed · 0 flaky recoveries** · only the documented conditional pilot-smoke skip
· fixed Clerk pool unchanged (no new users) · no IndexedDB/Service-Worker leakage
· exact-one annotation sync · exact-one visit/observation/photo effects · server
stays alive the whole run · no paid AI or vision provider call. Save the
machine-readable reporter output (JSON) and the final summaries as evidence —
**not** a lossy text filter, and read Playwright's own exit code directly (a
prior sprint mis-reported results by reading a pipeline's exit code instead of
the test runner's).

## Part 6 — Focused scouting certification (run first, `--retries=0`)

```
npx playwright test e2e/sprint27-scouting.spec.ts --workers=1 --retries=0
```

Must cover, without weakening exact-one assertions: local photo opens in the
touch editor; rectangle persists after restart; direct retry runs the real
selected-item retry with the same idempotency key → **one** server annotation
version, **no** duplicate; cross-farm access rejected; mobile viewport usable.
(`sprint27-scouting.spec.ts` present; the brief reports 6/6 last pass — **not
re-run this session.**)

## Part 7 — Physical iPhone runbook (record later; not passed)

Safari **and** installed PWA. Steps: grant camera permission · capture HEIC and
JPEG · select from gallery · create a touch rectangle · resize/move it by touch ·
add a text label · save while offline · terminate the app · reopen **offline** ·
verify the photo + annotation recover · reconnect · **interrupt** an upload mid-
transfer · retry **only** the failed photo · verify signed private-photo access
(and that a direct/expired URL is refused) · verify **exactly one** server
annotation version · open the scouting PDF. Record: device model · iOS version ·
Safari vs PWA · result · screenshot/video evidence · issue severity. **Do not
infer any of this from Playwright Chromium.**

## Part 8 — Physical Android runbook (record later; not passed)

Chrome **and** installed PWA. Equivalent steps: camera + gallery capture · touch
annotation (create/resize/move/text) · save offline, restart app, reopen offline,
recover · interrupted upload · per-item retry (failed photo only) · sync progress
never completes while a photo is pending · signed private-photo access · report
download. Record the same evidence fields. Android results are **independent** of
Chromium E2E and iPhone results.

## Part 9 — Final GO rules

**Automated Sprint 27 GO** requires ALL of: frozen unchanged commit · focused
scouting suite PASS · **two consecutive full E2E passes** · 0 failed · 0 flaky ·
only the documented skip · **real storage-contract PASS** · no cross-farm photo
leak · exact-one annotation/photo sync.

**Physical field pilot GO** additionally requires: real iPhone validation · real
Android validation · camera capture · touch editor · offline restart recovery ·
interrupted upload · per-item retry · exact-one synchronization.

Until every item above is met with machine-verifiable evidence:

> **AUTOMATED SPRINT 27: CONDITIONAL / NO-GO**
> **PHYSICAL FIELD PILOT: NO-GO**
