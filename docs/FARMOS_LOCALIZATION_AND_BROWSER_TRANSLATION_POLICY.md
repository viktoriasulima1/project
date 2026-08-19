# FarmOS Localization & Browser-Translation Policy

Date: 2026-07-23. Written after a physical iPhone test where Google Translate
(English → Russian) was active and the app both crashed and submitted a
translated label as a domain value.

## A. Native FarmOS localization vs. B. Browser page-translation

**A. Native localization** is the authoritative system. UI strings (labels,
messages, help text) come from the application and may be translated into
supported languages. Only labels are localized — never the underlying values.

**B. Browser automatic page-translation** (Google Translate, Safari/iOS
Translate, Edge) is a client convenience that rewrites visible text nodes in the
DOM after the page renders. It is **not** part of FarmOS's localization system
and must never become authoritative. It can mutate the DOM in ways React does
not expect.

The farmer keeps the ability to use browser translation. We do not disable it
globally. We make the application correct and resilient whether it is on or off.

## Rules

1. **Canonical domain values are language-independent.** Enum tokens such as the
   crop condition (`good` | `satisfactory` | `poor` | `critical`) and observation
   severity (`low` | `moderate` | `high` | `critical`) are English tokens stored
   and validated as-is. See `src/lib/scouting/condition.ts`.

2. **Only labels may be localized.** The visible option text is presentation.
   `CROP_CONDITION_LABELS` maps a canonical token to a display label; a real
   locale table can replace it per language.

3. **Browser translation must not affect the submitted value.** Every
   `<select>`/radio binds `option.value` (or the controlled React value) to the
   canonical token, *never* to text content. Translating the label changes what
   the farmer reads, not what is submitted. Server input is additionally
   normalised (`normalizeCropCondition`, accepting only canonical tokens plus
   explicit legacy aliases) and validation errors are mapped to friendly
   field-level messages — the raw `expected one of ...` enum text is never shown.

4. **Interactive controls use stable accessible labels/IDs.** Application logic
   keys off `id`, `name`, `value`, and ARIA roles — never off translated visible
   text. No code path uses `textContent`, translated `querySelector` results,
   child-node structure, or text-node identity to derive a domain value.

5. **Known external DOM-mutation risk.** Browser translation replaces text nodes
   with `<font>` wrappers and re-runs on every re-render. React can throw while
   reconciling replaced nodes, and a form whose change handler writes state on
   every input can be driven into an unbounded update loop. Mitigations in place:
   idempotent effects and identical-state guards (`src/lib/runtime-safety.ts`),
   a re-entrancy guard around synthetic draft-restore events
   (`ActivityDialog`), and route error boundaries that show a safe fallback with
   a copyable diagnostic ID instead of a white screen.

6. **Route/component areas tested with a translation simulation.** `/scouting`
   and the Activity dialog are covered by a Playwright "translated-DOM" flow
   (`e2e/physical-mobile-runtime.spec.ts`, Flow E) that wraps text nodes in
   `<font>` and stamps `translated-ltr`, then performs form updates and asserts
   no crash. This simulation is explicitly **not** a substitute for a physical
   translated-browser retest.

7. **Highly-interactive regions prefer native localization.** Where a region is
   too interactive to safely tolerate live DOM translation, prefer shipping a
   native translation of its labels over relying on the browser. We do **not**
   blanket-disable translation for the whole app.

## Future native-language priority

1. Dutch (nl-NL) — primary operating region (RVO / Ctgb compliance context).
2. English (en) — current default.
3. German (de), French (fr) — neighbouring cross-border operators.

Until native locales ship, browser translation remains available and the value
contract above guarantees it cannot corrupt stored data.

## Native localization — update 2026-07-23

Native localization now exists (dependency-free i18n core, `src/i18n/`; see
`FarmOS_Localization_Architecture.md`). Supported: nl-NL (default), en-GB
(fallback), pl-PL, de-DE. A clear `LanguageSwitcher` (sidebar + sign-in) replaces
any need for browser translation. Canonical enum values are rendered through
`getEnumLabel` with `option.value` bound to the canonical token, so browser
translation cannot alter a submitted value — the exact iPhone defect, now
structurally prevented. The post-iPhone state-loop guards remain in place.
Browser translation is still **not** globally blocked; targeted `translate="no"`
is reserved for controls proven unsafe under external DOM mutation and must be
documented per use (accessibility/product trade-off). Native localization is the
authoritative system; browser translation is a convenience only.
