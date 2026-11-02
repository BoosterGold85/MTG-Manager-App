import {it,expect,vi} from "vitest";
import {ScryfallClient} from "../../src/import/scryfall";
import {runLegalityCheck,savedLegalityCheckpoint} from "../../src/import/legality";
import {legacyFixture} from "../legacyFixture";
import {legacyCandidates} from "../../src/standard/engine";
import {ownedUpgradeRows,ownedDetailCard} from "../../src/standard/browse";
import {synergyFixture} from "../synergyFixtures";
const raw=(id:string)=>({object:"card",id,oracle_id:id,name:`Owned ${id}`,set:"tst",collector_number:"1",type_line:"Artifact",rarity:"common",cmc:1,color_identity:[],image_uris:{normal:"https://example.test/card.jpg"},legalities:{legacy:"legal",standard:"not_legal"}});
const clientFor=(fetcher:typeof fetch)=>new ScryfallClient(fetcher,0,{attempts:1,sleep:async()=>{}});
it("4,421 printings retain completed batches after a transient failure and retry only unresolved IDs",async()=>{
 const ids=Array.from({length:4421},(_,i)=>`printing-${i}`),batches:string[][]=[];let fail=true;
 const client=clientFor(vi.fn(async(_input,init)=>{
  const batch=(JSON.parse(init!.body as string).identifiers as {id:string}[]).map(x=>x.id);batches.push(batch);
  if(batch.includes(ids[150])&&fail)throw new TypeError("Network unavailable");
  return new Response(JSON.stringify({data:batch.map(raw)}));
 }));
 const progress=vi.fn(),signal=new AbortController().signal;
 const first=await runLegalityCheck(ids,signal,(b,s)=>client.checkLegalityBatch(b,s),progress);
 expect(first.checked).toBe(150);expect(first.unresolved).toHaveLength(4271);expect(first.issues).toEqual({});expect(first.failure).toBeInstanceOf(Error);
 fail=false;const second=await runLegalityCheck(ids,signal,(b,s)=>client.checkLegalityBatch(b,s),progress,first);
 expect(second.checked).toBe(4421);expect(second.unresolved).toEqual([]);expect(second.issues).toEqual({});expect(second.interrupted).toBe(false);
 expect(batches).toHaveLength(60);expect(batches.slice(3).flat().some(id=>ids.slice(0,150).includes(id))).toBe(false);
 expect(Object.keys(first.metadata)).toHaveLength(150); // Resume never mutates the saved checkpoint.
});
it("confirmed missing/malformed/migrated IDs are isolated without losing valid batch answers",async()=>{
 const client=clientFor(vi.fn(async()=>new Response(JSON.stringify({data:[raw("good"),{...raw("broken"),legalities:undefined},raw("different-id")],not_found:[{id:"missing"}]}))));
 const result=await client.checkLegalityBatch(["good","broken","missing","old-id"],new AbortController().signal);
 expect(Object.keys(result.metadata)).toEqual(["good"]);expect(Object.keys(result.issues).sort()).toEqual(["broken","missing","old-id"]);expect(result.unresolved).toEqual([]);
 expect(result.metadata.good.legalities?.legacy).toBe("legal");expect(result.issues.missing).toMatch(/retained/);
});
it("an incomplete successful response leaves only missing identifiers unresolved",async()=>{
 let incomplete=true;const calls:string[][]=[];
 const client=clientFor(vi.fn(async(_input,init)=>{
  const ids=(JSON.parse(init!.body as string).identifiers as {id:string}[]).map(x=>x.id);calls.push(ids);
  return new Response(JSON.stringify({data:ids.filter(id=>!incomplete||id!=="last").map(raw)}));
 }));
 const first=await runLegalityCheck(["first","last"],new AbortController().signal,(b,s)=>client.checkLegalityBatch(b,s),()=>{});
 expect(first.issues).toEqual({});expect(first.unresolved).toEqual(["last"]);expect(first.checked).toBe(1);
 incomplete=false;const second=await runLegalityCheck(["first","last"],new AbortController().signal,(b,s)=>client.checkLegalityBatch(b,s),()=>{},first);
 expect(calls).toEqual([["first","last"],["last"]]);expect(second.checked).toBe(2);
});
it("429 and Retry-After use the existing conservative retry path without card errors",async()=>{
 const sleeps:number[]=[];let calls=0;
 const client=new ScryfallClient(vi.fn(async()=>++calls===1?new Response("",{status:429,headers:{"Retry-After":"2"}}):new Response(JSON.stringify({data:[raw("one")]}))),0,{attempts:2,backoffMs:1,sleep:async(ms)=>{sleeps.push(ms);}});
 const result=await client.checkLegalityBatch(["one"],new AbortController().signal);
 expect(calls).toBe(2);expect(sleeps.some(n=>n>=1900)).toBe(true);expect(result.issues).toEqual({});expect(result.unresolved).toEqual([]);
});
it("stopping retains prior successes and unknown cards are never declared illegal",async()=>{
 const controller=new AbortController(),ids=Array.from({length:151},(_,i)=>String(i));let calls=0;
 const client=clientFor(vi.fn(async(_input,init)=>{
  if(++calls===2){controller.abort();throw new DOMException("Canceled","AbortError");}
  const batch=(JSON.parse(init!.body as string).identifiers as {id:string}[]).map(x=>x.id);
  return new Response(JSON.stringify({data:batch.map(raw)}));
 }));
 const result=await runLegalityCheck(ids,controller.signal,(b,s)=>client.checkLegalityBatch(b,s),()=>{});
 expect(result.stopped).toBe(true);expect(result.checked).toBe(75);expect(result.unresolved).toHaveLength(76);expect(result.issues).toEqual({});
});
it("strict selected-printing verification still rejects incomplete or wrong-ID responses",async()=>{
 const client=clientFor(vi.fn(async()=>new Response(JSON.stringify({data:[raw("another")] } ))));
 await expect(client.refreshLegalities(["requested"],new AbortController().signal)).rejects.toThrow("Unexpected legality");
});
it("browsing includes all owned records while comparison eligibility and scores remain restricted",()=>{
 const f=legacyFixture(),owned=synergyFixture().owned;
 const extras=[
  {...f.candidate,scryfallId:"off-color",name:"Blue owned spell",manaCost:"{U}"},
  {...f.land,scryfallId:"owned-land",name:"Owned Plains"},
  {...f.bodies[0],scryfallId:"at-limit"},
  {...f.candidate,scryfallId:"danger",name:"Severe spell",oracleText:"Discard your hand."},
  {...f.candidate,scryfallId:"banned",name:"Banned owned spell",legalities:{legacy:"banned"}},
  {...f.candidate,scryfallId:"unknown",name:"Unchecked owned spell",legalityCheckedAt:undefined},
 ];
 for(const card of extras){f.state.metadata[card.scryfallId]=card;f.state.items.push(owned(card,card.scryfallId,1));}
 const before=JSON.stringify(f.state),analysis=legacyCandidates(f.state,f.deck),rows=ownedUpgradeRows(f.state,f.deck,analysis);
 expect(analysis.candidates).toHaveLength(2);expect(rows).toHaveLength(8);expect(rows.filter(r=>r.legality==="legal")).toHaveLength(6);
 for(const id of ["off-color","owned-land","at-limit","danger","banned","unknown"]){const row=rows.find(r=>r.item.id===id)!;expect(row.candidate).toBeUndefined();expect(row.notes.length).toBeGreaterThan(0);expect(ownedDetailCard(f.state,id)?.ownership?.quantityOwned).toBe(1);}
 expect(rows.find(r=>r.item.id==="unknown")!.legality).toBe("unverified");expect(rows.find(r=>r.item.id==="banned")!.legality).toBe("not-legal");expect(JSON.stringify(f.state)).toBe(before);
});

it("resume after reload checks only missing/stale statuses and never trusts an old or absent format verdict",async()=>{
 const f=legacyFixture(),ids=[f.candidate.scryfallId,f.weak.scryfallId,"missing"];
 f.weak.legalityCheckedAt="2000-01-01";const checkpoint=savedLegalityCheckpoint(ids,f.state.metadata,"legacy");
 expect(Object.keys(checkpoint.metadata)).toEqual([f.candidate.scryfallId]);expect(checkpoint.unresolved).toEqual([f.weak.scryfallId,"missing"]);
 const requested:string[][]=[],client=clientFor(vi.fn(async(_input,init)=>{const batch=(JSON.parse(init!.body as string).identifiers as {id:string}[]).map(i=>i.id);requested.push(batch);return new Response(JSON.stringify({data:batch.map(raw)}));}));
 const result=await runLegalityCheck(ids,new AbortController().signal,(b,s)=>client.checkLegalityBatch(b,s),()=>{},checkpoint);
 expect(requested.flat()).toEqual([f.weak.scryfallId,"missing"]);expect(result.unresolved).toEqual([]);
});
