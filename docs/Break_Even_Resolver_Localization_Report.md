# Break-even Resolver Localization — Report (Stage 3)

## Browser closure — 2026-07-27

Focused Playwright: **6/6 PASS**, retries 0, 0 flaky, 1.1 min. Unit **922/922**,
TypeScript/build/Prisma/i18n validation PASS. Missing harvest renders `Not
recorded`; explicit zero remains distinguishable. Full evidence:
`Break_Even_E2E_Failure_Triage.md`.

**Break-even resolver localization — browser GO. Financial Completeness stage
may begin.**

Date: 2026-07-27. Companion: `Break_Even_Resolver_Audit.md`. Scope: **Break-even
only** — not general completeness, budget variance, cost categories or the other
economic signals.

## Verdict

**Break-even resolver localization — GO.**
**Global resolver localization — still NO-GO** pending completeness, budget
variance, cost categories and remaining economic signals.
**Browser verification — NO-GO (not executed here):** specs written, no live env,
no device retest.

## 1. Targeted audit baseline

`breakEvenExplanation` (`src/lib/field-economics.ts`) held **5** audit-flagged
English blocking reasons (plus 2 non-flagged formula strings and a `€/unit`
string). Global resolver prose **510** before. The numeric
`resolveFieldEconomics.breakEvenPrice/breakEvenYield` was already code-only.

## 2. Characterization behavior (Part 2)

Every eligibility decision, value and blocking reason is locked in
`field-economics.test.ts` (Stage 3 block): complete data, missing yield, **zero
yield** (no divide-by-zero), missing sale price (distinct from harvest), unit
mismatch, incomplete cost, unallocated remainder, and "no fabricated 0". All
pre-existing numeric assertions (77.5, 23.25) preserved; none changed.

## 3–6. Contract (status / reasons / metadata / discriminated union)

`breakEvenExplanation` now returns:

```
BreakEvenExplanation { price: BreakEvenComputation; yieldValue: BreakEvenComputation }
BreakEvenComputation  { available: boolean; value: BreakEvenValue | null; reasonCodes: BreakEvenReasonCode[] }
BreakEvenValue        { result; totalCost; divisor; yieldUnit; formulaCode }
```

- `BreakEvenReasonCode` = `INCOMPLETE_COST | MISSING_HARVEST | MISSING_SALE_PRICE |
  INCOMPATIBLE_UNITS | UNALLOCATED_COSTS` — exact current rules, no speculative codes.
- `BreakEvenFormulaCode` = `COST_PER_YIELD | COST_PER_PRICE` (replaces the English
  formula string).
- Removed prose fields: `formula: string`, `unit: string`, `priceReasons: string[]`,
  `yieldReasons: string[]`, and the `REASON` label map.
- **Money stays EUR floats with the same `round2`** (the codebase does not use
  integer cents here; not changed). Missing inputs stay `null`/absent — never 0.

## 7. Action codes

Derived at the adapter (presentation), not the resolver (break-even has no CTA in
the domain today): `INCOMPLETE_COST→ADD_COST`, `MISSING_HARVEST→ADD_HARVEST`,
`MISSING_SALE_PRICE→ADD_SALE_PRICE`, `INCOMPATIBLE_UNITS→ALIGN_UNITS`,
`UNALLOCATED_COSTS→REVIEW_ALLOCATIONS`. No new routes/workflows; rendered as a short
localized hint next to the blocking reason (the display previously showed the
reason sentence only).

## 8. Translation adapter (Part 9/15)

`src/i18n/adapters/break-even.ts` — `buildBreakEvenDisplayModel(t, locale, result)`.
Exhaustive `switch`es (reason/action/formula) whose `default` assigns to `never`
(adding a code fails `tsc`); unknown runtime codes degrade to a safe empty label,
never a raw code. Locale-aware `formatCurrency`/`formatNumber` (value unchanged;
nl-NL/de/pl separators and currency placement follow the locale). Keys under
`fields.economics.breakEven.{title,price,yield,unavailable,formula,reasons,actions}`
in all four locales.

## 9. Field Detail integration (Part 10)

`fields/[id]/page.tsx` renders the break-even section entirely from the display
model (heading, price/yield value + formula, unavailable + localized reason +
action hint). No fabricated €0, no fake yield, no English fallback; the resolver
output and (absent) action destination are unchanged.

## 10. Finance integration (Part 11)

Finance's only break-even reference is a warning sentence in the (still-English)
finance page; it does not render the prose resolver. Field Detail (adapter) and
Finance (numeric `resolveFieldEconomics.breakEvenPrice`) are proven to share the
same canonical value by a unit consistency test (both = 30 for the shared fixture).

## 11. Dashboard / Insights (Part 12)

The `econ-breakeven-above-sale` signal (`farm-economic-signals.ts`) consumes the
**numeric** `breakEvenPrice` (already a code/number), not the prose resolver. Its
English `explanation` belongs to the economic-**signals** resolver, which is
explicitly out of scope this iteration (and is all-English, like the other
signals). Documented as remaining debt; no change.

## 12. Reports / exports (Part 13)

CSV/economics exports carry the **numeric** `breakEvenPrice/breakEvenYield`
(canonical, unchanged). No break-even prose is exported or persisted; no historical
export is rewritten; no Prisma migration.

## 13. Missing-data honesty (Part 14)

Preserved and regression-tested: missing yield → `MISSING_HARVEST`, `value: null`
(not 0); zero yield treated as missing (no divide-by-zero); missing sale price is a
distinct code from missing harvest; unallocated remainder blocks; incomplete cost
blocks. No missing value becomes a fabricated zero.

## 14. Unit results

- `npx tsc --noEmit` clean · `npx vitest run` **916 passed** (was 908; +8) ·
  `npm run build` compiled · `i18n:validate` 4 locales / 9 namespaces / 0 warnings.
- Placeholder parity + four-locale coverage for `economics.breakEven.*` enforced by
  the `fields` `diffNamespace` test; adapter/consistency/unknown-code covered by
  `break-even-localization.test.ts`.

## 15. Resolver audit before/after (Part 16)

- Global resolver baseline **before: 510**.
- Targeted Break-even **before: 5 → after: 0.**
- New global resolver total: **505** (−5).

Targeted files: 0 English prose, 0 English label maps, 0 reason/explanation/message
strings, 0 positional English arguments, 0 undocumented suppressions.

## 16–17. Focused + regression E2E

`e2e/i18n-break-even.spec.ts` written (Flows A available, B missing-yield/no-€0,
D Finance consistency, F mobile 390/430). Regression specs
(`i18n-field-health`, `i18n-field-action-reasons`, `locale-hydration`,
`i18n-onboarding`) unchanged. **None executed here** (no live env).

## 18. Remaining resolver groups (still English)

completeness actions, budget variance rows, cost categories (`COST_CATEGORY_LABEL`),
gross-margin note, field-economics-detail cost-breakdown/allocation-history labels,
`farm-economic-signals` (incl. `econ-breakeven-above-sale` explanation),
`weather-risk`, `spray-window`, `user-error`. **Global resolver localization stays
NO-GO.** Not started this iteration, per scope.

## 19. Physical-device status

No physical device retest performed.

## 20. GO / NO-GO

| Criterion | Status |
|---|---|
| break-even resolver no final English prose | ✅ |
| all blocking reasons use stable codes | ✅ |
| all actions use stable codes | ✅ (adapter) |
| four-language translations | ✅ |
| calculations/rounding unchanged | ✅ (tests) |
| Field Detail & Finance same canonical result | ✅ (consistency test) |
| missing values never fabricated zero | ✅ |
| targeted Break-even audit = 0 | ✅ |
| no raw code reaches the UI | ✅ (adapter + tests; browser pending) |
| browser tests pass before browser GO | ⛔ not executed — no browser GO claimed |

This report is the canonical record of the Break-even finalization for
`Field_Resolver_Localization_Audit.md`, `FarmOS_Localization_Audit.md`,
`FarmOS_Multilingual_Report.md`, `BETA_ACCEPTANCE_CHECKLIST.md` and
`FarmOS_Feature_Implementation_Matrix.md`.
