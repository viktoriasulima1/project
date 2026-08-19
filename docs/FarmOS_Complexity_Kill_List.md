# FarmOS Complexity Kill List

Where FarmOS risks becoming another AGRIVI — or, more precisely, where FarmOS's own *documentation* risks pulling the *product* toward the complexity Isagri, AgroVision, and Navfarm already demonstrate. **The shipped product is currently disciplined.** This list exists to keep it that way, because the vision documents are not.

---

## The real risk is documentation-driven scope creep, not code that already exists

Fifteen sprints in, FarmOS's actual surface area is 7 modules (Fields, Activities, Inventory, Finance-stub, Weather, Compliance, AI-stub), no livestock, no marketplace, no drones. That is a genuinely small, focused product. The risk identified by this audit is not "FarmOS has already become bloated" — it is that `FarmOS_Master_Architecture.md` (a 15-object data model with Decision/Risk/Opportunity/AIInsight/SatelliteObservation as first-class entities, a 5-layer AI stack, a "Season-Activity-Decision Trinity") and `FarmOS_Strategy_Lock.md` (a 90-day plan with 10 demo-gating features, none built) describe a product roughly 5–10x the size of what exists. If a future sprint treats either document as a literal backlog rather than long-range vision, that is exactly how a small, excellent product becomes a giant incomplete one.

## Duplicate workflows / redundant screens

- **None found in the shipped product.** Each of the 7 real modules has exactly one way to do its core job (one activity dialog for all 6+ activity types, one Quick Log that reuses it, one onboarding flow). This is a genuine strength — name it so it isn't accidentally undone later by, for instance, building a second "activity creation" surface for a future "AI Cockpit" instead of extending the existing dialog.

## Repeated data entry

- **Operator name and machine, sort of.** `getActivityFormContext`'s "recent operator"/"recent machine" prefill (derived from the most recent *Activity*) and the Employee record created during onboarding are two disconnected sources of the same real-world fact (who sprays, with what). A farmer who added "Jan van der Berg" as an operator during onboarding gets no prefill benefit from that — the activity dialog only learns their name after they've manually typed it into a spray form once. This is a real, small instance of repeated entry, flagged in `FOUNDER_PRE_BETA_WALKTHROUGH.md`'s own notes.

## Overlapping modules

- **Compliance vs. Spray diary vs. CAP** are three names in the domain taxonomy (22, 6, 23) for what is, in the current implementation, one thing: a `ComplianceRecord` created only on spray activities, with a single framework value (`EU_SPRAY_DIARY_2009_128_EC`). `ComplianceModule.cap` exists as an enum value with zero workflow behind it. If CAP/eco-scheme tracking is ever built, resist the urge to build it as a fourth parallel module — it almost certainly belongs as another framework value on the same `ComplianceRecord` model, not a new one.

## Too many settings

- **None found** — there is currently no settings/preferences surface at all beyond farm details captured at onboarding. Not a complexity risk today. Worth a one-line reminder for later: do not let a future "notifications" or "permissions" feature (both currently absent, domains 39/37) default to a settings-page sprawl — most farmers will want sensible defaults, not configuration.

## Premature enterprise features

- **Multi-farm support, if ever built without a real signal it's needed.** `Farm.clerkUserId` is currently `@unique` — one farm per user, by design. `FarmOS_Master_Architecture.md`'s "Scaling Strategy" section (not fully read this sprint, but referenced) gestures at larger operations. Per `Product_Principles.md`'s own stated identity ("Designed for one farm manager, not an enterprise"), multi-farm, employee logins with permission levels, and audit trails beyond soft-delete are all premature until a paying customer actually asks for them. **Kill unless a real pilot farmer specifically needs it.**
- **Farm benchmarking (domain 43)** — comparing a farm's performance against anonymized peers requires (a) many farms of real data and (b) a mature Finance module that doesn't yet exist even for one farm. Structurally premature by at least two dependencies.

## Features copied without a clear problem

- **Voice logging.** `FarmOS_Strategy_Lock.md` treats this as the single most important acquisition moment ("the emotional response converts on the spot") based entirely on the observation that *no competitor has built it*, not on validated farmer demand. Absence of a competitor feature is not evidence of farmer need. This is the clearest instance in all the strategy documents of "we should build X because nobody else has" reasoning, which is exactly the trap Part 9 of this sprint's brief warns about. Do not build this without first asking real pilot farmers whether they'd actually use it — not whether it's impressive in a demo.
- **Satellite/NDVI (Sentinel-1 SAR).** Same pattern: justified in the strategy documents primarily as a technical differentiator ("no competitor has built it for consumers"), not as a response to an observed farmer problem. `Field.ndviScore` already exists as an unused, unpopulated column — a small, contained example of a feature partially scaffolded ahead of any validated need.
- **Agronomist read-only access.** Documented as a distribution-channel strategy (get agronomists to recommend FarmOS to their client farmers) more than as a farmer-requested capability. Not necessarily wrong, but the reasoning in the source documents is business-development-first, not problem-first — worth re-validating with real advisor and farmer conversations before building, not just building because Agworld has it.

## Features that should be merged (if/when built)

- **BRP import (domain 52) and Onboarding (domain 38)** should never become two separate features — BRP import, if built, is one step *inside* the existing onboarding wizard, not a parallel "import" flow competing with manual field entry.
- **CTB validation (domain 51) and Compliance/Spray diary (domains 22/6)** should share one validation layer, not become a separate "product safety" module bolted alongside the existing compliance record.
- **Task (domain 13, currently a pure schema stub) and Activity (domain 5)** — if Tasks are ever built, they should be modeled as "a not-yet-done Activity," reusing as much of the existing Activity form/validation logic as possible, not as an independent to-do-list feature with its own UI patterns. `FarmOS_Master_Architecture.md`'s own object model already describes Task this way ("Task Completed → becomes an Activity"); the risk is a future implementation drifting from that and building a generic task manager instead.

## Features that should never be built (per this project's own, correct, standing decisions)

Restated from `FarmOS_Strategy_Lock.md`'s own list, because it remains correct and is the single best piece of complexity-discipline already in this project's documentation: livestock module, in-app input marketplace (before 5,000 active farms), full accounting/Belastingdienst-replacement (partner with an accounting product first), custom report builder (before real farmer demand is validated), social/community features, drone management, precision-irrigation sensor hardware, non-NL/BE/DE crop content, an xFarm data-migration tool (before real switching demand exists), and a consumer-facing carbon module (regulatory landscape unsettled).

**Added by this audit:** a second, independent "AI Cockpit" surface distinct from the dashboard's existing briefing — if a real AI/LLM layer is ever built, it should upgrade the existing `generateDailyBriefing` output, not create a third place (after the dashboard and the current empty `/ai` stub) where "intelligence" is supposed to live.
