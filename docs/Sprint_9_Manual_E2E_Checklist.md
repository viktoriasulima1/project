# Sprint 9 — Manual Browser E2E Checklist

**Why manual:** this session has no browser automation tool available — everything below (real Clerk sign-up/sign-in, cross-user isolation, browser refresh behavior) requires an actual browser and a real Clerk account, neither of which can be scripted from here. Everything NOT requiring a live browser (state machine transitions, ownership checks, redirect logic, Clerk config detection) is covered instead by the automated test suite (103 tests as of Sprint 9; 172 as of Sprint 11 — see the Sprint 11 section below).

**Do not claim manual completion unless a human actually verifies it in a real browser.** Nothing in this document has been executed by the assistant; every row below is a specification of what to check, not a report of a check having passed.

**Prerequisite:** `.env.local` has real Clerk test keys configured (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`), and `npm run dev` has been restarted since they were added.

---

## Test flow

| # | Step | Expected result |
|---|---|---|
| 1 | Open the app in an incognito/private window at `/` | **Corrected per Sprint 10 audit:** there is no distinct landing page — `/` immediately redirects (`redirect('/dashboard')` in `src/app/page.tsx`), which itself isn't public, so the proxy bounces you again to `/sign-in`. Expected: you land on `/sign-in`, not a crash, not a redirect loop. |
| 2 | Click sign-up, register with a new email | Clerk's hosted sign-up UI renders (proves `ClerkProvider` mounted with valid keys). After completing, redirected per `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` (`/dashboard`). |
| 3 | Verify email if Clerk's instance requires it | Clerk handles this natively (verification code/link flow). Confirm you land back in the app afterward, not stuck on a Clerk error page. |
| 4 | Arrive at `/dashboard` as a brand-new user | Since no farm exists yet, `getFarmSetupState()` resolves `no_farm` — the dashboard shows "Finish setting up your farm" with a 0% progress bar and a "Start onboarding" button, **not** a crash and **not** another user's data. |
| 5 | Click "Start onboarding" | Lands on `/onboarding`, Welcome step. |
| 6 | Click "Get started", fill in farm name + location, click Continue | Farm is created (check: no error banner). Wizard advances to the Active season step. |
| 7 | **Refresh the browser tab right here** (mid-wizard, after farm creation, before season) | Page reloads and lands back on the **Active season** step — not Welcome, not an error. This is `getFarmSetupState()` re-resolving `farm_created` fresh from the database on every load; nothing is stored client-side. |
| 8 | Fill in season year/dates, Continue | Season created, advances to First field step. |
| 9 | Fill in field name + hectares, Continue | Field created, advances to Crop assignment step. |
| 10 | Select the crop, Continue | `FieldSeason` created, advances to Inventory (optional) step. |
| 11 | Select category "Fungicide" (under the "Crop protection" group), fill name/unit/stock, click "+ Advanced fields" | Advanced section expands showing Registration number / Active ingredient / FRAC code / HRAC code / PHI days — **not** N/P/K fields (those are fertiliser-only). Switch category to "Fertiliser" instead. | 
| 11b | With category "Fertiliser" selected and advanced expanded | Shows Nitrogen/Phosphorus/Potassium % fields — **not** registration number/active ingredient/FRAC/HRAC/PHI (those are crop-protection-only). Fill in a fungicide, stock 50, click "Add product" |
| 12 | Click "Skip for now" on the employee step | Advances to Review — no employee record created, no error. |
| 13 | Review screen shows farm name, season year, field count ≥1, "Crop assigned: Yes", "Inventory: Added" | Confirms all progressive writes actually landed. Click Finish. |
| 14 | Lands on the "You're all set" screen, click "Go to dashboard" | Redirects to `/dashboard`. |
| 15 | Dashboard now shows real data: farm name in the topbar title, the field just created, the product just added under inventory alerts (if below its minimum stock) | This is the transition from "setup" dashboard to the real data dashboard — confirms `getRealDashboardData()` picks up everything just written. |
| 16 | Check the topbar's right side | User menu shows: farm name, your name/email, Clerk's avatar/account button. |
| 17 | Go to `/activities`, click "+ Record activity", click the "Spraying" tile, fill in every field including selecting the product you just added with a dose, submit | **Updated per Sprint 11:** the dialog now opens on a type picker ("What did you do?") with 7 tiles, not a single long spray-only form. If the dose × area exceeds the product's current stock, an inline "Not enough stock" preview appears **before** submit and the Save button is disabled; if the server itself rejects it, a validation error banner appears **and scrolls into view** even if you were scrolled to the bottom of the form. Reduce the dose or increase stock, retry — should now succeed. |
| 18 | Check `/inventory` | The product's current stock is now reduced by exactly the dose × area used. |
| 19 | Check `/dashboard` again (no hard refresh — click a sidebar link away and back) | Reflects the new activity/stock without needing a manual browser refresh (Next.js Server Component re-fetch on navigation). |
| 20 | Sign out via the topbar user menu | Redirected to `/` (per `afterSignOutUrl="/"`). |
| 21 | Try to directly navigate to `/dashboard` (paste the URL) while signed out | Redirected to `/sign-in` — protected route correctly blocks anonymous access. Clerk should also preserve a return URL so signing back in lands you back on `/dashboard`. |
| 22 | Sign back in with the same account | Lands on `/dashboard` showing the **same farm** with the **same data** (field, product, activity all still present) — proves `Farm.clerkUserId` correctly persists ownership across sessions. |
| 23 | Sign out, then sign up with a **second, different** email | New user reaches `/dashboard` in the `no_farm` state — must **not** see the first user's farm, field, product, or activity anywhere. |
| 24 | As the second user, try navigating directly to `/fields`, `/activities`, `/inventory` | Each redirects to `/onboarding` (no farm yet) — never shows the first user's data, never crashes. |

## Sprint 10 additions — first-run dashboard, first activity, dynamic fields

| # | Step | Expected result |
|---|---|---|
| 25 | Immediately after finishing onboarding (before recording any activity), look at `/dashboard` | Shows the **first-run dashboard**, not the normal grid: a green "Farm setup complete" banner, three summary cards (Farm/season, First field+crop, Weather), an explainer line ("Finance, compliance, and AI insights will appear here once..."), and exactly **one** visually dominant button. **Must not** show a Finance card, Compliance card, or AI briefing with zero/fake values. |
| 26 | Check which button is dominant | If you added a product during onboarding (step 11 above), the dominant CTA should read "Record your first activity." If you skipped inventory, it should read "Add your first inventory item" instead — inventory takes priority over activity per the priority order. |
| 27 | Click the dominant CTA | Navigates to `/activities` or `/onboarding?step=inventory` per whichever was shown. |
| 28 | Go to `/activities`, click "+ Log spray", select the field/crop, the fungicide added earlier, a dose, submit | Activity is created. Compliance record is auto-created (spray type) — not directly visible in UI yet (Compliance module is still a stub, see `/compliance`), but confirm no error. |
| 29 | Try a **fertilising** activity instead of spraying | No compliance record should be created (compliance records are spray-only) — confirmed by code/tests, not independently visible in the current Compliance stub page. |
| 30 | Check `/inventory` again | Stock reduced by exactly dose × treated hectares for the product used. |
| 31 | Return to `/dashboard` (click a sidebar link, not a hard refresh) | **Dashboard transition**: since you've now recorded 1 activity (below the `active_farm` threshold of 5), you should see `early_usage` — same first-run-style dashboard is NOT guaranteed here; check whether it still shows first-run style or has moved to the normal grid. Record 4 more activities and check again — at 5+ activities the dashboard should show the full normal grid (Finance/Compliance/AI briefing), not the first-run summary. |
| 32 | Mobile-width Quick Log | **Superseded by Sprint 11** — Quick Log now exists; see the Sprint 11 section below for its dedicated checks. |

## Sprint 11 additions — first activity, Quick Log, and beta UX completion

**Why manual:** timing checks (spraying under a minute, scouting under 20 seconds), true mobile viewport behavior (44px tap targets, FAB not covering content, no horizontal scroll), and weather-unavailable fallbacks all require a real browser/device and cannot be scripted from here. Everything else (type-conditional required fields, safe-prefill data resolution, repeat-activity field safety, Quick Log reusing the same server action) is covered by the automated suite (172 tests as of this sprint).

| # | Step | Expected result |
|---|---|---|
| 33 | Time yourself: `/activities` → "+ Record activity" → "Spraying" tile → fill required fields (field, date, area, product, dose, operator, machine, water volume, nozzle) → submit | Should comfortably complete in **under 60 seconds** for a farmer with an existing field/product/machine already set up. If it takes noticeably longer, note which field caused the friction. |
| 34 | Time yourself: same flow but the "Fertilising" tile | Fewer required fields than spraying (no operator/machine/nozzle/water volume required) — should complete in **under 45 seconds**. |
| 35 | Time yourself: the "Scouting" tile, only filling required fields (field, date, area, observation category) | Severity/affected area/notes are optional — should complete in **under 20 seconds**. |
| 36 | Change activity type mid-flow (e.g. start on "Spraying", click "← Change type", pick "Sowing" instead) | Returns cleanly to the type picker; picking a new type shows only that type's fields — no leftover spray-only fields (operator/nozzle/water volume) visible for sowing. |
| 37 | With a field selected that has known hectares, check the "Treated area" field | Auto-fills from the field's hectares with a "· prefilled from field" hint, but remains editable — changing it does not snap back. |
| 38 | With at least one prior activity recorded (has an operator name and machine), open a new spray activity | Operator field pre-fills with the previous operator's name (marked "· suggested"), Sprayer pre-fills with the previous machine (marked "· suggested") — both fully editable, not locked. |
| 39 | Check the same new spray form for date, dose, water volume, BBCH-equivalent, and any certificate/registration fields | **None of these are pre-filled** — date defaults to today (not silently copied from history), dose/water volume are blank, requiring a fresh entry every time. |
| 40 | On the Activities table, click "Repeat" on a past spray activity row | Opens the dialog pre-set to the same type/field/operator/machine/product, but with **date, dose, area, water volume, and weather all blank** — must be re-entered, never silently copied. |
| 41 | On the farm's coordinates, check the Weather section of the Spraying form (with farm coordinates configured and Open-Meteo reachable) | Shows an auto-filled weather snapshot (temp/wind/humidity) with a "check suitability" link to `/weather` — not manually re-typed. |
| 42 | Temporarily simulate no weather data (e.g. a farm with no coordinates set, or Open-Meteo unreachable) | Shows the explicit fallback message "Weather data is unavailable. You may continue, but suitability cannot be calculated" — never a blank gap or a crash. |
| 43 | Submit a spray form with a required field left empty (e.g. no operator name) | Field-level error appears under that exact field, plus the global error banner scrolls into view — matches the existing Sprint-era error-scroll behavior, now consistently applied. |
| 44 | Complete a spray activity successfully | Success screen shows the activity type, field, date, updated stock figure, and "Compliance record created" — with three actions: "Add another", "View activity history", "Return to dashboard". |
| 45 | Click "Add another" on the success screen | Returns to the type picker (not the previous type's form) so a different type can be logged next, inside the same dialog session. |
| 46 | From `/dashboard`, locate the Quick Log entry point (desktop) | A trigger button is visible below the topbar; clicking it opens the same dialog used on `/activities`, on top of whatever page you're on. |
| 47 | Resize to a mobile viewport (≤767px) and check `/dashboard` or any farm page | The desktop Quick Log trigger is hidden; a circular floating action button (FAB) appears bottom-right instead. Confirm it does not sit on top of page content that needs to stay reachable (e.g. a bottom nav or a page's own primary button). |
| 48 | Tap the mobile FAB, complete an activity | Same dialog, same `createActivity` action — completing it updates `/activities` and `/dashboard` identically to using the full-page entry point. |
| 49 | On a mobile viewport, open the activity dialog and check tap target sizes for inputs/selects | All interactive inputs are at least 44px tall (per Sprint 11 CSS); nothing requires precise/small taps. |
| 50 | On a mobile viewport, check the dialog for horizontal scrolling | The dialog content fits the viewport width with no horizontal scrollbar, at any step (type picker, form, success). |
| 51 | Visit each of Fields, Activities, Inventory, Finance, Weather, Compliance, and AI pages with **zero data** in that module | Each shows the Sprint 11 empty-state copy exactly (e.g. Inventory: "No products yet" / "Add products to track stock, costs and activity usage.") — not a blank page, not a generic "No data" placeholder. |
| 52 | Trigger an error path in at least one non-activity flow (e.g. try creating a season with a duplicate year, or adding a field already in a season) | Shows a clear, specific message (e.g. "A season for 2026 already exists on this farm.") — never a raw Prisma/exception string. |
| 53 | Sign out, sign back in as the same user | The farm's activity history (including anything logged via Quick Log or Repeat) is still present, unchanged. |
| 54 | Sign out, sign up as a **second, different** user, and check `/activities` | No trace of the first user's activities, repeat suggestions, or recent-operator prefill — Quick Log and Repeat must never leak data across farms. |

## Known gaps in this checklist vs. a full automated E2E suite

- Steps 2–3 (Clerk's own sign-up/verification UI) are entirely Clerk-hosted and not something this app's code controls — if these fail, it's a Clerk dashboard configuration issue (check "Email verification" settings under Clerk's User & Authentication settings), not an app bug.
- Step 21's "return URL preserved" behavior is Clerk's `auth.protect()` default; if it doesn't redirect back correctly, check `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and that `src/proxy.ts`'s matcher isn't excluding the route being tested.
- No automated check exists for "does the avatar image actually render" (step 16) — that's a rendering detail only visible in a real browser.
- Sprint 11's timing checks (steps 33–35) are inherently subjective/human-timed — there is no automated performance budget enforcing "under 60 seconds" for a UI flow.
- Sprint 11's mobile checks (steps 47, 49, 50) require a real mobile viewport or device; the CSS rules being checked (44px targets, FAB position, no horizontal overflow) exist in `ActivityDialog.module.css` and `QuickLogButton.module.css` but were not visually confirmed in a running browser this sprint.
- Weather-unavailable fallback (step 42) was implemented and is straightforward to read in code (`ActivityDialog.tsx`'s conditional weather block), but forcing the real "Open-Meteo unreachable" case end-to-end was not exercised live.
