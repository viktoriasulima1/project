# First Pilot User Profile

## Ideal profile

- Dutch arable farmer (akkerbouwer), farming in the Netherlands.
- Farm size preferably **50–500 hectares** — large enough that spreadsheet/paper record-keeping is genuinely tedious (the pain FarmOS targets), small enough to still be a single-operator or small-team decision-maker who can commit to a session personally.
- Grows at least one of: wheat, potatoes, onions, sugar beet (the crops already represented in FarmOS's crop list and the ones this product was designed around).
- Currently uses Excel, paper records, or another farm management system (FMS) — someone with an existing process to compare FarmOS against, not someone starting from nothing.
- Personally involved in spraying/fertilising/record-keeping decisions (not purely delegating to an employee who won't be in the pilot session).
- Comfortable with a smartphone or tablet at a basic level — doesn't need to be tech-savvy, but Quick Log's value can't be evaluated by someone who never touches a phone in the field.
- Willing to commit **7–14 days** of light real (or real-equivalent) use, plus one 45–60 minute session with an observer.
- Willing to give **honest, unfiltered** feedback, including "this is useless" if that's genuinely their view.

## Exclusion criteria

- **Do not** recruit someone who would make legally or financially critical production decisions based on FarmOS alone during the pilot — the app is beta software, and its weather/compliance data is informational, not certified (see `FIRST_BETA_USER_GUIDE.md` §6–7). A pilot farmer must have (and keep using) their existing, trusted method for actual regulatory compliance during this period.
- Do not recruit someone currently mid-crisis (active pest outbreak, urgent harvest pressure) — you want their attention, not their triage.
- Do not recruit a personal friend/family member as the *only* signal — some social-desirability bias is fine to accept for a first pilot, but note it explicitly when interpreting feedback (see `PILOT_FEEDBACK_BACKLOG.md`'s "evidence" classification).
- Do not recruit someone without any of the four target crops — FarmOS's crop-specific handling (dose calculations, compliance framework) is built around them, and off-target crops would produce feedback about missing features rather than about how well the app does what it's meant to do.
- Do not proceed if they cannot commit real time — a 5-minute "sure, looks nice" glance is not a pilot.

## Recruitment message (template)

> Hoi [naam],
>
> Ik ben bezig met FarmOS, een nieuwe, eenvoudige applicatie voor akkerbouwers om spuit-, bemestings- en scoutingactiviteiten bij te houden — met automatische voorraadbijhouding en een spuitdagboek dat aan de EU-richtlijn voldoet.
>
> Het is nog in bètafase — geen kant-en-klaar product, maar echt bruikbaar voor dagelijkse registratie. Ik zoek één ervaren akkerbouwer die bereid is het 1–2 weken naast zijn eigen registratie te proberen, en die eerlijk wil zeggen wat wel en niet werkt. Geen verplichtingen, geen kosten — wel 45–60 minuten voor een gezamenlijke sessie waarin we het samen doornemen.
>
> Interesse?

(Translation for internal reference: introduces FarmOS as a new, simple app for arable farmers to track spray/fertilising/scouting activities with automatic stock tracking and an EU-compliant spray diary; explains it's in beta, asks for 1–2 weeks of parallel use alongside their existing records, honest feedback, no cost/obligation, one 45–60 min session.)

## Consent language (read/share before the session)

> You're helping test early software. FarmOS is not a finished product — it may have bugs, missing features, or things that don't work the way you'd expect. Please **do not** rely on FarmOS as your only record for anything legally or financially important during this pilot; keep using whatever you trust today for that, in parallel. Any weather or compliance information FarmOS shows you is informational, not a certification — always verify against the actual product label and your own knowledge. We may record the session (screen and/or audio, with your permission) purely to review feedback afterward — nothing is shared outside the team building this without asking you first. You can stop at any point, for any reason, no explanation needed.

## What FarmOS can and cannot guarantee

**Can:**
- Record activities (spraying, fertilising, sowing, tillage, scouting, harvesting) quickly, with only the fields relevant to each type.
- Automatically deduct product stock based on dose × treated area.
- Automatically create an EU spray-diary compliance record for spray activities.
- Show current weather conditions from a public data source (Open-Meteo) at the farm's location.

**Cannot:**
- Verify pesticide product registrations or certifications against any official registry.
- Certify legal compliance — records are created for the farmer's own use, not audited or guaranteed correct by FarmOS.
- Guarantee uptime, data durability, or feature stability during the beta period.
- Replace the farmer's own agronomic judgment or legal responsibility as an operator.

## Expected testing time

- **One 45–60 minute guided session** (see `FIRST_PILOT_SESSION_SCRIPT.md`).
- **7–14 days of light independent use** afterward — a handful of real (or realistic mock) activities logged as they'd naturally occur, not a forced daily quota.
- **One follow-up conversation** (15–20 minutes, phone or in person) near the end of the window to capture how it held up without an observer present.

## Support channel

A direct line to the founder/team during the pilot — not a ticket system for a single farmer. Recommended: a phone number or WhatsApp the farmer can reach directly, checked at least once daily during the pilot window. See `PILOT_SUPPORT_RUNBOOK.md` for response-time expectations and escalation.
