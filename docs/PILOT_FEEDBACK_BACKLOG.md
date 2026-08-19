# Pilot Feedback Backlog

**Empty until a real pilot session happens.** This document defines the scoring model and process; the backlog table fills in with real entries afterward. Do not build every requested feature — every entry below must separate what was *observed* from what to *do about it*, and the "founder decision" column is deliberately not auto-filled by severity or frequency alone.

**Status check, Sprint 14:** still empty — no real farmer session has occurred as of Sprint 14. Nothing added here since no evidence exists to add.

## Scoring model

**Severity**
- **P0** — unsafe, data loss, security issue, or legal/safety misinformation (e.g., wording that implies a certification FarmOS doesn't provide).
- **P1** — blocks a core workflow (onboarding, recording an activity, seeing stock/compliance results).
- **P2** — major friction (works, but slow, confusing, or requires a workaround).
- **P3** — usability improvement (would be nicer, doesn't block anything).
- **P4** — idea or feature request, not a problem with what exists today.

**Evidence**
- **Observed directly** — the observer watched it happen.
- **User stated** — the farmer said it, but the observer didn't independently see it occur.
- **Inferred** — the observer's interpretation of behavior, not a direct statement.
- **One-off preference** — a personal taste comment, not necessarily representative.

**Frequency**
- **Once** — happened a single time in the session.
- **Repeated** — happened more than once within the same session.
- **Every attempt** — happened every time that action was tried.

**Impact**
- **Time** — costs the farmer time.
- **Money** — affects stock/cost accuracy or a paid decision.
- **Trust** — makes the farmer doubt the app's correctness.
- **Compliance** — affects the spray-diary/compliance record's usefulness.
- **Retention** — affects whether they'd keep using it at all.

## Process

1. Every observation from `PILOT_OBSERVATION_SHEET.md` and every discrepancy from `PILOT_DATA_DISCREPANCIES.md` gets an entry here, scored on all four axes above.
2. **Problem evidence** and **proposed solution** are recorded separately — a farmer saying "I wish X" is evidence of a problem; it is not automatically the right solution.
3. **Founder decision** is a separate, explicit call: fix now, defer, or reject — with a one-line reason. Severity and frequency inform this decision; they don't replace it.
4. Per the Sprint 13 brief: fix every P0, fix every P1, review P2s that repeated across multiple observations (not just this one farmer, once more pilots exist), defer isolated P3/P4 preferences, and do not add large new modules on the strength of a single pilot's feedback.

## Backlog

| # | Problem evidence | Severity | Evidence type | Frequency | Impact | Proposed solution | Founder decision |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

(Add rows after the real pilot session. Nothing is filled in yet.)
