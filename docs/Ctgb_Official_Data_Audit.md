# Ctgb Official Data Audit

Primary-source verification only. Every claim below was checked directly against ctgb.nl, its linked official documents, or data.overheid.nl's catalog record during this sprint (2026-07-13) — not reconstructed from general knowledge. Where verification failed or was inconclusive, that is stated explicitly rather than guessed past.

## What Ctgb is

The Ctgb (College voor de toelating van gewasbeschermingsmiddelen en biociden — the Dutch Board for the Authorisation of Plant Protection Products and Biocides) maintains the **Bestrijdingsmiddelendatabank** (Pesticides Database / Toelatingendatabank), the authoritative register of every crop-protection product and biocide authorised for use in the Netherlands.

## Exact official endpoints found

| Source | URL | Verified how |
|---|---|---|
| Public search UI | `https://toelatingen.ctgb.nl/` | Confirmed live (returned HTTP 403 to an automated fetch — see "Live test results" below; the site itself is real and referenced consistently across ctgb.nl and data.overheid.nl) |
| Official instruction document | `https://www.ctgb.nl/site/binaries/site-content/collections/documents/2017/09/26/voorbeelding-mst-public-api/MST+Public+API.pdf` ("Voorbeelden MST Public API") | Fetched directly — 21-page PDF, dated 2017-09-26, still linked from ctgb.nl's current documents index as of this sprint |
| Documented base URL (from the PDF above) | `https://public.mst.ctgb.nl/public-api/1.0/` | Sourced from the official PDF; a live unauthenticated test request to this base returned **403 Forbidden** (see below) |
| Apiary-hosted full API reference (linked from the PDF and data.overheid.nl) | `https://mstpublicapi.docs.apiary.io/` | **Unreachable** — TLS certificate hostname mismatch on one URL form, HTTP 502 on another. Apiary.io (the third-party doc-hosting platform) appears to be degraded or this specific project's docs are no longer served. This is a real, current gap: the one place the *complete* endpoint reference was supposed to live is not reachable today. |
| Official open-data catalog record | `https://data.overheid.nl/dataset/overzicht-toegelaten-middelen-in-de-bestrijdingsmiddelendatabank` | Fetched directly |
| Catalog-listed bulk download | `https://ctgb.blob.core.windows.net/documents/public-authorisations-report.xls` | **DNS lookup failed (`ENOTFOUND`)** — this specific Azure Blob Storage hostname does not resolve. The catalog record listing it was itself last updated 2020-08-29, so this is very plausibly a stale link, not a live one. |
| Contact | `post@ctgb.nl` | Listed in the official PDF |

## Resources documented in the official 2017 PDF (JSON:API format)

- `GET /authorisations` — list/search, with filters: `filter[productName]`, `filter[categorie]`, `filter[biocideProductTypes]`, `filter[activeSubstances]` (comma-separated IDs), `filter[pppTargetCrops]`, `filter[pppTargetOrganisms]`, `filter[lastModifiedDateFrom]`, plus `page[offset]`/`page[limit]` and `sort`.
- `GET /authorisations/{id}` — single record (examples in the PDF: `/authorisations/686`, `/authorisations/2240`).
- `GET /masterdata/biocide/producttypes`
- `GET /masterdata/ppp/targetcrops` and `/masterdata/ppp/targetcrops/lists`
- `GET /masterdata/ppp/targetorganisms` and `/masterdata/ppp/targetorganisms/lists`
- `GET /masterdata/authorisationholders`
- `GET /masterdata/lastmodified` — apparently a change-detection endpoint

Response format follows the [JSON:API](http://jsonapi.org/) specification. No field-by-field response schema could be verified this sprint (the Apiary reference that would show one is unreachable — see above).

## Live test results (this sprint)

A single unauthenticated `GET https://public.mst.ctgb.nl/public-api/1.0/authorisations?page[limit]=1` request was made (one request only, respecting the possibility of undocumented rate limits). **Result: HTTP 403 Forbidden.**

This contradicts the 2017 documentation's framing of the API as requiring no authentication ("Alle gegevens uit de databank zijn openbaar en kunnen door externe partijen worden gebruikt"). Three explanations are equally plausible and none can be confirmed without contacting Ctgb directly:
1. The API now requires an API key or registration that wasn't required in 2017.
2. The endpoint blocks non-browser / automated user agents (bot protection) rather than requiring real authentication.
3. The specific base URL has moved and `public.mst.ctgb.nl` no longer resolves to the live service.

**This is the single most important open question for this integration** — see `docs/Ctgb_API_Questions.md`.

## Licensing / reuse conditions

**Confirmed via data.overheid.nl's official catalog metadata**: the dataset is published under **CC-0 (1.0)** — a public-domain dedication, no restrictions on reuse, including commercial use. This is the strongest and clearest finding of this audit: however the data is actually retrieved, its reuse terms are unambiguous.

## Formats available

- Webservice/API (JSON:API, per the 2017 PDF)
- Downloadable Excel (`.xls`) export of "basisgegevens van alle middelen (toegelaten en vervallen)" — approved and expired products
- All Ctgb's own documents (PDF/ODT for text, ODS for spreadsheets) follow open-standard formats per their stated Web Guidelines compliance

## Update frequency

Ctgb's own help page states the live database is "refreshed every minute" during use — i.e., the underlying database is effectively real-time. This is distinct from the data.overheid.nl **catalog record's** "last updated" stamp (2020-08-29), which only reflects when the *catalog listing itself* was last edited, not the freshness of the underlying data. Do not confuse the two.

## Rate limits

**Not documented anywhere found.** Neither the ctgb.nl help pages, the 2017 PDF, nor the data.overheid.nl catalog record state a rate limit. Given the live 403 result above, this may be moot until basic access is resolved.

## Dataset year/version

The authorisation database itself is not year-versioned the way BRP is — it reflects current authorisation status continuously (per the "refreshed every minute" claim). Historical/point-in-time snapshots are not a documented feature of the public API. This has a direct consequence for Sprint 18 Part 5 (historical compliance snapshots): FarmOS must capture and store its own snapshot at the moment of use, because Ctgb's API does not appear to offer a way to ask "what did authorisation X look like on date Y."

## Completeness warnings (Ctgb's own words)

The Ctgb help page itself states the database is actively being **expanded** — application-level data ("toepassingen") for fungicides, growth regulators, and other crop-protection products is described as being added over time, implying **not every product's use-authorisation detail is present today**. This is a first-party admission of incompleteness, not this project's inference, and directly justifies Sprint 18 Part 4's "do not assume every field exists" instruction.

## Contact for unanswered questions

`post@ctgb.nl` — the only contact address found in official material. See `docs/Ctgb_API_Questions.md` for the specific questions to send.

## Summary verdict for this sprint

- **License**: clear and favorable (CC-0).
- **Data existence and structure**: well-documented in principle (JSON:API, specific resources/filters named in an official PDF).
- **Live access**: **unverified/blocked** as of this sprint — a real request was refused. FarmOS's Ctgb connector (Part 3) must be built to treat "Ctgb unavailable" as the expected, primary state until this is resolved with Ctgb directly, not an edge case.
- **Bulk download**: the one concretely-linked bulk file URL is dead. A working download link would need to be re-located from the current ctgb.nl/toelatingen.ctgb.nl site by a human, or provided by Ctgb directly in response to the outreach in `Ctgb_API_Questions.md`.
