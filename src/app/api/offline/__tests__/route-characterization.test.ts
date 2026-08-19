import { describe, expect, it } from 'vitest';
import { POST as activitySync } from '../sync/route';
import { POST as financeSync } from '../finance-sync/route';

function request(body: string, origin = 'http://localhost') {
  return new Request('http://localhost/api/offline/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body,
  });
}

describe('offline API targeted error characterization', () => {
  it.each([
    ['activity', activitySync],
    ['finance', financeSync],
  ])('%s sync rejects an untrusted mutation origin with 403', async (_name, handler) => {
    const response = await handler(request('{}', 'https://evil.example'));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'REQUEST_NOT_ALLOWED', category: 'authorization', retryable: false } });
  });

  it('activity sync maps malformed JSON and missing payload to distinct 400 branches', async () => {
    const malformed = await activitySync(request('{'));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ ok: false, error: { code: 'INVALID_VALUE', category: 'validation', retryable: false, field: 'formData' } });
    const missing = await activitySync(request('{}'));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ ok: false, error: { code: 'REQUIRED_FIELD', category: 'validation', retryable: false, field: 'formData' } });
  });

  it('finance sync rejects malformed drafts and missing exact-one identities without mutation', async () => {
    const malformed = await financeSync(request('{}'));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ ok: false, error: { code: 'INVALID_VALUE', category: 'validation', retryable: false, field: 'formData' } });
    const missingIds = await financeSync(request(JSON.stringify({ recordType: 'expense', formData: {} })));
    expect(missingIds.status).toBe(400);
    expect(await missingIds.json()).toMatchObject({ ok: false, error: { code: 'REQUIRED_FIELD', category: 'validation', retryable: false, field: 'formData', metadata: { fields: ['localDraftId', 'idempotencyKey'] } } });
  });
});
