# FarmOS Next 30 Product Decisions

## Part 8 — Missing high-value ideas, ranked

**Formula:** Opportunity Score = Farmer Value + Frequency + Willingness to Pay + Differentiation + Retention − Implementation Effort − Legal Risk − Data Dependency. Each dimension scored 1–10 by this audit's own judgment, grounded in the evidence gathered in the other four Sprint 15 documents — not a precision instrument, a ranking signal. Legal Risk here means *risk introduced by building the feature imperfectly* (e.g., a licence-expiry check that's subtly wrong), not risk of *not* having the feature.

| Rank | Idea | Value | Freq | WTP | Diff | Retention | Effort | Legal Risk | Data Dep | **Score** |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Fix Finance page (real query instead of permanent empty stub) | 9 | 8 | 7 | 4 | 8 | 2 | 1 | 1 | **32** |
| 2 | Wire the existing spray-window engine into the activity dialog (planned-application mode) | 8 | 7 | 6 | 7 | 6 | 3 | 3 | 2 | **26** |
| 3 | Real, simple per-field cost/margin view | 8 | 5 | 7 | 5 | 7 | 4 | 1 | 3 | **24** |
| 4 | Operator/spuitlicentie expiry tracking tied to spray validation | 7 | 3 | 4 | 5 | 5 | 2 | 2 | 1 | **20** |
| 5 | Notifications (spray window opening, low stock) | 6 | 5 | 4 | 5 | 6 | 4 | 1 | 2 | **19** |
| 6 | Real LLM-backed AI briefing (upgrade existing rule engine) | 6 | 6 | 5 | 7 | 6 | 5 | 3 | 4 | **18** |
| 6 | Inventory item edit/correction action | 6 | 5 | 3 | 2 | 4 | 1 | 1 | 0 | **18** |
| 8 | Real per-product spray thresholds (extend InventoryItem) | 7 | 5 | 5 | 6 | 5 | 4 | 3 | 4 | **17** |
| 8 | Agronomist/advisor read-only account type | 6 | 3 | 5 | 6 | 6 | 5 | 2 | 2 | **17** |
| 10 | Disease-pressure-aware spray guidance (Dacom-style) | 8 | 5 | 6 | 8 | 6 | 7 | 4 | 6 | **16** |
| 10 | Multi-field bulk activity logging | 6 | 4 | 4 | 5 | 5 | 4 | 2 | 2 | **16** |
| 10 | Voice activity logging | 6 | 5 | 5 | 9 | 5 | 9 | 2 | 3 | **16** |
| 13 | Fix AI Cockpit page (same false-completeness bug as Finance) | 5 | 4 | 3 | 3 | 4 | 2 | 1 | 1 | **15** |
| 13 | Bank-sync cost capture (PSD2 or manual CSV import first) | 7 | 4 | 6 | 6 | 6 | 6 | 3 | 5 | **15** |
| 13 | Dutch number/decimal localization | 4 | 6 | 2 | 2 | 2 | 1 | 0 | 0 | **15** |
| 13 | NVWA inspection package (one-tap PDF export) | 6 | 1 | 4 | 6 | 5 | 3 | 2 | 2 | **15** |
| 17 | Inventory per-product detail/history view | 5 | 5 | 2 | 2 | 3 | 2 | 1 | 0 | **14** |
| 17 | GPS auto-field-detection | 5 | 6 | 3 | 5 | 4 | 6 | 1 | 2 | **14** |
| 17 | Offline-first mobile support | 6 | 5 | 4 | 6 | 6 | 9 | 1 | 3 | **14** |
| 20 | Self-service data export/portability | 5 | 2 | 3 | 3 | 5 | 2 | 2 | 1 | **13** |
| 21 | Dedicated machine management page | 5 | 3 | 2 | 2 | 3 | 2 | 1 | 0 | **12** |
| 21 | Harvest-specific fields (yield, moisture, quality) | 5 | 2 | 3 | 3 | 3 | 2 | 1 | 1 | **12** |
| 23 | CAP eco-scheme activity tracking | 6 | 2 | 5 | 6 | 5 | 5 | 4 | 4 | **11** |
| 24 | Kringloopwijzer export | 6 | 1 | 4 | 7 | 4 | 5 | 3 | 4 | **10** |
| 24 | BRP field auto-import | 7 | 1 | 3 | 8 | 4 | 6 | 2 | 5 | **10** |
| 24 | CTB product-registry dose validation | 7 | 3 | 4 | 7 | 6 | 6 | 5 | 6 | **10** |
| 27 | Task management UI (using the existing, unused Task model) | 4 | 3 | 2 | 2 | 3 | 3 | 1 | 1 | **9** |
| 28 | Satellite/NDVI real data pipeline | 5 | 2 | 4 | 8 | 4 | 9 | 1 | 7 | **6** |
| 29 | Soil data UI (using the existing, unused SoilAnalysis model) | 4 | 2 | 2 | 2 | 2 | 3 | 1 | 3 | **5** |
| 30 | Farm benchmarking (peer comparison) | 3 | 2 | 3 | 5 | 4 | 6 | 2 | 7 | **2** |

**What this ranking says, in plain terms:** the highest-value work available to FarmOS right now is fixing what's already half-built (Finance, the spray engine's disconnection, a few missing CRUD actions) — not adding anything new. Every item most heavily promoted in the strategy documents as a "differentiator" (voice logging, BRP import, CTB validation, satellite/NDVI) ranks in the bottom half once implementation effort and data dependency are honestly weighed against value and frequency. This is not a coincidence — it is what "prefer a smaller excellent product" looks like when quantified.

---

## Part 10 — Domain coverage score (0–100)

| Domain | Score | Evidence |
|---|---|---|
| Agronomy | 25 | Generic activity logging and basic weather only. No disease models, no yield prediction, no soil data surfaced, `ndviScore` column exists and is never populated. |
| Compliance | 55 | Real, E2E-tested spray-diary auto-generation and a real (Sprint 13-fixed) listing page. No CTB validation, no CAP tracking, no NVWA export, no Kringloopwijzer, no operator-licence enforcement. |
| Inventory | 45 | Real stock deduction on activity save, category-specific onboarding fields, unit-tested. No edit/correction action, no per-product detail view, no reconciliation. |
| Activities | 75 | The most mature module in the product: type-first validated flow, inline machine/crop creation, unit- and E2E-tested including mobile and accessibility. |
| Weather | 50 | Real Open-Meteo integration; a genuinely sophisticated spray-window engine exists (0–100 score, fail-closed mode, typed context) but is disconnected from the activity-logging flow and always uses a mock product profile. |
| Finance | 5 | `FinancialSnapshot`/`CropFinancial` models exist; the page never queries them. Functionally absent to a user despite schema readiness. |
| Mobile | 65 | Responsive sidebar (Sprint 12 fix), 44px targets, `inputmode` correctness, E2E-tested on two real viewports, axe-core-passing. No offline, no GPS, no native app. |
| Offline | 0 | Absent entirely — directly contradicts the strategy documents' "offline-first" claim. |
| AI | 10 | Deterministic rule engine only (`generateDailyBriefing`, own code comment admits it was meant to be replaced by a real LLM call and never was). Dedicated `/ai` page is a permanently-empty stub. |
| Machinery | 20 | Inline creation only, during spray logging. No management page, no service-due tracking despite schema fields existing for it. |
| Fields/maps | 30 | Real CRUD, E2E-tested. No maps, no GPS boundaries, no BRP import — fields are entered by hand, one at a time. |
| Onboarding | 80 | The most thoroughly built and tested flow in the product (golden-path, failure-paths, founder-walkthrough all exercise it). Real gaps: BRP import, deeper employee/certificate capture. |
| Security | 70 | Clerk auth, server-verified cross-farm ownership checks on every write path (the one real gap found — missing machineId check — was found and fixed in Sprint 12, then confirmed via isolation E2E tests). No employee-level roles/permissions. |
| Data integrity | 55 | Strong validation (type-conditional `superRefine`, ownership checks) and soft-delete preserving compliance history. No dedicated audit-log table, no self-service data export. |
| Collaboration | 5 | Single implicit owner role. No agronomist access, no employee login, no sharing mechanism of any kind. |
| Integrations | 5 | Open-Meteo only. No BRP, CTB, KNMI, Meststoffen, PSD2, or Kringloopwijzer integration exists anywhere. |
| Reporting | 0 | Absent entirely — no export, PDF, or CSV output of anything in the product. |
| Decision support | 20 | The rule-based briefing and the (disconnected) spray-window engine are real, useful signals where they're actually surfaced. No predictions, no disease models, no connection to the moment of activity logging. |
| Daily usefulness | 55 | The core daily task (recording what happened) is genuinely fast and well-tested. Undermined by two permanently-broken pages (Finance, AI) that a real farmer would hit within their first week. |
| Commercial readiness | 35 | Real E2E/security/accessibility coverage and a real (process-ready, not-yet-executed) pilot framework exist. No real farmer has used the product, no billing exists, and a headline value proposition (Finance) does not function at all. |

**Overall pattern:** the domains scoring highest (Activities 75, Onboarding 80, Mobile 65, Security 70) are exactly the ones this project's own sprint history shows was driven by real E2E testing and real bug-fixing cycles (Sprints 9–14). The domains scoring lowest (Offline 0, Reporting 0, AI 10, Collaboration 5, Integrations 5) are exactly the ones that exist only in the vision documents and have never had a sprint's real attention. The score distribution is itself evidence for this audit's central finding: FarmOS is good at what it has actually built, and the gap is a *building* gap, not a *knowing-what-to-build* gap.

---

## Part 12 — Build / do-not-build decisions

### A. Must build before closed beta (5-farm)

1. Fix the Finance page — real query, even a minimal one, replacing the permanent stub.
2. Fix the AI Cockpit page — same bug class, same fix pattern as the Sprint 13 Compliance fix.
3. Operator/spuitlicentie expiry tracking tied to spray-activity validation.
4. Inventory item edit/correction action (a real pilot farmer will need this in week one).
5. A real farmer pilot session actually happens (Sprint 13/14's own standing condition, restated here because it remains the actual gate, not anything on this list).

### B. Must build before paid launch

6. Wire the existing spray-window engine into the activity dialog (`'planned-application'` mode, real operator/inventory/machine context).
7. A real, simple per-field cost/margin view (does not need to be automatic bank-sync-derived on day one — even a manually-entered-cost version would satisfy the core "which field made money" question).
8. Notifications for spray-window opening and low stock.
9. Multi-field bulk activity logging (spraying the same product across several fields in one pass is a real, common workflow this audit's competitor research repeatedly surfaced).
10. Self-service data export (not just the pilot's manual, ad-hoc process).

### C. Build after first 10 farms

11. BRP field auto-import.
12. CTB product-registry dose validation.
13. Real per-product spray-condition thresholds (extending `InventoryItem`).
14. Agronomist/advisor read-only account type.
15. Disease-pressure-aware spray guidance (Dacom-style pattern).
16. Kringloopwijzer export.
17. NVWA inspection package.
18. CAP eco-scheme activity tracking.

### D. Do not build yet

Voice logging, satellite/NDVI, GPS auto-field-detection, offline-first mobile, a real LLM-backed AI layer (until there's validated demand beyond the existing rule engine), livestock, marketplace, drones, precision-irrigation hardware, full accounting/Belastingdienst replacement, custom report builder, social/community features, non-NL/BE/DE crop content, an xFarm data-migration tool, a consumer carbon module, farm benchmarking, multi-farm support, and employee permission levels beyond the current single-owner model. Every item in this list is either explicitly and correctly deferred in FarmOS's own existing strategy documents, or newly identified by this audit as reasoned primarily from "no competitor has this" rather than validated farmer need (see `FarmOS_Complexity_Kill_List.md`).
