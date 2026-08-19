# Field Resolver Localization — Report

Date: 2026-07-27. Companion: `Field_Resolver_Localization_Audit.md`.

Honest scope: this brief asked to refactor the domain resolvers to stable codes +
metadata, translate them ×4, add adapters, integrate Field Detail / Dashboard /
Insights, and extend the audit. That is a large, multi-iteration refactor of
shared contracts that must preserve every decision. **This iteration delivered the
keystone — the resolver audit tool + measured baseline — not the refactor.**

## 1. Audit of English prose (Part 11 — DONE)
New `npm run i18n:audit -- resolvers` scans `src/lib` for domain prose (label
maps, `explanation`/`reason`/`recommendation`/`message`/`title` props, and bare
English sentences passed positionally). **Baseline: 527 strings / 98 files.**
The Part-2..10 target resolvers (field-health, field-economics, break-even/
completeness/budget, cost-category, field-action, economic-signals) are ≈90+ of
those. Suppressible via `i18n-audit-ignore`. Unit-tested
(`resolver-audit.test.ts`): flags sentences, ignores canonical tokens/paths.

## 2–4. Code contracts / metadata / business-logic preservation
**NOT done.** No resolver was refactored this iteration, precisely to avoid a
half-applied change to shared contracts (field-health/economics feed Field
Detail, Dashboard, Insights and the Daily Briefing) without the characterization
tests Part 4 requires and without runnable E2E here. The audit doc records the
target return shapes and the intended code families (HEALTHY / NEEDS_ATTENTION /
BREAK_EVEN_MISSING_YIELD / MISSING_LABOUR_RATE / OVER_BUDGET / ACTION_OFFLINE_ONLY
…) for the follow-up.

## 5–13. Namespaces / adapters / integration / cost categories / tests
**NOT done** (depend on the refactor). Existing translations, `getEnumLabel`, and
the `errors`/`enums` namespaces remain the foundation the adapters will build on.

## 14. Playwright
`e2e/i18n-field-resolvers.spec.ts` — **not written** this iteration (nothing to
assert until the resolvers are refactored).

## 15. Unit tests
+3 this iteration (resolver-prose heuristic + the field-health blind-spot guard).
Full suite **884/884**. Business-logic characterization tests (Part 4) are the
first step of the actual refactor — **not yet added**.

## 16–17. Validation / full E2E
`i18n:validate` ✓ · `i18n:audit-options` ✓ · `i18n:audit -- resolvers` = **527**
(the debt, by design) · `tsc` 0 · `vitest` **884/884** · `npm run build` 0. Full
E2E **not executed here**.

## 18. Remaining strings
527 domain-prose strings (98 files); ≈90+ in the Part-2..10 target resolvers. Plus
the earlier deferred items (Field Detail economics/history sections, onboarding
Server-Action codes, BRP, Field Map spec execution).

## 19. Physical device status
Not applicable / not tested.

## 20. GO / NO-GO
**NO-GO** for resolver localization: pure resolvers still return final English
prose (527 strings; the tool now measures and can gate it, but zero is not
reached). The deliverable is the **audit tool + honest baseline + classification**
— the keystone that makes the refactor measurable and enforceable, exactly as the
broad `i18n:audit` did for components.

## Recommended path (for the next iterations)
Refactor **one resolver per iteration**, smallest-blast-radius first:
1. `field-action` reasons (1 consumer: `FieldActionsBar`) — codes + adapter.
2. `field-health` (explanation/recommendedAction/labels → codes + `getEnumLabel`)
   — shared by Field Detail + Dashboard + Insights; add characterization tests
   FIRST (Part 4), then the adapter, then wire all consumers.
3. break-even / completeness / budget in `field-economics`.
Each ends by driving that file's `i18n:audit -- resolvers` count to zero.
