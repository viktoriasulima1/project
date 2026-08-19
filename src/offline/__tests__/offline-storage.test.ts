import { describe, expect, it, vi } from 'vitest';
import { createLocalDraft, draftAge, formDataToRecord } from '../drafts';
import { markUnmigratableDraft, migrateDraft } from '../migrations';
import { MemoryOfflineRepository } from '../memory';
import { backoffDelay } from '../network';
import { canAttempt, enqueueDraft, MAX_SYNC_ATTEMPTS, scheduleRetry } from '../queue';
import { offlineNamespace, type LocalActivityDraft } from '../types';
import { createRecoveryExport, parseRecoveryImport } from '../recovery';
import { inspectOfflineStorage } from '../storage';
import { withQueueLock } from '../lock';

vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('11111111-1111-4111-8111-111111111111').mockReturnValue('22222222-2222-4222-8222-222222222222') });

function draft(overrides: Partial<LocalActivityDraft> = {}): LocalActivityDraft {
  return { localDraftId:'d1',schemaVersion:1,namespace:'u:f',farmId:'f',userRef:'u',activityType:'scout',status:'draft',formData:{ type:'scout', fieldSeasonId:'field' },createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',syncAttemptCount:0,idempotencyKey:'k1',...overrides };
}

describe('offline storage and drafts', () => {
  it('1. draft persists and reloads', async () => { const r=new MemoryOfflineRepository(); await r.putDraft(draft()); expect((await r.getDraft('d1'))?.formData.type).toBe('scout'); });
  it('2. namespace isolates users', async () => { const r=new MemoryOfflineRepository(); await r.putDraft(draft()); expect(await r.listDrafts('other:f')).toEqual([]); });
  it('3. namespace isolates farms', async () => { const r=new MemoryOfflineRepository(); await r.putDraft(draft()); expect(await r.listDrafts('u:other')).toEqual([]); });
  it('4. current schema migrates deterministically', () => expect(migrateDraft(draft()).schemaVersion).toBe(1));
  it('5. corrupt draft becomes needs_review when identity is recoverable', () => expect(markUnmigratableDraft({ ...draft(), formData:null }, 'bad')?.status).toBe('needs_review'));
  it('6. signed-out namespace cannot read previous drafts', async () => { const r=new MemoryOfflineRepository(); await r.putDraft(draft()); expect(await r.listDrafts('signed-out')).toHaveLength(0); });
  it('7. latest autosave overwrites the same stable draft', async () => { const r=new MemoryOfflineRepository(); await r.putDraft(draft()); await r.putDraft(draft({formData:{type:'scout',notes:'latest'}})); expect((await r.getDraft('d1'))?.formData.notes).toBe('latest'); });
  it('8. wording reports local age honestly', () => expect(draftAge('2026-01-01T00:00:00Z',new Date('2026-01-01T00:05:00Z').getTime())).toBe('5m ago'));
  it('9. clearSynced leaves unsynchronized drafts', async () => { const r=new MemoryOfflineRepository(); await r.putDraft(draft()); await r.putDraft(draft({localDraftId:'d2',status:'synced'})); await r.clearSynced('u:f'); expect((await r.listDrafts('u:f')).map(d=>d.localDraftId)).toEqual(['d1']); });
  it('10. offline submission enqueues', async () => { const r=new MemoryOfflineRepository(); expect((await enqueueDraft(draft(),r)).status).toBe('ready_to_sync'); });
  it('11. namespace composition is stable', () => expect(offlineNamespace('u','f')).toBe('u:f'));
  it('12. queue repository returns oldest first', async () => { const r=new MemoryOfflineRepository(); await r.putDraft(draft({localDraftId:'new',createdAt:'2026-02-01T00:00:00Z'})); await r.putDraft(draft({localDraftId:'old'})); expect((await r.listDrafts('u:f'))[0].localDraftId).toBe('old'); });
  it('13. backoff grows exponentially and is capped', () => { expect(backoffDelay(1)).toBe(1000); expect(backoffDelay(99)).toBe(60000); });
  it('14. max-attempt items do not run', () => expect(canAttempt(draft({status:'failed',syncAttemptCount:MAX_SYNC_ATTEMPTS}))).toBe(false));
  it('15. future schema fails safely', () => expect(() => migrateDraft({...draft(),schemaVersion:99})).toThrow(/newer/));
  it('16. missing schema fails safely', () => expect(() => migrateDraft(({...draft(),schemaVersion:undefined}))).toThrow(/schema version/));
  it('17. stable UUID and idempotency keys survive edits', () => { const a=draft(); const b=createLocalDraft({userRef:'u',farmId:'f'},'scout',{notes:'x'},a); expect([b.localDraftId,b.idempotencyKey]).toEqual(['d1','k1']); });
  it('17b. blank optional controls are omitted from offline payloads', () => { const form=new FormData();form.set('type','scout');form.set('machineHours','');form.set('fuelInventoryItemId','');expect(formDataToRecord(form)).toEqual({type:'scout'}); });
  it('18. retry scheduling increments attempt', () => expect(scheduleRetry(draft({status:'ready_to_sync'})).syncAttemptCount).toBe(1));
  it('31. recovery export carries schema and stable local ID', () => { const file=createRecoveryExport([draft()],new Date('2026-01-02T00:00:00Z')); expect([file.schemaVersion,file.drafts[0].localDraftId]).toEqual([1,'d1']); });
  it('32. imported regulated draft requires review and cannot auto-submit', () => { const raw=JSON.stringify(createRecoveryExport([draft({status:'ready_to_sync'})])); const imported=parseRecoveryImport(raw,'u:f')[0]; expect(imported.status).toBe('needs_review'); expect(canAttempt(imported)).toBe(false); expect(imported.safeError).toMatchObject({code:'SYNC_CONFLICT',retryable:false}); expect(imported.safeErrorMessage).toBeUndefined(); });
  it('33. import refuses another account or farm', () => expect(() => parseRecoveryImport(JSON.stringify(createRecoveryExport([draft()])), 'other:f')).toThrow(/another account or farm/));
  it('34. import rejects an unversioned file', () => expect(() => parseRecoveryImport('{"drafts":[]}','u:f')).toThrow(/Unsupported/));
  it('35. persistence denial is reported honestly', async () => { vi.stubGlobal('indexedDB',{}); vi.stubGlobal('navigator',{storage:{persisted:vi.fn(async()=>false),persist:vi.fn(async()=>false),estimate:vi.fn(async()=>({usage:10,quota:100}))}}); const result=await inspectOfflineStorage(); expect(result).toMatchObject({indexedDbAvailable:true,persistenceRequested:true,persistenceGranted:false,usageBytes:10,quotaBytes:100}); });
  it('36. Web Lock prevents a second tab from processing the queue', async () => { const task=vi.fn(async()=>1); vi.stubGlobal('navigator',{locks:{request:vi.fn(async(_name:string,_options:unknown,callback:(lock:null)=>Promise<unknown>)=>callback(null))}}); expect(await withQueueLock('u:f',task)).toBeNull(); expect(task).not.toHaveBeenCalled(); });
  it('37. expired Safari lease is replaced and processing recovers', async () => { const values=new Map<string,string>([['farmos-offline-sync:u:f',`${Date.now()-1}:old`]]); vi.stubGlobal('navigator',{}); vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}); vi.stubGlobal('crypto',{randomUUID:()=> 'new-owner'}); const task=vi.fn(async()=>42); expect(await withQueueLock('u:f',task)).toBe(42); expect(task).toHaveBeenCalledOnce(); expect(values.has('farmos-offline-sync:u:f')).toBe(false); });
  it('38. unmigratable drafts retain identity/data but never persist the supplied technical reason', () => { const result=markUnmigratableDraft({...draft(),formData:null},'DOMException: object store missing'); expect(result).toMatchObject({localDraftId:'d1',namespace:'u:f',status:'needs_review',safeErrorCategory:'schema',safeError:{code:'SYNC_CONFLICT'},formData:{}}); expect(result?.safeErrorMessage).toBeUndefined(); expect(JSON.stringify(result)).not.toContain('DOMException'); });
  it('39. invalid recovery JSON and unsupported versions throw before returning any drafts', () => { expect(()=>parseRecoveryImport('{','u:f')).toThrow(); expect(()=>parseRecoveryImport(JSON.stringify({format:'farmos-offline-recovery',schemaVersion:99,drafts:[draft()]}),'u:f')).toThrow(/Unsupported/); });
  it('40. a mixed recovery file is atomic at parse time and cannot return the valid neighbour', () => { const raw=JSON.stringify({format:'farmos-offline-recovery',schemaVersion:1,drafts:[draft(),{...draft(),localDraftId:'bad',namespace:'other:f'}]}); expect(()=>parseRecoveryImport(raw,'u:f')).toThrow(/another account or farm/); });
});
