# Ctgb API Questions — for post@ctgb.nl

Drafted from real gaps found during this sprint's own verification (see `docs/Ctgb_Official_Data_Audit.md`) — every question below exists because official documentation either didn't answer it or a live test contradicted what documentation implied. None of these are hypothetical.

1. **Is commercial SaaS use of the public webservice permitted?** The dataset itself is CC-0 (confirmed via data.overheid.nl), but CC-0 covers the *data*, not necessarily unrestricted automated *API access* at any volume. Please confirm whether a commercial farm-management SaaS product may call the webservice on behalf of its users, and whether that requires a separate agreement from the CC-0 data licence.

2. **Is full-dataset synchronization allowed, or must access remain per-product/on-demand?** We have deliberately built our integration to only fetch products actually in use by a farm (never a bulk copy) specifically because this wasn't confirmed either way. If bulk/full synchronization is permitted, please point us to the terms governing it.

3. **What attribution is required, if any?** Ctgb's own site states data is public and reusable; we display "Source: official Ctgb Toelatingendatabank" plus a fetch timestamp in our UI regardless, but would like to confirm whether a specific attribution format or notice is actually required.

4. **What rate limits apply to the public API?** No rate limit is documented anywhere we found (ctgb.nl help pages, the 2017 "Voorbeelden MST Public API" PDF, or the data.overheid.nl catalog entry). We've built in a conservative client-side timeout/backoff and a 24-hour cache, but would appreciate the actual documented limit so we're not guessing.

5. **Is the public API (`https://public.mst.ctgb.nl/public-api/1.0/`) still the correct, current base URL?** A live, unauthenticated `GET` request to `/authorisations` from this integration returned **HTTP 403 Forbidden** during this sprint's testing (2026-07-13), which contradicts the 2017 documentation's description of the API as requiring no authentication. Has authentication/registration been introduced since 2017? If so, how does a software vendor request access?

6. **Are all plant-protection product use authorisations available structurally through the API** (dose ranges, BBCH restrictions, PHI, buffer zones, application counts/intervals), **or only a subset?** Ctgb's own help page states application-level data for fungicides, growth regulators, and other product types is still being added — we'd like to know which use-level fields are reliably structured today versus only available in the human-readable label/PDF.

7. **How should amendments/revocations to an authorisation be tracked over time?** Our product keeps its own historical snapshot at the moment a farmer completes a regulated activity (so a later authorisation change never silently rewrites a past compliance record — see `docs/Sprint_18_Ctgb_BRP_Report.md` Part 5) and flags affected historical records for human review when we detect a status change on our own periodic check. Is there an official "last modified"/changelog feed we should be polling instead of diffing snapshots ourselves? (`/masterdata/lastmodified` is named in the 2017 documentation but its exact semantics were not independently confirmed this sprint.)

8. **Is there a stable production API and a published versioning policy?** The fullest technical reference we could find (`https://mstpublicapi.docs.apiary.io/`) was unreachable during this sprint (TLS hostname mismatch on one URL form, HTTP 502 on another) — is this documentation still maintained, and is there a more current reference we should be using instead?

9. **Is there a working, current bulk-download link?** The XLS export URL listed in Ctgb's own data.overheid.nl catalog entry (`https://ctgb.blob.core.windows.net/documents/public-authorisations-report.xls`) no longer resolves (`ENOTFOUND`). Could you point us to the current download location?
