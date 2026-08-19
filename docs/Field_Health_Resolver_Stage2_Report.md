# Field Health Resolver Localization — Stage 2 Report

> **FINALIZED by Stage 2B (2026-07-27).** The "PARTIAL GO / prose retained" verdict
> below is **superseded**: `Field_Health_Resolver_Finalization_Report.md` records the
> completed migration — resolver is prose-free, all consumers use codes, targeted
> audit = 0 (22 → 0). This file is kept for historical context.

Date: 2026-07-27. Sibling of `Field_Resolver_Localization_Report.md` (Stage 1 =
Field Action reasons). Scope: **Field Health only.** No economics/break-even/
budget/completeness work (explicitly out of scope this iteration).

## Verdict: PARTIAL GO — display path localized, prose retained (documented NO-GO)

The Field Health **display path is now fully code-driven and localized in all four
locales**. The resolver's English prose is **retained**, so the *targeted*
`i18n:audit -- resolvers` on `field-health.ts` is **NOT zero** (22 hits). This is
deliberate and safe, not an oversight — see §4.

## 1. What shipped (GO)

- **Stable code contract (additive).** `resolveFieldHealthStatus` now returns
  `reasonCode` (9-member union), `actionCode` (5-member union), a numeric
  `priority` derived from status, and canonical `metadata`
  (`openObservationCount`, `severeObservationCount`, `daysSinceStage`,
  `weatherRisk`). **No decision, threshold, severity, priority ordering, GPS or
  scouting logic changed** — the branch structure is byte-for-byte the same; only
  new fields were attached to each branch's result.
- **Translations ×4.** `messages/<locale>/fields.json → health.{status,reasons,
  actions}` for nl-NL, en-GB, pl-PL, de-DE. Two reason strings interpolate
  `{count}`; placeholder parity is enforced by the existing `diffNamespace` test.
- **Presentation adapter.** `src/i18n/adapters/field-health.ts` maps codes →
  localized text at the UI boundary (resolver imports no i18n). Unknown runtime
  codes degrade to a safe status label — **never a raw code** (asserted).
- **Field Detail wired.** `src/app/(farm)/fields/[id]/page.tsx` now renders
  `statusLabel` / `reason` / `actionLabel` from the adapter instead of the English
  `FIELD_HEALTH_LABELS` map and `health.explanation` / `.recommendedAction`.
- **Tests: 902 pass** (was 888; +14). Characterization tests lock the
  decision→code mapping per branch (`field-health.test.ts`); adapter tests prove
  every code resolves to non-code text in all four locales, count interpolation,
  and the unknown-code fallback (`fields-localization.test.ts`). `tsc --noEmit`
  clean.

## 2. Incidental fix (build hygiene)

`e2e/i18n-field-action-reasons.spec.ts` (Stage 1) called `seedEconomicsFarm` with
a third argument the helper didn't accept (`{ withActiveSeason: false } as never`)
→ a real `TS2554` that had been red in the main `tsc` project. Fixed properly by
adding a genuine `withActiveSeason?: boolean` option to `seedEconomicsFarm` (when
false it unlinks the field's season so Field Detail resolves `hasActiveSeason=
false`) and removing the `as never` cast. The flag now does what it claims.

## 3. Not done / still English (NO-GO, honest)

- **Targeted resolver audit is NOT zero** — 22 prose hits remain in
  `field-health.ts`, by design (§4).
- **Other Field Health surfaces still use the old English path**:
  `FieldOperationsMap.tsx`, `fields/map/page.tsx`, `scouting/page.tsx` still read
  `FIELD_HEALTH_LABELS[...]` / `health.explanation`. Only **Field Detail** was
  migrated this iteration. Migrating them is mechanical follow-up (swap to the
  adapter), deferred to keep this change reviewable.
- **No E2E executed.** No live server / Postgres / Clerk pool here; the Playwright
  gate stays documented, not run. No physical-device retest.

## 4. Why the prose stays (the load-bearing constraint)

`src/lib/farm-insights.ts` consumes `health.explanation`, `health.primaryEvidence`
and `health.status` as **canonical facts that flow into the AI Daily Briefing**
(`src/lib/ai/briefing.ts` → `GroundedBriefingCard.tsx`). Removing the prose to reach
audit-zero would break those grounded facts unless the Insights/Briefing pipeline
is migrated to the codes first. That migration is a separate, higher-blast-radius
change and remains a **documented NO-GO** for this iteration. The additive contract
shipped here is exactly the foundation that migration needs: once Insights/Briefing
read `reasonCode`/`metadata` instead of prose, the four prose fields can be deleted
and the targeted audit reaches zero.

## 5. Follow-up (ordered)

1. Migrate `farm-insights.ts` (and briefing) off `.explanation`/`.primaryEvidence`/
   `.recommendedAction` onto `reasonCode` + `metadata` (+ characterization tests on
   the briefing facts).
2. Delete the four prose fields + `FIELD_HEALTH_LABELS` from the resolver → targeted
   audit zero.
3. Migrate the remaining display surfaces (map, scouting) to the adapter.
4. Run the Playwright specs in a provisioned E2E environment.
