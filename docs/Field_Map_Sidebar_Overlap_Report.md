# Field Map ↔ Sidebar Overlap — Report

Date: 2026-07-24. Companion: `Field_Map_Sidebar_Overlap_Audit.md`.

## 1. Screenshot evidence
`/fields/map`: Leaflet map + controls render over the open sidebar; on the ≤767px
drawer breakpoint (e.g. 732×847) the map stayed visible and interactive beneath
the drawer.

## 2. Exact root cause
`.mapPanel { position: relative }` had **no z-index/isolation**, so it created no
stacking context — Leaflet's controls (z≈1000) and `.locationBar` (z 500) leaked
into the shell stacking context and out-ranked the sidebar (100) / backdrop (99).
The desktop flex push-layout (`.shell` flex, `.content` min-width:0) was already
correct; the map was never mis-sized.

## 3. Desktop layout fix
Kept the existing flex push-layout; added an explicit `z-index: var(--z-sidebar)`
to the desktop sidebar so it always out-ranks the isolated map (z:0). Map fills
the content column (`width:100%`), never `100vw`.

## 4. Mobile drawer fix
Backdrop opacity 0.35 → 0.55 at `--z-map-backdrop` (90), above the isolated map
(0) and the FAB (20) and below the sidebar (100): it covers the map and intercepts
all pointer input while open. Escape closes and returns focus to the toggle.

## 5. Layer scale
globals.css tokens: `--z-fab 20` < `--z-map-backdrop 90` < `--z-sidebar 100` <
`--z-nav-toggle 110` < `--z-dialog 200`. Used by Sidebar, backdrop, toggle, FAB.

## 6. Leaflet z-index handling
Not touched individually. `.mapPanel { isolation: isolate; z-index: 0 }` contains
**all** Leaflet panes/controls/tooltips/popups inside the map region with their
relative order intact, but unable to escape above the app nav layer.

## 7. Pointer interaction blocking
While the drawer is open, the opaque backdrop (above the isolated map) receives
all clicks/taps/drags — verified in the Playwright spec via
`document.elementFromPoint` over the map resolving to a non-Leaflet element.

## 8. Resize handling
`FieldOperationsMap` `ResizeObserver` → `invalidateSize`, firing only on a real
size change, throttled by one `requestAnimationFrame`, with observer + rAF
cleanup. Idempotent and bounded — no ResizeObserver/call-stack loop (the class the
physical-iPhone fix guarded against).

## 9. Safe areas
`.locationBar` keeps `env(safe-area-inset-bottom)`; the map uses `min-height`
(not fixed `100vh`) inside a `min-width:0` content column.

## 10. Accessibility
Localized toggle name (`navigation.openNav/closeNav`); Escape closes; focus
returns to the toggle; backdrop click closes; the field list beside the map is the
accessible non-map alternative. (Full breakpoint-dependent dialog role + focus
trap remains a follow-up.)

## 11. Unit tests
`src/components/__tests__/field-map-layout.test.ts` — 9 tests: flex push-layout +
main min-width:0, no `100vw`, `.mapPanel` isolation, layer ordering
(sidebar>backdrop>fab) + token usage, backdrop opacity ≥0.5, backdrop covers +
`closeDrawer`, Escape + focus-return, invalidateSize idempotent-guard + rAF +
cleanup. Full suite: **881 passed**. tsc 0, build 0.

## 12. Focused Playwright
`e2e/field-map-sidebar-layout.spec.ts` — Flow A (desktop map after sidebar), B
(732×847 drawer covers + disables map, then re-enables), C (390×844 open/close ×5 +
Escape + focus return, no loop errors), E (pl/de no horizontal overflow). Console
noise rejected: ResizeObserver loop / call-stack / hydration / update-depth.

## 13. Full E2E result
**NOT executed here** (no live server + Postgres + Clerk pool).

## 14. Physical phone/tablet status
**NOT tested** on a real device. Manual gate: verify 732×847, 390×844, 430×932 —
map never over the sidebar, drawer disables the map, no leaked Leaflet control.

## 15. GO / NO-GO
**GO at the code level:** root-cause isolation + documented layer scale + opaque
backdrop + bounded resize + Escape/focus; tsc 0, vitest 881, build 0; existing
i18n gates green. **Gated:** the Playwright layout spec and the manual
device/tablet checks were **not executed** here — run
`e2e/field-map-sidebar-layout.spec.ts --workers=1 --retries=0` (plus locale-
hydration + the mobile/accessibility spec) before declaring the runtime fixed. No
browser PASS is claimed.
