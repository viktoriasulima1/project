# Field Map ↔ Sidebar Overlap — Audit

Date: 2026-07-24. `/fields/map`: the Leaflet map and its controls render over the
open FarmOS sidebar/drawer (most visible at the ≤767px drawer breakpoint, e.g.
732×847). This is a stacking/layout defect, not localization.

## Layout as-found

| Element | File | Positioning |
| --- | --- | --- |
| `.shell` | AppShell.module.css | `display:flex; min-height:100vh` — **correct desktop push layout** |
| `.content` | AppShell.module.css | `flex:1; min-width:0; overflow-y:auto` — correct main column |
| `.sidebar` (desktop) | Sidebar.module.css | `position:sticky; width:216px` — in-flow, **no z-index** |
| `.sidebar` (≤767) | Sidebar.module.css | `position:fixed; z-index:100; translateX(-100%)` drawer |
| `.backdrop` (≤767) | Sidebar.module.css | `position:fixed; inset:0; z-index:99; rgba(0,0,0,.35)` |
| `.mobileToggle` | Sidebar.module.css | `position:fixed; z-index:110` |
| `.mapPanel` | Operations.module.css | `position:relative; min-width:0` — **relative WITHOUT z-index/isolation** |
| `.map` | Operations.module.css | `min-height:560/380px` — no `100vw` |
| `.locationBar` | Operations.module.css | `position:absolute; z-index:500` (inside mapPanel) |
| Leaflet panes/controls | leaflet.css | tiles 200 … markers 600 … popups 700 … controls ~1000 |

## Exact root cause

`position: relative` **without** a z-index (or `isolation`) does **not** create a
stacking context. So `.mapPanel`'s descendants — Leaflet's panes and especially
its **controls (z-index ≈ 1000)** and the `.locationBar` (z-index 500) —
participate directly in the **shell** stacking context, where they out-rank the
sidebar (100) and backdrop (99). Result: Leaflet controls/tiles paint **over** the
open drawer and remain hittable underneath it. The desktop `.shell` flex layout
was already correct — the map was never actually mis-sized; its z-index simply
escaped the map region.

Contributing: the desktop sidebar had no explicit z-index, and the backdrop was
only 35% opaque (map visibly showed through).

## Fix (root cause, not z-index whack-a-mole)

1. **Isolate the map** — `.mapPanel { isolation: isolate; z-index: 0 }` makes it a
   stacking-context root, so **all** Leaflet z-index values are contained inside
   the map region and can never exceed the app nav layers, regardless of Leaflet's
   internal numbers.
2. **One documented layer scale** (globals.css tokens): `--z-fab: 20` <
   `--z-map-backdrop: 90` < `--z-sidebar: 100` < `--z-nav-toggle: 110` <
   `--z-dialog: 200`. Sidebar (desktop + mobile), backdrop, toggle and FAB now use
   these; the map sits at z:0 inside its isolate.
3. **Drawer covers + disables the map** — backdrop opacity 0.35 → 0.55 and it sits
   at `--z-map-backdrop` (above the isolated map + the FAB), so it visually hides
   the map and **intercepts every click/tap** while open. The FAB (`--z-fab` 20)
   is below the backdrop → non-interactive when the drawer is open.
4. **Drawer a11y** — Escape closes the drawer and returns focus to the toggle
   (bounded listener, attached only while open).
5. **Bounded resize** — `FieldOperationsMap` gets a `ResizeObserver` →
   `invalidateSize`, guarded to fire only on a **real** width/height change and
   throttled by one `requestAnimationFrame`, with observer + rAF cleanup — so it
   cannot drive a ResizeObserver / call-stack loop.

No Leaflet removal, no `z-index: 999999`, no map redesign, no geometry/GPS change.
