# Field Action Reason Localization — Report

Date: 2026-07-27. Resolver Localization Stage 1 (Field Action reasons only).
Companion: `Field_Action_Reason_Audit.md`.

1. **Targeted audit baseline:** field-action prose lived in `field-economics.ts`
   (file total 23). Global resolver baseline 527.
2. **Existing decisions (unchanged):** add_expense/add_harvest/review_breakdown/
   view_history always available; add_revenue needs an active season;
   allocate/correct/reverse/export_report are online-only. Verified by
   characterization tests incl. the full online×season truth table.
3. **Stable code contract:** `FieldActionReasonCode = 'AVAILABLE' | 'OFFLINE_ONLY'
   | 'NO_ACTIVE_SEASON'` (only codes with a real decision; documented).
4. **Metadata contract:** `{ actionType: FieldAction }` — canonical token only, no
   localized text, no farmer data.
5. **Characterization tests:** `field-actions.test.ts` proves decisions before/after
   are identical; the old boolean truth table is re-derived and asserted.
6. **Translation keys:** `fields.actions.reasons.{offlineOnly,noActiveSeason,
   unavailable}`, `fields.actions.labels.*` (9), `fields.actions.lastSyncedAt`
   (×4, real nl/pl/de).
7. **Presentation adapter:** `src/i18n/adapters/field-action.ts` —
   `translateFieldActionReason(t, availability)`; exhaustive switch with a
   compile-time `never` guard (adding a code fails to compile) AND a safe runtime
   `unavailable` fallback (never a raw code). Pure resolver imports no i18n/React.
8. **FieldActionsBar integration:** labels, reason (tooltip + aria-label), and the
   offline last-synced banner all localized; enabled/disabled state, action IDs,
   routes and offline gating unchanged.
9. **Offline behavior:** unchanged — online-only actions stay disabled offline;
   the reason is code-driven; last-synced date is locale-formatted; no action
   becomes available because text changed. Offline drafts/idempotency untouched
   (resolver has no queue involvement).
10. **Security:** the resolver takes only `{ online, hasActiveSeason }` — no
    farmId, no record identifiers; metadata carries only the canonical action
    token. Server-side availability remains authoritative; no cross-farm exposure.
11. **Unit tests:** `field-actions.test.ts` (characterization, codes, no-prose,
    adapter translations ×4, unknown-code fallback, canonical IDs). Full suite
    **888 passed**.
12. **Component tests:** covered via the adapter + resolver unit tests (the
    project has no separate RTL harness for this component); the Playwright spec
    covers rendered disabled state + localized reason.
13. **Focused Playwright:** `e2e/i18n-field-action-reasons.spec.ts` — Flow A
    (offline disables online-only action with the Dutch reason, no code leak),
    Flow B (no active season → localized reason, nothing created), Flow E
    (mobile 390/430, wrap, no overflow, no code leak). **Not executed here.**
14. **Global resolver count:** 527 → **522**; `field-economics.ts` 23 → **18**;
    `field-actions.ts` = **0**.
15. **Remaining resolver groups:** field-health (22), field-economics break-even/
    completeness/budget (18), field-economics-detail (23), farm-economic-signals
    (22), cost categories, plus `lib/actions/*` error prose — ≈500 total.
16. **GO/NO-GO:** **Field Action resolver localization — GO at code level**
    (targeted resolver audit = 0, codes + 4-locale translations, decisions/
    security/offline unchanged, 888 tests + build green). **Browser NOT verified**
    — the Playwright spec was not executed here (no live server + Postgres + Clerk
    pool); run it before claiming browser PASS.

Honest status: **"Field Action resolver localization — GO. Global resolver
localization — still NO-GO pending Field Health, break-even, completeness, budget
and economic signals."**
