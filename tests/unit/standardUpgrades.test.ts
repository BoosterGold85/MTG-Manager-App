import {it,expect} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import {standardFixture} from "../standardFixture";
import {standardCandidates,compareStandard,freshStandard} from "../../src/standard/engine";
import {IndexedDbCollectionRepository,validateState} from "../../src/storage/collectionRepository";
import {LocalDeckRepository} from "../../src/storage/deckRepository";
it("includes additional copies, enforces combined-board limits and does not mutate input",()=>{
 const f=standardFixture(),before=JSON.stringify(f.state),rows=standardCandidates(f.state,f.deck);
 const c=rows.candidates.find(c=>c.itemId==="blink-owned")!;expect(c.inDeck).toBe(2);expect(c.room).toBe(2);expect(c.score).toBeGreaterThan(40);expect(c.reasons.join(" ")).toMatch(/entry|reuse|return/i);
 expect(compareStandard(f.state,f.deck,c.itemId,"weak",2).delta).toBeGreaterThan(0);
 expect(compareStandard(f.state,f.deck,c.itemId,"weak",2).releases).toEqual([{itemId:"weak-owned",quantity:2,printing:expect.any(String)}]);
 expect(()=>compareStandard(f.state,f.deck,c.itemId,"weak",3)).toThrow("copy limit");
 expect(JSON.stringify(f.state)).toBe(before);expect(structuredClone(rows)).toEqual(rows);
});
it("rejects banned, unknown and stale candidates; severe downsides are not recommendations",()=>{
 const f=standardFixture();f.candidate.legalities={standard:"banned"};expect(standardCandidates(f.state,f.deck).candidates.some(c=>c.itemId==="blink-owned")).toBe(false);
 f.candidate.legalities={standard:"legal"};
 const stamp=Date.parse(f.candidate.legalityCheckedAt!);expect(freshStandard(f.candidate,stamp+7*86400000)).toBe(true);expect(freshStandard(f.candidate,stamp+7*86400000+1)).toBe(false);
 f.candidate.legalityCheckedAt="2000-01-01";expect(freshStandard(f.candidate)).toBe(false);
 expect(standardCandidates(f.state,f.deck).unknown).toBe(1);
 f.candidate.legalityCheckedAt=new Date().toISOString();f.candidate.oracleText="When this creature enters, exile your library.";
 expect(standardCandidates(f.state,f.deck).riskExcluded).toBe(1);
 expect(()=>compareStandard(f.state,f.deck,"blink-owned","weak",1)).toThrow("Severe downside");
});
it("never invokes Standard analysis for Commander or Legacy and rejects land/no-op/invalid quantity changes",()=>{
 const f=standardFixture();expect(()=>standardCandidates(f.state,{...f.deck,format:"commander"})).toThrow("another format");
 expect(()=>standardCandidates(f.state,{...f.deck,format:"legacy"})).toThrow("another format");
 expect(()=>compareStandard(f.state,f.deck,"blink-owned","blink-main",1)).toThrow("different");
 expect(()=>compareStandard(f.state,f.deck,"blink-owned","land",1)).toThrow("nonland");
 expect(()=>compareStandard(f.state,f.deck,"blink-owned","weak",1.5)).toThrow("one to four");
});
it("confirmed quantity changes are atomic, preserve sideboard/count/ownership and reject stale saves",async()=>{
 const f=standardFixture(),collection=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());await collection.save(f.state,0);const repo=new LocalDeckRepository(collection);
 const action={type:"standard-swap" as const,deckId:f.deck.id,incomingItemId:"blink-owned",outgoingEntryId:"weak",quantity:2,verifiedCard:f.candidate};
 const next=await repo.change(f.state,action),deck=next.decks![0];
 expect(deck.entries!.filter(e=>e.board==="main").reduce((n,e)=>n+e.quantity,0)).toBe(60);
 expect(deck.entries!.find(e=>e.id==="blink-main")!.quantity).toBe(3);expect(deck.entries!.find(e=>e.id==="weak")!.quantity).toBe(1);
 expect(deck.entries!.filter(e=>e.board==="sideboard")).toEqual(f.deck.entries!.filter(e=>e.board==="sideboard"));
 expect(next.items.map(i=>i.quantityOwned)).toEqual([6,3]);expect(next.items.map(i=>i.quantityAssigned)).toEqual([4,1]);validateState(next);
 await expect(repo.change(f.state,action)).rejects.toThrow();expect(await collection.load()).toEqual(next);
});
it("cannot take allocated copies or apply Standard changes to a Commander deck",async()=>{
 const f=standardFixture();f.state.items[0].quantityOwned=2;f.state.items[0].quantityUnassigned=0;
 const collection=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());await collection.save(f.state,0);const repo=new LocalDeckRepository(collection);
 expect(compareStandard(f.state,f.deck,"blink-owned","weak",1).canAssign).toBe(false);
 await expect(repo.change(f.state,{type:"standard-swap",deckId:f.deck.id,incomingItemId:"blink-owned",outgoingEntryId:"weak",quantity:1,verifiedCard:f.candidate})).rejects.toThrow("No copies are taken");
 expect(await collection.load()).toEqual(f.state);
});
it("comparison reports consistency and loss of the last interaction role",()=>{
 const f=standardFixture();f.deck.entries=f.deck.entries!.filter(e=>e.board!=="sideboard");f.deck.assignments=f.deck.assignments.filter(a=>a.entryId!=="blink-side");
 f.weak.oracleText="Destroy target creature.";
 const result=compareStandard(f.state,f.deck,"blink-owned","weak",3);
 expect(result.lost).toContain("Interaction");expect(result.openingBefore).toBe(11.7);expect(result.openingAfter).toBeGreaterThan(result.openingBefore);
});
it("mana screening uses cast symbols rather than Commander color identity and handles hybrid costs",()=>{
 const f=standardFixture();f.candidate.colorIdentity=["W","U","B","R","G"];
 expect(standardCandidates(f.state,f.deck).candidates.some(c=>c.itemId==="blink-owned")).toBe(true);
 f.candidate.manaCost="{1}{U}";expect(standardCandidates(f.state,f.deck).manaExcluded).toBe(1);
 expect(()=>compareStandard(f.state,f.deck,"blink-owned","weak",1)).toThrow("cast cost");
 f.candidate.manaCost="{1}{W/U}";expect(standardCandidates(f.state,f.deck).candidates.some(c=>c.itemId==="blink-owned")).toBe(true);
});
it("the separate Standard transaction rejects a real existing Commander deck",async()=>{
 const {reignOfDragonsFixture}=await import("../recommendationFixtures"),f=reignOfDragonsFixture();f.state.revision=1;
 const collection=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());await collection.save(f.state,0);
 await expect(new LocalDeckRepository(collection).change(f.state,{type:"standard-swap",deckId:f.deck.id,incomingItemId:"unused-format-guard",outgoingEntryId:f.deck.entries![1].id,quantity:1})).rejects.toThrow("only for Standard");
 expect(await collection.load()).toEqual(f.state);
});

it("atomic Standard swaps require recent same-printing legal proof",async()=>{
 const f=standardFixture(),collection=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());await collection.save(f.state,0);const repo=new LocalDeckRepository(collection);
 const action={type:"standard-swap" as const,deckId:f.deck.id,incomingItemId:"blink-owned",outgoingEntryId:"weak",quantity:1};
 for(const proof of [undefined,{...f.candidate,legalities:{standard:"banned"}},{...f.candidate,legalityCheckedAt:new Date(Date.now()-6*60000).toISOString()},{...f.candidate,scryfallId:"other-printing"}]){
  await expect(repo.change(f.state,{...action,verifiedCard:proof})).rejects.toThrow();expect(await collection.load()).toEqual(f.state);
 }
});
it("adding copies grows the intended entry instead of filling its older missing requests",async()=>{
 const f=standardFixture();f.deck.assignments=f.deck.assignments.filter(a=>a.entryId!=="blink-main");f.state.items[0].quantityAssigned=1;f.state.items[0].quantityUnassigned=5;
 const collection=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());await collection.save(f.state,0);
 const next=await new LocalDeckRepository(collection).change(f.state,{type:"standard-swap",deckId:f.deck.id,incomingItemId:"blink-owned",outgoingEntryId:"weak",quantity:2,verifiedCard:f.candidate});
 expect(next.decks![0].entries!.find(e=>e.id==="blink-main")!.quantity).toBe(3);
 expect(next.decks![0].assignments.find(a=>a.entryId==="blink-main")!.quantity).toBe(2);
 expect(next.decks![0].entries!.filter(e=>e.board==="main").reduce((n,e)=>n+e.quantity,0)).toBe(60);
});
it("outgoing mixed-variant releases match the preview and preserve an existing Commander deck",async()=>{
 const f=standardFixture(),{reignOfDragonsFixture}=await import("../recommendationFixtures"),commander=reignOfDragonsFixture();
 f.state.metadata={...commander.state.metadata,...f.state.metadata};f.state.decks!.push(commander.deck);
 f.state.items[1].quantityAssigned=1;f.state.items[1].quantityUnassigned=2;
 f.state.items.push({...f.state.items[1],id:"weak-foil",finish:"foil",quantityOwned:2,quantityAssigned:2,quantityUnassigned:0});
 f.deck.assignments.find(a=>a.entryId==="weak")!.quantity=1;f.deck.assignments.push({itemId:"weak-foil",entryId:"weak",quantity:2});
 const preview=compareStandard(f.state,f.deck,"blink-owned","weak",2);expect(preview.releases).toEqual([{itemId:"weak-foil",quantity:2,printing:expect.stringContaining("foil")}]);
 const collection=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());await collection.save(f.state,0);
 const next=await new LocalDeckRepository(collection).change(f.state,{type:"standard-swap",deckId:f.deck.id,incomingItemId:"blink-owned",outgoingEntryId:"weak",quantity:2,verifiedCard:f.candidate});
 expect(next.items.find(i=>i.id==="weak-foil")!.quantityAssigned).toBe(0);expect(next.items.find(i=>i.id==="weak-owned")!.quantityAssigned).toBe(1);
 expect(next.decks!.find(d=>d.id===commander.deck.id)).toEqual(commander.deck);expect(next.items.map(i=>i.quantityOwned)).toEqual(f.state.items.map(i=>i.quantityOwned));
});
