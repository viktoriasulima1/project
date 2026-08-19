# Founder Pre-Beta Walkthrough

**Honesty framing, read this first:** the 21 items below have been executed by automation (`e2e/founder-walkthrough.spec.ts`, run against both a dev server and a real production build), not by an actual human founder clicking through the app. This is real evidence — a real browser, real Clerk authentication, a real Postgres database, real screenshots saved to `e2e/walkthrough-screenshots/` — but it is not a substitute for a human's judgment about whether the app *feels* right. **A human founder must still do this pass themselves before inviting the pilot farmer** — budget 20–30 minutes. Two items (2 and part of the sign-up flow) structurally cannot be automated and need a human regardless.

**No beta invitation until every P0/P1 below is resolved.** As of this writing, all P0/P1s found during this pass have been fixed and re-confirmed by re-running the automated walkthrough to a clean pass.

---

| # | Item | Pass/Fail | Screenshot | Severity if failed | Notes / bug repro |
|---|---|---|---|---|---|
| 1 | Open production-like build | Pass (automated) | — | — | Verified against `npm run build && npm run start`. |
| 2 | Sign up with a fresh Clerk user | **Not automated — needs a human** | — | — | Automation used a ticket-based `+clerk_test` sign-in (Clerk's own testing helper), which is not the same as a human typing an email, receiving a real verification code, and completing Clerk's hosted sign-up UI. A founder must do this step personally at least once. |
| 3 | Complete onboarding | Pass (automated) | `02-signed-in-onboarding-start.png` | — | Full flow: Welcome → Farm → Season → Field → Crop → Inventory → Employee → Review → Complete. |
| 4 | Add a real-looking farm | Pass (automated) | — | — | "Maatschap Van der Berg", Nagele, Flevoland, 180 ha. |
| 5 | Add active season | Pass (automated) | — | — | Default year/dates accepted as-is. |
| 6 | Add two fields | Pass (automated), **required a fix** | — | **Was P0** | See bug below. First field (Noordpolder, 42.5 ha) added during onboarding; second field (Zuidkamp, 37 ha) added afterward via the Fields page. |
| 7 | Assign crops | Pass (automated), **required a fix** | — | **Was P0** | **Bug found and fixed:** the "assign a crop to a field" guide (`SetupGuide`) only ever appeared when a season had *zero* field-seasons total. Once the first field (Noordpolder) got a crop during onboarding, that condition became permanently false — a second field added afterward (Zuidkamp, the completely normal case for a 50–500 ha farm) had **no UI path anywhere to ever get a crop assigned**. Fixed by adding `UnassignedFieldsBanner`, computed independently of whether the season already has *some* assignments, shown on the Activities page without hiding the rest of it. Confirmed fixed: Zuidkamp received `sugar_beet` via the new banner. |
| 8 | Add crop-protection product | Pass (automated) | — | — | Amistar Opti (fungicide), 500 L stock. |
| 9 | Add fertiliser | Pass (automated) | — | — | KAS 27% N, 8,000 kg stock. |
| 10 | Add spray operator | Pass (automated) | `10-review-screen.png` | — | Jan van der Berg, spray operator, spuitlicentie checked. Note: this operator record does **not** connect to the activity form's "recent operator" prefill (that's derived from activity history, not the Employee table) — worth a founder's own judgment on whether that disconnect is confusing. |
| 11 | Add sprayer | Pass (automated) | `12-spray-form-filled.png` | — | Used the inline "+ Add a new sprayer" control inside the spray form itself (Sprint 12 fix) — "John Deere M732i" created and selected without leaving the dialog. |
| 12 | Record spraying activity | Pass (automated) | `12-spray-success.png` | — | Noordpolder, Amistar Opti, 2 L/ha, 300 L/ha water, flat fan nozzle. Compliance record confirmed created. |
| 13 | Record fertilising activity | Pass (automated) | — | — | Zuidkamp, KAS 27% N, 150 kg/ha. |
| 14 | Record scouting activity | Pass (automated) | — | — | Noordpolder, 5 ha observed. |
| 15 | Verify inventory changes | Pass (automated) | — | — | Amistar Opti: 500 L → 415 L after 2 L/ha × 42.5 ha, confirmed via the product dropdown's live stock hint. |
| 16 | Verify compliance record | Pass (automated), **required a fix** | `16-compliance-page.png` | **Was P0** | **Bug found and fixed:** the Compliance page had no query at all — it unconditionally showed "No compliance records yet" regardless of how many spray activities existed. A founder trying to visually confirm a compliance record via the Compliance page (the natural thing to do) would have seen nothing, ever. Fixed with a minimal real query and list view; confirmed the spray from item 12 now appears. |
| 17 | Verify dashboard updates | Pass (automated) | `17-dashboard-after-activities.png` | — | First-run banner correctly gone after activities exist. |
| 18 | Test mobile width | Pass (automated) | `18-mobile-dashboard.png` | — | 390×844, no horizontal scroll. |
| 19 | Sign out and sign back in | Pass (automated) | — | — | |
| 20 | Confirm persistence | Pass (automated) | — | — | Both fields and both activities' field names still present after re-sign-in. |
| 21 | Confirm another user cannot access the farm | Pass (automated) | — | — | Signed in as a separate seeded user (User C); neither "Noordpolder" nor "Zuidkamp" appear on their Activities or Fields pages. |

## Bugs found during this pass (all fixed and re-confirmed)

1. **No way to assign a crop to a second field** (item 7) — P0, since this blocks any farm with more than one field from ever using half their land in FarmOS. Fixed via `UnassignedFieldsBanner`.
2. **Compliance page never actually queried records** (item 16) — P0, since it directly contradicts the app's own claim ("Records are created automatically after regulated activities") with a page that would never show them regardless.

## What a human founder still needs to check personally

- Item 2 (real Clerk sign-up UI, email verification).
- Whether the disconnect between "Employee/operator added during onboarding" and "recent operator suggested in the activity form" (noted at item 10) is actually confusing in practice, or a non-issue.
- General *feel* — does the app feel trustworthy, fast, and clear to a person seeing it for the first time? Automation cannot answer this.
