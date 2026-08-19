# Sprint 13 — First Farmer Pilot Report

**Status: PREPARATION COMPLETE. No real pilot session has occurred.** Everything in this report describes readiness to run the pilot, evidence from an automated founder walkthrough, and process documents built for a human to execute — not a completed pilot. Do not read any section below as claiming a real Dutch farmer has used FarmOS. The "after the real session" fields throughout are explicitly marked not yet available.

**Sprint 14 update:** still no real farmer session as of Sprint 14. Sprint 14 added a more detailed live-fill session capture instrument (`docs/Sprint_14_Pilot_Session_Record.md`, superseding the general-purpose observation sheet for actual session use) and re-ran full regression validation (174/174 unit tests, 39/39 E2E tests, clean build) — nothing else in this report changes. See `docs/Sprint_14_Real_Farmer_Results.md` for the current, still-empty results shell and the restated NO-GO decision.

---

## 1. Pilot preparation status — complete

All 12 process/infrastructure documents required by the Sprint 13 brief exist and are ready to use:

| Document | Status |
|---|---|
| `docs/FOUNDER_PRE_BETA_WALKTHROUGH.md` | Complete — 21/21 items evidenced, 2 real bugs found and fixed |
| `docs/PILOT_ENVIRONMENT_RUNBOOK.md` | Complete — isolated `farmos_pilot` database created and migrated |
| `docs/FIRST_PILOT_USER_PROFILE.md` | Complete |
| `docs/FIRST_PILOT_SESSION_SCRIPT.md` | Complete — agenda, 10 tasks, trust/safety questions |
| `docs/PILOT_OBSERVATION_SHEET.md` | Complete — ready to fill in live |
| `docs/PILOT_DATA_DISCREPANCIES.md` | Template ready, empty (no real data to compare yet) |
| `docs/PILOT_FEEDBACK_BACKLOG.md` | Template ready, empty |
| `docs/PILOT_SUPPORT_RUNBOOK.md` | Complete |
| `docs/SPRINT_13_POST_PILOT_DECISIONS.md` | Template ready, empty |

## 2. Founder walkthrough status — complete (automated), human pass still required

`e2e/founder-walkthrough.spec.ts` executed all 21 items from `FOUNDER_PRE_BETA_WALKTHROUGH.md`, in a real browser, against both a dev server and a real production build, run twice for stability. **19 of 21 items pass as automated evidence; item 2 (real Clerk sign-up UI) and the general "does this feel right" judgment structurally require a human** — flagged explicitly in the walkthrough doc, not silently claimed as covered.

**Two real P0 bugs were found and fixed during this pass:**
1. No UI path existed to assign a crop to any field beyond a farm's first one — would have blocked every multi-field farm (the entire target market) from using most of their land in FarmOS. Fixed with a new `UnassignedFieldsBanner` component.
2. The Compliance page unconditionally showed "No compliance records yet" regardless of how many actually existed — a founder or farmer checking it after a spray would have seen nothing, ever. Fixed with a real (if minimal) query and list view.

Both fixes are confirmed by re-running the automated walkthrough to a clean pass, and by the full regression suite (below).

## 3. Environment status — ready

- `farmos_pilot` database created, migrated (4/4 migrations applied), fully isolated from `farmos` (dev) and `farmos_e2e` (test).
- `.env.pilot.example` documents every required variable; dev-fallback flags deliberately absent.
- `/api/health` now returns a `pilotVersion` field (Sprint 13 addition) for tying any bug report to an exact build.
- **Genuine gap, not hidden:** no hosting platform has been chosen yet, so automated daily backups and structured log shipping are not yet real — `PILOT_ENVIRONMENT_RUNBOOK.md` documents manual `pg_dump`/`pg_restore` as the current, honest fallback until a hosting decision is made.

## 4. Open blockers before a real farmer session

1. **No hosting/deployment target chosen** — the pilot environment exists locally; it needs to run somewhere the farmer can actually reach it.
2. **A human founder has not yet personally walked through the app** — the automated evidence in §2 is real but is not a substitute for this; budget 20–30 minutes before recruiting begins.
3. **No pilot farmer has been recruited yet** — `FIRST_PILOT_USER_PROFILE.md`'s recruitment message has not been sent to anyone.
4. **Daily automated backup is not yet implemented** — manual backup procedure exists and is documented; automation depends on the hosting decision above.

## 5. Validation results (Part 14, run this session)

| Command | Result |
|---|---|
| `npx prisma generate` | Succeeded |
| `npx prisma migrate status` | Up to date, 4/4 migrations, dev database |
| `npx tsc --noEmit` | Clean |
| `npx vitest run` | 174/174 passing |
| `npm run build` | Succeeded |
| `npm run test:e2e` | 39/39 passing (dev target) |
| `npm run test:e2e` against `npm run start` | 39/39 passing (production target, run separately) |

---

## Sections below: to be completed after the real pilot session

**Do not fill these in until a real farmer has actually used FarmOS.** Placeholders only.

### 6. Participant profile
*(Not yet available.)*

### 7. Observed results
*(Not yet available — see `PILOT_OBSERVATION_SHEET.md` once filled in.)*

### 8. Timing metrics
*(Not yet available.)*

### 9. Bugs found during the real session
*(Not yet available — see `PILOT_FEEDBACK_BACKLOG.md` once populated.)*

### 10. Trust feedback
*(Not yet available.)*

### 11. Data discrepancies
*(Not yet available — see `PILOT_DATA_DISCREPANCIES.md` once populated.)*

### 12. Willingness to continue / willingness to pay
*(Not yet available.)*

### 13. P0/P1 fixes required
*(Not yet available.)*

### 14. GO/NO-GO for five more farms

**NO-GO**, for exactly one reason: **no real farmer has used FarmOS yet.** Every GO condition in the brief (`founder walkthrough passed`, `one farmer completed core flow`, `no unresolved P0`, `data calculations matched reality`, `farmer expressed clear recurring value`, `pilot backup and recovery verified`) requires evidence from an actual pilot session that has not happened. This is not a product-quality verdict — the automated evidence in §2 and the full Sprint 12 regression suite are both strong — it is a simple factual gate: five-farm expansion requires proof from one real farm first, and that proof doesn't exist yet.

**What would need to be true to flip this to GO:** a real farmer completes `FIRST_PILOT_SESSION_SCRIPT.md`, `PILOT_OBSERVATION_SHEET.md`'s go-thresholds all check out, `PILOT_DATA_DISCREPANCIES.md` shows no P0/P1 miscalculation, and a hosting/backup story exists beyond "local machine, manual pg_dump."

### 15. Updated beta readiness score

**9/10, unchanged from Sprint 12.** Two real, meaningful bugs were found and fixed this sprint (unassigned-fields crop gap, silent compliance page) — both would have been directly hit by a real multi-field farmer within their first ten minutes, so fixing them before recruiting anyone is exactly what this gate was for. The score doesn't move because nothing about *real-world validation* has changed yet — that's precisely what Part 14/6–13 above are waiting on. A higher score requires a real pilot's evidence, not more automation.
