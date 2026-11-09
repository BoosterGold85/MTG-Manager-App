import type { Page } from '@playwright/test';
export async function addStorageSentinels(page: Page) {
  await page.evaluate(async () => {
    localStorage.setItem('analyzer-local-sentinel', 'keep'); sessionStorage.setItem('analyzer-session-sentinel', 'keep');
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('analyzer-unrelated-sentinel', 7);
      request.onupgradeneeded = () => request.result.createObjectStore('unrelated');
      request.onsuccess = () => { const db = request.result, tx = db.transaction('unrelated', 'readwrite'); tx.objectStore('unrelated').put({ bytes: [1,2,3], value: 'preserve' }, 'sentinel'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
      request.onerror = () => reject(request.error);
    });
  });
}
export async function allStorage(page: Page) {
  return page.evaluate(async () => {
    const databases = [];
    for (const info of (await indexedDB.databases()).sort((a,b)=>(a.name||'').localeCompare(b.name||''))) {
      const record = await new Promise<{name:string;version:number;stores:unknown[]}>((resolve,reject) => {
        const request = indexedDB.open(info.name!);
        request.onsuccess = async () => {
          const db = request.result, stores = [];
          try {
            for (const name of [...db.objectStoreNames].sort()) {
              const data = await new Promise<{name:string;keys:unknown[];values:unknown[]}>((resolve,reject) => {
                const tx=db.transaction(name,'readonly'), store=tx.objectStore(name), keys=store.getAllKeys(), values=store.getAll();
                tx.oncomplete=()=>resolve({name,keys:keys.result,values:values.result});tx.onerror=()=>reject(tx.error);
              });stores.push(data);
            }
            resolve({name:db.name,version:db.version,stores});
          } catch(error){reject(error);}finally{db.close();}
        };request.onerror=()=>reject(request.error);
      }); databases.push(record);
    }
    return {databases,local:Object.fromEntries(Object.entries(localStorage).sort()),session:Object.fromEntries(Object.entries(sessionStorage).sort())};
  });
}
