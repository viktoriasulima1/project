import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markConflict, requiresReview } from '../conflict';
import { MemoryOfflineRepository } from '../memory';
import { logOfflineEvent } from '../observability';
import { processQueue, synchronizeDraft } from '../sync';
import type { LocalActivityDraft } from '../types';

function draft(overrides:Partial<LocalActivityDraft>={}):LocalActivityDraft{return{localDraftId:'d1',schemaVersion:1,namespace:'u:f',farmId:'f',userRef:'u',activityType:'spray',status:'ready_to_sync',formData:{type:'spray',status:'completed'},createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',syncAttemptCount:0,idempotencyKey:'key',...overrides}}
const identity={userRef:'u',farmId:'f',namespace:'u:f'};
const okFetch=vi.fn(async()=>new Response(JSON.stringify({success:true,activityId:'a1'}),{status:200}));

describe('offline synchronization safety',()=>{
  beforeEach(() => vi.clearAllMocks());
  it('19. successful sync retains receipt but clears detailed payload',async()=>{const r=new MemoryOfflineRepository();await r.putDraft(draft());const x=await synchronizeDraft(draft(),identity,r,okFetch as typeof fetch);expect(x.formData).toEqual({});expect(await r.listReceipts('u:f')).toHaveLength(1)});
  it('20. deleted field conflict does not retry',async()=>{const r=new MemoryOfflineRepository();const f=vi.fn(async()=>new Response(JSON.stringify({category:'conflict',error:'Field was deleted'}),{status:409}));expect((await synchronizeDraft(draft(),identity,r,f as typeof fetch)).status).toBe('conflict')});
  it('21. insufficient stock conflict does not finalize',async()=>{const r=new MemoryOfflineRepository();const f=vi.fn(async()=>new Response(JSON.stringify({category:'insufficient_stock',error:'Insufficient stock'}),{status:409}));const x=await synchronizeDraft(draft(),identity,r,f as typeof fetch);expect(x.safeErrorCategory).toBe('insufficient_stock')});
  it('22. product archived conflict requires review',()=>expect(requiresReview('stale_reference')).toBe(true));
  it('23. changed farm cannot submit',async()=>{const r=new MemoryOfflineRepository();expect((await synchronizeDraft(draft(),{...identity,farmId:'other'},r,okFetch as typeof fetch)).status).toBe('conflict');expect(okFetch).not.toHaveBeenCalled()});
  it('24. stale schema is a non-retryable conflict',()=>expect(markConflict(draft(),'schema','changed').status).toBe('conflict'));
  it('25. offline completed spray is pending before server response',()=>expect(draft().status).toBe('ready_to_sync'));
  it('26. network failure schedules a retry',async()=>{const r=new MemoryOfflineRepository();const f=vi.fn(async()=>{throw new Error('offline')});expect((await synchronizeDraft(draft(),identity,r,f as typeof fetch)).status).toBe('ready_to_sync')});
  it('27. successful response marks exactly one server activity',async()=>{const r=new MemoryOfflineRepository();const x=await synchronizeDraft(draft(),identity,r,okFetch as typeof fetch);expect(x.serverActivityId).toBe('a1')});
  it('28. signed-out/different user stops sync',async()=>{const r=new MemoryOfflineRepository();const f=vi.fn();await synchronizeDraft(draft(),{...identity,userRef:'other'},r,f as typeof fetch);expect(f).not.toHaveBeenCalled()});
  it('29. another user cannot process queued item',async()=>{const r=new MemoryOfflineRepository();await r.putDraft(draft());const f=vi.fn();expect(await processQueue({...identity,userRef:'other',namespace:'other:f'},r,f as typeof fetch)).toEqual([])});
  it('30. safe logs exclude activity payload and notes',()=>{const spy=vi.spyOn(console,'info').mockImplementation(()=>{});logOfflineEvent({event:'sync_failed',farmId:'f',localDraftId:'d1',errorCategory:'network'});expect(spy.mock.calls[0][1]).not.toContain('notes');spy.mockRestore()});
  it('31. structured authorization is not mislabeled as conflict and persists no server prose',async()=>{const r=new MemoryOfflineRepository();const f=vi.fn(async()=>new Response(JSON.stringify({ok:false,error:{code:'REQUEST_NOT_ALLOWED',category:'authorization',retryable:false,correlationId:'corr_12345678'}}),{status:403}));const x=await synchronizeDraft(draft(),identity,r,f as typeof fetch);expect(x).toMatchObject({status:'conflict',safeErrorCategory:'authorization',safeError:{code:'REQUEST_NOT_ALLOWED',category:'authorization'}});expect(JSON.stringify(x)).not.toContain('Untrusted request origin')});
  it('32. legacy raw server text is ignored before persistence',async()=>{const r=new MemoryOfflineRepository();const f=vi.fn(async()=>new Response(JSON.stringify({category:'validation',error:'Prisma secret table details'}),{status:400}));const x=await synchronizeDraft(draft(),identity,r,f as typeof fetch);expect(x.safeError).toMatchObject({code:'INVALID_VALUE'});expect(JSON.stringify(x)).not.toContain('Prisma secret')});
});
