# xFarm — Inventory Deep Audit
**Audit series:** FarmOS Competitive Intelligence  
**Document:** 06 — Inventory, Warehouse, Seeds, Chemicals, Fertilizer, Harvest  
**Date:** 2026-07-07  
**Classification:** Internal / Confidential

---

## Verdict Up Front

xFarm's inventory module is a stock counter. It counts what you have. It does not tell you whether what you have is enough for what you've planned, when you need to reorder, what it cost you, whether it's still legal to use, or where it came from. A physical notebook does the same job with less friction.

The module exists because "inventory management" sounds like farm management. What was actually built is a product registry with a quantity field attached. The automation that would make it genuinely useful — supplier integration, activity-driven deduction, purchase history, reorder intelligence — is absent across every category.

---

## Part 1: Chemicals (Gewasbeschermingsmiddelen)

### What xFarm Offers

A list of crop protection products in the farmer's inventory. Each record contains:
- Product name (free text)
- Registration number (free text, optional)
- Category (herbicide, fungicide, insecticide, etc.)
- Unit of measure (L, kg, etc.)
- Current stock quantity
- Minimum stock alert threshold (optional)
- Storage location (free text, optional)
- Movement history (inflows and outflows linked to purchase entries or activities)

### The Entry Problem

Every product must be created manually. There is no product catalogue to search. A farmer adding Proline EC 406 to their inventory types: "Proline EC 406," selects category fungicide, selects unit litres, enters 50 as opening stock. If they misspell the product name or enter a different variant, stock tracking silently diverges from the actual product registered with the CTB.

The CTB (College voor de toelating van gewasbeschermingsmiddelen en biociden) maintains a complete Dutch product register with: full product name, registration number, active ingredients, formulation type, approved crops, maximum dose per crop per application, maximum annual dose, pre-harvest interval, re-entry interval, water buffer zone requirements, and approved nozzle classifications. This database is public and updated weekly.

xFarm does not use it for product creation. The farmer types. The farmer makes errors. The errors propagate into compliance records.

The correct approach: search the CTB database by product name or registration number, select the matching product, and all regulatory data auto-populates. The farmer confirms. The stock quantity is the only thing manually entered.

### The Deduction Problem

When a spray activity is logged and a product is assigned with a dose and area, xFarm should automatically calculate the quantity used (dose × area) and deduct it from stock.

This works in straightforward cases. It fails in:

**Partial field applications.** Farmer sprays 12 ha of a 20 ha field. Logs area as 12 ha. Stock deduction is correct. But the field record shows the full field was sprayed in the compliance report unless the farmer explicitly edits the area — which many don't because the field is pre-populated to its full registered area.

**Dose adjustments mid-field.** Farmer starts at 0.8 L/ha and reduces to 0.6 L/ha for the last 4 ha due to weather deterioration. xFarm cannot handle a split dose in one activity record. The farmer either logs two entries (rarely done in the field), uses an average dose (inaccurate), or logs one dose and accepts the error.

**Retroactive stock entry.** A farmer buys 100 L of a product in March, doesn't enter it into xFarm until May, then logs spray activities in April that reference that product. Stock goes negative. xFarm allows this and shows a negative balance. There is no prompt to reconcile.

**Returns and waste.** A product is returned to the supplier or disposed of as hazardous waste. There is no "waste disposal" movement type. A farmer who disposes of 5 L of an expired product either doesn't record it (stock error) or logs it as "used" on a fictional field (compliance record falsification).

### The Expiry Problem

Pesticide products have: batch-specific expiry dates, label validity periods (some products are still in warehouses when their CTB registration lapses), and storage temperature requirements that affect shelf life.

xFarm has no expiry date field. A farmer who holds a product past its CTB registration expiry date is legally holding an unregistered pesticide. They cannot apply it. If they apply it without knowing the registration lapsed, they create a compliance failure that xFarm's records document.

The CTB registration database publishes expiry dates per product. FarmOS cross-references stock held with current CTB registration status and alerts 90 days before a product's registration expires with: "Your 15L of [product] has a CTB registration expiring in 87 days. This product may not be applied after that date. Remaining stock at planned usage rate: will not be fully used before expiry. Options: accelerate usage this season or arrange disposal."

### The Cost Problem

Chemical input costs represent 25–35% of total variable costs on a Dutch arable farm. xFarm records quantities. It does not record purchase prices. The inventory module cannot calculate:

- Cost per litre/kilogram by product
- Total chemical spend year-to-date
- Chemical cost per hectare per crop
- Price variance between orders (was this batch cheaper or more expensive than last time?)
- Input cost trend over multiple years

A farmer who wants to know their herbicide spend this season opens xFarm, finds zero useful financial information, and opens their accountant's spreadsheet instead.

### What FarmOS Builds

**CTB-integrated product registry.** Type three characters of a product name: autocomplete from the CTB database. Select the product: all regulatory data auto-populates. The farmer never manually enters a registration number, maximum dose, or PHI.

**Batch-level stock management.** Each purchase creates a batch with: purchase date, batch number, supplier, purchase price per unit, expiry date, quantity. The FIFO (first in, first out) deduction rule applies — oldest batch depletes first. Expired batches are flagged before they can be selected in an activity.

**Waste disposal movement type.** Structured record: quantity disposed, disposal method (licensed collector, returned to supplier), date, disposal reference number. Required for compliance with Besluit beheer autowrakken (hazardous waste regulations).

**Activity-driven deduction with split support.** If an activity records 12 ha of a 20 ha field, exactly 12 ha worth of product is deducted. If two doses are used in one pass (nozzle section management), two deduction entries are created from one activity record.

**Chemical cost per field, auto-calculated.** Every activity deduction carries the cost per unit from the batch used. Multiply by quantity deducted = cost of that spray event. Sum across all spray events per field = chemical cost per field per season. Available in one tap.

---

## Part 2: Fertiliser (Meststoffen)

### What xFarm Offers

Same inventory structure as chemicals. A list of fertiliser products with: product name, N/P/K content (manually entered), unit, current stock.

Application records from the activities module link to fertiliser products and record applied quantity per field.

### The Nitrogen Calculation Problem

Dutch law requires farmers to track:
1. Total nitrogen applied per field per crop (mineral + organic)
2. Organic nitrogen from animal manure (maximum 170 kg N/ha under derogation, or 80 kg N/ha for standard)
3. Mineral nitrogen from manufactured fertilisers
4. Effective nitrogen from intermediate crops and crop residues
5. Annual nutrient balance reported via the Kringloopwijzer (nutrient cycle report)

xFarm records application quantities. To determine the nitrogen content of what was applied, the farmer must have correctly entered the N% of each product in the product setup. If the N% is wrong (common with blended fertilisers whose composition varies by batch), every downstream nitrogen calculation is wrong.

There is no validation against the Handbuch der Düngung or the Dutch RVO fertiliser database. There is no running balance of nitrogen applied vs. the crop-specific limit. There is no alert when the next planned application would cause an exceedance.

The consequence of exceeding the nitrogen limit: reduction or loss of CAP basic payments (cross-compliance deduction), possible prosecution under the Meststoffenwet, mandatory participation in phosphate reduction measures.

xFarm records nitrogen applications. It does not protect farmers from the consequences of getting them wrong.

### The Manure Problem

Manure applications are the most complex part of Dutch nutrient management:

- Manure must be injected or incorporated within 4 hours on most Dutch soils (emission requirements)
- Animal manure must be analysed for N and P content before application (requires lab test)
- Manure from different animal types has different effective N availability (digestate from mono-digestion ≠ cattle slurry)
- Manure applications must be recorded with: date, animal type, quantity, N and P content from lab analysis, injection method
- The total organic N across all manure applications must not exceed the crop-specific limit

xFarm has no structured manure application record. Manure is logged as a generic fertiliser activity with free-text notes. The organic N content must be manually calculated and entered. Lab analysis data has no import path.

### What FarmOS Builds

**Fertiliser product database integration.** The Netherlands has the Meststoffen database maintained by RVO — a list of all registered fertiliser products with their guaranteed nutrient content. FarmOS integrates this database for mineral fertilisers. The farmer selects a product; N/P/K content is auto-filled from the registration.

**Manure log with lab analysis import.** Structured manure application record: animal type, quantity (m³ or tonnes), application method (injection, trailing shoe, broadcast), lab analysis import (CSV or PDF from ALCO or Eurofins NL — the two main Dutch manure analysis labs). Effective N calculated using Dutch efficiency coefficients (werkingscoëfficiënten) per animal type per soil type per application timing.

**Real-time nitrogen balance.** Per-field, continuously updated:

```
Keetje Noord — Winter Wheat 2026
──────────────────────────────────────────────
Organic N applied:    28 kg/ha  (cattle slurry, March 12)
Mineral N applied:   156 kg/ha  (KAS 27%, 3 applications)
Total N applied:     184 kg/ha
──────────────────────────────────────────────
Legal limit (wheat):  220 kg/ha
Remaining budget:      36 kg/ha
N residue from cover:  12 kg/ha  (phacelia predecessor)
Effective budget:      48 kg/ha  (after residue credit)
──────────────────────────────────────────────
[████████████████░░░░]  84% used
```

Applications that would cause exceedance are blocked. The farmer sees: "This application of 60 kg N/ha would exceed the legal limit by 24 kg N/ha on this field. Maximum allowed: 36 kg N/ha remaining."

**Kringloopwijzer data export.** At year end, all fertiliser application records per field are exported in the format required for the annual Dutch nutrient cycle report. A task that currently takes Dutch farmers 4–8 hours with a consultant takes 2 taps.

---

## Part 3: Seeds (Zaaizaad)

### What xFarm Offers

Seed inventory follows the same structure as chemicals: product name, variety, unit (kg, units), current stock. Seed usage is logged via sowing activity records.

### Critical Missing Features for Dutch Farmers

**Potato seed certification tracking.** Dutch seed potato production is the most regulated in Europe. Every seed potato lot has: a breeder, a grower, a certification class (E, SE, E, A, B), a disease test result (Potato Virus Y, PVX, PLRV, Erwinia, blackleg), and a Plant Health Certificate. This chain of certification determines the legality of the material for replanting and export.

xFarm has no seed lot registry that captures certification class, variety registration number, disease-free certificate, or country of origin. A Dutch seed potato farmer — one of the core target customers in the Netherlands given that NL produces 60% of European seed potato — cannot manage their legal documentation in xFarm.

**GMO and variety registration compliance.** The Dutch variety list (Rassenlijst) maintained by Naktuinbouw and Plantum lists all commercially approved varieties for each crop. An unlisted variety cannot be sold. xFarm does not validate that the planted variety is registered for the target market.

**Seed treatment tracking.** Most Dutch cereal and sugar beet seed arrives pre-treated with fungicide and/or nematicide seed treatments. These treatments contain active substances subject to the same CTB registration requirements as foliar products. Seed treatments must be documented in field records for traceability. xFarm treats seed as a product without capturing treatment details.

**Seed rate calculation assistance.** Target plant population, thousand kernel weight, and field germination rate combine to give the required seed rate per hectare. xFarm has no such calculation. A farmer seeds sugar beet without assistance on achieving target plant population accuracy.

### What FarmOS Builds

**Seed lot registry.** Each seed purchase creates a lot record: variety, certification class, lot number, supplier, disease test certificate (PDF attachment), date of purchase, expiry of certification validity. For potato seed: PVX, PVY, PLRV, Erwinia, blackleg test results linked to the lot. On sowing, the lot number populates the field record — full traceability from bag to field.

**Seed rate calculator.** Target population (plants/m²) → adjusted for TKW (thousand kernel weight from bag label) and expected field germination rate → recommended kg/ha. For sugar beet: target seeds per hectare, precision seed adjustment for planter settings.

---

## Part 4: Harvest Inventory (Oogstopslag)

### What xFarm Offers

Harvest activities create a stock entry: crop, quantity (tonnes), moisture content (optional), field of origin (optional), date. A separate "warehouse" section shows current stocks of harvested produce.

### What Is Missing

**Lot management.** A harvest lot is not just a quantity. It is: a specific field, a harvest date, a combine/contractor, a quality test result, a delivery contract reference, and a storage location. When the same crop from two different fields is combined in one grain store, lot identity is lost. xFarm does not manage lot integrity.

**Quality tracking by lot.** Grain merchants, Aviko, and Cosun pay premiums or deductions based on quality parameters at delivery. Moisture content at harvest → expected dry-down rate in store → moisture at delivery → payment calculation. Protein content in wheat determines bread vs. feed classification. Dry matter in potatoes determines starch delivery premium. None of this multi-step quality tracking exists in xFarm.

**Storage cost tracking.** On-farm grain storage has costs: drying energy (electricity/gas), ventilation, insurance, pest management. These costs must be allocated to the stored lot to calculate the true cost of storing vs. selling at harvest. xFarm records that something is in storage. It never calculates what the storage is costing.

**Forward sales matching.** A farmer who has sold 200 tonnes of wheat forward at €195/tonne needs to track how much of that contract is fulfilled by current storage. xFarm does not manage sales contracts or contract fulfilment.

**Biosecurity and trace-back.** Potato stores require Phytophthora management, temperature monitoring, and lot isolation. If a lot is found to carry a quarantine pathogen (Clavibacter michiganensis, ringrot), trace-back to the originating field is required by Dutch and EU plant health law. xFarm's harvest records are insufficient for this trace-back.

### What FarmOS Builds

**Lot-tracked harvest records.** Every harvest creates a lot with: field of origin, harvest date, initial quality assessment, storage location. The lot maintains its identity through: drying (moisture change recorded), storage (cost accumulation), and delivery (lot matched to sales contract).

**Quality progression tracking.** For grain: moisture at harvest, target moisture for storage, moisture at delivery check. Automatic calculation of drying energy required based on quantity, starting moisture, and target moisture (using standard grain drying energy coefficients). For potato: DM% at harvest, expected DM% at delivery based on storage conditions, bruise risk score based on harvest conditions (soil and tuber temperature at harvest).

**Sales contract matching.** Farmer enters a forward sale: crop, quantity, price, delivery period, buyer. As harvest lots are added to storage, the system asks: "Do you want to allocate this lot to your contract with [buyer]?" Contract fulfilment tracked automatically. Alert when delivery period approaches and contract is underfulfilled.

---

## Part 5: Automation — What xFarm Should Do But Doesn't

The most important word missing from xFarm's inventory module is **automatic**. Every process is manual. Every number must be entered. Every reorder must be initiated. Every calculation must be performed by the farmer. xFarm is a vessel for manual data entry, not a system that reduces administrative burden.

### Automation Gap 1: Supplier Integration

**The opportunity:** Agrifirm, De Groot & Slot, BAM, and AgroCentra — the major Dutch agrochemical and seed suppliers — send invoices by email in PDF format. These PDFs follow consistent templates. OCR + LLM parsing can extract: supplier, line items (product name, quantity, unit, unit price, total), delivery date, and invoice reference with >95% accuracy for structured supplier invoices.

**What FarmOS does:** Every emailed invoice forwarded to a dedicated FarmOS address (or auto-detected in a connected inbox) is parsed and presented for confirmation: "Agrifirm invoice #2026-04817: 200L Proline EC 406 @ €14.20/L, 2 bags KAS 27% 800kg @ €0.29/kg. Add to inventory?" One tap confirms. Stock updates. Cost is recorded against the correct batch. Invoice is archived for accounting.

**Time saved:** 200 invoices/year × 4 minutes manual entry = 13 hours returned to the farmer.

### Automation Gap 2: Planned vs. Available Stock Check

**The opportunity:** A farmer's spray programme is a planned series of activities: T1 fungicide in week 15, T2 in week 20, T3 in week 24. Each planned activity has a product, dose, and set of fields with known areas. Total planned product requirement = Σ(dose × area) across all planned applications.

**The calculation:** Planned requirement vs. current stock = sufficiency or shortfall. If shortfall: how many days before the activity is planned? Is there time to reorder from standard supplier with their standard lead time?

This is a simple calculation that xFarm never performs. Farmers discover they are out of product on the morning they need to spray, from 4G dead zones, at 06:00.

**What FarmOS does:** Running sufficiency check visible on the inventory card. "Proline EC 406: 45L in stock. Planned activities requiring this product: T2 wheat (week 22, 54L needed). Shortfall: 9L. Order now for delivery before week 22?" One tap initiates the order via Agrifirm's ordering API.

### Automation Gap 3: Activity-Triggered Reorder

**The opportunity:** After each spray activity that deducts stock, the system checks whether remaining stock is sufficient for the next planned activity using that product. If not, a reorder recommendation is surfaced immediately after the activity is saved.

**xFarm:** No such check exists. Stock deduction happens silently. Inventory screen shows updated quantity. No inference about what that quantity means for future plans.

**What FarmOS does:** Post-activity save: "You used 27L of Retengo Plus. Remaining stock: 8L. Next planned use: cercospora spray on 3 beet fields in 11 days (requires 32L). Shortfall: 24L. Order from [preferred supplier] for Thursday delivery?" The farmer's response is one tap. Not a phone call. Not a separate app. Not a mental calculation while driving to the next field.

### Automation Gap 4: Cost Allocation to Fields

**The opportunity:** Every inventory deduction carries a cost (quantity × purchase price per unit). Every deduction is linked to an activity. Every activity is linked to a field. Therefore: every input cost is traceable to a field without any manual allocation.

**xFarm:** Activity logging records the field. Inventory deduction records the quantity. The linkage between quantity deducted, cost per unit, and field is never made explicit. Per-field input cost cannot be calculated from within xFarm.

**What FarmOS does:** This linkage is created automatically at every deduction. The field's running input cost updates after every activity. The per-field income/cost report does not require any additional data entry — it is derived entirely from activities already logged as part of normal workflow.

### Automation Gap 5: Waste and Disposal Tracking

**The opportunity:** Dutch law (Besluit beheer autowrakken and WABO) requires documentation of pesticide disposal. An expired product must be collected by a licensed waste processor. This collection must be recorded with: waste code, collector identity, quantity, and collection certificate number.

**xFarm:** No structured disposal record type. A farmer disposing of 5L of expired Diquat (now banned) either doesn't record it or logs a fake spray activity. The compliance record is wrong either way.

**What FarmOS does:** "Disposal" is a movement type in inventory alongside "purchase" and "used." A disposal record captures: product, quantity, reason (expired, banned substance, label change, surplus), disposal route (licensed collector name, collector number), collection date, certificate number. The certificate PDF is attachable. The disposal is excluded from spray diary totals. The compliance record is clean.

---

## Part 6: The Missing Dashboard for Inventory

xFarm has no inventory overview dashboard. To understand the inventory position, a farmer must scroll through a list of products and read individual quantities.

**What FarmOS shows on the inventory overview:**

```
INVENTORY STATUS — TODAY
─────────────────────────────────────────────────
CHEMICALS               STOCK    STATUS
Proline EC 406          45 L     ⚠ Below needed for T2 (9L short)
Retengo Plus            108 L    ✓ Sufficient through T3
Boxer 800 EC            0 L      ✗ OUT OF STOCK
Pirimor 50 WG           8 kg     ✓ Sufficient for season
─────────────────────────────────────────────────
FERTILISERS
KAS 27% N               2,400 kg ✓ Sufficient for season plan
Urean 32%               0 kg     ✗ OUT OF STOCK — reorder?
─────────────────────────────────────────────────
SEEDS
Kerubino wheat          320 kg   ✓ Sufficient for planned autumn sowing
Fontane potato seed     12 bags  ⚠ Cert expires in 38 days
─────────────────────────────────────────────────
HARVEST IN STORE
Winter wheat            142 t    Contract: 200t — 58t unfulfilled
Sugar beet              [delivered]
```

Three status levels: check mark (sufficient), warning (attention needed), X (action required). The farmer scans this in 15 seconds and knows exactly what needs to be ordered today.

---

## Summary

xFarm's inventory module tracks quantities. FarmOS manages stock as a function of what is planned, what it costs, what is legal to use, what needs to be reordered, and what has been harvested and needs to be sold. The difference is not a feature gap. It is a philosophy gap: xFarm builds what farmers asked for (a stock list). FarmOS builds what farmers need (an inventory intelligence system that prevents stock-related failures before they happen).

---

*Next document: [07-finance.md](07-finance.md)*
