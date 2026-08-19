# Pilot Data Discrepancy Log

Compares FarmOS's calculated/recorded results against the pilot farmer's own real records (their existing Excel/paper/FMS). **Empty until a real pilot session produces real data to compare** — this is a template and logging convention, not a filled-in result.

**Do not claim legal compliance certification anywhere in this document or in any conversation with the farmer.** A discrepancy log is about accuracy of calculation and record-keeping, not a certification that FarmOS's compliance records satisfy any specific legal requirement.

## What to validate

For each activity the farmer records (or re-enters from a recent real one for comparison), check FarmOS's value against their own record for:

- Field hectares
- Product unit (L / kg / T / bag / box) — does it match what they actually track in?
- Stock deduction (does the post-activity stock match dose × area subtracted correctly?)
- Dose calculation (per-hectare math correct?)
- Treated area (does it match what they'd report themselves for that operation?)
- Water volume (spray only)
- Machine/operator data (recorded correctly, matches who/what actually did the work?)
- Compliance record (does the denormalized snapshot — field, crop, date, product, dose — match reality?)
- Date/time and timezone (is the date shown the date they actually did the work, accounting for `Europe/Amsterdam`?)
- Spray suitability / weather explanation (does the *explanation* they were given match what conditions actually were, per their own observation?)

## Discrepancy log

| # | Date observed | Field validated | FarmOS value | Farmer's real value | Discrepancy | Likely cause | Severity |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

(Add rows as discrepancies are found. Severity uses the same P0–P4 scale as `PILOT_FEEDBACK_BACKLOG.md`: a wrong stock/dose calculation is P0 or P1 depending on whether it could cause real harm if trusted; a cosmetic date-format mismatch is P3.)

## Known, already-documented gaps (not new discrepancies — carried over from prior sprints)

- No localized (Dutch, comma-decimal) number formatting — stock/dose values render as `"500.000"`, not `"500,000"`. Documented in `Sprint_12_Bug_Audit.md`. If the farmer flags this, it confirms a known issue rather than a new one — still worth noting time/frequency here.
- No stale-weather indicator — weather is always fetched live; if the farmer catches Open-Meteo showing outdated conditions, that's an upstream data-source issue, not a FarmOS calculation error, but still worth logging if it affects trust (see `FIRST_PILOT_SESSION_SCRIPT.md`'s trust questions).
