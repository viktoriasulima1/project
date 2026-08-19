# FarmOS Feature Library — Everything Worth Stealing
**Audit series:** FarmOS Competitive Intelligence  
**Document:** 10 — Feature Library, 100+ Ideas, Categorised  
**Sources:** xFarm, AGRIVI, Climate FieldView, John Deere Ops Center, eAgronom, CropX, Ambrook, Agroptima  
**Date:** 2026-07-07  
**Classification:** Internal / Confidential

---

## How to Read This Document

Every idea is assigned one of four build decisions:

- **COPY** — implement close to how the competitor did it; the concept is correct and the execution is adequate
- **IMPROVE** — take the concept, reject the execution, build it significantly better
- **REINVENT** — the concept is structurally right but needs a completely different design philosophy to work
- **IGNORE** — not worth building at this stage; wrong market, wrong complexity, or already solved better elsewhere

Ideas are grouped by domain. Within each domain they are ranked by strategic priority for the Dutch arable market.

Total: **127 ideas**

---

## Domain 1: Activity Logging & Compliance

| # | Idea | Source | Decision | Rationale |
|---|---|---|---|---|
| 1 | Electronic spray diary | xFarm, all | **REINVENT** | The concept is mandatory. The execution — 7–9 taps, manual weather, no defaults — must be destroyed and rebuilt as voice-first, GPS-aware, auto-validated |
| 2 | Multi-field bulk activity logging | Missing in xFarm | **BUILD NEW** | One spray run across 8 fields = one form, not 8. Core Dutch use case |
| 3 | Smart defaults from activity history | Missing in xFarm | **BUILD NEW** | Last used product + dose + operator for each field. Pre-fill everything, farmer corrects only exceptions |
| 4 | Voice activity logging | Missing in all | **BUILD NEW** | 20-second voice entry replaces 5-minute form. Primary input method for cab operations |
| 5 | Auto weather capture at log time | Missing in xFarm | **BUILD NEW** | KNMI API at field GPS coordinates at logged timestamp. Farmer never types weather |
| 6 | CTB product database integration | Missing in xFarm | **BUILD NEW** | Search CTB by product name → all regulatory data auto-fills (registration number, max dose, PHI, buffer zones) |
| 7 | Pre-application validation checklist | Missing in all | **BUILD NEW** | 8-point check before save: CTB approval, dose within range, BBCH window, licence valid, buffer zone, wind speed, PHI, annual limit |
| 8 | GPS track recording during activity | Missing in all | **BUILD NEW** | Phone GPS logs position every 10 seconds while activity is active. Actual area from track, not registered area |
| 9 | Duplicate activity detection | Missing in xFarm | **BUILD NEW** | Same field + same date + same product → flag before save, suggest merge |
| 10 | Operator licence (spuitlicentie) validation | Missing in xFarm | **BUILD NEW** | Per-operator cert number + expiry; block spray logging if expired on log date |
| 11 | Activity template (repeat last spray) | xFarm has basic version | **IMPROVE** | xFarm's repeat is manual. FarmOS proposes the repeat: "Same programme as last Thursday?" — one tap |
| 12 | Retroactive activity backdating with weather backfill | Missing in all | **BUILD NEW** | If logged within 6 hours of activity, KNMI historical data fills weather fields automatically |
| 13 | Activity cost auto-calculation | Missing in xFarm | **BUILD NEW** | Product cost (from batch price) × quantity used + machine cost per hour × logged hours = total activity cost, shown before save |
| 14 | BBCH auto-estimation from thermal time | Missing in xFarm | **BUILD NEW** | Planting date + KNMI GDD accumulation → expected BBCH displayed on activity form, farmer confirms or overrides |
| 15 | Soft delete with compliance preservation | Missing in xFarm | **BUILD NEW** | Activities never hard-deleted; compliance records survive; stock restoration on delete |
| 16 | Split dose logging (two nozzle sections) | Missing in xFarm | **BUILD NEW** | One pass with two different doses on front vs. rear nozzle sections: two deduction records from one activity |
| 17 | Contractor access with activity logging | xFarm has basic users | **IMPROVE** | Contractors get limited access: log activities on assigned fields only, cannot view financial data or other operations |
| 18 | Harvest yield logging with quality parameters | xFarm has basic | **IMPROVE** | Structured quality fields (DM%, protein%, moisture%, bruise%) per crop type, not free text |
| 19 | ISOXML harvest data import | Missing in all consumer platforms | **BUILD NEW** | Combine exports ISOXML; FarmOS imports yield map and averages to field level automatically |
| 20 | Sowing activity with seed lot traceability | xFarm has basic | **IMPROVE** | Seed lot number + certification class links to the field record for full seed-to-harvest traceability |

---

## Domain 2: Field Management

| # | Idea | Source | Decision | Rationale |
|---|---|---|---|---|
| 21 | BRP/RVO auto-import (Netherlands) | Missing in xFarm | **BUILD NEW** | Public API, free, complete. Replaces 4-hour manual field setup with 60-second import. Kill-shot for NL market |
| 22 | FLIK import (Germany) | Missing in xFarm | **BUILD NEW** | Same concept as BRP for the German market. Phase 2 |
| 23 | RPG import (France) | Missing in xFarm | **BUILD NEW** | Same concept for French market. Phase 3 |
| 24 | Field status colour coding by risk (not crop) | Missing in xFarm | **REINVENT** | Map colours = urgent/on-track/no-action required. Not crop type colour coding. Actionable, not decorative |
| 25 | PCN (Potato Cyst Nematode) history per field | Missing in all | **BUILD NEW** | Legally required test history for Dutch potato fields. Currently in paper binders. Critical for seed potato growers |
| 26 | Field access notes (soft spots, gate widths, overhead lines) | Missing in xFarm | **BUILD NEW** | Persistent field notes visible when starting an activity on that field |
| 27 | Watercourse buffer zone auto-calculation | Missing in xFarm | **BUILD NEW** | Field boundary vs. RWS watercourse layer → required buffer distance calculated and displayed on spray form |
| 28 | Natura 2000 proximity check | Missing in all | **BUILD NEW** | Some Dutch fields border protected habitat zones with specific spray restrictions. Auto-flag on activity start |
| 29 | Crop rotation tracker per field | xFarm has basic | **IMPROVE** | Visual 5-year rotation history; disease break analysis; highlight if rotation is creating PCN or root disease pressure |
| 30 | Field rental cost tracking | Missing in xFarm | **BUILD NEW** | Annual lease cost per field → allocated to per-field P&L automatically |
| 31 | Soil type with Dutch classification (KOMO/STIBOKA) | xFarm has basic | **IMPROVE** | Validate soil type against Dutch soil map (BasisRegistratie Ondergrond) rather than free text |
| 32 | Field-level yield history trend (5 years) | Missing in xFarm | **BUILD NEW** | Sparkline on field card showing yield per hectare per season. Immediate visual of declining/improving fields |
| 33 | BRP parcel number on every field record | Missing in xFarm | **BUILD NEW** | Required for RVO reporting. Auto-populated from BRP import. Used as unique identifier for regulatory purposes |
| 34 | Water board (waterschap) zone tagging | Missing in all | **BUILD NEW** | Which waterschap manages the drainage of this field? Relevant for pump management and waterboard reporting |
| 35 | Eco-scheme / ANLb management zone tagging | Missing in xFarm | **BUILD NEW** | Fields enrolled in agri-environment schemes require specific management. Tag at field level, trigger compliance checks |

---

## Domain 3: Weather & Decision Intelligence

| # | Idea | Source | Decision | Rationale |
|---|---|---|---|---|
| 36 | Spray window scorer (0–100 composite) | xFarm has binary green/red | **REINVENT** | Composite score: product-specific wind limit, temperature, dew point, precipitation, re-entry interval. Per-product, per-field |
| 37 | Spray window push notification at 21:00 | Missing in xFarm | **BUILD NEW** | Delivered the night before when planning happens, not the morning of |
| 38 | Soil temperature display from KNMI | Missing in all | **BUILD NEW** | 5cm/10cm/20cm soil temp for nearest KNMI station. Critical for herbicide and cultivation decisions |
| 39 | Growing degree day accumulation per crop | Missing in xFarm | **BUILD NEW** | Daily GDD shown on field card. Running total since planting. Used for BBCH estimation and pest emergence |
| 40 | Dew point display and risk flag | Missing in xFarm | **BUILD NEW** | Dew point + condensation risk flag. Critical for fungal disease management and minimum spray temperature |
| 41 | Cumulative precipitation since last application | Missing in all | **BUILD NEW** | "62mm rain since last Boxer application. Pre-emergence efficacy may be compromised." Product-specific calculation |
| 42 | Frost risk with crop-specific damage threshold | xFarm has basic frost alert | **IMPROVE** | xFarm shows <0°C. FarmOS shows: "Forecast -2°C at 04:00. Young sugar beet (cotyledon stage) damaged at -1°C. Risk: HIGH." |
| 43 | Soil workability forecast | Missing in all | **BUILD NEW** | Clay soil moisture model: precipitation, drainage rate, soil type → days until trafficable. From CropX's concept |
| 44 | KNMI station integration (free, Netherlands national) | xFarm uses commercial provider | **BUILD NEW** | KNMI is free, more accurate for NL, provides soil temp. Commercial provider costs money and is less localised |
| 45 | On-farm weather station integration (Davis, Lufft) | xFarm has partial | **IMPROVE** | When farmer has own station, local data replaces KNMI for all calculations. Spray window accuracy improves dramatically |
| 46 | Wind speed at field level vs. farm level | Missing in all | **BUILD NEW** | Interpolation from multiple KNMI stations for different field zones. More accurate for large farms with wind exposure variation |
| 47 | Rain-fast interval tracker | Missing in all | **BUILD NEW** | "Rain expected at 14:30. Your Retengo Plus requires 1 hour rain-free after application. Last possible spray start: 12:30." |
| 48 | Evapotranspiration (ET₀) display | xFarm Intelligence tier | **COPY** | ET₀ is useful for irrigation management. xFarm's calculation is standard Penman-Monteith. Replicate it. |
| 49 | Leaf wetness tracking from nearest station | Missing in xFarm | **BUILD NEW** | Leaf wetness duration is primary input into infection period models. KNMI stations measure it. Surface it. |
| 50 | Week-ahead agronomic calendar | Missing in all | **BUILD NEW** | "Next 7 days: spray window Tuesday, rain Wednesday-Thursday, possible harvest window Friday-Saturday (potato)." Farm-specific |

---

## Domain 4: Satellite & Remote Sensing

| # | Idea | Source | Decision | Rationale |
|---|---|---|---|---|
| 51 | NDVI display from Sentinel-2 | xFarm | **COPY** | The concept and data source are correct. The implementation (show only when actionable, show age prominently) must improve |
| 52 | Sentinel-1 SAR imagery for cloud penetration | Missing in all consumer platforms | **BUILD NEW** | Cloud-penetrating radar imagery. Available free from Copernicus. Critical differentiator for cloudy NL/UK/DE markets |
| 53 | NDVI anomaly detection vs. historical baseline | Missing in xFarm | **BUILD NEW** | Automatic comparison to same-date previous years. Alert when current NDVI is >15% below expected |
| 54 | Management zone delineation from NDVI variability | Missing in xFarm | **BUILD NEW** | Cluster NDVI raster into 3–5 zones per field based on historical variability. Basis for VRA prescription maps |
| 55 | Satellite alert only when actionable | xFarm shows always | **REINVENT** | If image is >10 days old: don't show the widget. Show only when image is current AND contains anomaly worth acting on |
| 56 | Change detection between consecutive images | Missing in xFarm | **BUILD NEW** | Compare last two cloud-free images. Highlight zones with >10% NDVI change. Flag sudden declines |
| 57 | Yield prediction from multi-year satellite + weather | Missing in xFarm (claimed, not real) | **BUILD NEW** | ML model on NDVI time series + weather + crop type → yield forecast updated weekly during season |
| 58 | Crop emergence uniformity score | Missing in all | **BUILD NEW** | Sentinel-2 image 3–4 weeks after sowing → NDVI variance within field → emergence uniformity score. Flag poor establishment early |
| 59 | Waterlogging detection from SAR | Missing in all | **BUILD NEW** | SAR backscatter identifies waterlogged zones within fields after heavy rain. Alert before visual symptoms appear |
| 60 | Crop lodging detection after storm | Missing in all | **BUILD NEW** | SAR detects lodged crop (changed backscatter signature). Alert day after storm event if lodging is detected |

---

## Domain 5: Disease, Agronomy & Recommendations

| # | Idea | Source | Decision | Rationale |
|---|---|---|---|---|
| 61 | Late blight model for potato (Dacom integration) | xFarm has partial | **IMPROVE** | xFarm integrates Dacom passively. FarmOS: integrate Dacom model + adjust threshold for specific variety resistance score |
| 62 | Septoria tritici blotch model for wheat | Missing in xFarm | **BUILD NEW** | Modified Fry model: temperature + leaf wetness duration → infection units. Standard agronomic science, not implemented anywhere in consumer ag software |
| 63 | Cercospora leaf spot model for sugar beet | Missing in xFarm | **BUILD NEW** | IRS cercospora advisory model integration. Critical for Dutch and German beet growers |
| 64 | Aphid pressure alerts (beet yellows, PLRV) | Missing in xFarm | **BUILD NEW** | DLO/WUR aphid trap count data + degree day aphid flight model. Push alert when flight risk is HIGH in farmer's region |
| 65 | Wireworm emergence risk model | Missing in all | **BUILD NEW** | Soil temperature-driven emergence model for Agriotes species. Dutch potato and sugar beet at-risk period prediction |
| 66 | Spray efficacy learning loop | Missing in all | **BUILD NEW** | Spray applied → disease model reading before → disease model reading 7 days after → efficacy calculation. Per-product per-farm learning over seasons |
| 67 | AI photo disease/pest identification | Missing in xFarm | **BUILD NEW** | Multimodal vision model: photo → probable disease/pest, confidence score, severity, recommended action |
| 68 | Pre-season spray programme builder | xFarm has basic | **REINVENT** | xFarm's is a template. FarmOS's is optimised: disease history + variety resistance + budget constraint + weather patterns → programme proposal |
| 69 | Product recommendation from CTB-approved list only | xFarm mixes sponsored | **REINVENT** | All recommendations from public CTB approved list only. No sponsored placement. Transparency is the differentiator |
| 70 | Tank mix compatibility checker | Missing in xFarm | **BUILD NEW** | Select two or more products → check physical and chemical compatibility from BASF tank-mix advisor or equivalent |
| 71 | Application window calendar per product per crop | Missing in xFarm | **BUILD NEW** | Visual calendar per field showing approved application windows for planned products by BBCH stage |
| 72 | Dutch nozzle classification (drift reduction) display | Missing in xFarm | **BUILD NEW** | Show drift reduction class (75%/90%/95%) for selected nozzle type on spray form. Auto-check against buffer zone requirement |
| 73 | Nitrogen residue credit from predecessor crop | Missing in xFarm | **BUILD NEW** | After green manure or legume crop: calculate expected N mineralisation from Nmin tables and credit against next crop's fertiliser requirement |

---

## Domain 6: Inventory & Supply Chain

| # | Idea | Source | Decision | Rationale |
|---|---|---|---|---|
| 74 | CTB database product auto-populate | Missing in xFarm | **BUILD NEW** | Already covered in activity section. Critical for inventory too: all regulatory data on product creation |
| 75 | Invoice OCR and auto-booking from email | Ambrook has partial | **IMPROVE** | Forward invoice email → OCR + LLM extraction → pre-filled booking for farmer confirmation. No manual entry |
| 76 | Barcode scanning for inventory entry | Missing in all farm apps | **BUILD NEW** | EAN barcode on product → CTB database lookup → product added to inventory. Replaces manual typing |
| 77 | Stock sufficiency check against planned activities | Missing in xFarm | **BUILD NEW** | Running calculation: planned activities × dose × area vs. current stock. Shortfall shown proactively |
| 78 | Reorder recommendation with supplier link | Missing in xFarm | **BUILD NEW** | "4L shortfall for T2. Order from Agrifirm for Thursday delivery?" One tap to order |
| 79 | Agrifirm/De Groot invoice import (structured EDI) | Missing in all | **BUILD NEW** | Major Dutch suppliers have consistent invoice formats. Structured import rather than OCR where possible |
| 80 | Batch-level inventory with FIFO deduction | Missing in xFarm | **BUILD NEW** | Each purchase = batch with purchase price, date, expiry. Deduction uses FIFO. Cost allocation uses actual batch price |
| 81 | Product expiry tracking with CTB registration check | Missing in xFarm | **BUILD NEW** | Alert 90 days before registration expires. Cross-check current stock vs. upcoming plans to quantify stranded inventory value |
| 82 | Waste disposal record with licensed collector tracking | Missing in xFarm | **BUILD NEW** | Structured disposal record: product, quantity, disposal route, collector registration number, certificate |
| 83 | Harvest lot management (field → store → sale) | Missing in xFarm | **BUILD NEW** | Lot identity maintained from field harvest through drying/storage to delivery. Quality progression tracked |
| 84 | Forward sale contract matching against harvest stock | Missing in all farm apps | **BUILD NEW** | Match stored lots to forward sale contracts. Alert when delivery period approaches and contract is underfulfilled |
| 85 | Seed lot certification tracking (potato seed) | Missing in all | **BUILD NEW** | Certification class, disease test results, lot number, expiry. Critical for Dutch seed potato sector |
| 86 | Inventory cost dashboard (real-time position) | Missing in xFarm | **BUILD NEW** | Summary view: product → stock → status (sufficient/alert/out) → planned requirement → shortfall. 15-second read |

---

## Domain 7: Finance & Business Intelligence

| # | Idea | Source | Decision | Rationale |
|---|---|---|---|---|
| 87 | PSD2 bank sync (Rabobank, ABN AMRO, ING) | Ambrook has US version | **IMPROVE** | Ambrook uses Plaid (US). FarmOS uses PSD2 open banking (EU). Architecture is the same. Execute for NL market |
| 88 | Farm-specific chart of accounts (crop enterprise) | Ambrook | **IMPROVE** | Ambrook's chart is US Schedule F. FarmOS needs Dutch BTW categories + crop enterprise structure |
| 89 | Per-field P&L auto-derived from activities | Missing in all | **BUILD NEW** | Unique FarmOS advantage: activity records + inventory batch prices → per-field cost without any additional entry |
| 90 | Cash flow calendar (13-week rolling forward) | Ambrook has version | **IMPROVE** | Ambrook's is generic. FarmOS's knows Dutch agricultural payment schedule: Cosun advances, CAP payment timing, Agrifirm invoice cycle |
| 91 | CAP / GLB subsidy tracker per scheme | Missing in all | **BUILD NEW** | BIS, eco-scheme, ANLb — application status, compliance requirements, expected payment date, received vs. expected |
| 92 | Dutch VAT (BTW) management and aangifte export | Missing in all farm apps | **BUILD NEW** | No farm management platform produces a Dutch BTW aangifte. First-mover advantage in Dutch tax compliance |
| 93 | Exact Online / Twinfield export integration | Missing in xFarm | **BUILD NEW** | Export coded ledger in native format. The accountant receives complete books, not a box of paper |
| 94 | Annual impact statement at renewal | Missing in all | **BUILD NEW** | Quantified: hours saved, errors prevented, fines avoided, cost vs. regional benchmark. Retention tool disguised as a report |
| 95 | Year-on-year cost per hectare benchmarking | xFarm has none; Ambrook partial | **BUILD NEW** | Anonymised peer comparison: "Your herbicide cost/ha is 11% below similar farms. Your machinery cost/ha is 8% above." |
| 96 | Machinery depreciation and cost allocation | Ambrook has version | **IMPROVE** | Ambrook's is generic. FarmOS: machine cost per hour configured once, allocated to activities automatically |
| 97 | Land lease P&L contribution analysis | Missing in all | **BUILD NEW** | "Renew Achterste Kamp lease at €1,850/ha? Last 3 years: average margin -€40/ha. Recommendation: renegotiate or release." |
| 98 | Harvest forward price alert (Euronext) | Missing in all | **BUILD NEW** | "Euronext wheat Dec is at €218. Your forward price is €195. Current spread: -€23/t on 180t contract = -€4,140 vs. today." |
| 99 | Working capital requirement forecast | Missing in all | **BUILD NEW** | "Peak working capital requirement in March: €138,000. Current Rabobank credit line: €120,000. Shortfall: €18,000. Discuss with advisor now." |
| 100 | Grain storage cost tracking (drying energy + insurance) | Missing in all | **BUILD NEW** | Cost per tonne stored per week. Helps farmer decide sell-now vs. store-and-wait, integrated with forward price data |

---

## Domain 8: Mobile & UX

| # | Idea | Source | Decision | Rationale |
|---|---|---|---|---|
| 101 | GPS auto-field selection on parcel entry | Missing in all | **BUILD NEW** | Phone inside field boundary → field pre-selected in activity form. Removes largest single friction in mobile logging |
| 102 | Glove mode (56px+ touch targets, high contrast) | Missing in xFarm | **BUILD NEW** | Not a visual mode toggle. A design standard: all primary actions meet 56×56 minimum, all dropdowns replaced by search-and-select |
| 103 | iOS Home Screen Widget | Missing in xFarm | **BUILD NEW** | Spray window quality + most urgent task, no app open required. Becomes the first thing farmers look at every morning |
| 104 | Full offline mode (SQLite local DB, background sync) | xFarm has partial | **REINVENT** | Not "partial offline." Every screen from local cache. Every write local-first. Sync queue visible. Nothing lost silently |
| 105 | Activity form as bottom sheet (not full screen nav) | Missing in xFarm | **BUILD NEW** | Activity log slides up from the map. Field is already visible. User never loses spatial context while logging |
| 106 | Large-format number pad for dose entry | Missing in xFarm | **BUILD NEW** | Custom numpad with large keys (not system keyboard). One-handed. Decimal key prominent. Pre-populates with last dose for this product+field |
| 107 | No dropdowns for lists > 10 items | xFarm uses dropdowns throughout | **REINVENT** | Every long list replaced with search-and-select. Typing 3 characters of a product name is faster than scrolling 40-item dropdown |
| 108 | Recent and pinned fields for quick selection | Missing in xFarm | **BUILD NEW** | Last 5 used fields appear at top of field selector. Pin frequently used fields. Removes 80% of field-selection friction |
| 109 | Offline basemap pre-caching for all registered fields | xFarm has unreliable | **IMPROVE** | On first sync and weekly thereafter: download map tiles for all field locations at Z12–Z17. Fields visible with zero connectivity |
| 110 | Background sync queue display | Missing in xFarm | **BUILD NEW** | Icon in top bar: green (synced), orange + count (pending), red (error). Tap to see queue. No silent failures |

---

## Domain 9: Onboarding

| # | Idea | Source | Decision | Rationale |
|---|---|---|---|---|
| 111 | BRP auto-import as onboarding step 1 | Missing in xFarm | **BUILD NEW** | KvK number or BRP-relatienummer → all registered parcels imported. 60 seconds to complete what xFarm takes 4+ hours to do manually |
| 112 | Progressive onboarding (don't require completion before first use) | Missing in xFarm | **BUILD NEW** | Show value first (weather, spray window). Collect additional data (inventory, machinery) through normal use over first 2 weeks |
| 113 | Setup completeness indicator | Missing in xFarm | **BUILD NEW** | "Your farm is 64% set up. Complete: machinery (15 min) and inventory (20 min) to unlock full compliance reporting." |
| 114 | Data migration from xFarm (export/import) | Missing in all | **BUILD NEW** | Offer a credible xFarm data migration path. Reduce the switching cost that keeps farmers in xFarm despite dissatisfaction |
| 115 | First-week value delivery guarantee | Missing in all | **BUILD NEW** | Onboarding flow guarantees one specific value delivered in the first 7 days: "By Friday you will have a complete spray diary for any past activity you log this week" |
| 116 | Agronomist invite as step 2 of onboarding | Missing in xFarm | **BUILD NEW** | "Invite your agronomist — they get free read-only access." Creates the agronomist relationship from day 1 |

---

## Domain 10: Compliance & Regulatory

| # | Idea | Source | Decision | Rationale |
|---|---|---|---|---|
| 117 | RVO spray diary auto-draft (Netherlands) | Missing in all | **BUILD NEW** | Complete spray diary records → pre-fill RVO regulatory format → one-tap submission or PDF download |
| 118 | 7-year field history export (Netherlands legal requirement) | xFarm has buried | **IMPROVE** | One-tap export from field detail screen. Not buried 4 levels deep in Reports |
| 119 | Kringloopwijzer data export (Dutch nutrient cycle report) | Missing in xFarm | **BUILD NEW** | All fertiliser application records → export in Kringloopwijzer input format. Eliminates 4–8 hours of annual admin |
| 120 | Nitrogen balance per field (Meststoffenwet) | xFarm does not calculate | **BUILD NEW** | Running N balance per field per crop. Visual bar. Alert at 80% of legal limit. Block at 100% |
| 121 | Manure application log with lab analysis import | Missing in xFarm | **BUILD NEW** | Structured manure record with organic N from lab test (ALCO/Eurofins import). Dutch derogation compliance |
| 122 | Eco-scheme compliance activity tracker | Missing in xFarm | **BUILD NEW** | Each eco-scheme tier has required management activities. Track completion. Alert before compliance window closes |
| 123 | NVWA inspection readiness report | Missing in all | **BUILD NEW** | One-tap: "Generate inspection package" — complete spray diary, field history, operator licences, product registration checks, gaps flagged |
| 124 | Spuitlicentie expiry calendar (all operators) | Missing in xFarm | **BUILD NEW** | All operator licences in one view with expiry dates and days-remaining countdown. Alert 90/60/30/14 days before each expiry |
| 125 | Dutch approved nozzle list integration | Missing in xFarm | **BUILD NEW** | CTB publishes approved nozzle list with drift reduction classifications. Validate nozzle entry on spray form against this list |
| 126 | Annual compliance summary report | xFarm has basic | **IMPROVE** | "Your 2026 compliance status: 247 spray events logged, 100% complete, 0 exceedances detected, 3 CTB-approved products used after label update — review recommended." |
| 127 | Cross-year compliance audit trail | Missing in xFarm | **BUILD NEW** | Any field, any year: complete record of what was applied, by whom, under what weather conditions, with what compliance outcome. Tamper-evident, exportable |

---

## Prioritised Build Order

Based on strategic impact × speed to implement × Dutch market specificity:

### Phase 1 — Launch Differentiators (Must ship before first cooperative pitch)

| Priority | Feature | Why first |
|---|---|---|
| 1 | BRP auto-import (idea 21) | 10× onboarding advantage. Kills xFarm in the first 5 minutes |
| 2 | Auto weather capture on activity log (idea 5) | Removes most common complaint. Zero extra tap for mandatory data |
| 3 | CTB product database (ideas 6, 74) | Eliminates compliance errors. Enables pre-application validation |
| 4 | Voice activity logging (idea 4) | 20 seconds vs. 5 minutes. The demo that makes farmers buy |
| 5 | Spray window scorer with product-specific limits (idea 36) | Answers the question xFarm never answers: "Can I spray today?" |
| 6 | GPS auto-field selection (idea 101) | Removes largest mobile friction without any new UI |
| 7 | Nitrogen balance per field — real-time (idea 120) | Legal requirement with criminal liability. xFarm ignores it. We own it |
| 8 | Soft delete with compliance preservation (idea 15) | Data integrity. Non-negotiable for a compliance product |
| 9 | Full offline mode (idea 104) | The #1 reason farmers leave xFarm. The #1 reason they switch to us |
| 10 | Pre-application validation — 8 checks (idea 7) | Silent protection that prevents compliance failures farmers don't know they're making |

### Phase 2 — Competitive Depth (Months 4–12)

Ideas 11–50, 61–68, 87–93: Financial module with bank sync, invoice OCR, per-field P&L; disease models (Septoria, Cercospora, late blight enhanced); satellite anomaly detection; smart defaults engine; reorder automation.

### Phase 3 — Intelligence Moat (Year 2)

Ideas 57, 66, 95–100: Yield prediction ML, spray efficacy learning, peer benchmarking, forward price integration, harvest lot management, carbon footprint. By Phase 3, FarmOS has 2 seasons of farm data per customer. The intelligence runs on real data. No competitor can replicate this without the same data volume.

---

## What To Ignore (And Why)

| Idea | Reason to ignore |
|---|---|
| Livestock module | Different domain, different regulatory framework, different daily workflow. Do not compete with Agrovision or Farmdesk on their home turf |
| In-app marketplace (inputs) | Chicken-and-egg liquidity problem. Requires scale we don't have. Partner with Agrifirm via API instead |
| Full accounting replacement (BTW aangifte direct submission) | Partner with Exact Online for the submission layer. Don't build a Belastingdienst API integration when one already exists in the market |
| Global livestock advisory content | Out of scope. Leave Mediterranean olive and vine features to xFarm's Italian heritage team |
| Drone management | Too early, too expensive, too hardware-dependent for Phase 1–2 |
| Precision irrigation management | Relevant only for certain crops on certain soils. Phase 3 at earliest |
| Custom report builder | Farmers do not build custom reports. They use the 3 reports they need. Build those 3 better |
| Social / community features | Boerderij.nl and local WhatsApp groups are entrenched. Don't compete with social infrastructure |
| Agrochemical company advisory content | This is xFarm's conflict of interest problem. Stay away from any sponsored content model |

---

## The 10 Ideas No Competitor Has Built

These are the 10 ideas in this library that represent genuine product innovation rather than competitive imitation:

1. **Spray efficacy learning loop** (idea 66) — per-farm, per-product efficacy database built from logged spray events + disease model outcomes
2. **GPS track recording during field operations** (idea 8) — actual area treated from phone GPS, not registered field area
3. **Pre-application 8-point validation checklist** (idea 7) — silent pre-save validation against CTB database, licence registry, field map, and N balance
4. **Per-field P&L auto-derived from activities** (idea 89) — no manual cost coding required; financial intelligence from operational data
5. **SAR cloud-penetrating satellite imagery** (idea 52) — first-mover for cloudy-climate markets (NL, UK, Belgium)
6. **Kringloopwijzer auto-export** (idea 119) — eliminates 4–8 hours of mandatory annual admin for every Dutch farmer
7. **Annual impact statement at renewal** (idea 94) — quantified proof of value delivered, timed to the renewal decision
8. **BRP auto-import onboarding** (idea 21) — public API, free, eliminates the worst experience in agricultural software for Dutch farmers
9. **NVWA inspection readiness package** (idea 123) — one-tap generation of everything an inspector can ask for, with gaps flagged
10. **Intelligence lock-in via spray efficacy model** (ideas 57, 66 combined) — after 3 seasons, leaving FarmOS means abandoning a calibrated farm-specific intelligence model that cannot migrate. This is not data lock-in. It is competence lock-in.

---

*Next document: [11-verdict.md](11-verdict.md)*
