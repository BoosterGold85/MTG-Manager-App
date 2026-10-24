import type { CardMetadata } from '../models/collection';
export interface MetadataCache {
  load():Promise<{metadata:Record<string,CardMetadata>;nameMatches:Record<string,string>}>;
  save(cards:CardMetadata[],nameMatches:Record<string,string>):Promise<void>;
}
// Canonical public card data only. Never ownership, CSV rows, quantities or purchase data.
export class IndexedDbScryfallCache implements MetadataCache {
  constructor(private factory:IDBFactory=globalThis.indexedDB,private name='mtg-manager-scryfall-cache') {}
  private open():Promise<IDBDatabase> {
    return new Promise((resolve,reject)=>{
      if(!this.factory) {reject(new Error('Metadata cache unavailable'));return;}
      const request=this.factory.open(this.name,1);
      request.onupgradeneeded=()=>{request.result.createObjectStore('cards',{keyPath:'scryfallId'});request.result.createObjectStore('names');};
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Metadata cache blocked'));
    });
  }
  async load() {
    const db=await this.open();
    try {return await new Promise<{metadata:Record<string,CardMetadata>;nameMatches:Record<string,string>}>((resolve,reject)=>{
      const tx=db.transaction(['cards','names'],'readonly');const cards=tx.objectStore('cards').getAll();const names=tx.objectStore('names').get('matches');
      tx.oncomplete=()=>resolve({metadata:Object.fromEntries(cards.result.map((c:CardMetadata)=>[c.scryfallId,c])),nameMatches:names.result||{}});tx.onerror=tx.onabort=()=>reject(tx.error);
    });} finally {db.close();}
  }
  async save(cards:CardMetadata[],nameMatches:Record<string,string>) {
    const db=await this.open();
    try {await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(['cards','names'],'readwrite');
      try {for(const card of cards) tx.objectStore('cards').put(card);const store=tx.objectStore('names');const current=store.get('matches');current.onsuccess=()=>store.put({...current.result,...nameMatches},'matches');}
      catch(error) {tx.abort();reject(error);}
      tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error);
    });} finally {db.close();}
  }
}
