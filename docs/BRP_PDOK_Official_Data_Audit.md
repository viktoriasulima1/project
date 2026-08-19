# BRP / PDOK Official Data Audit

Primary-source verification only, performed this sprint (2026-07-13) directly against `pdok.nl` and `api.pdok.nl` — live API calls, not reconstructed from general knowledge.

## What this dataset is

**BRP Gewaspercelen** (Basisregistratie Gewaspercelen — "crop parcel" register): the location of Dutch agricultural parcels together with the crop declared on each one, published via PDOK (Publieke Dienstverlening op de Kaart) on behalf of the data owner, **RVO** (Rijksdienst voor Ondernemend Nederland). Parcel boundaries derive from the Agrarisch Areaal Nederland (AAN).

**Critical distinction, confirmed by this research (see Part 2 discussion below): this is a public, annual, aggregate dataset — not a live feed of any individual farmer's current RVO registration.**

## Exact official endpoints found

| Resource | URL | Verified how |
|---|---|---|
| Dataset introduction page | `https://www.pdok.nl/introductie/-/article/basisregistratie-gewaspercelen-brp-` | Fetched directly |
| OGC API Features landing page | `https://api.pdok.nl/rvo/gewaspercelen/ogc/v1?f=html\|json` | Fetched directly, live |
| OGC API collections | `https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections?f=json` | Fetched directly, live |
| OGC API items (the actual data) | `https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections/brpgewas/items` | Fetched directly, live, returned a real feature |
| OpenAPI spec | `https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/api?f=json` | Linked from the landing page (not independently fetched this sprint) |
| Conformance | `https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/conformance?f=json` | Linked from the landing page |
| WMS/WFS/ATOM (legacy-style services, same dataset) | Referenced via `https://www.pdok.nl/ogc-webservices/-/article/basisregistratie-gewaspercelen-brp-` | Confirmed to exist, not individually fetched |
| Nationaal Georegister metadata (API-level) | `https://nationaalgeoregister.nl/geonetwork/srv/dut/catalog.search#/metadata/da1d9b80-05d3-4aed-ad63-5c9efcc847c4` | Linked from the live API's own landing-page `links` array |
| Nationaal Georegister metadata (dataset-level) | `https://nationaalgeoregister.nl/geonetwork/srv/dut/catalog.search#/metadata/b812a145-b4fe-4331-8dc6-d914327a87ff` | Linked from the live API's own landing-page `links` array |

## Collection details (confirmed live)

- **Collection id**: `brpgewas`
- **Title**: "BRP Gewaspercelen"
- **Item type**: Feature (Polygon geometry)
- **Bounding box (CRS84)**: `[-1.657292, 48.040502, 12.431727, 56.110590]` (covers the whole Kingdom of the Netherlands including Caribbean territories, per the standard PDOK extent convention)
- **Storage CRS**: `EPSG:28992` (Amersfoort / RD New — the Dutch national grid)
- **Also supported**: `OGC:CRS84` (WGS84 lon/lat — what FarmOS already uses for farm coordinates), `EPSG:3857` (Web Mercator), `EPSG:4258` (ETRS89)

## Fields actually returned (confirmed from a real live feature)

```json
{
  "type": "Feature",
  "geometry": { "type": "Polygon", "coordinates": [ /* ... */ ] },
  "properties": {
    "category": "Landschapselement",
    "gewas": "Sloot",
    "gewascode": 343,
    "jaar": 2025,
    "status": "Definitief"
  }
}
```

Field meanings (Dutch, as returned — FarmOS's mapper must translate, not invent English equivalents):
- `category` — e.g. "Landschapselement" (landscape element) vs. presumably a crop-parcel category. **Important finding**: the very first live feature fetched was a landscape element (a ditch, `gewas: "Sloot"`), not a crop parcel — confirming this dataset includes non-crop features and FarmOS's connector must filter by `category` rather than assume every polygon is a farmable parcel.
- `gewas` — the declared crop/feature name, in Dutch.
- `gewascode` — a numeric crop code (a lookup table for these codes was not independently fetched this sprint — flagged as an open item).
- `jaar` — the dataset year (see "Update frequency" below).
- `status` — e.g. "Definitief" (definitive/final) — implying a non-final/provisional status value also exists, not yet confirmed.

The response envelope includes standard OGC API Features fields: `type: "FeatureCollection"`, `timeStamp`, `numberReturned`, and a `links` array — including a **cursor-based** `next` link (`cursor=...`), confirming pagination is cursor-based, not offset-based.

## Licensing — confirmed authoritatively

The API's own landing page declares, via a machine-readable `rel="license"` link: **"Public Domain Mark 1.0"** (`https://creativecommons.org/publicdomain/mark/1.0/deed.nl`). This is the dataset-specific, authoritative answer — more precise than PDOK's general copyright page (which names CC-BY-4.0 only for four specific *other* datasets: BRT Achtergrondkaart, Bestuurlijke Grenzen, TOPraster, TOPNL). **Do not assume CC-BY-4.0 applies to BRP Gewaspercelen** — its own metadata says Public Domain, a different and more permissive designation. No attribution is legally required under Public Domain Mark, though showing source attribution in the UI is still the right thing to do for user trust (see Part 14 disclaimer components).

## Update frequency / dataset year

**Annual**, with a fixed reference date (**peildatum**) of **15 May** each year — "van elk jaar wordt een dataset gegenereerd van peildatum 15 mei." The most recent confirmed version as of this sprint is **BRP Gewaspercelen 2025 definitief**, published 2026-03-17. This means:
- The dataset always lags reality by up to ~10 months (a farmer's 2026 season crop won't appear until roughly March 2027, based on the 2025→2026-03 publication gap observed).
- `jaar: 2025` in a feature means "as declared for the 15 May 2025 reference date," not "current in 2026."

## Authentication / access

**None required.** Confirmed directly: the OGC API landing page states no authentication and no usage cost, and the live `/collections/brpgewas/items` request succeeded with a plain unauthenticated `GET`.

## Rate limits

Not documented on any page fetched this sprint. No explicit limit was hit during the (small number of) live test requests made. Flagged as an open question for `docs/RVO_PDOK_Integration_Questions.md`.

## Completeness / data-quality note (Part 1 requirement)

The dataset is explicitly **farmer-declared**: "Users must annually delineate their crop parcels and declare which crops are cultivated" as part of RVO's Gecombineerde Opgave (Combined Declaration) process. This means:
- It reflects what was *declared*, not necessarily ground truth.
- It reflects the state as of the *declaration year's* reference date, not the current growing season.
- It is **not** the same system as an individual farmer's live "Mijn percelen" account (see below).

---

## Part 2 — the distinction this integration must never blur

Two genuinely different systems exist, both operated ultimately by RVO:

1. **BRP Gewaspercelen via PDOK** (what this sprint integrates): a public, annual, anonymous, aggregate dataset of *all* declared parcels nationwide, published roughly 10 months after the fact, under a Public Domain licence, with no authentication and no concept of "which user this belongs to." A polygon appearing near a farm's coordinates is **not evidence that farm's owner declared it** — it could be a neighbor's field.
2. **RVO "Mijn percelen"**: an individual farmer's own, current, authenticated registration — logged into via eHerkenning (minimum trust level 2+, tied to the farm's KVK/Chamber-of-Commerce registration) or DigiD. This is the farmer's real, live, legally-declared parcel data.

**Confirmed this sprint**: RVO does operate a real webservices program for software developers (`https://www.rvo.nl/onderwerpen/webservices`) — access requires the requesting software system to be **registered/known to RVO in advance**, connects via **eHerkenning**, and for some webservices a **PKI certificate** is required. An official "Connecting to RVO webservices" instruction document is referenced as existing. This means an authenticated, personal Mijn-percelen integration is **not hypothetical** — RVO has a real program for it — but it requires a genuine business/legal onboarding process (registering FarmOS as a known software system with RVO) that cannot be completed inside a coding sprint. It is out of scope for this sprint and is correctly deferred as "future partnership/authenticated integration," per the brief.

**What FarmOS's BRP import feature (Part 10) may honestly claim**: "here are publicly registered parcels near your farm's coordinates, for you to review and confirm — sourced from the [year] national BRP dataset, not from your own RVO account." **What it must never claim**: that a nearby polygon belongs to the signed-in user, that it reflects their current/live RVO declaration, or that confirming it inside FarmOS updates or replaces anything in the real Mijn percelen system.
