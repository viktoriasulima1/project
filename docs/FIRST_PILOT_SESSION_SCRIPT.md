# First Pilot Session Script

For the observer running the session. Total time: 45–60 minutes. Bring `PILOT_OBSERVATION_SHEET.md` (printed or on a second screen) to record as you go — do not rely on memory afterward.

**Golden rule for the observer: do not help too early.** If the farmer pauses, let them pause. Count to at least 10 silently before offering anything. If they ask a direct question, you may answer it, but note that a hint was given (see the observation sheet's hint count). The value of this session is watching what's confusing *without* your help, not proving the app can be operated with a guide standing over their shoulder.

---

## 0–5 min: Introduction

Say, in your own words, covering all of:
- What FarmOS is and why you're testing it with them specifically.
- **This is a pilot** — the software is beta, not finished. Bugs are expected and useful, not embarrassing.
- **Safety limits**: nothing they do here should be treated as their real legal spray diary or their real compliance record for this session — this is a test environment (or clearly marked test data in the pilot environment). Weather and compliance data are informational, not certified.
- Ask permission to record the screen (if applicable) and to take notes throughout.
- Remind them: "There are no wrong answers or wrong clicks — if something is confusing, that's exactly what we need to know."

## 5–15 min: Sign up, create farm, season, fields

Let them sign up themselves if this is their actual first time (real Clerk sign-up, real email). Then:

**Task 1 — Create the farm and active season.**
- Expected path: onboarding wizard, Welcome → Farm details → Active season.
- Success criteria: farm and season created without the observer typing anything.
- Target time: under 3 minutes.
- Max acceptable hints: 1.
- Blocker severity if they cannot complete this at all: **P0**.

**Task 2 — Add three real fields and their crops.**
- Expected path: one field via onboarding, the rest via the Fields page + the Activities page's "add to season" prompt (per-field crop assignment).
- Success criteria: three fields exist, each with a crop assigned for the active season.
- Target time: under 5 minutes for all three.
- Max acceptable hints: 2.
- Blocker severity: **P1** if the flow works but is confusing; **P0** if a field genuinely cannot get a crop assigned.

## 15–25 min: Products, operator, machine

**Task 3 — Add one crop-protection product and one fertiliser.**
- Expected path: onboarding's inventory step (if still mid-onboarding) or `/onboarding?step=inventory` afterward, once per category.
- Success criteria: both products exist with correct category-specific fields (registration number etc. for crop protection; N/P/K for fertiliser).
- Target time: under 2 minutes total.
- Max acceptable hints: 1.
- Blocker severity: **P1**.

Also have them add an operator (name, spuitlicentie checkbox) and, when they get to their first spray, a machine (via the inline "+ Add a new sprayer" control in the spray form itself — do not pre-empt this by explaining it exists; watch whether they find it themselves).

## 25–40 min: Record activities

**Task 4 — Record a spraying activity.**
- Expected path: "+ Record activity" or Quick Log → Spraying tile → fill required fields → save.
- Success criteria: activity saved, stock deducted, compliance record created (confirmed via the success screen).
- Target time: under 90 seconds after they already know the flow (their *second* spray, not their very first — see `PILOT_OBSERVATION_SHEET.md` for first-vs-repeat timing).
- Max acceptable hints: 1.
- Blocker severity: **P0** if it fails to save or silently loses data; **P1** if merely slow/confusing.

**Task 5 — Record a fertilising activity.**
- Same structure, Fertilising tile.
- Target time: under 60 seconds.
- Max hints: 1.
- Severity: **P1**.

**Task 6 — Record a scouting observation, at mobile width.**
- Ask them to do this one on their own phone if possible (or resize the browser window to simulate it).
- Target time: under 30 seconds.
- Max hints: 1.
- Severity: **P1** — this is the flow Quick Log is meant to make trivial in the field; if it isn't, that's central to this whole pilot's purpose.

**Task 7 — Find remaining stock of the product they just sprayed.**
- Expected path: open a new activity form and check the product dropdown's stock hint, or Inventory page.
- Success criteria: they find a number and it matches what you calculate independently (dose × area subtracted from starting stock).
- Target time: under 30 seconds.
- Max hints: 1.
- Severity: **P1**.

**Task 8 — Find the compliance record for the spray they just did.**
- Expected path: Compliance page.
- Success criteria: they find it and it shows the right field/product/date.
- Target time: under 30 seconds.
- Max hints: 1.
- Severity: **P0** if it's not there at all (data-integrity concern); **P1** if merely hard to find.

**Task 9 — Explain what the spray suitability / weather information means, in their own words.**
- Do not explain it to them first. Ask: "What do you think this is telling you?"
- Success criteria: their explanation roughly matches reality (current conditions, informational, not a go/no-go certification).
- Severity: **P0** if they believe it's a legal certification or safety guarantee — that's a trust/safety failure, see Part 7 below.

**Task 10 — Find what FarmOS recommends doing next.**
- Expected path: dashboard's primary CTA or AI briefing (once the farm has enough activity for the full dashboard).
- Success criteria: they find *something* framed as a next step and can say what it is.
- Severity: **P2** if unclear, **P3** if merely unpolished.

## 40–50 min: Review dashboard, inventory, compliance

Let them browse freely for a few minutes with only "look around, tell me what you notice" as guidance. Record which screens they linger on, which they skip past without comment, and anything they click that does nothing useful.

## 50–60 min: Feedback interview

Ask these exactly, in order, and let silence sit before moving on:

### Trust and safety (Part 7)

1. Would you trust the weather recommendation shown here?
2. Is there any wording on this screen that feels too certain — like it's telling you something is safe when you're not sure it should?
3. Do the hard blockers (things the app won't let you save) make sense to you, or did any feel arbitrary?
4. Did you notice the disclaimer about what FarmOS does and doesn't guarantee? Was it visible enough?
5. Would you rely on the compliance record FarmOS created today as your actual spray diary?
6. Looking at the spray form, is there any field you wish was there but wasn't?
7. Is there any field here that you'd be uncomfortable seeing pre-filled automatically, even if it saved you time?
8. Would you check the product label yourself separately, even with FarmOS showing you the registration number?
9. Does the stock number FarmOS calculated match what you'd expect from your own stock?

### General (from `BETA_FEEDBACK_FORM.md`, asked live here as well as left for them to fill in later)

10. What confused you today?
11. What took longer than it should have?
12. What did you expect to find but couldn't?
13. Which screen felt most useful?
14. Which screen felt unnecessary?
15. Would you use Quick Log in the field, on your phone, doing actual work?
16. Would you pay for this today, as it is right now?
17. What's the one thing that would have to be fixed before you'd use this every week?

**Any answer suggesting FarmOS's wording implied a safety or legal certification it doesn't actually provide is P0** — flag it immediately in `PILOT_DATA_DISCREPANCIES.md` and `PILOT_FEEDBACK_BACKLOG.md`, don't wait for the write-up.

Close by thanking them and confirming the 7–14 day follow-up window and how to reach support (`PILOT_SUPPORT_RUNBOOK.md`).
