import { it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDbCollectionRepository } from '../../src/storage/collectionRepository';
import { changeCollection, collectionBackup, collectionStats } from '../../src/storage/collectionManagement';
import { emptyCollection } from '../../src/models/collection';
import type { CollectionState } from '../../src/models/collection';
import { metadata, sol, forest } from '../importFixtures';
function state(): CollectionState {
  return { ...emptyCollection(), revision: 1, metadata, items: [sol, forest].map((card, i) => ({
    id: `record-${i}`, scryfallId: card.scryfallId, setCode: card.setCode, collectorNumber: card.collectorNumber!,
    finish: 'nonfoil', language: 'en', condition: 'nm', binderName: 'Main', binderType: 'binder',
    quantityOwned: i + 2, quantityAssigned: 0, quantityUnassigned: i + 2, sourceRows: [{ Name: card.name }],
  })), unresolved: [{line:2,name:'Unknown',message:'Not found',raw:{Name:'Unknown'},sourceKey:'unknown'}] };
}
it('removes only stable IDs atomically, persists across repository recreation and backs up current records', async () => {
 const factory = new IDBFactory(); const repo = new IndexedDbCollectionRepository('remove',factory);
 const original = state(); await repo.save(original,0);
 expect(collectionStats(original)).toEqual({records:2,owned:5,assigned:0,unassigned:5});
 const next = await changeCollection(repo, original,{type:'remove',ids:['record-0','stale']});
 expect(next.items).toEqual([original.items[1]]);
 const recreated = new IndexedDbCollectionRepository('remove',factory);
 expect(await recreated.load()).toEqual(next);
 const backup = JSON.parse(await collectionBackup(recreated));
 expect(backup.schemaVersion).toBe(1); expect(backup.exportedAt).toBeTruthy();
 expect(backup.collection.items).toEqual(next.items); expect(backup.collection.metadata[forest.scryfallId].name).toBe('Forest');
 expect(original.items).toHaveLength(2);
});
it('clears records, metadata, problems and import state while retaining a persisted empty snapshot',async()=>{
 const repo = new IndexedDbCollectionRepository('clear',new IDBFactory()); const original=state(); await repo.save(original,0);
 const next=await changeCollection(repo,original,{type:'clear'});
 expect(next).toEqual({...emptyCollection(),revision:2}); expect(await repo.load()).toEqual(next);
 expect(JSON.parse(await collectionBackup(repo)).collection.items).toEqual([]);
});
it('rejects stale writes without affecting stored collection',async()=>{
 const repo = new IndexedDbCollectionRepository('stale',new IDBFactory()); const original=state(); await repo.save(original,0);
 const next=await changeCollection(repo,original,{type:'remove',ids:['record-0']});
 await expect(changeCollection(repo,original,{type:'clear'})).rejects.toThrow('another tab');
 expect(await repo.load()).toEqual(next);
});
it('propagates failed saves and backup reads without mutating caller state',async()=>{
 const original=state(); const repo={load:async()=>{throw Error('Unavailable');},save:async()=>{throw Error('Storage full');}};
 await expect(changeCollection(repo,original,{type:'remove',ids:['record-0']})).rejects.toThrow('Storage full');
 await expect(changeCollection(repo,original,{type:'clear'})).rejects.toThrow('Storage full');
 await expect(collectionBackup(repo)).rejects.toThrow('Unavailable'); expect(original.items).toHaveLength(2);
});
it('backs up a never-imported collection as empty, never the sample binder',async()=>{
 const repo=new IndexedDbCollectionRepository('new',new IDBFactory());
 expect(JSON.parse(await collectionBackup(repo)).collection.items).toEqual([]);
});
