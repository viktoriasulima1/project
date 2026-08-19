import { CtgbUnavailableError, CtgbRateLimitError } from './errors';
import { validateRawAuthorisationCollection, validateRawAuthorisationSingle } from './validation';
import { mapCtgbAuthorisation } from './mapper';
import { getCachedProduct, searchCachedProducts, upsertCachedProduct, CTGB_CACHE_FRESH_HOURS } from './cache';
import { isCtgbMockEnabled, mockCtgbSearchResponse, mockCtgbSingleResponse } from './mock-fixtures';
import type { CtgbLookupResult, NormalizedCtgbProduct } from './types';

// A query/id containing this literal string deterministically triggers the
// unavailable path even in mock mode — Sprint 18 Part 18's failure-flow
// E2E test needs a reliable way to exercise this without real network
// manipulation.
const MOCK_UNAVAILABLE_TRIGGER = 'E2E_UNAVAILABLE';

// Documented base URL — see docs/Ctgb_Official_Data_Audit.md. A live
// unauthenticated request to this exact URL returned 403 during this
// integration's own research; the client below is still built to call the
// real endpoint (never a stub), and degrades honestly when it fails.
const CTGB_BASE_URL = 'https://public.mst.ctgb.nl/public-api/1.0';
const FETCH_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** No documented rate limit exists (see the audit doc) — this fixed
 * timeout+backoff is a conservative default, not derived from a published
 * limit. Revisit once Ctgb answers docs/Ctgb_API_Questions.md. */
async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/vnd.api+json' },
      });
      clearTimeout(timeout);

      if (res.status === 429) throw new CtgbRateLimitError();
      if (res.status >= 500) {
        lastError = new CtgbUnavailableError(`upstream returned ${res.status}`);
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
          continue;
        }
        throw lastError;
      }
      if (!res.ok) {
        // A real rejection (403/404/etc.) — not a transient failure, don't retry.
        throw new CtgbUnavailableError(`upstream returned ${res.status}`);
      }
      return res;
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof CtgbRateLimitError || e instanceof CtgbUnavailableError) throw e;
      lastError = e;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      throw new CtgbUnavailableError('network error or timeout', e);
    }
  }
  throw new CtgbUnavailableError('exhausted retries', lastError);
}

function safeReason(e: unknown): string {
  // Never surface a raw upstream body/stack — a short, safe category only.
  if (e instanceof CtgbUnavailableError || e instanceof CtgbRateLimitError) return e.message;
  return 'Ctgb source unavailable';
}

/**
 * Searches the live Ctgb API for products by name. On any failure
 * (network, timeout, non-2xx, validation), falls back to whatever this
 * farm's prior successful lookups have cached — never invents data, and
 * always reports the degraded/unavailable state honestly (Sprint 18 Part 3).
 */
export async function searchCtgbProducts(query: string): Promise<CtgbLookupResult> {
  const url = `${CTGB_BASE_URL}/authorisations?filter[productName]=${encodeURIComponent(query)}&page[limit]=20`;
  try {
    if (query.includes(MOCK_UNAVAILABLE_TRIGGER)) throw new CtgbUnavailableError('E2E-forced unavailable');
    const raw = isCtgbMockEnabled() ? mockCtgbSearchResponse() : await (await fetchWithRetry(url)).json();
    const validated = validateRawAuthorisationCollection(raw);
    const fetchedAt = new Date();
    const products: NormalizedCtgbProduct[] = validated.data.map((resource) =>
      mapCtgbAuthorisation(resource, url, fetchedAt, null),
    );
    await Promise.all(products.map((p) => upsertCachedProduct(p).catch(() => undefined)));
    return {
      state: products.some((p) => p.isIncomplete) ? 'degraded' : 'ok',
      products,
    };
  } catch (e) {
    const cached = await searchCachedProducts(query);
    return {
      state: cached.length > 0 ? 'degraded' : 'unavailable',
      products: cached,
      unavailableReason: safeReason(e),
    };
  }
}

/** Fetches one product by its Ctgb source id, with the same
 * fetch-then-cache-fallback behavior as `searchCtgbProducts`. */
export async function getCtgbProductById(sourceProductId: string): Promise<CtgbLookupResult> {
  const url = `${CTGB_BASE_URL}/authorisations/${encodeURIComponent(sourceProductId)}`;
  try {
    if (sourceProductId.includes(MOCK_UNAVAILABLE_TRIGGER)) throw new CtgbUnavailableError('E2E-forced unavailable');
    const raw = isCtgbMockEnabled() ? mockCtgbSingleResponse() : await (await fetchWithRetry(url)).json();
    const validated = validateRawAuthorisationSingle(raw);
    const fetchedAt = new Date();
    const product = mapCtgbAuthorisation(validated.data, url, fetchedAt, null);
    await upsertCachedProduct(product).catch(() => undefined);
    return { state: product.isIncomplete ? 'degraded' : 'ok', products: [product] };
  } catch (e) {
    const cached = await getCachedProduct(sourceProductId);
    if (!cached) {
      return { state: 'unavailable', products: [], unavailableReason: safeReason(e) };
    }
    return {
      state: cached.isStale ? 'degraded' : 'ok',
      products: [cached.product],
      unavailableReason: cached.isStale ? `Showing cached data, ${cached.ageMinutes} minutes old` : undefined,
    };
  }
}

export { CTGB_CACHE_FRESH_HOURS };
