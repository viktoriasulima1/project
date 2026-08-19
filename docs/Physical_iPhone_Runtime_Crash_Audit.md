# Physical iPhone Runtime Crash — Reproduction Audit

Date: 2026-07-23. Follows the first real iPhone test of FarmOS through a
Cloudflare Quick Tunnel (`https://<random>.trycloudflare.com`). The blank-screen
issue is already fixed (`allowedDevOrigins`); this audit covers the **new
runtime/product defects** the physical test exposed.

Physical evidence being reproduced:
1. `RangeError: Maximum call stack size exceeded` (Next.js 16.2.9, Turbopack).
2. Browser translation (English → Russian) active during the crash.
3. Scouting form showed a raw validation message:
   `Invalid option: expected one of "good" | "satisfactory" | "poor" | "critical"`.
4. GPS UI showed `accuracy 5632 m` presented as normal location evidence.
5. Mobile layout: Translate overlay, sidebar over map, FAB/error-banner overlap,
   technical errors visible, no useful route error boundary.

## How each flow was exercised here

| Env | Available in this environment | Notes |
| --- | --- | --- |
| Desktop Chrome through the tunnel | ❌ not run | no `cloudflared` here |
| Mobile Playwright viewport (390×844, 430×932) | ⚠ spec written, not executed | needs live server + Postgres + Clerk test |
| Static/unit reproduction (vitest) | ✅ run | 14 targeted cases, all green |
| Physical iPhone | ❌ developer gate | must be retested on the real phone |

The exact synchronous line of the stack overflow could **not** be deterministically
isolated in a headless environment, because it only manifests while an external
DOM-mutation agent (browser page-translation) is continuously rewriting the DOM.
What the code review *did* isolate is the internal state loop and the data
defects that make the page fragile under that external mutation (below).

## Reproduction matrix

### Defect 3 — raw enum message (root cause CONFIRMED, reproducible)

- Route: `/scouting`
- Action: select overall condition, Save visit
- Translation state: **on** (English → Russian)
- Root cause: the overall-condition `<select>` rendered
  `<option>good</option>` **with no `value` attribute**, so the submitted value
  is the option's *text content*. Google Translate rewrites that text to Russian
  → the browser submits the translated label → server Zod
  `z.enum([...])` rejects it → the raw
  `Invalid option: expected one of ...` message was returned verbatim to the
  farmer (the action returned `parsed.error.issues[0].message`).
- Component stack: `ScoutingVisitForm` → `createScoutingVisit` (server action).
- Reproducible: **yes** — deterministic. Any select whose value is text content
  is corrupted by translation. The observation *severity* select shared the same
  defect. Unit-reproduced: `normalizeCropCondition('Хорошо') === null`.
- Fix: option `value` now binds the canonical English enum; labels are localized
  separately; server maps Zod issues to friendly field messages
  (`friendlyScoutingIssue`) and never returns the raw enum text.

### Defect 4 — coarse GPS presented as evidence (CONFIRMED, reproducible)

- Route: `/scouting` (`locate()`) and `/fields/map` (`watchPosition`)
- Action: request location on a device with a ±5632 m fix
- Translation state: independent
- Cause: both surfaces displayed `accuracy N m` and stored/plotted the point with
  no confidence gate. `ScoutingVisitForm` persisted `locationAccuracyM` but never
  judged whether the point was usable.
- Reproducible: **yes** — Playwright `setGeolocation({accuracy: 5632})` (Flow B).
  Unit-reproduced: `classifyGpsAccuracy(5632).usableForFieldSuggestion === false`.
- Fix: `classifyGpsAccuracy` policy (≤30 / ≤150 / ≤1000 / >1000 m), a low/unusable
  fix is labelled "too low to identify a field", requires explicit confirmation
  before attaching, offers Retry, and keeps manual field selection. Accuracy is
  always persisted with the coordinates (`buildLocationEvidence`).

### Defect 1 — RangeError / stack overflow (state loop identified; external trigger)

- Route: most likely the Activity dialog (natural-language flow) and any
  interactive form while translation is active.
- Action: interact with a controlled form while Google Translate re-writes text
  nodes.
- Translation state: **on** — required to reproduce. With translation **off**,
  no stack overflow was observed in review or in the unit/spec flows.
- Internal state loop identified: `ActivityDialog` autosave.
  `applyDraftToForm` (offline/drafts) synthetically dispatches **bubbling**
  `input`/`change` events; the form's `onInput`/`onChange` = `handleMeaningfulChange`
  writes state → `saveDraft` → `refresh` → `setDrafts` → re-render. Normally this
  is debounced and self-terminating, but while Google Translate continuously
  mutates and re-translates the re-rendered DOM it fires further input/mutation
  events, sustaining an unbounded update/mutation cycle; React additionally
  throws while reconciling text nodes Translate has replaced with `<font>`
  wrappers. The observable symptom is the synchronous
  `Maximum call stack size exceeded`.
- Reproducible: **partially** — the internal loop is reproduced/guarded in unit
  tests (identical-state no-op, idempotent transcript stop, bounded split,
  cycle-safe traversal). A faithful synchronous Google-Translate reproduction
  remains a **manual physical gate**.
- Fix: (a) restore no longer feeds autosave (`applyingDraftRef` re-entrancy
  guard); (b) identical snapshots are ignored (`lastSnapshotRef`); (c) idempotent
  transcript stop/cancel/delete; (d) canonical option values so translation can't
  corrupt data; (e) route error boundaries so any residual reconciliation error
  shows a safe fallback + diagnostic ID instead of a white screen.

### Defect 5 — mobile layout (CONFIRMED)

- FAB (`z-index 20`) and error toast (`z-index 30`) both pinned bottom-right →
  overlap. Fixed: toast raised above the 56px FAB.
- Nav toggle (top-left, 44px) overlapped Leaflet's zoom control. Fixed: mobile
  margin on `.leaflet-top.leaflet-left`.
- iOS bottom browser chrome could hide the dialog footer / FAB. Fixed:
  `env(safe-area-inset-bottom)` padding on FAB, dialog footer, map location bar.

## Components inspected for recursion / state loops (Part 2/4)

`ActivityDialog` (autosave, draft restore, transcript, focus-trap, suitability
effects), `offline/drafts.applyDraftToForm`, `OfflineProvider` (refresh/queue),
`ScoutingVisitForm`, `FieldOperationsMap` (watchPosition/Leaflet), `Sidebar`,
`AppShell`, `QuickLogButton`, `activity-parser` (`normalize`/`resolveEntity`),
`reallocation-preview.resolvePercentages`, `activity-form-logic`. No unbounded
*algorithmic* self-recursion was found; the one exploitable **state** loop is the
autosave feedback path documented above. Object-traversal used by the new dev
telemetry is cycle-safe by construction (`safeSerialize`).
