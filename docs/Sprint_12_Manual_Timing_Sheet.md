# Sprint 12 — Manual Timing Sheet

**Purpose:** the timing targets below describe a *human's* felt experience (how long a real farmer takes, including reading, thinking, and typing), which cannot be faithfully simulated by a script — a Playwright test fills fields and clicks instantly, so an automated pass could never fail "took too long" in the way a real user could. Automated tests confirm the *reachability and correctness* of each flow (see `golden-path.spec.ts`, `failure-paths.spec.ts`); this sheet is for a human to actually time themselves.

**How to use:** open the app in a real browser, signed in as an account with a farm already set up (mirrors User B's seeded state — one field, one product, no machines yet). Use a stopwatch from the moment you decide to start the action to the moment you see the success confirmation. Record the actual time, not a rounded guess.

**Do not claim these numbers are confirmed until a real human has actually run the stopwatch.** Nothing in this sheet has been executed by the assistant — there is no browser automation tool available in this environment that could act as a human proxy for subjective timing.

| # | Flow | Target | Actual (fill in) | Pass/Fail | Notes |
|---|---|---|---|---|---|
| 1 | Full required onboarding (farm → season → field → crop, skipping inventory/employee) | Under 5 minutes | | | |
| 2 | Scouting activity (field, date, area, observation category only) | Under 20 seconds | | | |
| 3 | Fertilising activity (field, date, area, product, dose) | Under 45 seconds | | | |
| 4 | Spraying activity, including creating a sprayer for the first time via the new inline "+ Add a new sprayer" control | Under 60 seconds | | | Sprint 12 added this step — a brand-new farm has no machines, so first-time timing should include it. Repeat sprays (sprayer already exists) should be noticeably faster. |
| 5 | Opening Quick Log (click to dialog visibly open) in a local production build (`npm run build && npm run start`) | Under 500 ms | | | Use browser DevTools' Performance panel or simply watch closely — this is a UI responsiveness target, not a network-bound one, since Quick Log's data fetch is a single fast local query. |
| 6 | Dashboard usable (visibly interactive, not just a loading spinner) on a warm local load, production build | Under 2 seconds | | | "Warm" means not the very first request after starting the server. |

## Context for whoever fills this in

- Timings 2–4 assume a field, product, and (for #4, after the first run) a sprayer already exist — i.e., the "quick" case the type-first dialog and safe prefilling were built for, not first-time setup friction.
- If any timing fails, note *which specific field or step* caused the delay (e.g., "selecting the field took a while because the dropdown wasn't focused") rather than just recording a slower total — that detail is what makes the number actionable.
- Re-run timings 2–4 a second time in the same session (repeat activity, not "add another" from scratch) to distinguish first-use friction from steady-state speed — both are useful, but they answer different questions.
