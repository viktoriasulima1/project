# Physical iPhone Runtime Crash — Report

Date: 2026-07-23. Fixes for the defects found during the first real iPhone test
of FarmOS through a Cloudflare Quick Tunnel. Companion docs:
`Physical_iPhone_Runtime_Crash_Audit.md` (reproduction matrix) and
`FARMOS_LOCALIZATION_AND_BROWSER_TRANSLATION_POLICY.md`.

## 1. Physical evidence

`RangeError: Maximum call stack size exceeded` (Next 16.2.9 / Turbopack) with
Google Translate (EN→RU) active; a raw
`Invalid option: expected one of "good" | "satisfactory" | "poor" | "critical"`
shown to the farmer; GPS `accuracy 5632 m` presented as normal evidence; sidebar
over map, FAB/error-banner overlap, no useful route error boundary.

## 2. Exact reproduction

See the audit. **Deterministic:** the raw enum message and the coarse-GPS
display. **Translation-dependent:** the stack overflow.

## 3. Translation-off result

No stack overflow reproduced with translation off, in review or in the
unit/spec flows. The enum and GPS defects reproduce regardless of translation
(the enum one is *worsened* by translation because the translated label became
the submitted value).

## 4. Translation-on result

With translation on, the overall-condition select submitted the Russian label
(the `<option>` had no `value`, so its value was its text content) → server
rejected it with the raw enum message. Continuous DOM re-translation of a
re-rendering form is the external trigger for the unbounded update loop /
reconciliation crash.

## 5. Full stack

The precise synchronous frame could not be captured headlessly (it requires the
live browser-translation agent). The internal state loop was isolated by code
review: `ActivityDialog.handleMeaningfulChange` ← synthetic bubbling
`input`/`change` from `applyDraftToForm` ← draft-restore effect ← `offline.saveDraft`
→ `refresh` → `setDrafts` → re-render, amplified by Translate re-mutating and
React reconciling `<font>`-wrapped text nodes.

## 6. Root cause

Two independent defects plus one fragility:
- **Data (confirmed):** domain `<select>`s bound their value to translatable text
  content, so browser translation changed the submitted value; the server also
  leaked the raw Zod enum message.
- **GPS (confirmed):** no accuracy confidence gate; a ±5632 m point was shown and
  stored as ordinary evidence.
- **Runtime (fragility):** the autosave feedback path is a self-terminating loop
  in isolation but becomes unbounded under an external DOM-mutation agent, and
  the app had no route error boundary to contain the resulting exception.

## 7. Recursion / state-loop fix

- `applyingDraftRef` re-entrancy guard: synthetic restore events no longer
  schedule autosave.
- `lastSnapshotRef` idempotency: an identical form snapshot never triggers
  another `saveDraft`/`refresh`/re-render.
- Idempotent `stopVoiceTranscript` (null the recognizer ref before stopping) so a
  second Stop/Cancel/Delete and the recognizer's own `onend` cannot re-enter.
- Reusable pure guards (`src/lib/runtime-safety.ts`): `guardedUpdate`/`shallowEqual`
  (ignore identical state), `nextVisibility` (bounded open/close), `safeSerialize`
  (cycle-safe diagnostic traversal).

## 8. Google Translate relationship

Translation is a **trigger and an amplifier**, not blamed as the sole cause. The
app still eliminates its internal loop and removes the text-as-value dependency.
Translation is not disabled; policy in
`FARMOS_LOCALIZATION_AND_BROWSER_TRANSLATION_POLICY.md`.

## 9. Validation enum fix

Canonical contract `good | satisfactory | poor | critical`
(`src/lib/scouting/condition.ts`). Option `value` is the canonical token; labels
are localizable; legacy `fair` is accepted as an inbound alias → `satisfactory`.
The server normalises input and maps Zod issues to friendly field messages
(`friendlyScoutingIssue`) — the farmer never sees `expected one of ...`. Empty
selection has its own message ("Choose the overall crop condition before
saving."). The scouting form shows an error summary that scrolls into view on
mobile. The observation *severity* select was given explicit canonical values too.

## 10. GPS accuracy fix

`classifyGpsAccuracy` (≤30 high / ≤150 usable / ≤1000 low / >1000 unusable). A
low/unusable fix is labelled "too low to identify a field", is **not**
auto-suggested, requires explicit confirmation to attach, offers **Retry
location**, and keeps manual field selection. `buildLocationEvidence` stores the
point only when trusted-or-confirmed and always persists accuracy with the
coordinates. Applied to both `/scouting` and the `/fields/map` location bar.

## 11. Mobile layout fixes

Error toast raised above the FAB; nav toggle cleared from Leaflet's zoom control;
`env(safe-area-inset-bottom)` added to the FAB, the dialog footer, and the map
location bar. No redesign.

## 12. Error-boundary behavior

New `error.tsx` for `/scouting`, `/activities`, `/fields/map`, `/offline` render
a shared `FarmFlowError`: *"FarmOS encountered a display error. Your locally
saved draft has not been deleted."* with **Try again / Return to Today / Copy
diagnostic ID**. The wording only asserts that an already-saved local draft is
intact (interactive drafts autosave to IndexedDB) — it never claims unsaved
in-memory data was persisted. A **dev-only** safe telemetry recorder
(`src/lib/dev/runtime-telemetry.ts`) captures error name, safe message, route,
boundary, timestamp, user action, translation-likely hint, viewport and online
state — and **no** tokens, farmer text, audio, photo bytes, cookies or secrets;
it is a no-op in production.

## 13. Unit tests

`src/lib/__tests__/physical-mobile-runtime.test.ts` — 14 cases: canonical value
vs. label; translated label never submitted; empty-condition message; no raw
enum leak; identical-state no-op; cycle-safe traversal; bounded draft split;
idempotent transcript stop; bounded dialog visibility; guarded observer loop; low
GPS rejected for auto-suggestion; manual confirmation path; accuracy persisted;
safe error-fallback wording.

## 14. Playwright tests

`e2e/physical-mobile-runtime.spec.ts` at 390×844 and 430×932 — Flow A (scouting
saves, no raw enum), B (±5632 m unusable + confirm + manual pick), C
(parse + mocked mic start/stop/cancel, no RangeError), D (sidebar/map churn),
E (translated-DOM simulation + form update, no crash). Every flow asserts no
`Maximum call stack size exceeded` via a `pageerror` listener. The spec does
**not** claim to reproduce Google Translate exactly.

## 15. Physical retest status

**NOT tested on a physical iPhone.** No device and no live tunnel were available
in this environment, so the Playwright suite was **not executed** here either
(it needs a running server + Postgres + Clerk test). No physical PASS is claimed.
Retest per Part 13: `npm run dev`, keep/re-create the tunnel, open the tunnel URL,
and run each flow once with translation **off** and once with EN→RU translation
**on**, recording iPhone model, iOS version, browser, translation state, action,
pass/fail, screenshot and diagnostic ID.

## 16. Remaining limitations

- The exact synchronous stack frame is only observable with the live translation
  agent; the fixes remove the internal loop and the data defect but the physical
  translated-browser retest is the authoritative gate.
- Browser-translation testing stays manual; the Playwright simulation is an
  approximation.
- Full E2E certification (runtime code changed) has not been run here.

## 17. GO / NO-GO

**NO-GO** for declaring the physical crash fixed until the physical iPhone retest
(translation off *and* on) passes. Automated status here is green: `tsc` 0,
`vitest` 771/771, `npm run build` exit 0. The data-integrity rules hold:
browser-translated labels never become database values, low-accuracy GPS never
becomes trusted evidence, and the RangeError is neither hidden nor swallowed
(surfaced through a safe boundary with a diagnostic ID).
