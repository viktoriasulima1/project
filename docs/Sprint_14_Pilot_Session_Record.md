# Sprint 14 — Pilot Session Record

**This is a live-fill document, used during a real farmer session.** It is empty as of this writing — no real session has occurred. Format extends `PILOT_OBSERVATION_SHEET.md` and `FIRST_PILOT_SESSION_SCRIPT.md` (Sprint 13) with Sprint 14's more specific 20-task acceptance list and interview scripts. Fill in every section live, in ink or on a second screen — do not reconstruct from memory afterward.

**Why this is a document, not a new in-app feature:** the brief calls this a "pilot session mode." Building a dedicated in-app recording UI for a single-use, one-farmer session would itself be exactly the kind of speculative feature this project has repeatedly been told to avoid building ahead of real evidence. This document *is* the session mode — a structured, repeatable protocol the founder runs by hand, sitting next to the farmer, not a product feature to maintain afterward.

## What this document must never contain

Do not record, under any circumstances:
- Clerk session tokens or any authentication secret
- Certificate numbers (spray licence numbers etc.) — reference "certificate field was/wasn't filled," never the actual number
- Passwords (there shouldn't be any to record — this app uses ticket/email-based auth, but if the farmer ever types one anywhere, it is never written down here)
- Confidential farm financial values (input costs, revenue, margins) **unless the farmer explicitly agrees** to share them for this record — ask first, every time, don't assume yesterday's consent covers today
- Raw personal data beyond what's needed to run the session (no ID numbers, home address, etc.)

If in doubt, leave it out and describe the situation generically instead (e.g., "farmer entered a certificate number, format looked correct" — not the number itself).

## Consent

- [ ] Farmer has read and verbally agreed to `FIRST_PILOT_USER_PROFILE.md`'s consent language.
- [ ] Screen recording: consented? Y / N — if N, do not record, take written notes only.
- [ ] Audio recording: consented? Y / N — if N, do not record.
- [ ] Farmer understands this is beta software and has their own real record-keeping in parallel (not relying on FarmOS alone).

## Session metadata

- Date:
- Start time:
- End time:
- Duration:
- Observer (founder) name:
- Location (in person / remote):
- Device(s) used:

---

## Part 2 — Acceptance tasks

For each task, record: **completion** (without help / with hint / failed), **duration**, **misunderstanding** (if any), **trust concern** (if any), **exact user wording** (quote directly, don't paraphrase), and **severity** (P0–P4, see scale below).

| # | Task | Completion | Duration | Misunderstanding | Trust concern | Exact user wording | Severity |
|---|---|---|---|---|---|---|---|
| 1 | Create an account | | | | | | |
| 2 | Create a farm | | | | | | |
| 3 | Create active season | | | | | | |
| 4 | Add three real or realistic fields | | | | | | |
| 5 | Assign crops to all three fields | | | | | | |
| 6 | Add crop-protection product | | | | | | |
| 7 | Add fertiliser | | | | | | |
| 8 | Add spray operator | | | | | | |
| 9 | Add sprayer machine | | | | | | |
| 10 | Record spraying activity | | | | | | |
| 11 | Record fertilising activity | | | | | | |
| 12 | Record scouting activity (mobile width) | | | | | | |
| 13 | Find updated inventory stock | | | | | | |
| 14 | Find created compliance record | | | | | | |
| 15 | Explain the spray suitability result, own words | | | | | | |
| 16 | Find the next recommended action | | | | | | |
| 17 | Sign out | | | | | | |
| 18 | Sign in again | | | | | | |
| 19 | Confirm all data remains | | | | | | |
| 20 | Explain whether FarmOS saves time vs. current process | | | | | | |

**Severity scale** (Part 7 of the brief): P0 = safety/security/data-loss/cross-farm exposure/misleading legal-or-agronomic statement/wrong inventory-or-dose math. P1 = blocks a core workflow. P2 = major friction, repeated confusion, excess time, trust-harming wording. P3 = minor/isolated preference. P4 = feature request without a validated problem.

For each finding, also classify **what kind of problem it actually is** (Part 3) — don't default to "bug":
- Usability failure (the feature works, the design didn't communicate it)
- Missing domain knowledge (farmer didn't know a term/concept — not FarmOS's fault, but note if FarmOS could have taught it in-context)
- Product bug (it's actually broken)
- Unclear language (the words used were the problem, not the logic)
- Incorrect business logic (the calculation or rule itself is wrong)
- Personal preference (this farmer's taste, not necessarily generalizable)
- Training need (would be fine with a 30-second explanation, not a product change)

---

## Part 3 — Founder behaviour checklist (self-check for the observer, during the session)

- [ ] Did not explain the UI in advance of each task.
- [ ] Did not click anything for the farmer.
- [ ] Waited at least 10 seconds of visible struggle before offering any help.
- [ ] Asked "What are you expecting to happen?" at each pause, before explaining.
- [ ] Did not defend the product when the farmer criticized something.
- [ ] Did not suggest a solution before fully understanding the problem.
- [ ] Recorded exact pause locations (which screen, which field) as they happened, not reconstructed after.

---

## Part 4 — Trust interview (record answers verbatim where possible)

1. Which result did you trust immediately?
2. Which result did you not trust?
3. Would you rely on the inventory deduction?
4. Would you rely on the compliance record?
5. Does the spray suitability wording feel too certain?
6. Which value would you verify elsewhere?
7. Which field is missing from the spray record?
8. Which value should never be prefilled?
9. Would you use Quick Log from the tractor?
10. What would stop you from using FarmOS next week?

| # | Verbatim answer |
|---|---|
| 1 | |
| 2 | |
| 3 | |
| 4 | |
| 5 | |
| 6 | |
| 7 | |
| 8 | |
| 9 | |
| 10 | |

---

## Part 5 — Value interview (record answers verbatim where possible)

1. What do you currently use instead?
2. How long does recording one activity take today?
3. What is the most annoying administrative task?
4. Which FarmOS screen was most useful?
5. Which screen was unnecessary?
6. What would make you return tomorrow?
7. Would you use it weekly?
8. Would you import your real farm data?
9. Would you pay €10, €20, €30 or €50 per month?
10. What must work before you would pay?

| # | Verbatim answer |
|---|---|
| 1 | |
| 2 | |
| 3 | |
| 4 | |
| 5 | |
| 6 | |
| 7 | |
| 8 | |
| 9 | |
| 10 | |

**Note on willingness-to-pay (#9):** record the answer as qualitative evidence of perceived value, never as proven revenue or a commitment. One farmer's number is a data point, not a pricing model.

---

## Part 6 — Data accuracy check

Compare FarmOS's output against the farmer's own calculation or existing records. For each row, record FarmOS's value, the expected (farmer's own) value, the difference, the likely root cause, severity, and whether a fix is required before running another pilot.

| Field validated | FarmOS value | Expected value | Difference | Root cause | Severity | Fix required before next pilot? |
|---|---|---|---|---|---|---|
| Field hectares | | | | | | |
| Product quantity used | | | | | | |
| Stock before | | | | | | |
| Stock after | | | | | | |
| Treated area | | | | | | |
| Dose | | | | | | |
| Water volume | | | | | | |
| Operator | | | | | | |
| Machine | | | | | | |
| Date/time | | | | | | |
| Compliance record | | | | | | |
| Weather timestamp | | | | | | |
| Timezone | | | | | | |
| Spray suitability explanation | | | | | | |

---

## Screenshot references

List screenshot filenames/paths taken during the session here (store alongside this document, e.g. `docs/pilot-session-screenshots/`), rather than embedding images directly:

| # | Task # referenced | Screenshot filename | Notes |
|---|---|---|---|
| | | | |

---

## Observer's post-session summary (write immediately after, not days later)

**Overall impression:**

**Single biggest blocker observed:**

**Single biggest positive moment observed:**

**Would this farmer's data support a GO decision for five-farm beta, on its own?**
