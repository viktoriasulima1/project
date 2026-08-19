# Pilot Support Runbook

For whoever is on call during the 7–14 day pilot window. One farmer, direct contact — this is not a ticketing-system process.

## How the farmer reports a bug

Direct contact via the channel agreed in `FIRST_PILOT_USER_PROFILE.md` (phone/WhatsApp recommended). Ask them, if possible, to include:
- What they were doing
- What they expected
- What happened instead
- A screenshot, if easy for them

Do not require a formal bug report format from them — a voice message or a one-line text is fine. Capturing *something* immediately beats a perfect report later.

## Expected response time

- **Same day** (within business hours) for anything blocking their ability to use the app at all.
- **Within 24 hours** for anything else.
- If a response will take longer, tell them that directly rather than going silent — see "communicate honestly" below.

## Emergency disable procedure

If something is actively producing wrong data or behaving unsafely:

1. Stop the pilot server (or, if using a hosting platform, pause/scale it to zero).
2. Tell the farmer immediately that you've taken it offline and why, in plain language — not "we're investigating an issue," but the actual problem as best understood at that moment.
3. Do not bring it back up until the specific cause is understood, not just "seems fine now."

## How to export the farmer's data

See `PILOT_ENVIRONMENT_RUNBOOK.md`'s "Farm data export" section — a manual, ad-hoc process today. If the farmer asks for their data (during or after the pilot), do this promptly; it's their data, not FarmOS's.

## How to delete pilot data

See `PILOT_ENVIRONMENT_RUNBOOK.md`'s "Account removal" section. Confirm with the farmer before deleting anything they might still want — don't delete proactively just because the pilot window ended, unless they've said to.

## How to handle a wrong spray recommendation or weather reading

1. Do not argue that the farmer misread it — check the actual data source (Open-Meteo's response for that location/time) and the app's own calculation first.
2. If FarmOS's *display* of correct underlying data was misleading, that's a P0/P1 bug — log it in `PILOT_FEEDBACK_BACKLOG.md` immediately, don't wait for the session write-up.
3. If the underlying weather data itself was simply wrong or stale (an Open-Meteo/upstream issue), tell the farmer plainly that this is a known limitation (no stale-data indicator exists yet — see `Sprint_12_Bug_Audit.md`) rather than implying FarmOS caught and corrected it.
4. Never suggest the farmer should have trusted it more than they did — if they were skeptical, that skepticism was reasonable given the app's own disclaimers.

## How to restore from backup

See `PILOT_ENVIRONMENT_RUNBOOK.md`'s "Backup and restore" section. If you have to restore mid-pilot, tell the farmer what data (if any) might be affected by the restore point before doing it, not after.

## How to communicate incidents honestly

- Say what happened, not a euphemism for it ("the server crashed," not "we had a brief interruption").
- Say what you know and don't know yet — don't guess out loud as if it were confirmed.
- Say what you're doing about it and roughly when they can expect an update.
- Follow up once it's actually resolved, even if they didn't ask again.
- If FarmOS caused them any real inconvenience (lost time re-entering something, a confusing wrong number), acknowledge that plainly rather than minimizing it.
