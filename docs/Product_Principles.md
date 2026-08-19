# FarmOS Product Principles

## What FarmOS Is

An AI-first Farm Operating System for European arable farmers. Not a generic farm app with an AI chatbot bolted on — AI is the primary interface. The dashboard is a daily briefing, not a data dump.

---

## Core Principles

### 1. AI first, forms second
Every module surfaces its most actionable insight via the AI Briefing card before the farmer opens a single form. The farmer should be able to read the briefing and know exactly what to do today, without clicking into any module.

### 2. Compliance is a feature, not a burden
Dutch farmers spend 2–4 hours/week on regulatory paperwork (RVO spray diary, CAP eco-scheme tracking, GlobalG.A.P. audit prep). FarmOS turns compliance into a zero-effort side effect of normal farm operations: log a spray, the diary is filled. Complete an eco-scheme activity, the CAP tracker updates.

### 3. One number per card
Each dashboard card has one primary metric that answers "am I OK?" — NDVI score, spray window status, budget variance, compliance status. Secondary detail is present but subordinate. No dashboard card should require interpretation.

### 4. The right data model is competitive moat
A well-modeled farm record (field → season → crop → activity → weather at time of application) takes years to accumulate. We model this correctly from Sprint 1 so data entered today is useful in Sprint 10.

### 5. No lock-in (Databankenwet)
Under Dutch Databankenwet and GDPR, farmers own their farm data. FarmOS must always offer full data export. This is both a legal requirement and a product principle: earned trust, not captive data.

### 6. Designed for one farm manager, not an enterprise
Our primary user is the owner-operator of a 50–300 ha Dutch arable farm. They check the app in the morning before going to the field, and log activities in the evening on their phone. Every UX decision optimizes for speed and legibility in these two contexts.

### 7. Eurozone-native pricing
Inputs, margins, and subsidies are in EUR. Weather is in °C and km/h. Dates are `dd-mm-yyyy`. All regulatory references are EU and NL-specific. We are not a US product localized for Europe.

---

## What FarmOS Is Not

- Not a marketplace for agronomists or input suppliers (Phase 2+)
- Not a soil sensor platform (integration, not hardware)
- Not a satellite imagery business (we consume NDVI, not generate it)
- Not an ERP for large co-ops or agri-businesses (different buyer, different product)
- Not a generic SaaS farm tool with a chatbot — AI is the primary interface, not an add-on

---

## Non-Negotiable Quality Bars

| Area | Standard |
|---|---|
| TypeScript | Strict mode, zero `any`, no type assertions without comment |
| CSS | Design tokens from `:root`, dark theme, mobile-responsive |
| Compliance data | EU regulation references must be accurate |
| AI briefing | Must be explainable — every item shows its reasoning |
| Data privacy | No farm data sent to third-party analytics without consent |
