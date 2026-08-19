# Financial Completeness resolver localization report

## Final closure — 2026-07-28

**Financial Completeness resolver localization — full stage GO.  
Global resolver localization — still NO-GO pending Budget Variance, Cost
Categories, Gross Margin and remaining resolver groups.**

### Canonical contract and surfaces

The frozen contract contains four statuses, eight deterministic checks, ordered
recorded codes, ordered reason objects, ordered action codes, percentage and
numeric metadata. It contains no final UI prose. Field Detail and Finance both
render each field's `completenessResult` through the same exhaustive adapter.
Finance exposes `finance-completeness-section/status/reasons/actions`; no
separate Finance resolver or raw stable code was introduced.

### Fixture evidence

| Fixture | Canonical evidence | Browser evidence |
|---|---|---|
| Complete | `profitability_ready`, 100%, all 8 recorded codes | Field Detail and Finance agree |
| Missing purchase price | `MISSING_PRODUCT_PRICE`, `ADD_PURCHASE_PRICE`, 88%, unpriced count 1, field cost `null` | 4 locales, no fabricated €0, Inventory action reachable |
| Missing labour rate | `MISSING_LABOUR_RATE`, 88%, one labour activity without rate | operator data unchanged; localized Field/Finance output |
| Missing machinery rate | `MISSING_MACHINE_RATE`, 88%, one machine activity without rate | machine data unchanged; localized Field/Finance output |
| Labour + machinery | reasons/actions in labour-then-machine order, unique, 75% | order unchanged in Polish/German; 390×844 and 430×932 fit |
| Missing harvest | `MISSING_HARVEST`; no row stays `null`/Not recorded | Break-even remains unavailable for the right reason |

The fixture also proves a €275 unallocated cost and €1,200 unallocated revenue
remain outside the target field, and a €300 parent allocation has one active
€180 child plus exact €120 remainder at version 2. The current completeness
resolver has no unallocated-expense, partial-allocation, or
unallocated-revenue reason codes. These flows are therefore **not applicable**
to completeness localization; no new policy/code was invented. Opening Finance
does not mutate or auto-allocate them.

### Reports and exports

Existing CSV output retains canonical status/reason columns and blank missing
values rather than zero. Human-readable completeness presentation uses the
selected locale adapter where present. Identifiers, provenance/checksums,
record counts and historical records are unchanged. This stage did not broaden
into full Reports localization.

### Automated validation

- `i18n:validate`: PASS; 4 locales, 9 namespaces, 0 warnings.
- `i18n:audit-options`: PASS.
- targeted completeness audit: 0; global resolver audit: 486 remaining.
- fields audit: 66; finance audit: 102; completeness component slice: 0.
- Prisma Client generated; 22 migrations, database current.
- TypeScript: PASS.
- Vitest: 85 files, **927/927 PASS**.
- production build: PASS; existing unrelated NFT trace warning remains.
- Financial Completeness Playwright: **11/11 PASS**, 1.7 minutes.
- focused regression gate: **25/25 PASS**, 2.8 minutes.
- final unrestricted Playwright: **153 collected, 152 passed, 1 documented
  conditional pilot-smoke skip, 0 failed, 0 flaky, retries=0, exit 0,
  13.3 minutes**.
- Clerk: 5 users before and after; fixed pool 4 before and after; 0 new users.
- Offline draft sync and service-worker safety specs passed in the same final
  run. No service-worker or IndexedDB state leakage was observed.

Physical iPhone/Android browser validation was not performed by this automated
closure. It remains a separate physical-device acceptance gate and does not
invalidate the scoped resolver-localization GO.

Date: 2026-07-27.

- Stable status/reason/recorded/action contract implemented with deterministic
  ordering and canonical metadata.
- Presentation adapter is exhaustive and localized in nl-NL, en-GB, pl-PL and
  de-DE; unknown runtime reasons use safe localized fallback.
- Field Detail uses semantic test IDs and no resolver prose.
- FinanceData is the single canonical calculation used by Finance and Field
  Detail; CSV retains canonical machine-readable codes.
- Missing harvest remains null/`Not recorded`; explicit zero remains zero.
- Break-even formulas/reasons and financial calculations were unchanged.
- Focused completeness Playwright: **7/7 PASS**, retries 0, 1.3 min.
- Combined focused regressions: **21/21 PASS**, retries 0, 2.9 min.
- Preflight: Field Health 7/7, Field Actions 4/4, hydration 5/5.
- Unit: **927/927 PASS**; TypeScript and production build PASS.
- Targeted completeness prose audit: **0**. Global resolver localization remains
  open; no global-zero claim.

Full unrestricted E2E was not completed in this validation window, so a
whole-suite browser GO is not claimed solely from the focused gates.

**Financial Completeness resolver localization — focused browser GO.
Global resolver localization — still NO-GO pending budget variance, cost
categories, gross-margin and remaining economic signals.**
