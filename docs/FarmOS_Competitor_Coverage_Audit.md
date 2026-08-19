# FarmOS Competitor Coverage Audit

**Sprint 15. Source-of-truth audit, not marketing comparison.** This document distinguishes three things that this project's own documentation has, at times, blurred together: (1) what competitors actually do, (2) what FarmOS's strategy documents describe as its vision, and (3) what FarmOS's actual source code implements today. Where those three disagree — and they disagree often — this document says so plainly.

---

## Part 1 — Inventory of existing FarmOS sources

### Documents read

| Document | Role | Reliability as an implementation record |
|---|---|---|
| `docs/FarmOS_Master_Architecture.md` | Aspirational architecture bible (Decision-Season-Activity trinity, 5-layer AI stack, ~15 domain objects incl. Decision/Risk/Opportunity/AIInsight/SatelliteObservation/DiseasePestRecord) | **Low.** Describes a 5-year vision. Confirmed by direct code inspection: none of Decision, Risk, Opportunity, AIInsight, WeatherEvent (as a model), SatelliteObservation, or DiseasePestRecord exist in `prisma/schema.prisma`. This document should be read as strategy, never as a status report. |
| `docs/FarmOS_Strategy_Lock.md` | Post-xFarm-research strategic decisions: 20 xFarm weaknesses to exploit, 20 FarmOS differentiators, "10 features for the first public demo," 90-day roadmap | **Low, as a status report; high, as intent.** Confirmed by grep across `src/`: voice logging, BRP import, CTB validation, Meststoffen integration, KNMI integration, real-time nitrogen balance, spuitlicentie expiry tracking, GPS auto-field-selection, offline-first SQLite, Sentinel satellite, PSD2 bank sync, Kringloopwijzer export, and NVWA inspection packages — **zero** of these exist in the codebase as of Sprint 15. This is the single most important finding of this audit: the project's own "Strategy Lock" describes a 90-day build plan whose 10 demo-gating features have, after 15 sprints, not been started. |
| `docs/FarmOS_Master_Specification.md`, `docs/Product_Principles.md`, `docs/Module_Map.md`, `docs/Database_Model.md`, `docs/FarmOS_Dashboard_V2_Specification.md` | Product principles and MVP module roadmap | **Mixed.** `Module_Map.md`'s own Sprint 1/2/3 roadmap already promised NDVI, GPS boundaries, offline batch entry, EDI supplier integration, subsidy tracking, invoicing, certifications/audit log, and a Claude-chat AI Cockpit — most of which remain unbuilt. Product_Principles.md's stated identity ("AI-first... AI is the primary interface") does not match the shipped product (a deterministic rules engine explicitly commented `// Replace ... with real Claude API calls in Sprint 2` — never done). |
| `docs/xfarm/*` (12 files) + `docs/xfarm/XFARM_MASTER_ANALYSIS.md` | Genuine deep competitive research on xFarm — company, navigation, dashboard, activities, weather/AI, inventory, finance, mobile, psychology, feature library, investor review | **This is real, substantial research** — 44,000 words per its own count. The one competitor audit in this project that deserves the label "deep." |
| `docs/AGRIVI_Sprint_Analysis.md` | Marketing/website/video-based analysis from Sprint 1 | **Partial.** One document, reasonable structure, explicitly sourced from public marketing material — not a deep audit by this project's own (correct) standard. |
| No "FarmOS Constitution" file exists. | — | Referenced in the Sprint 15 brief; not found under any name in `docs/`. Treated as not existing rather than assumed to be one of the above under a different name. |
| Sprint reports (`Sprint_3` through `Sprint_14`, ~25 files) | Historical record of what was actually built, sprint by sprint | **High reliability** — these are the most trustworthy source in the whole `docs/` tree, because each one was written immediately after real `tsc`/`vitest`/E2E runs, with failures reported honestly rather than smoothed over. |

### Feature inventory (FarmOS itself, not competitors)

**Implemented** (real route + server action + Prisma model + test, confirmed by direct file inspection):
- Farm/Season/Field/FieldSeason CRUD, one active season per farm
- Type-first activity dialog (spray/fertilise/sow/tillage/scout/harvest/other), per-type required-field validation
- Inline "add sprayer" (Sprint 12), inline "assign crop to any field" (Sprint 13 fix)
- Quick Log (same `createActivity` action, different entry point)
- Inventory CRUD with category-specific fields (crop-protection vs. fertiliser), stock deduction on activity save
- Compliance record auto-creation on spray (data denormalized onto the record), Compliance page listing (fixed Sprint 13 — previously always empty)
- Weather: current-hour snapshot + indicative spray-suitability status (`blocked`/`poor`/`marginal`/`good`/`excellent`), explicitly labelled non-legal, via Open-Meteo only
- Dashboard: onboarding-incomplete / first-run / early-usage / active-farm states, rule-based "AI" briefing (no LLM)
- Clerk auth, cross-farm data isolation (server-verified, not just UI-hidden), mobile-responsive sidebar, WCAG-AA-passing color contrast, dialog focus trap
- Playwright E2E harness: golden path, failure paths, cross-farm isolation, mobile (2 viewports), accessibility (axe-core) — 39 tests, all passing against both dev and production builds

**Partially implemented:**
- Finance — `FinancialSnapshot`/`CropFinancial` Prisma models exist; the `/finance` **page has no query at all** and unconditionally renders "No financial records yet" regardless of real data. This is the same false-completeness pattern as the Compliance-page bug found and fixed in Sprint 13 — **not yet fixed here**.
- Tasks — `Task` model and enums exist in the schema; no route, no server action, no UI reads or writes it anywhere in `src/`.
- Soil — `SoilAnalysis` model exists; no route, no UI.
- Employees/operators — created during onboarding (name, role, spuitlicentie checkbox); no expiry date field, no expiry tracking, no linkage to activity validation (a spray can be logged with an expired or nonexistent operator licence and nothing checks it).

**Documented-only (no code at all)**, confirmed absent by grep across `src/`: voice logging, BRP/RVO auto-import, CTB product-registry validation, Meststoffen database integration, KNMI integration, Kringloopwijzer export, PSD2/bank sync, real-time nitrogen balance, spuitlicentie expiry alerts, satellite/NDVI (Sentinel-1 or -2), computer-vision disease identification, GPS auto-field-detection, offline-first storage, invoice OCR, agronomist read-only accounts, per-field P&L, NVWA inspection package, a real LLM-backed AI layer, Decision/Risk/Opportunity as first-class objects.

**Postponed** (explicitly, in `FarmOS_Strategy_Lock.md`'s own "10 features we must NOT build yet"): livestock module, in-app input marketplace, full accounting replacement, custom report builder, social/community features, drone management, precision-irrigation sensor networks, non-NL/BE/DE crop content, xFarm data-migration tool, consumer carbon-footprint module. These are the one part of the vision documents that *is* still accurate — none of them have been built, and the brief correctly said not to.

**Rejected:** none found explicitly labelled as rejected; the closest is the mock-data module below.

**Unknown/orphaned:** `src/lib/mock-data/farm-dashboard.ts` — a full realistic mock `DashboardData` object, not imported anywhere in `src/`. Dead code left over from before the real DB-backed dashboard was built (Sprint 1 era). Harmless but should be deleted in a future cleanup pass (not done here — this sprint does not write code).

---

## Part 2 — Competitor research status

| Competitor | Depth achieved this audit | Documents/sources | Evidence quality | Confidence | Missing research areas |
|---|---|---|---|---|---|
| **xFarm** | Deep audit (pre-existing) | `docs/xfarm/` — 12 files, 44,000 words | High — structured, multi-dimensional, cited | High | Pricing tiers as of 2026 not re-verified this sprint |
| **AGRIVI** | Partial audit (pre-existing) | `docs/AGRIVI_Sprint_Analysis.md` — 1 file | Medium — website/video-based, Sprint-1-era, not re-verified since | Medium | Current 2026 feature set, pricing, mobile app quality |
| **AgroVision** | Marketing-level review (this sprint) | 1 search, official site + review site | Low-medium | Medium | Dutch-market positioning vs. FarmOS specifically, actual UI/UX quality, pricing |
| **CropX** | Marketing-level review (this sprint) | 1 search, official site + press | Low-medium | Medium | Software-only tier vs. hardware-bundled tier differences, price |
| **Farm21** | Marketing-level review (this sprint) | 1 search, official site + startup DB | Low-medium | Medium | Actual field adoption in NL, pricing, churn |
| **FarmBrite** | Marketing-level review (this sprint) | 1 search, review aggregators | Low-medium | Medium | Not EU-focused; limited relevance depth needed |
| **AgriWebb** | Marketing-level review (this sprint) | 1 search, official site + reviews | Low-medium | Medium | Livestock-specific — low relevance to FarmOS's arable focus, not pursued further |
| **Conservis** | Marketing-level review (this sprint) | 1 search, official site + reviews | Low-medium | Medium | US grain-marketing focus; NL relevance unclear |
| **Trimble Ag Software** | Marketing-level review (this sprint) | 1 search, official site + press | Low-medium | Medium | Enterprise/hardware-tied positioning, pricing |
| **Granular** | Marketing-level review (this sprint) | 1 search, Corteva official pages | Low-medium | Medium | Independent existence vs. Corteva-bundled-only; US focus |
| **Agworld** | Marketing-level review (this sprint) | 1 search, official site + reviews | Low-medium | Medium | Agronomist-collaboration UX detail |
| **Croptracker** | Marketing-level review (this sprint) | 1 search, official site | Low-medium | Medium | Fruit/vegetable focus — limited arable relevance |
| **eAgronom** | Marketing-level review (this sprint) | 1 search, official site + press | Low-medium | Medium | Carbon-credit mechanics detail, EU applicability |
| **Dacom** | Marketing-level review (this sprint) | 1 search, official site (now part of CropX) | Low-medium | Medium | Disease-model specifics, NL market share |
| **FarmMaps** | **No meaningful audit possible** | 1 search — official site is Dutch-only, thin secondary coverage | Very low | Low | Almost everything — this is a genuine research gap, not a shortcut taken |
| **Isagri** | Marketing-level review (this sprint) | 1 search, official site + reviews | Low-medium | Medium | French-market specifics, product line breadth (Geofolia etc.) |
| **Ekylibre** | Marketing-level review (this sprint) | 1 search, GitHub + docs site | Low-medium (better than most — open source means the actual code/docs are inspectable) | Medium | Real-world adoption, whether the open-source project is actively maintained |
| **Ambrook** | Marketing-level review (this sprint) | 1 search, official site + press | Low-medium | Medium | US-only (Schedule F, US banking) — direct feature relevance limited, but the *pattern* (bank-first, real-time P&L) is highly relevant |
| **Navfarm** | Marketing-level review (this sprint) | 1 search, official site | Low-medium | Low-medium | Appears to be a generic/India-focused ERP-style product; unclear how established it is |

**Honest summary:** 2 of 19 competitors (xFarm, AGRIVI) have research that predates this sprint and was built through deliberate, multi-source investigation. The other 17 were researched for the first time in this sprint, at "marketing-level review" depth — one targeted web search each, sourced from official sites and review aggregators, not hands-on product trials. This is enough to identify each competitor's headline positioning and core feature set, and enough to compare against FarmOS's own documented and implemented capability — but it is not equivalent to xFarm's 44,000-word depth, and this document does not claim otherwise anywhere below.

---

## Part 7 — What FarmOS already learned from each competitor

**AGRIVI:**
- Farm → Field → Season → Crop → Activity structure (adopted, and FarmOS's actual Prisma schema — Farm/Season/Field/FieldSeason/Activity — matches this almost exactly)
- Spray diary as the compliance anchor (adopted — `ComplianceRecord` auto-created on spray)
- Cost/ha as the headline financial metric (documented as the plan; **not actually implemented** — Finance page is a stub)
- Dashboard-first entry point (adopted)

**xFarm:**
- The clearest, most consequential lesson: "breadth kills depth" — FarmOS's own Strategy Lock explicitly names xFarm's "most complete platform" positioning as a trap to avoid. FarmOS's actual shipped surface area (7 focused modules, no livestock, no marketplace, no drone management) reflects this lesson better than it reflects the rest of the xFarm research, which mostly generated an aspirational feature list that hasn't been built.
- Quick Log as a fast, reusable entry point (genuinely adopted and shipped — Sprint 11/12)
- Mobile-first, glove-friendly touch targets (partially adopted — 44px targets shipped Sprint 11/12; not verified in a real field/glove context)
- The specific claims about xFarm's weaknesses (no BRP import, no CTB validation, no voice logging, data-selling business model) were used to generate a long differentiator list — of which **zero items have been built**. The research was thorough; the follow-through has not happened.

**AgroVision:** Nothing meaningful adopted. AgroVision's core strength (a 40-year-old, deeply Dutch-specific multi-species product line — crops/cows/pigs/finance as separate integrated modules) is a scale and breadth FarmOS has explicitly chosen not to pursue (Product_Principles.md: "Not an ERP for large co-ops"). Worth noting for later: their Meteo/disease-pressure module is a real, working version of something FarmOS's Strategy Lock only describes.

**CropX:** Nothing adopted yet, but directly relevant: CropX's core product is **hardware-sensor-driven** (soil moisture/temperature/salinity at multiple depths). FarmOS has explicitly stayed software-only and sensor-free (Product_Principles.md: "Not a soil sensor platform (integration, not hardware)"). This is a deliberate scope boundary, correctly held.

**Farm21:** Nothing adopted yet. Their scouting-and-sensor dashboard (weather + satellite + crop + sensor data unified) is closer to FarmOS's Master Architecture vision than to anything shipped. Worth a second look for the "one unified field view" pattern if fields/maps is ever prioritized.

**FarmBrite:** Nothing meaningful adopted — its core differentiation (mixed crop *and livestock*, direct-to-consumer sales, Zapier/API breadth) sits outside FarmOS's explicit "not a livestock platform" and "Netherlands arable first" boundaries.

**AgriWebb:** Nothing adopted — livestock-specific (paddock/mob management), out of domain by design.

**Conservis:** Nothing adopted yet, but relevant: their grain-marketing and settlement-matching workflow is a real, working version of "financial intelligence derived from farm operations" — a pattern FarmOS's Strategy Lock aspires to (PSD2, per-field P&L) but hasn't built.

**Trimble Ag Software:** Nothing adopted — their strength (equipment telematics, variable-rate prescriptions, mixed-fleet machinery integration) requires hardware/machinery-manufacturer partnerships FarmOS has no plan to pursue.

**Granular:** Nothing adopted — seed-performance planning and satellite field-note-sharing tied to a Corteva-owned distribution model, not a pattern FarmOS is positioned to copy.

**Agworld:** Nothing built yet, but the clearest unadopted idea: agronomist-to-farmer recommendation handoff ("one click turns a recommendation into a spray record") is a genuinely relevant collaboration pattern FarmOS's own Master Architecture mentions ("Advisor / agronomist collaboration") but has zero implementation of (no read-only agronomist account type exists).

**Croptracker:** Nothing adopted — fruit/vegetable/orchard traceability and 50+ report types are outside FarmOS's current arable-crop, minimal-reporting scope.

**eAgronom:** Nothing adopted — carbon-credit MRV and pre-payment financing is explicitly deferred in FarmOS's own Strategy Lock ("Wait for EU carbon farming scheme clarity").

**Dacom:** Nothing adopted yet, but directly relevant and Dutch: their validated, science-backed disease-pressure model (320 crop/disease combinations, "3–4 fewer sprayings per season" claimed in practice) is a real, working, Dutch-market version of exactly what FarmOS's spray-suitability engine gestures at but does not yet do (FarmOS's engine scores weather conditions only — wind/temp/rain — not disease pressure).

**FarmMaps:** Nothing adopted — insufficient research depth this sprint to say anything meaningful. Flagged for follow-up, not guessed at.

**Isagri:** Nothing adopted — its breadth (crop + livestock + wine + payroll + accounting across multiple country-specific products) is exactly the multi-vertical ERP shape FarmOS's Strategy Lock says to avoid.

**Ekylibre:** Nothing adopted, but worth noting: it is the one competitor here that is open-source and inspectable at the code level (Ruby on Rails + PostgreSQL/PostGIS), which — if ever useful — is a much cheaper way to verify a specific workflow's real complexity than reading marketing copy.

**Ambrook:** Nothing built yet, but the clearest unadopted idea of the whole audit: real-time bank-synced P&L, tagged by crop/field/enterprise, with a modern onboarding experience — this is a working, shipped version of exactly what FarmOS's own Strategy Lock describes wanting (PSD2 + per-field P&L) and has not built. If FarmOS ever prioritizes Finance beyond its current stub, Ambrook is the closest real precedent, not xFarm.

**Navfarm:** Nothing adopted — appears to be a broad multi-vertical ERP (crop/dairy/livestock/poultry/aquaculture) with generic feature descriptions; insufficient evidence of Dutch-market or arable-specific depth to justify closer study yet.

---

## Part 11 — Competitor coverage score

| Competitor | Research coverage | Relevant ideas identified | Relevant ideas implemented | FarmOS already better? | Remaining strategic gap |
|---|---|---|---|---|---|
| xFarm | 90% | 90% | ~15% (Quick Log, mobile targets, type-first flow) | Partially | BRP import, CTB validation, voice, offline, satellite, real per-field P&L — all still theirs, none built by FarmOS despite deep research |
| AGRIVI | 40% | 60% | ~40% (farm/season/field/activity structure, spray diary, dashboard-first) | Partially | Cost/ha finance module (documented, not built), agronomist marketplace pattern |
| AgroVision | 15% | 30% | 0% | Unknown | Almost everything — under-researched, 40-year-deep Dutch multi-species product |
| CropX | 15% | 20% | 0% (deliberately — different domain, hardware) | Not comparable | N/A — different product category by design |
| Farm21 | 15% | 25% | 0% | Unknown | Unified sensor/satellite/scouting dashboard pattern |
| FarmBrite | 10% | 10% | 0% | Not comparable | N/A — livestock/direct-to-consumer, out of scope |
| AgriWebb | 10% | 10% | 0% | Not comparable | N/A — livestock, out of scope |
| Conservis | 10% | 20% | 0% | Unknown | Grain marketing / settlement matching pattern |
| Trimble Ag Software | 10% | 15% | 0% | Not comparable | N/A — hardware/machinery-tied |
| Granular | 10% | 15% | 0% | Not comparable | N/A — Corteva-distribution-tied |
| Agworld | 10% | 25% | 0% | Unknown | Agronomist collaboration / read-only advisor access |
| Croptracker | 10% | 10% | 0% | Not comparable | N/A — fruit/veg traceability, out of scope |
| eAgronom | 10% | 15% | 0% | Not applicable (deferred by design) | Carbon MRV — deliberately postponed |
| Dacom | 15% | 30% | 0% | No | Real, validated disease-pressure model — FarmOS's spray engine is weather-only |
| FarmMaps | 5% | 5% | 0% | Unknown | Everything — genuine research gap |
| Isagri | 10% | 10% | 0% | Not comparable | N/A — multi-vertical ERP breadth FarmOS avoids by design |
| Ekylibre | 10% | 15% | 0% | Unknown | Open-source — cheapest to verify further if ever relevant |
| Ambrook | 15% | 35% | 0% | No | Real-time bank-synced per-field/enterprise P&L — FarmOS's Finance is an empty stub |
| Navfarm | 10% | 10% | 0% | Unknown | Insufficient evidence of specific relevance |

---

## Part 13 — Final verdict

**1. Have we already extracted everything valuable from all 19 competitors?**
No. Two competitors (xFarm, AGRIVI) have been researched deeply or moderately; the rest were touched for the first time this sprint at marketing-level depth. Of what *has* been identified as valuable — even from the two well-researched competitors — most has not been implemented. The gap is not primarily "we haven't found the ideas." It is "we found the ideas and did not build them."

**2. Which competitors are fully covered?**
None, by this audit's own honest standard. xFarm is the closest (deep research), but "fully covered" would require both deep research *and* meaningful implementation of what was learned — and implementation is near-zero even for xFarm.

**3. Which competitors are only partially covered?**
xFarm (deep research, near-zero implementation) and AGRIVI (partial research, moderate implementation of its core structural ideas).

**4. Which competitors have not been meaningfully audited?**
Seventeen: AgroVision, CropX, Farm21, FarmBrite, AgriWebb, Conservis, Trimble Ag Software, Granular, Agworld, Croptracker, eAgronom, Dacom, FarmMaps, Isagri, Ekylibre, Ambrook, Navfarm. All received a single-search marketing-level pass this sprint — real, cited, but shallow.

**5. Which 5 competitors should be researched next?**
Dacom (real, validated, Dutch disease-pressure model — directly extends FarmOS's own weather-only spray engine), Ambrook (the clearest working precedent for the per-field-P&L/bank-sync vision FarmOS has documented but never built), AgroVision (the actual 40-year Dutch incumbent FarmOS is realistically competing against locally, arguably more relevant day-to-day than xFarm), Agworld (the one competitor with a real, shipped agronomist-collaboration pattern — a documented FarmOS domain with zero implementation), FarmMaps (currently has no meaningful research at all, and is Dutch — a genuine blind spot).

**6. Which 10 missing capabilities matter most?**
See `docs/FarmOS_Next_30_Product_Decisions.md` Part 8 for the full ranked list; the headline ten, independent of scoring, are: (1) a Finance module that actually queries real data instead of a hardcoded stub, (2) operator/spuitlicentie expiry tracking tied to activity validation, (3) a working per-field cost/margin view (the one metric AGRIVI, Conservis, and Ambrook all treat as central and FarmOS has only documented), (4) disease-pressure-aware spray guidance (Dacom's proven pattern) beyond weather-only suitability, (5) BRP field import (still the single most-cited xFarm weakness in FarmOS's own research, still unbuilt), (6) CTB/product-registry dose validation, (7) an agronomist/advisor read-only account type, (8) task management (the `Task` model exists with zero UI), (9) soil data surfaced anywhere (the `SoilAnalysis` model exists with zero UI), (10) a real (even lightweight) AI layer to justify "AI-first" as a stated identity.

**7. Are we at risk of building too much?**
Not currently, in code — the shipped product is genuinely narrow and disciplined (7 modules, no livestock, no marketplace, no drones). The risk lives entirely in the *documentation*: `FarmOS_Master_Architecture.md` and `FarmOS_Strategy_Lock.md` describe a 15-object data model and a 90-day, 10-feature demo-gate that the team has not executed against in 15 sprints. If those documents are read as a literal backlog rather than as long-range vision, the next real risk is trying to build all of it at once. See `docs/FarmOS_Complexity_Kill_List.md`.

**8. Is FarmOS currently better than any competitor in a complete workflow?**
Yes, narrowly: the type-first, progressive-disclosure activity-logging flow with inline sprayer/crop-assignment creation, cross-farm-verified isolation, and a real (if not deep) Playwright E2E-and-accessibility-tested mobile experience is more polished, in that specific workflow, than what the marketing-level research suggests for AGRIVI, Isagri, or Navfarm. It is not close to xFarm's presumed production depth, Dacom's validated disease models, or Ambrook's real bank-synced finance — because those specific capabilities don't exist in FarmOS at all yet.

**9. What should be the next actual sprint?**
Fix the Finance-page false-completeness bug (same class of bug as the Sprint 13 Compliance-page fix — a real query behind a page that currently always lies about having no data) and add operator/spuitlicentie expiry tracking tied to spray validation. Both are evidence-backed, narrowly scoped, and directly address items this audit found, rather than reaching into the aspirational vision documents for a large new build.

**10. What should explicitly not be built?**
Everything in `FarmOS_Strategy_Lock.md`'s own "10 features we must NOT build yet" list (livestock, marketplace, full accounting replacement, custom report builder, social features, drones, precision-irrigation hardware, non-NL/BE/DE crops, xFarm migration tooling, consumer carbon module) — that list remains correct. Additionally: do not attempt voice logging, satellite/NDVI, BRP/CTB/KNMI government-API integrations, or a real LLM layer as a single large sprint — each is a substantial, multi-week integration effort in its own right and none is evidence-backed as the *most urgent* gap versus the smaller, cheaper fixes named in answer 9.
