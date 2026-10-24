import { it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { ScryfallClient, LookupInterrupted, retryAfterMilliseconds } from '../../src/import/scryfall';
import { IndexedDbScryfallCache } from '../../src/storage/scryfallCache';
import { parseManaBox } from '../../src/import/csv';
import { buildImportPlan } from '../../src/import/plan';
import { apiCard, sol, exportCsv, fixtureRow } from '../importFixtures';
const signal=()=>new AbortController().signal;
const noWait=async(_ms:number,s:AbortSignal)=>{s.throwIfAborted();};
const options={sleep:noWait,backoffMs:0};
const response=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers});
function records(count:number) {
 return Array.from({length:count},(_,i)=>({...sol,scryfallId:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`Card ${i}`,setCode:'tst',collectorNumber:String(i)}));
}
it('recovers all 4,421 valid ManaBox rows after interruption at 1,839; durable cache avoids repeating successful batches or later imports',async()=>{
 const cards=records(4421),byId=new Map(cards.map(c=>[c.scryfallId,c]));
 const parsed=parseManaBox(exportCsv(cards.map(c=>fixtureRow(c))));
 const seed=Object.fromEntries(cards.slice(0,39).map(c=>[c.scryfallId,c]));
 const cache=new IndexedDbScryfallCache(new IDBFactory(),'large-reliability');
 const succeeded=new Set<string>();let failed=false,goodBatches=0;
 const fetcher=vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
  const ids=JSON.parse(init!.body as string).identifiers as {id:string}[];
  if(goodBatches===24 && !failed) return response({error:'temporary outage'},503);
  for(const {id} of ids) {expect(succeeded.has(id),'successful ID must never be requested twice').toBe(false);succeeded.add(id);}
  goodBatches++;return response({data:ids.map(({id})=>apiCard(byId.get(id)!)),not_found:[]});
 });
 const client=new ScryfallClient(fetcher,0,{...options,cache});
 await expect(client.resolve(parsed.rows,seed,{},signal(),()=>{})).rejects.toMatchObject({name:'LookupInterrupted',resolvedRows:1839,totalRows:4421});
 expect(fetcher).toHaveBeenCalledTimes(28);expect((await cache.load()).metadata).toEqual(Object.fromEntries(cards.slice(39,1839).map(c=>[c.scryfallId,expect.objectContaining({scryfallId:c.scryfallId})])));
 failed=true;
 // Recreate the client, proving progress is retained even after page/session replacement.
 const resumed=await new ScryfallClient(fetcher,0,{...options,cache}).resolve(parsed.rows,seed,{},signal(),()=>{});
 expect(resumed.results.size).toBe(4421);expect([...resumed.results.values()].every(r=>r.card && !r.error)).toBe(true);
 expect(goodBatches).toBe(59);expect(fetcher).toHaveBeenCalledTimes(63);
 const plan=buildImportPlan(parsed,resumed,null,'ManaBox.csv');expect(plan.summary.recognized).toBe(4421);expect(plan.problems).toEqual([]);expect(plan.next.items).toHaveLength(4421);
 const previous=buildImportPlan({...parsed,rows:parsed.rows.slice(0,1839),totalRows:1839},resumed,null,'old-partial.csv').next;
 previous.unresolved=parsed.rows.slice(1839).map(row=>({line:row.line,name:row.name,message:'Old transient HTTP 503 problem',raw:row.raw,sourceKey:row.sourceKey}));
 const recovered=buildImportPlan(parsed,resumed,previous,'ManaBox.csv');expect(recovered.next.items).toHaveLength(4421);expect(recovered.next.unresolved).toEqual([]);expect(recovered.summary.newRecords).toBe(2582);expect(recovered.summary.unchanged).toBe(1839);
 const noNetwork=vi.fn();const cached=await new ScryfallClient(noNetwork,0,{...options,cache}).resolve(parsed.rows,seed,{},signal(),()=>{});
 expect(noNetwork).not.toHaveBeenCalled();expect(buildImportPlan(parsed,cached,plan.next,'ManaBox.csv').summary.unchanged).toBe(4421);
},20000);
for(const failure of ['429','500','503','network','timeout']) it(`retries ${failure} conservatively without producing card problems`,async()=>{
 let calls=0;const fetcher=vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
  calls++;
  if(calls===1) {
   if(failure==='network') throw new TypeError('CORS/network');
   if(failure==='timeout') return await new Promise<Response>((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(new DOMException('Timeout','AbortError')),{once:true}));
   return response({},Number(failure),{'Retry-After':'0'});
  }
  return response({data:[apiCard(sol)]});
 });
 const result=await new ScryfallClient(fetcher,0,{...options,timeoutMs:1}).resolve(parseManaBox(exportCsv([fixtureRow(sol)])).rows,{}, {},signal(),()=>{});
 expect(result.results.values().next().value?.card?.scryfallId).toBe(sol.scryfallId);expect(calls).toBe(2);
});
it('honors uncapped Retry-After numeric/date values and exponential backoff, then slows subsequent batches',async()=>{
 expect(retryAfterMilliseconds('120')).toBe(120000);expect(retryAfterMilliseconds('Sat, 24 Oct 2026 12:01:00 GMT',Date.parse('2026-10-24T12:00:00Z'))).toBe(60000);
 const cards=records(76);let now=10000,calls=0;const waits:number[]=[];const times:number[]=[];
 const clock=vi.spyOn(Date,'now').mockImplementation(()=>now);
 try {
 const client=new ScryfallClient(vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
  calls++;times.push(now);if(calls===1)return response({},429,{'Retry-After':'90'});if(calls===2)return response({},503);
  const ids=JSON.parse(init!.body as string).identifiers as {id:string}[];return response({data:ids.map(({id})=>apiCard(cards.find(c=>c.scryfallId===id)!))});
 }),250,{sleep:async ms=>{waits.push(ms);now+=ms;},backoffMs:1000});
 const result=await client.resolve(parseManaBox(exportCsv(cards.map(c=>fixtureRow(c)))).rows,{}, {},signal(),()=>{});
 expect(result.results.size).toBe(76);expect(waits).toContain(90000);expect(waits).toContain(2000);expect(times[3]-times[2]).toBeGreaterThanOrEqual(500);
 } finally {clock.mockRestore();}
});
it('only explicit not_found/invalid UUID become row errors; incomplete or failed collection responses interrupt',async()=>{
 const rows=parseManaBox(exportCsv([fixtureRow(sol)])).rows;
 const absent=await new ScryfallClient(vi.fn(async()=>response({data:[],not_found:[{id:sol.scryfallId}]})),0,options).resolve(rows,{}, {},signal(),()=>{});
 expect(absent.results.values().next().value?.error).toContain('No Scryfall printing');
 for(const payload of [{data:[]},{data:[],not_found:[]},{unexpected:true}]) await expect(new ScryfallClient(vi.fn(async()=>response(payload)),0,options).resolve(rows,{}, {},signal(),()=>{})).rejects.toBeInstanceOf(LookupInterrupted);
 await expect(new ScryfallClient(vi.fn(async()=>response({},404)),0,options).resolve(rows,{}, {},signal(),()=>{})).rejects.toBeInstanceOf(LookupInterrupted);
 const fetcher=vi.fn();const invalid=await new ScryfallClient(fetcher,0,options).resolve([{...rows[0],scryfallId:'invalid'}],{}, {},signal(),()=>{});expect(invalid.results.values().next().value?.error).toContain('Invalid Scryfall ID');expect(fetcher).not.toHaveBeenCalled();
});
it('does not turn fallback search or set-list network failures into card errors',async()=>{
 const parsed=parseManaBox(exportCsv([fixtureRow(sol,1,{'Scryfall ID':'','Collector number':''})]));
 await expect(new ScryfallClient(vi.fn(async()=>{throw new TypeError('offline');}),0,options).resolve(parsed.rows,{}, {},signal(),()=>{})).rejects.toBeInstanceOf(LookupInterrupted);
});
it('cancels backoff promptly and retains session successes if durable cache fails',async()=>{
 const cards=records(76);let calls=0;const controller=new AbortController();
 const fetcher=vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
  calls++;if(calls>1)return response({},503);
  const ids=JSON.parse(init!.body as string).identifiers as {id:string}[];return response({data:ids.map(({id})=>apiCard(cards.find(c=>c.scryfallId===id)!))});
 });
 const client=new ScryfallClient(fetcher,0,{backoffMs:0,sleep:async(_ms,s)=>{if(calls>=2)controller.abort();s.throwIfAborted();},cache:{load:async()=>{throw Error('cache unavailable');},save:async()=>{throw Error('quota');}}});
 const rows=parseManaBox(exportCsv(cards.map(c=>fixtureRow(c)))).rows;
 await expect(client.resolve(rows,{}, {},controller.signal,()=>{})).rejects.toMatchObject({name:'AbortError'});
 const fetched=vi.mocked(fetcher);fetched.mockImplementation(async()=>response({data:[apiCard(cards[75])]}));
 // Same client keeps 75 successful identities although its persistent cache was unavailable.
 const before=calls;const result=await client.resolve(rows,{}, {},signal(),()=>{});expect(result.results.size).toBe(76);expect(fetcher).toHaveBeenCalledTimes(before+1);
});
it('one unexpected card never stalls a whole batch: reversible faces, malformed metadata, migrated IDs and mismatches are per-row outcomes',async()=>{
 const cards=records(6);
 const parsed=parseManaBox(exportCsv(cards.map(c=>fixtureRow(c))));
 const reversible={...apiCard(cards[1]),layout:'reversible_card',type_line:undefined,cmc:undefined,oracle_id:undefined,card_faces:[{name:'Card 1',oracle_id:'face-oracle',cmc:2,type_line:'Legendary Creature — Elf',image_uris:{normal:'n.jpg'}},{name:'Card 1',cmc:2,type_line:'Legendary Creature — Elf'}]};
 const malformed={...apiCard(cards[2]),color_identity:undefined};
 const migrated={...apiCard(cards[3]),id:'99999999-0000-4000-8000-000000000003'};
 const different={...apiCard(cards[0]),id:'99999999-0000-4000-8000-000000000004',name:'Unrelated',set:'zzz',collector_number:'1'};
 const fetcher=vi.fn(async()=>response({data:[apiCard(cards[0]),reversible,malformed,migrated,different,apiCard(cards[5])],not_found:[]}));
 const result=await new ScryfallClient(fetcher,0,options).resolve(parsed.rows,{},{},signal(),()=>{});
 const at=(i:number)=>result.results.get(`id:${cards[i].scryfallId}`)!;
 expect(at(0).card!.name).toBe('Card 0');
 expect(at(1).card).toMatchObject({typeLine:'Legendary Creature — Elf',manaValue:2,oracleId:'face-oracle'});
 expect(at(2).error).toMatch(/incomplete metadata for this printing/);
 expect(at(3).card!.scryfallId).toBe('99999999-0000-4000-8000-000000000003');
 expect(at(4).error).toMatch(/different card/);
 expect(at(5).card!.name).toBe('Card 5');
 const plan=buildImportPlan(parsed,result,null,'ManaBox.csv');
 expect(plan.summary.recognized).toBe(4);expect(plan.problems.map(p=>p.name)).toEqual(['Card 2','Card 4']);
});
it('a short response is still an interruption, and the message names the underlying cause',async()=>{
 const cards=records(3);
 const parsed=parseManaBox(exportCsv(cards.map(c=>fixtureRow(c))));
 await expect(new ScryfallClient(vi.fn(async()=>response({data:[apiCard(cards[0])],not_found:[]})),0,options).resolve(parsed.rows,{},{},signal(),()=>{})).rejects.toThrow(/interrupted after 1 of 3 rows.*\(Scryfall returned an incomplete collection batch\.\)/);
 await expect(new ScryfallClient(vi.fn(async()=>response({},503)),0,options).resolve(parsed.rows,{},{},signal(),()=>{})).rejects.toThrow(/\(Scryfall lookup failed \(HTTP 503\)\.\)/);
});
