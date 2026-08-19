# Break-even E2E failure triage

Date: 2026-07-27. Evidence reviewed for all five failed tests: screenshots,
video/trace artifacts, `error-context.md`, rendered field route, active locale,
visible Break-even section, and seed state.

| Flow | Classification | Cause and resolution |
|---|---|---|
| A — available | Fixture + assertion defect | Costs existed but harvest and field sale price did not. The seed now has compatible 40-tonne harvest and €2,000/40-tonne sale; canonical availability is checked before opening the exact field ID. |
| B — missing harvest | Fixture + assertion + product defect | Removing the active season introduced competing `INCOMPLETE_COST`; an empty harvest aggregate also collapsed to zero. The variant now keeps costs/sale price and omits only harvest. |
| D — Finance consistency | Fixture + assertion defect | Incomplete seed plus raw-document regex. The test checks canonical result, localized Field Detail, and Finance's shared source row. Finance has no Break-even card, so none was fabricated. |
| F — 390×844 | Assertion defect | Overflow passed; `page.content()` matched RSC/catalog keys. Visible/accessibility-only helper passes. |
| F — 430×932 | Assertion defect | Same assertion location; German text wrapped and cards remained reachable. |

No route leakage, cross-farm disclosure, or Break-even translation defect was
found.

## Raw HTML versus visible UI

`page.content()` includes Next.js RSC scripts, route payloads, and translation
catalog keys. Stable codes there are contracts, not secrets. `getVisibleBodyText`
checks rendered `body.innerText()` plus visible `aria-label` and `title`
metadata, excluding hidden/aria-hidden/inert/non-visible elements.
`expectNoVisibleDomainCodeLeak` enforces that codes never appear in visible text,
accessible names, tooltips, buttons, or raw user errors.

## Corrections

- Added `break-even-section`, harvest metric, and yield/ha metric selectors.
- Added `harvestRecorded` and `harvestRecordCount` evidence.
- No harvest rows → `Not recorded`; explicit zero → zero; positive rows → actual.
- Canonical E2E reads refuse non-test DBs and scope by user/farm/exact field.
- Economic History now receives an explicit locale, fixing a real hydration
  mismatch exposed by rerun.
- Remaining English Field Detail debt: Total recorded cost, Cost/hectare, Data
  completeness, Cost breakdown, Direct vs allocated, Budget vs actual, Source
  records, Economic history, Purchase history.

## Validation

- Before: **1 passed / 5 failed**.
- Individual: Flow A 2/2, Flow B 2/2, Flow D 2/2, Flow F 3/3 (setup included).
- First combined rerun: 5/6; Flow A was Clerk/FAPI timeout after four provider
  attempts, not an application assertion failure.
- Final focused: **6/6 PASS**, 0 failed, 0 flaky, retries 0, **1.1 min**.
- TypeScript PASS; Prisma current (22 migrations); production build PASS.
- Unit: **922/922 PASS**, 84 files.
- i18n validation: 4 locales/9 namespaces/0 warnings; options audit PASS.
- Targeted Break-even audit: **5 → 0**. Global known debt: **505**.
- Regression: locale hydration **5/5**; Field Health **5/7** (unrelated
  locale/state and map-selector failures); Field Actions **2/4** (two tests
  navigate after forcing offline and receive `ERR_INTERNET_DISCONNECTED`).

**Break-even resolver localization — browser GO. Financial Completeness stage
may begin.**

This GO is limited to the focused Break-even gate; unrelated regression/global
debt is not represented as passing.
