# Sprint 17 — Feature Freeze

In effect for the duration of Sprint 17 (real farmer pilot execution). Supersedes nothing already agreed in `FarmOS_Complexity_Kill_List.md` / `FarmOS_Next_30_Product_Decisions.md` — it narrows further, specifically for this sprint's window.

## Purpose

Sprint 17 exists to get one real farmer's evidence, not to keep building. Every prior sprint's own audits (`FarmOS_Next_30_Product_Decisions.md`, `Sprint_13_First_Farmer_Pilot_Report.md`, `Sprint_14_Real_Farmer_Results.md`) have independently reached the same conclusion: the blocking gap is the absence of real usage evidence, not a missing feature. This freeze protects that conclusion from being quietly undone by "just one more improvement" before the evidence exists.

## Allowed during this sprint

- P0 safety fixes
- P0 security fixes
- P0 data-integrity fixes
- P1 blockers in onboarding, inventory, activity, finance, compliance, weather, or insights
- Repeated P2 usability problems, but **only** once confirmed by actual pilot observation — not anticipated in advance

## Not allowed during this sprint

- Voice recognition
- Satellite imagery
- A new AI chatbot
- Livestock
- Machinery telemetry
- Marketplace
- BRP integration
- CTGB integration
- Advanced accounting
- Any other speculative feature request
- Redesign of any screen without pilot evidence naming the specific problem

This list matches `FarmOS_Complexity_Kill_List.md`'s own "do not build" list and `FarmOS_Next_30_Product_Decisions.md`'s Section D almost exactly — it is not a new judgment, it is the same one, re-stated as a hard gate for this specific sprint.

## How a fix earns its way past this freeze

A change is only in scope if it can point to one of:
1. A specific P0/P1 finding recorded in `docs/PILOT_DATA_DISCREPANCIES.md` or `docs/PILOT_FEEDBACK_BACKLOG.md` with real evidence (a quote, a screenshot, a measured discrepancy) attached — not a hypothetical.
2. A repeated P2 pattern — meaning it was observed more than once (founder walkthrough *and* farmer session, or twice within the same session), not a single isolated preference.

Anything else, however reasonable it sounds in isolation, waits for the next sprint that has room for net-new feature work.

## Enforcement

Any pull request / change made during this sprint that isn't traceable to one of the two conditions above should be rejected on that basis alone, independent of whether the change itself is good code. "This would be a nice improvement" is not, on its own, a reason to build something during a pilot-execution sprint.
