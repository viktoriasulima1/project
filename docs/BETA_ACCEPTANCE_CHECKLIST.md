# FarmOS Beta Acceptance Checklist

## Stage 18 automated gate — 2026-08-08

Offline Sync Center localization: targeted 10 → 0; focused 8/8; relevant offline regression 29/29; full E2E 210 collected, 209 passed, 1 conditional skip, 0 failed/flaky, retries 0. Clerk remained 5 total / 4 fixed-pool and created no users. No IndexedDB or Service Worker leakage was observed. Automated gate is GO; physical iPhone/Android offline field pilot remains NOT RUN / NO-GO.

## Stage 16 localization evidence

- [x] Activity Parse target 2 → 0; focused 9/9, regression 35/35, full 202 pass + 1 conditional skip.
- [x] No automatic Activity/draft persistence and no live/paid AI.
- [ ] Physical iPhone/Android validation was not performed.
- [ ] Application-wide localization remains NO-GO at 120 user-error / 367 resolver.

## Stage 15 localization evidence

- [x] Activities / Quick Log core findings 9 → 0; focused 6/6, regression 38/38, full E2E 195 collected / 194 passed / one conditional skip.
- [x] Cross-farm identifiers stay hidden; offline and Work Order exact-one regressions pass.
- [ ] Application-wide localization remains NO-GO at 122 user-error / 367 resolver findings.

## Stage 13 evidence (2026-08-01)

- [x] Work Order action errors contain no raw Zod/Prisma/caught text.
- [x] Farm-scoped not-found remains existence-hiding.
- [x] Stock/reservation and exact-one lifecycle regression passes.
- [x] Full automated E2E: 183 passed, one documented conditional skip, zero failed/flaky.
- [ ] Application-wide user-error/localization debt is zero (still 135 / 379); overall multilingual completion remains NO-GO.

# Stage 12 — Remaining localization inventory

| Gate | Result |
|---|---|
| Machine-readable evidence | PASS — 402 resolver + 150 user-error findings |
| Reachability/family classification | PASS — no unknown findings |
| Audit tooling tests | PASS — 10/10 focused |
| Final unit / TypeScript / build | 994/994 / PASS / PASS |
| Runtime application changes | None |
| Browser tests | NOT RUN; last clean 178/177/1/0 retained |
| Inventory stage | GO |
| Application-wide localization | NO-GO |
| Next batch | Work Order operational errors — 15 findings / one file |

# Stage 11 — User Error contracts

| Gate | Result |
|---|---|
| Shared contract / Onboarding | GO / GO |
| Targeted active audit | 158 → 150; NOT ZERO, NO-GO |
| Global resolver audit | 415 → 402; NO-GO |
| Prisma / TypeScript / unit / build | 22 current / PASS / 984 of 984 / PASS |
| Focused / regression E2E | 4/4 / 58/58 PASS, retries 0 |
| Final full E2E | 178 collected / 177 pass / 1 documented skip / 0 fail-flaky |
| Clerk / browser isolation | 5 total / 4 fixed before and after; 0 created; no SW/IDB leak reported |
| Physical device | Not tested |

# Stage 10 — Spray Window resolver localization

| Gate | Result |
|---|---|
| Existing implementation / four-locale canonical contract | Case A / PASS |
| Threshold characterization / targeted audit | PASS; 16 → 0 |
| Prisma / type / unit / build | 22 current / PASS / 984 of 984 / PASS |
| Focused / full E2E | 21/21; 175 collected, 174 pass, 1 documented skip, 0 fail/flaky |
| Clerk / browser isolation | 5 total / 4 fixed before and after; 0 created; no SW/IDB failure |
| Work Orders / physical device | No resolver caller / not claimed |
| Global resolver localization | NO-GO; 415 findings remain |

## Financial Completeness closure — 2026-07-28

| Check | Result |
|---|---|
| Canonical contract/order/no prose | PASS |
| Complete, missing price, labour, machinery, combined and harvest fixtures | PASS (11/11 focused) |
| Field Detail / Finance consistency and localized actions | PASS |
| Missing values remain null, never fabricated zero | PASS |
| Allocation integrity where resolver support is absent | PASS; no reason invented |
| Focused regression | PASS (25/25) |
| Full unrestricted E2E | PASS (152 + 1 documented skip / 153, retries=0) |
| Clerk fixed pool | PASS (5 total / 4 pool before and after; 0 created) |
| Physical iPhone/Android localization review | PENDING — separate device gate |

Financial Completeness localization is GO. Global resolver localization remains
NO-GO.

## Localization (multilingual sprint — 2026-07-23)

| # | Check | Expected | Status |
| --- | --- | --- | --- |
| L1 | Switch language (nl/en/pl/de) in the sidebar | Nav + wired labels change; route preserved; persists on reload | Automated (`i18n.test.ts`); E2E written (`i18n-localization.spec.ts`, not run) |
| L2 | Save a scouting condition in Dutch, re-read the DB | Stored value is canonical `satisfactory`, never the localized label | Automated (unit); E2E Flow B (not run) |
| L3 | Trigger a validation error in each locale | Friendly localized message; never raw Zod/enum/Prisma text | Automated (`i18n.test.ts` 16/17) |
| L4 | `npm run i18n:validate` | No missing/extra keys, no placeholder mismatch across 4 locales | Automated (green) |
| L5 | Offline draft created, then language switched | Canonical tokens unchanged; recovery export locale-independent | Automated (unit) |
| L6 | Physical iPhone, native locales + browser translation | Correct language; translation cannot change submitted values | NOT retested — gate |
| L7 | Clerk sign-in follows selected locale | Localized where the pack supports it | Pending (packs not installed) |
| L8 | PDF/CSV export locale + provenance | Localized headings; canonical IDs; locale recorded | Pending wiring (helpers ready) |
| L9 | Onboarding fully translates (all steps) | `i18n:audit -- onboarding` = 0; nl/pl/de; canonical soil/crop/category/unit values | Automated ✓ (audit 86→0, `onboarding-localization.test.ts`); E2E written (`i18n-onboarding.spec.ts`, not run) |
| L10 | Onboarding i18n E2E harness | Flow A step-preserved (persist before switch), Flow B valid cookie URL, reset clears UserLocalePreference, DB-over-cookie precedence intact | Automated ✓ (`e2e-locale-harness.test.ts`, 6 tests); **Playwright NOT executed** — developer gate (see `Onboarding_I18n_E2E_Triage.md`) |

See `FarmOS_Multilingual_Report.md` (GO/NO-GO = NO-GO — foundation + slice).

## Sprint 27 final integration acceptance (still NO-GO)

- [ ] Desktop and 390x844/430x932: add, resize, move and reopen persisted rectangle/text annotations.
- [ ] Finalized photo correction shows Original, Corrected and Current effective with required reason.
- [ ] Offline annotation survives app termination, explicitly syncs once and preserves conflicts.
- [ ] Per-photo retry resumes the failed checkpoint without repeating the successful sibling.
- [ ] Real object provider contract, private-access policy, lifecycle cleanup and restore drill pass.
- [ ] Photo-AI consent/review and consultation WorkOrder pass without treatment recommendation.
- [ ] Real iPhone HEIC/JPEG/camera/touch/offline/retry/signed-read/PDF evidence recorded.
- [ ] Real Android camera/touch/offline/retry/sync/report evidence recorded.

Implemented foundations are not a pass for unchecked browser or physical-device evidence.

> Sprint 27 finalization automation is green (708 unit; focused 4/4; two clean full runs), but physical iPhone/Android camera, HEIC, app termination/restart, interrupted upload, exact-one reconnect, annotation touch and PDF viewing remain mandatory NO-GO items. No physical success is inferred from Playwright.

## Sprint 27 physical field scouting — NO-GO until completed

| # | Device action | Expected result | Status | Blocker |
|---|---|---|---|---|
| Q1 | iPhone + Android GPS near a field | Candidate fields and distance; farmer confirms | Unverified | P0 |
| Q2 | Capture/select multiple photos and annotate | Private original survives; annotation reopens separately | Unverified | P0 |
| Q3 | Record and correct growth stage | Current stage and auditable history are clear | Physical unverified | P1 |
| Q4 | Save visit/photo offline, restart app | Same user/farm can reopen all evidence | Not implemented/verified | P0 |
| Q5 | Reconnect and explicitly sync twice | Exact-one visit, observations, photos and WorkOrder | Not implemented/verified | P0 |
| Q6 | Switch user/farm | Prior drafts/photos are hidden and unsyncable | Scouting unverified | P0 |
| Q7 | Mobile Crop Health map at 390 px | Labels/list, no colour-only meaning or overflow | Physical unverified | P1 |
| Q8 | Repeat Sprint 26 microphone/live checks | No regression on both phone platforms | Unverified | P1 |

## Sprint 25 — economics mobile validation (physical devices required)

| Check | iPhone | Android | Status |
|---|---|---|---|
| Save and restore an expense offline draft | Not run | Not run | NO-GO |
| Save and exact-one sync a purchase offline draft | Not run | Not run | NO-GO |
| Enter harvest and revenue, reconnect, verify exact-one | Not run | Not run | NO-GO |
| Read Finance tables without page overflow | Not run | Not run | NO-GO |
| Download and open economics PDF | Not run | Not run | NO-GO |
| Open UTF-8 economics CSV in Dutch Excel | Not run | Not run | NO-GO |
| Confirm “local”, “queued”, and “synchronized” wording | Not run | Not run | NO-GO |

Automated browser checks cannot replace this physical-device checklist. Do not mark the economics pilot ready until both device columns pass.

## Sprint 25 - Field Detail economics + version history

| Check | Expected result | Evidence | Status |
|---|---|---|---|
| Open a field's economics detail | /fields/[id] shows summary, breakdown, direct/allocated, break-even, source records | Unit tests + page | PASS (code) |
| Missing values | "Not recorded" / "Partial" / "Unavailable", never fabricated 0 | Unit tests | PASS |
| Direct vs allocated | Farm-level unallocated never folded into field margin | Unit test | PASS |
| Break-even | Exact blocking reason shown; no low-confidence number | Unit tests 11-16 | PASS |
| Version history | Original/Corrected/Reversed/Reallocated + Current effective marked | Unit tests 17-24 | PASS |
| Cross-farm field/source/version/allocation | Rejected as not-found, no existence leak | Unit tests 31-34 | PASS |
| Offline field view | History visible; reallocate/correct/reverse/export disabled with reason | Unit tests 35-36 | PASS |
| Field-detail Playwright (A, B, G, H) | Written; run twice clean | e2e/sprint25-field-detail.spec.ts | WRITTEN - NOT EXECUTED |
| Physical iPhone/Android field detail | Cards stack, no hidden totals, drawers fit viewport | Manual | NOT RUN - PILOT NO-GO |

## Sprint 25 - Dashboard economics signals + reports

| Check | Expected result | Evidence | Status |
|---|---|---|---|
| Dashboard shows only actionable economic signals | Max 3 above the fold, ordered by priority | Unit tests 10-11 | PASS |
| Shared signal source | Dashboard + Farm Insights derive from one resolver | Unit test 13 | PASS |
| Incomplete fields not ranked | Strongest-margin / break-even exclude incomplete fields | Unit tests 7-8 | PASS |
| Missing data not zero | Null metric emits no fabricated signal | Unit test 14 | PASS |
| CTA routes | Every signal links to a real destination | Unit test 12 | PASS |
| Unallocated records report | New CSV excludes activity-derived direct costs | Unit test 24 | PASS |
| CSV headers stable + formula injection escaped | Stable header row; leading = neutralised | Unit tests 26-27 | PASS |
| Reversed excluded by default | includeHistory opt-in | Unit test 17 | PASS |
| Export provenance | Checksum + record count + app version in audit; x-export-checksum header | Route code | PASS (code) |
| Cross-farm export rejected | Foreign season -> 403 | Unit test 30-31 | PASS |
| PDF generates with disclaimer | Valid A4 %PDF document | Unit test 22/28 | PASS |
| Dashboard/report Playwright (A-I) | Written; run twice clean | e2e/sprint25-dashboard-reports.spec.ts | WRITTEN - NOT EXECUTED |
| Physical iPhone/Android dashboard + reports | Signals stack, filters usable, PDF/CSV download | Manual | NOT RUN - PILOT NO-GO |

## Sprint 25 Final Closure - browser E2E execution gate

Automated dedicated E2E (Sprint 23-25) were **NOT executed** this iteration.
Empirically-confirmed blocker: the Clerk backend is unreachable from this
environment (`api.clerk.com` / `clerk.com` time out), and `global.setup.ts`
signs in all four fixed-pool identities before any authenticated spec can run.
Postgres, Playwright browsers and `.env.e2e` (pk_test/sk_test keys) are all
present - the gate is external-network access to Clerk. See
`docs/Sprint_25_E2E_Inventory.md`.

| Gate | Requirement | Status |
|---|---|---|
| Dedicated Sprint 23 WorkOrder-lifecycle spec | Exists + passes | **PASS** (executed 2026-07-17; Flows A–K green) |
| Dedicated Sprint 24/25 economics specs | Written + pass | **PASS** (field-detail, dashboard/reports, reallocation all green) |
| Full run 1 (`npm run test:e2e`, CI `--retries=2`) | Clean | **PASS** — 92 passed / 1 flaky-recovered / 0 failed / 1 skip · exit 0 |
| Full run 2 (consecutive) | Clean, same count, no new Clerk users, no state leak | **PASS** — 93 passed / 0 flaky / 0 failed / 1 skip · exit 0; no new Clerk users |
| E2E failure triage | All failures classified + fixed | **PASS** — 17→0; 3 product defects fixed (`Sprint_25_E2E_Failure_Triage.md`) |
| Executable validation (prisma/tsc/vitest/build) | Pass | **PASS** (660/660, tsc clean, build compiled) |
| Retries note | Infra-flakiness only, no weakened assertions | `--retries=2` absorbs Clerk-CDN/Open-Meteo flakiness; every test passes in isolation |

## Sprint 25 Final Closure - physical mobile gate (manual, NOT RUN)

No physical device was available in this environment. **No iPhone/Android
success is claimed.** Record one row per check on a real device:

| Area | Check | Device | OS | Browser | Viewport | Pass/Fail | Screenshot | Issue | Severity |
|---|---|---|---|---|---|---|---|---|---|
| Operations | Field map loads | | | | | NOT RUN | | | |
| Operations | Field Detail opens | | | | | NOT RUN | | | |
| Operations | WorkOrder start | | | | | NOT RUN | | | |
| Operations | WorkOrder completion | | | | | NOT RUN | | | |
| Operations | Offline WorkOrder completion | | | | | NOT RUN | | | |
| Economics | Purchase / expense / harvest / revenue entry | | | | | NOT RUN | | | |
| Economics | Field Detail economics | | | | | NOT RUN | | | |
| Economics | Reallocation | | | | | NOT RUN | | | |
| Economics | Correction / reversal | | | | | NOT RUN | | | |
| Economics | Dashboard economics signals | | | | | NOT RUN | | | |
| Economics | PDF download | | | | | NOT RUN | | | |
| Economics | CSV download | | | | | NOT RUN | | | |
| Economics | Offline finance exact-one sync | | | | | NOT RUN | | | |

### Physical offline golden flow (Part 12) - NOT RUN

Run once on a real phone; every step must pass:

1. Load FarmOS online · 2. Open assigned WorkOrder · 3. Go offline ·
4. Complete activity · 5. Verify saved locally · 6. Close app ·
7. Reopen offline · 8. Verify queued item · 9. Restore connection ·
10. Synchronize · 11. Verify **exact-one** Activity · 12. Verify exact-one
stock effect · 13. Verify exact-one ComplianceRecord · 14. Verify the correlated
AuditEvent chain · 15. Restart app · 16. Confirm **no duplicate**. Also test one
offline expense/revenue draft to exact-one sync.

After executing a flow, `EXACT_ONE_VERIFY_FARM_ID=<farm> tsx
scripts/verify-exact-one.ts` reports the exact-one counts from the database
(read-only) to confirm steps 11-14/16 objectively.

## Sprint 24 — field economics

| Check | Expected result | Evidence | Status |
|---|---|---|---|
| Weighted-average purchase | Exact stock valuation | Unit tests | PASS |
| Later inventory price change | Historical activity cost remains frozen | Unit/integration tests | PASS |
| Missing finance data | “Not recorded”, never fabricated €0/margin | Unit + E2E regression | PASS |
| Revenue status | Only received enters recorded revenue | Unit tests | PASS |
| Two full browser runs | No SW/IndexedDB leak or new Clerk users | 62/62 twice | PASS |
| Physical iPhone/Android offline/reconnect | No lost/duplicate data; usable auth/UI | Manual | **NOT RUN — PILOT NO-GO** |

## Sprint 20 — Offline field reliability (manual, required)

- [ ] Disable Wi-Fi/mobile data during activity entry and confirm “Saved on this device.”
- [ ] Close the browser, reopen it, and confirm the draft remains.
- [ ] Reconnect and verify exactly one server activity.
- [ ] Verify inventory deduction manually and confirm it happened once.
- [ ] Verify the compliance record and correlated audit chain happened once.
- [ ] Sign out with an unsynchronized draft; sign in as another user and confirm it is hidden and cannot sync.
- [ ] Return to the original user and recover the draft.
- [ ] Simulate a weak/flapping connection and verify controlled backoff rather than repeated submissions.
- [ ] Confirm every message distinguishes device-local from FarmOS-synchronized data.
- [ ] Confirm stale cached weather shows its age and never claims current suitability.
- [ ] Create a server-side field/product/stock conflict and resolve it without data loss.
- [ ] Repeat the full flow on an actual 390×844-class phone with unstable connectivity.

Do not describe FarmOS as field-reliable offline until this real-device checklist passes.

Consolidates `Sprint_9_Manual_E2E_Checklist.md` and Sprint 12's additions into one checklist, organized by module. **Nothing in this document has been executed by a human.** Rows marked "Automated ✓" are covered by a passing Playwright test as of Sprint 12 (`npm run test:e2e`) — a human does not need to re-verify the underlying logic, only that it *feels* right in a real browser. Rows marked "Manual only" have no automated coverage and need a real person with a stopwatch and a real device.

**Do not mark a row Pass until a human has actually performed the action.** Fill in Pass/Fail and Notes columns yourself; leave them blank until then.

**Screenshot required?** — "Yes" means attach one when reporting a Fail (not needed for a Pass).

---

## A. Authentication

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| A1 | Open the app signed out at `/` | Redirects to `/sign-in`, no crash, no loop | Automated ✓ (`golden-path.spec.ts`) | | | No | P0 |
| A2 | Sign up with a new email via Clerk's hosted UI | Clerk's own sign-up flow completes, lands on `/dashboard` | Manual only (real Clerk sign-up UI, not `+clerk_test` ticket-based) | | | Yes | P0 |
| A3 | Sign in with an existing account | Lands on `/dashboard` with the correct farm's data | Automated ✓ | | | No | P0 |
| A4 | Directly navigate to a protected route while signed out | Redirects to `/sign-in`, preserves a return URL | Automated ✓ | | | No | P0 |
| A5 | Sign out via the topbar user menu | Redirected to `/`, then to `/sign-in` | Automated ✓ (via `clerk.signOut()`, not the real UserButton click) | | Verify the real UserButton menu click behaves the same | No | P1 |
| A6 | `/api/health` responds without requiring sign-in | Returns `200 {"status":"ok",...}` unauthenticated | Automated ✓ (fixed in Sprint 12 — was previously gated behind Clerk) | | | No | P0 |

## B. Onboarding

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| B1 | Complete Welcome → Farm → Season → Field → Crop, skipping Inventory/Employee | Reaches Review with correct summary, under 5 minutes felt time | Automated ✓ (reachability); timing is manual (`Sprint_12_Manual_Timing_Sheet.md`) | | | No | P0 |
| B2 | Refresh the browser mid-wizard | Resumes at the same step, not the beginning | Automated ✓ | | | No | P1 |
| B3 | Browser back/forward mid-wizard | Shows a real step, never a blank/broken page | Automated ✓ | | | No | P1 |
| B4 | Submit the farm step with required fields empty | Field-level validation error, no crash | Automated ✓ | | | No | P1 |
| B5 | Finish onboarding, then revisit `/onboarding?step=inventory` later to add a product | Adds the product without re-triggering the completion flow oddly | Automated ✓ (golden path) | | | No | P1 |
| B6 | Revisit `/onboarding?done=1` a second time (refresh or back button) | `onboarding_completed` event does not fire twice (Sprint 12 fix) | Automated ✓ (verified via server log, see `Sprint_12_Browser_E2E_Beta_Report.md` §7) | | Not independently visible in the UI — this is a backend-log check | No | P1 |

## C. Dashboard

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| C1 | View dashboard immediately after onboarding, before any activity | First-run summary (farm/field/weather cards, one dominant CTA) — no fake Finance/Compliance/AI widgets | Automated ✓ | | | No | P0 |
| C2 | Dominant CTA reflects priority (inventory → activity → 2nd field → weather) | Matches whichever tier applies | Automated ✓ | | | No | P1 |
| C3 | Record 5+ activities, revisit dashboard | Switches to the full grid (AI briefing, weather, tasks, inventory, fields, finance, compliance) | Not automated this sprint (would need 5 real activities recorded) | | | No | P2 |
| AI1 | Disable/unavailable provider, open Dashboard | Useful rule-based briefing remains; no blank card or invented fact | Core fallback unit-tested; Dashboard E2E pending | | | No | P1 |
| AI2 | Describe one spray in farmer language | Only reviewed suggestions appear; ambiguity and Ctgb/resource blockers remain authoritative | Core/parser tested; full E2E pending | | | No | P1 |
| AI3 | Enter description offline | Text persists locally; parsing disabled; no raw audio queued or retained | Implemented; physical-device validation pending | | | No | P1 |
| AI4 | Physical iPhone Safari/PWA finalization | Briefing/evidence/feedback, ambiguity, WorkOrder comparison/link, split, compliance correction, microphone/transcript/delete, offline restart/reconnect and exact-one sync; record model/iOS/mode/screenshots | Not run — physical iPhone pending | | | No | P1 |
| AI5 | Physical Android Chrome/PWA finalization | Same core flows, microphone permission/indicator, transcript review, offline persistence/reconnect, service-worker update and exact-one sync | Android physical validation pending | | | No | P1 |
| C4 | Dashboard usable state loads in under 2 seconds (warm, production build) | Feels responsive, not stuck on a spinner | Manual only (`Sprint_12_Manual_Timing_Sheet.md`) | | | No | P1 |

## D. Fields

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| D1 | View Fields with zero fields | Empty state: "Add your first field to begin planning crops and recording work." | Automated ✓ (isolation/failure-path specs incidentally exercise this) | | | No | P2 |
| D2 | Create a field | Appears immediately, correct hectares/soil type | Automated ✓ | | | No | P0 |
| D3 | Archive (delete) a field with no activities | Hard-deleted, disappears from the list and from any field picker | Automated ✓ | | | No | P1 |
| D4 | Attempt to update/access another farm's field by id | Server rejects; UI never shows it | Automated ✓ (`isolation.spec.ts`, plus unit tests in `fields.test.ts`) | | | No | P0 (security) |

## E. Inventory

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| E1 | View Inventory with zero products | Empty state: "No products yet" / "Add products to track stock, costs and activity usage." | Automated ✓ | | | No | P2 |
| E2 | Add a crop-protection product (herbicide/fungicide/insecticide), expand advanced fields | Shows registration number / active ingredient / FRAC / HRAC / PHI — not N/P/K | Not re-verified live this sprint (covered by Sprint 8/10 tests + code review) | | | No | P1 |
| E3 | Add a fertiliser product, expand advanced fields | Shows N/P/K% — not crop-protection fields | Not re-verified live this sprint | | | No | P1 |
| E4 | Attempt to use another farm's product id on an activity | Server rejects with "Product does not belong to this farm." | Automated ✓ | | | No | P0 (security) |

## F. Activities

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| F1 | Open "+ Record activity", see type picker first | 7 tiles, no universal long form | Automated ✓ | | | No | P0 |
| F2 | Record a spraying activity, including creating a sprayer inline for the first time | Succeeds; stock deducted; compliance record created | Automated ✓ (this sprint's biggest single fix — see report §8) | | | No | P0 |
| F3 | Record a fertilising activity | Succeeds without needing operator/machine/nozzle/water volume | Automated ✓ | | | No | P1 |
| F4 | Record a scouting activity | Only field/date/area/category required | Automated ✓ | | | No | P1 |
| F5 | Dose × area exceeds product stock | Inline "Not enough stock" warning before submit; Save disabled | Automated ✓ | | | No | P0 |
| F6 | Submit a spray with required fields missing | Field-level errors, no crash | Automated ✓ | | | No | P1 |
| F7 | "Repeat" a past activity | Pre-fills type/field/operator/machine/product only — date/dose/area/water volume/weather stay blank | Automated ✓ (unit-tested field-safety contract; live repeat-click not re-driven this sprint) | | | No | P1 |
| F8 | Attempt to submit another farm's machine/field id | Server rejects | Automated ✓ (this sprint's machine-ownership fix) | | | No | P0 (security) |
| F9 | Delete an activity | Diary record retained (compliance requirement), stock restored | Not automated this sprint | | | No | P1 |

## G. Quick Log

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| G1 | Open Quick Log from the dashboard | Same dialog as Activities, same `createActivity` action underneath | Automated ✓ | | | No | P0 |
| G2 | Quick Log trigger does not overlap other page controls | No page's own buttons are obscured | Automated ✓ (Sprint 12 fix — was overlapping Activities' own toolbar button) | | | No | P0 |
| G3 | Complete an activity via Quick Log, click "View activity history" | Navigates to `/activities` from any page, not just when already there | Automated ✓ (Sprint 12 fix) | | | No | P1 |
| G4 | Quick Log opens in under 500ms (production build) | Feels instant | Manual only | | | No | P2 |
| G5 | Mobile FAB opens Quick Log | Same dialog, reachable, ≥44px target | Automated ✓ | | | No | P0 |

## H. Weather

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| H1 | View Weather with no farm coordinates | Empty state: "No local weather yet" / "Add farm coordinates..." | Not re-driven live this sprint (code-reviewed) | | | No | P2 |
| H2 | Spray form with coordinates set | Weather auto-fills (temp/wind/humidity), link to check suitability | Automated ✓ (golden path) | | | No | P1 |
| H3 | Spray form with no coordinates / fetch failure | Explicit "Weather data is unavailable" message, can still continue | Not re-driven live this sprint (code-reviewed) | | | No | P1 |
| H4 | Stale weather data indicator | **Does not exist in the product** — real gap, not a test gap | N/A | | Documented as a beta blocker | No | P2 |

## I. Compliance

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| I1 | View Compliance with zero records | Empty state: "No compliance records yet" / "Records are created automatically..." | Automated ✓ (isolation spec incidentally) | | | No | P2 |
| I2 | Record a spray activity | Compliance record auto-created (confirmed via success panel text) | Automated ✓ | | | No | P0 |
| I3 | Record a non-spray activity | No compliance record created | Not re-driven live this sprint (unit-tested) | | | No | P1 |
| I4 | Attempt to view another farm's compliance records | Never shown | Automated ✓ (`isolation.spec.ts`) | | | No | P0 (security) |

## J. Security

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| J1 | User B submits Farm C's product/machine/fieldSeason id via a crafted request | Server rejects all three with a clear message | Automated ✓ | | | No | P0 |
| J2 | User B browses every module page | Farm C's data never appears anywhere | Automated ✓ | | | No | P0 |
| J3 | Source maps / stack traces exposed in production | Not exposed (verified: `.js.map` requests 404) | Automated ✓ (manual curl check, see report) | | | No | P0 |
| J4 | Dev-only fallback (`ALLOW_DEV_FARM_FALLBACK`, Load Demo Farm) active in production | Absent — both gated on `NODE_ENV === 'development'` | Automated ✓ (structural — verified via build output + code) | | | No | P0 |

## K. Mobile

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| K1 | Load dashboard at 390×844 and 430×932 | No horizontal scroll | Automated ✓ | | | No | P0 |
| K2 | Sidebar nav on mobile | Hidden by default behind a hamburger toggle (Sprint 12 fix — previously always-visible, ~55% of screen) | Automated ✓ | | | No | P0 |

## Sprint 27 — Field Scouting certification gate (2026-07-21)

Baseline: `docs/Sprint_27_Certification_Evidence.md`. Automated gate is
## Break-even localization browser gate — 2026-07-27

Focused gate: **PASS — 6/6, retries 0, 0 flaky, 1.1 min**. Missing-harvest
honesty PASS; visible raw-code check PASS; TypeScript/build PASS; unit 922/922;
targeted resolver debt 5 → 0. Global debt remains 505. Unrelated regression
failures are documented in `Break_Even_E2E_Failure_Triage.md`; this does not
clear the whole multilingual beta or physical-device gates.

**CONDITIONAL / NO-GO**; physical field pilot is **NO-GO**. Storage runbook:
`docs/SCOUTING_PHOTO_STORAGE_RUNBOOK.md`.

| # | Check | Requirement | Status |
|---|---|---|---|
| S1 | Storage preflight | `npm run test:storage:preflight` verifies config read-only, no secrets printed | **PASS (tool)** — FAIL/exit 1 here (no provider); PASS-path verified with simulated config |
| S2 | Storage contract vs real provider | `STORAGE_CONTRACT_TEST=true npm run test:storage:contract` → `status:passed` (synthetic only) | **NOT RUN** — direct `s3_compatible` adapter now implemented + provider-aware contract (16 unit tests); no real provider credentials configured, so no PASS claimed |
| S3 | Production storage rejections | local/in-memory/public/http/placeholder/excessive-lifetime/missing region+bucket rejected at startup | **PASS** — enforced + unit-tested (`final-closure.test.ts`) |
| S4 | Safe unavailable state | Provider outage degrades scouting safely; never crashes unrelated modules | **PASS** — `UnavailablePhotoStorage` + `classifyPhotoFailure` (unit-tested) |
| S5 | Focused scouting E2E | `sprint27-scouting.spec.ts --retries=0` PASS (editor, restart, per-item retry exact-one, cross-farm) | **PASS (2026-07-21)** — 6/0/0/0, exit 0, JSON `cert-focused.json` |
| S6 | Two consecutive full E2E passes | 0 failed / 0 flaky / only documented skip, server alive, no new Clerk users | **PASS (2026-07-21)** — 105/1/0/0 twice, exit 0 each, Playwright-owned server alive, no new users |
| S7 | Physical iPhone (Safari + PWA) | camera, touch editor, offline restart recovery, interrupted upload, per-item retry, exact-one, signed photo access, PDF | **NOT RUN** — runbook `Sprint_27_Field_Scouting_Report.md` Part 7 |
| S8 | Physical Android (Chrome + PWA) | equivalent to S7; independent of Chromium E2E | **NOT RUN** — runbook Part 8 |

Do not mark iPhone/Android passed without a real device and recorded evidence
(device model, OS version, Safari/PWA, screenshot/video, severity).
| K3 | Mobile FAB position | Reachable, ≥44px, doesn't cover content | Automated ✓ | | | No | P0 |
| K4 | Record an activity end-to-end on mobile | Dialog scrolls internally, Save button reachable | Automated ✓ | | | No | P0 |
| K5 | Numeric fields (dose, area) | Correct `inputmode="decimal"` for mobile keyboards | Automated ✓ | | | No | P2 |
| K6 | Long Dutch field/product names in tables | No broken layout/overflow | Not tested this sprint — real gap | | | No | P2 |

## L. Accessibility

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| L1 | axe-core scan of sign-in, dashboard, activities, inventory, weather, compliance, onboarding-inventory, Quick Log, activity form, success dialog | Zero critical/serious violations | Automated ✓ (14/14 passing) | | | No | P0 |
| L2 | Tab through the activity dialog | Focus stays within the dialog (Sprint 12 fix — previously no trap at all) | Automated ✓ | | | No | P0 |
| L3 | Press Escape with the activity dialog open | Closes the dialog (Sprint 12 fix — previously not wired) | Automated ✓ | | | No | P1 |
| L4 | Trigger a validation error | Announced to screen readers (`role="alert"`, Sprint 12 fix — was missing everywhere) | Automated ✓ (structural) — not tested with an actual screen reader | | | No | P1 |
| L5 | Text contrast throughout the app | Meets WCAG AA 4.5:1 (Sprint 12 fix — muted text token was 3.76:1) | Automated ✓ | | | No | P1 |
| L6 | Navigate the whole golden path using only a keyboard, no mouse | Fully possible, nothing unreachable | Not exercised this sprint | | | No | P1 |

## M. Sign-out and return

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| M1 | Sign out, sign back in as the same user | Same farm, same data, nothing lost | Automated ✓ | | | No | P0 |
| M2 | Sign out, sign up as a second, different user | Lands in `no_farm` state, sees none of the first user's data | Automated ✓ (via separate seeded users B/C, not a live fresh sign-up) | | | No | P0 |

## N. Failure recovery

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| N1 | Any server action failure | Safe, specific message — never a raw exception or Prisma error text | Automated ✓ (duplicate season conflict test; broader coverage via `user-error.test.ts`) | | | No | P0 |
| N2 | Duplicate/double-click form submission | No duplicate record created | Not explicitly re-tested this sprint (React 19's `useActionState` inherently disables the button while pending) | | | No | P1 |
| N3 | Session expires mid-session | Graceful redirect to sign-in, no silent failure | Not tested this sprint — real Clerk JWT expiry is impractical to force in an automated run | | | No | P1 |

## O. Sprint 16 — closing the half-built loops

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| O1 | Open a spray activity form with a real field/product/operator/machine selected | A real suitability review (score/status, blockers, warnings, confidence, disclaimer) appears before "Save activity", computed from the real spray-window engine, not the weather page's raw snapshot | Automated ✓ (`sprint16-close-the-loops.spec.ts`, golden flow 1) | | | No | P0 |
| O2 | Read the suitability review's blocker text | Understandable to a non-technical farmer — names the specific missing/failed condition ("No verified product registration selected...", "Operator certification not provided...") rather than a generic "error" | Automated ✓ (structural — asserts exact blocker text is shown); plain-language clarity itself needs a human read | | | No | P1 |
| O3 | Save an activity as "Save as planned" vs. "Save activity" | The distinction is visible and its consequence (no stock deduction / no compliance record until later marked complete) is understandable without reading code | Automated ✓ (unit-tested behavior in `activities.test.ts` / `complete-activity.test.ts`); the wording's real-world clarity needs a human read | | | No | P1 |
| O4 | Compare Finance page's recorded cost to a manual dose × area × price calculation | Numbers match exactly (no hidden rounding, no fabricated adjustment) | Automated ✓ (`finance-data.test.ts` asserts the exact arithmetic; `sprint16-close-the-loops.spec.ts` golden flow 2 verifies it end-to-end) | | | No | P0 |
| O5 | View Finance with an unpriced product used in an activity | A clear, specific warning names the product missing a price and states totals are undercounted | Automated ✓ (`finance-data.test.ts`, Finance page copy) | | | No | P1 |
| O6 | View Farm Insights on a farm with real overdue tasks / low stock / compliance gaps | Each insight is genuinely useful (real evidence, a real next action) and honestly attributed — not generic filler | Automated ✓ (structural — real data sources, real action links); usefulness itself needs a human farmer's judgment | | | No | P1 |
| O7 | Read any Farm Insights card's footer text | States "Rule-based insight (no AI/ML model involved)" — never called "AI" anywhere the insight itself is shown | Automated ✓ (`farm-insights.test.ts`, page copy, `sprint16-close-the-loops.spec.ts`) | | | No | P0 |
| O8 | Compare the dashboard's Finance Snapshot / Farm Insights cards against the dedicated `/finance` and `/ai` pages for the same farm | Numbers and insights agree — both read from the same `getFinanceData`/`getFarmInsights` resolvers, never a second independently-computed version | Automated ✓ (`dashboard-shared-resolvers.test.ts`) | | | No | P0 |

## P. Sprint 19 — audit trail, corrections, and export

| # | Action | Expected result | Automated? | Pass/Fail | Notes | Screenshot? | Blocker severity if failed |
|---|---|---|---|---|---|---|---|
| P1 | Correct a completed spray's treated area | Original record remains visible and unchanged in "View" history | Automated ✓ (`sprint19-compliance-corrections.spec.ts` Flow A) | | | No | P0 |
| P2 | Same correction | The corrected record is clearly labeled "Current effective record"; the original is labeled "Original" | Automated ✓ (Flow A) | | | No | P0 |
| P3 | Same correction | Correction reason is visible in the record's detail/history view | Automated ✓ (Flow A) | | | No | P1 |
| P4 | Compare the correction's stock-difference preview to a manual dose × area calculation | Numbers match exactly | Automated ✓ (unit-tested in `compliance-corrections.test.ts`; structurally exercised live in Flow A) | | | No | P0 |
| P5 | Reverse a completed spray | Stock is restored to its pre-application level; understandable without reading code | Automated ✓ (Flow B) | | | No | P0 |
| P6 | View Compliance after a reversal, default filters | The reversed record does not count as an active application (excluded from the default list/totals) | Automated ✓ (Flow B) | | | No | P0 |
| P7 | Enable "Include reversed" on the Compliance page | The reversed record becomes visible, clearly marked | Automated ✓ (Flow B) | | | No | P1 |
| P8 | Export a season's records as PDF, open the file | Readable on A4, no clipped columns, page numbers present | Automated ✓ (`sprint19-compliance-corrections.spec.ts` Flow C — download succeeds; visual A4 layout review is manual) | | Human should open the actual PDF once and confirm it reads well | Yes (if it doesn't) | P1 |
| P9 | Read the PDF's field labels and disclaimer as a Dutch farmer would | Terminology is understandable, no jargon, no claim of legal certification anywhere | Manual only | | | No | P1 |
| P10 | Open an exported CSV in Excel (Dutch locale) | Diacritics (ë, ï) render correctly; decimals are unambiguous (`.` not `,`) | Automated ✓ (structural — BOM + decimal-format tests in `csv.test.ts`); a real Excel open is manual | | | No | P1 |
| P11 | Compare exported PDF/CSV values against the same record shown in the Compliance page UI | Values match exactly — both read from the same `getEffectiveComplianceRecords` resolver | Automated ✓ (`compliance-data.test.ts`, shared-resolver pattern) | | | No | P0 |
| P12 | Export with "include incomplete records" on | Incomplete records appear, clearly marked, not silently dropped | Automated ✓ (`pdf.test.ts`/`csv.test.ts`) | | | No | P1 |
| P13 | Export a record whose product is Ctgb-unavailable/manual | The manual/unverified or unavailable status is preserved and visible in the export, not upgraded to "complete" | Automated ✓ (`compliance-completeness.test.ts`) | | | No | P0 |
| P14 | Submit another farm's field/product/correction-target id via a crafted request | Server rejects or returns zero matching records — never another farm's data | Automated ✓ (`sprint19-compliance-corrections.spec.ts` Flow E) | | | No | P0 (security) |
| P15 | Read the audit history panel for a corrected record | Understandable to a non-technical farmer — who, when, why, in plain language, not raw JSON | Automated ✓ (structural — real fields rendered); plain-language clarity itself needs a human read | | | No | P1 |
| P16 | Attempt to correct or reverse a record with a stale/reloaded screen after someone else already changed it | Clear message: "This record was changed by another action. Reload and review the latest version." | Automated ✓ (`compliance-corrections.test.ts`) | | | No | P1 |
# Budget Variance localization gate (2026-07-31)

- [x] Stable status/reason/action codes and integer-cents metadata.
- [x] Four-locale adapter and missing-versus-zero honesty.
- [x] Field Detail/Finance canonical consistency.
- [x] Dashboard/Farm Insights priority and route preserved.
- [x] Dedicated and focused Playwright gates pass without retries.
- [x] Full E2E passes with only the documented conditional skip.
- [ ] Global resolver localization (473 unrelated findings remain).
# Localization Stage 6 evidence (2026-07-31)

| Gate | Result |
|---|---|
| Targeted audit | PASS — 13 → 0 |
| Unit / type / build | PASS — 944/944 / PASS / PASS |
| Category / regression E2E | PASS — 4/4 and 38/38 |
| Final full E2E | PASS — 165 collected, 164 passed, 1 conditional skip, 0 failed/flaky |
| Clerk / storage isolation | PASS — 5 total / 4 fixed before and after, 0 new; no IDB/SW leak |
# Stage 7 — Gross Margin resolver localization

| Gate | Result |
|---|---|
| Canonical contract and four locales | PASS |
| Unit / focused / regression | 950/950; 6/6; 41/41 PASS |
| Full E2E | 170 collected / 169 pass / 1 documented skip / 0 fail/flaky |
| Clerk | 5 total / 4 fixed before and after; 0 created |
| Physical device | Separate pilot gate; not claimed by this stage |

# Stage 8 — Economic Signals resolver localization

| Gate | Result |
|---|---|
| Canonical 12-code contract and four locales | PASS |
| Targeted/global resolver audit | 20 → 0 / 457 → 437; global remains NO-GO |
| Prisma / type / unit / build | 22 current / PASS / 950 of 950 / PASS |
| Focused / regression / full E2E | 6/6; 46/46; 175 collected, 174 pass, 1 conditional skip, 0 fail/flaky |
| Clerk / browser isolation | 5 total / 4 fixed before and after; 0 created; no SW/IDB leak reported |
| Physical device | Separate pilot gate; not claimed by Stage 8 |

# Stage 9 — Weather Risk resolver localization

| Gate | Result |
|---|---|
| Canonical contract / four locales / diagnostic boundary | PASS |
| Threshold characterization / targeted audit | 15/15 PASS; 6 → 0 |
| Prisma / type / unit / build | 22 current / PASS / 975 of 975 / PASS |
| Focused regression / full E2E | 40/40; 175 collected, 174 pass, 1 documented skip, 0 fail/flaky |
| Clerk / browser isolation | 5 total / 4 fixed before and after; 0 created; no SW/IDB failure |
| Weather Risk production UI and physical-device flow | NOT IMPLEMENTED / NO-GO; resolver has no production caller |
| Global resolver localization | NO-GO; 431 findings remain |
# Stage 14 U2 localization gate (2026-08-01)

- [x] Inventory/Machines targeted user errors 4 → 0 and resolver overlap 6 → 0.
- [x] Unit 1011/1011, focused 7/7, regression 36/36, full E2E 190 collected / 189 passed / 1 conditional skip / 0 failed.
- [x] Clerk fixed pool unchanged at 5 total / 4 fixed-pool; no IndexedDB or Service Worker leakage observed.
- [ ] Application-wide user-error localization (131 findings remain) and physical-device review.
