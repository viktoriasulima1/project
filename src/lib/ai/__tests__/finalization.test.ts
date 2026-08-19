import { describe, expect, it } from 'vitest';
import { canExplicitlyLinkWorkOrder, matchActivityDraftToWorkOrders, type MatchableWorkOrder } from '../work-order-matcher';
import { detectMultipleActivities } from '../multi-activity';
import { createSplitActivityDrafts } from '@/offline/drafts';
import { MAX_AUDIO_BYTES, validateAudioContract } from '../transcription';

const order: MatchableWorkOrder = { id: 'wo-1', farmId: 'farm-a', version: 3, title: 'WO-014 Spray North', status: 'ready', operationType: 'spray', fieldSeasonId: 'field-north', plannedStart: new Date('2026-07-18'), plannedEnd: new Date('2026-07-20'), dueDate: new Date('2026-07-20'), expectedAreaHa: 10, expectedProductId: 'product-a', employeeIds: ['employee-a'], machineId: 'machine-a', fieldName: 'North', crop: 'wheat' };
const draft = { activityType: 'spray', fieldSeasonId: 'field-north', productId: 'product-a', areaHa: 10.5, occurredAt: new Date('2026-07-19'), employeeId: 'employee-a', machineId: 'machine-a' };

describe('deterministic WorkOrder matching', () => {
  it('produces a strong exact match with field/operation/product/date evidence', () => { const result = matchActivityDraftToWorkOrders(draft, 'farm-a', [order])[0]; expect(result.status).toBe('strong_match'); expect(result.evidence.filter((e) => e.result === 'match').map((e) => e.field)).toEqual(expect.arrayContaining(['Field', 'Operation', 'Product', 'Date/window'])); });
  it('uses area tolerance', () => expect(matchActivityDraftToWorkOrders({ ...draft, areaHa: 10.9 }, 'farm-a', [order])[0].evidence.find((e) => e.field === 'Area')?.result).toBe('match'));
  it('reports a possible match when optional comparison data is absent', () => expect(matchActivityDraftToWorkOrders({ ...draft, productId: null, areaHa: null, employeeId: null, machineId: null }, 'farm-a', [order])[0].status).toBe('strong_match'));
  it('marks a material field conflict and disables linking', () => { const result = matchActivityDraftToWorkOrders({ ...draft, fieldSeasonId: 'south' }, 'farm-a', [order])[0]; expect(result.status).toBe('conflict'); expect(canExplicitlyLinkWorkOrder(result)).toBe(false); });
  it('marks product conflict material', () => expect(matchActivityDraftToWorkOrders({ ...draft, productId: 'other' }, 'farm-a', [order])[0].materialConflicts).toContain('Product'));
  it('excludes completed and cancelled orders', () => expect(matchActivityDraftToWorkOrders(draft, 'farm-a', [{ ...order, status: 'completed' }, { ...order, id: '2', status: 'cancelled' }])).toHaveLength(0));
  it('excludes foreign-farm orders and arbitrary ids', () => expect(matchActivityDraftToWorkOrders(draft, 'farm-a', [{ ...order, farmId: 'farm-b' }])).toHaveLength(0));
  it('preserves server version for optimistic revalidation', () => expect(matchActivityDraftToWorkOrders(draft, 'farm-a', [order])[0].version).toBe(3));
});

describe('multi-activity split', () => {
  it('detects two clear operations and preserves spans', () => { const result = detectMultipleActivities('Sprayed field North with A, then fertilised field South with B.'); expect(result.classification).toBe('multiple_activities'); expect(result.candidates).toHaveLength(2); expect(result.candidates[0].originalTextSpan).toContain('Sprayed'); });
  it('marks a conjunction with one operation ambiguous', () => expect(detectMultipleActivities('Applied fertiliser to North and South fields.').classification).toBe('ambiguous'));
  it('bounds split candidates at five', () => { const result = detectMultipleActivities('Sprayed A; sprayed B; sprayed C; sprayed D; sprayed E; sprayed F'); expect(result.candidates).toHaveLength(5); expect(result.truncated).toBe(true); });
  it('creates separate stable exact-one identities without ready-to-sync state', () => { const drafts = createSplitActivityDrafts({ userRef: 'u', farmId: 'f' }, [{ activityType: 'spray', originalTextSpan: 'Sprayed North' }, { activityType: 'fertilise', originalTextSpan: 'Fertilised South' }]); expect(new Set(drafts.map((d) => d.localDraftId)).size).toBe(2); expect(new Set(drafts.map((d) => d.idempotencyKey)).size).toBe(2); expect(new Set(drafts.map((d) => d.splitGroupId)).size).toBe(1); expect(drafts.every((d) => d.status === 'draft' && d.aiReviewState === 'unreviewed')).toBe(true); });
});

describe('voice data contract', () => {
  it('accepts supported bounded audio', () => expect(validateAudioContract({ mimeType: 'audio/webm', byteSize: 1000, durationSeconds: 20 }).ok).toBe(true));
  it('rejects unsupported MIME', () => expect(validateAudioContract({ mimeType: 'text/plain', byteSize: 10, durationSeconds: 1 })).toMatchObject({ ok: false, category: 'unsupported_mime' }));
  it('rejects oversized or overlong audio', () => { expect(validateAudioContract({ mimeType: 'audio/webm', byteSize: MAX_AUDIO_BYTES + 1, durationSeconds: 1 }).ok).toBe(false); expect(validateAudioContract({ mimeType: 'audio/webm', byteSize: 10, durationSeconds: 61 }).ok).toBe(false); });
});
