# FarmOS Master Specification

## Vision

The most intelligent farm operating system in Europe. Built for the professional arable farmer who runs 50–300 ha, speaks Dutch, files with RVO, and needs to be in the field by 7 AM.

FarmOS makes every farm decision data-driven, every compliance obligation automatic, and every morning start with a clear AI briefing on what matters today.

---

## Target Market

**Primary:** Dutch professional arable farmers, 50–300 ha
- Approximately 11,000 farms in this segment (CBS 2023)
- Average age: 52; many have adult children as succession
- Primary crops: wheat, potato, onion, sugar beet, barley
- Regulatory environment: RVO/BRP, CAP payments, Databankenwet, EU spray diary directive

**Secondary (Sprint 4+):** Belgium (Flanders), Germany (NRW/Bayern), UK (post-CAP)

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server Components, route groups, streaming |
| Language | TypeScript strict | Zero `any`, full domain types |
| Styling | CSS Modules + CSS custom properties | No Tailwind dependency, full control |
| AI (Sprint 2) | Anthropic Claude API | Best-in-class reasoning, function calling |
| Database (Sprint 2) | PostgreSQL + Prisma or Drizzle | Type-safe ORM, EU-hosted (Supabase EU) |
| Auth (Sprint 2) | Clerk or NextAuth | Per-farm multi-user, role-based access |
| Weather API (Sprint 2) | Open-Meteo | Free, EU-hosted, GDPR-safe, hourly data |
| Deployment | Vercel | Edge CDN, preview deploys |

---

## Sprint Plan

### Sprint 1 — Foundation (Current) ✅
- Design system: Button, Card, Badge, Input, Table (CSS Modules, dark theme)
- Layout: AppShell, Sidebar (8 modules), Topbar
- TypeScript domain types: all 25+ types
- Mock data: realistic Dutch farm (187 ha, Gelderland)
- Deterministic AI briefing engine (rule-based, no API)
- Dashboard: 7 working cards
- Route structure: 8 module routes with stubs
- Documentation: Master Spec, AGRIVI Analysis, Module Map, Product Principles, DB Model

### Sprint 2 — Real Data Layer
- PostgreSQL schema (Prisma migrations)
- Authentication (Clerk) — farm-level access control
- Fields module: CRUD, NDVI chart (recharts)
- Activities module: spray diary form with validation
- Weather: Open-Meteo API integration, spray window calculator
- Replace mock data with real DB queries

### Sprint 3 — Compliance + Finance
- Compliance module: spray diary PDF export (Dutch RVO format)
- CAP eco-scheme tracker with activity-to-qualification mapping
- Finance: full P&L with crop breakdown, budget entry
- Real-time budget variance alerts
- Inventory: full CRUD with stock movement history

### Sprint 4 — AI Cockpit (Claude)
- Claude API integration with farm data context
- Natural-language queries over fields, activities, finance
- Proactive recommendations: spray timing, optimal harvest window
- AI-generated compliance pre-fills (activity → diary entry)
- Multi-farm support, role-based access (owner / employee / agronomist)

---

## Pricing Strategy (Target)

| Tier | Monthly | Annual | Target |
|---|---|---|---|
| Solo | €49 | €490 | 1 farm, 1 user, all modules |
| Pro | €99 | €990 | 1 farm, 3 users, AI Cockpit |
| Team | €199 | €1,990 | 3 farms, unlimited users, API access |

Benchmark: AGRIVI starts at ~€199/month for comparable features. We target a 50% price advantage with better UX and AI-native design.

---

## Key Regulatory References

| Regulation | Relevance |
|---|---|
| EU Directive 2009/128/EC | Spray diary mandatory: product, dose, date, operator, weather |
| EU Regulation 1107/2009 | Crop protection product registration (toelatingsnummer) |
| CAP Strategic Plan NL 2023–2027 | Eco-scheme B: €45/ha for qualifying interventions |
| Databankenwet (NL) | Farmer owns farm data, must be exportable |
| GDPR | Personal data (operator names, GPS) requires consent + deletion capability |
| Nitraatrichtlijn | N-application limits per field type (derogation: 250 kg N/ha for grassland) |

---

## Success Metrics (Sprint 2 target)

- TypeScript: 0 errors, 0 `any` usage
- Lighthouse: Performance > 90 on dashboard route
- Core Web Vitals: LCP < 2.5s, CLS < 0.1
- Dashboard load: < 800ms (mock data, SSR)
- Coverage: at least smoke tests for `generateDailyBriefing()`

---

## File Structure

```
src/
  app/
    (farm)/              # Route group — shared AppShell layout
      dashboard/         # /dashboard
      fields/            # /fields
      activities/        # /activities
      inventory/         # /inventory
      finance/           # /finance
      weather/           # /weather
      compliance/        # /compliance
      ai/                # /ai
    layout.tsx           # Root layout (Geist fonts, globals)
    page.tsx             # Redirects → /dashboard
  components/
    ui/                  # Button, Card, Badge, Input, Table
    layout/              # AppShell, Sidebar, Topbar, StubPage
    farm/                # AIBriefingCard, WeatherCard, TasksCard, ...
  lib/
    mock-data/           # farm-dashboard.ts
  modules/
    ai/                  # generateDailyBriefing.ts
  types/
    farm.ts              # All domain types
docs/
  FarmOS_Master_Specification.md
  AGRIVI_Sprint_Analysis.md
  Module_Map.md
  Product_Principles.md
  Database_Model.md
```
