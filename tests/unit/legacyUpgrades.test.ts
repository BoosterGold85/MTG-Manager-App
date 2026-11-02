import type {CardMetadata} from "../../src/models/collection";
import {it,expect} from "vitest";
import {IDBFactory} from "fake-indexeddb";
import {legacyFixture} from "../legacyFixture";
import {standardFixture} from "../standardFixture";
import {legacyCandidates,compareLegacy,freshLegacy,standardCandidates,constructedCandidates} from "../../src/standard/engine";
import {legacyBrew} from "../../src/legacy/brew";
import {SupplyIndex} from "../../src/upgrades/conditions";
import {IndexedDbCollectionRepository,validateState} from "../../src/storage/collectionRepository";
import {LocalDeckRepository} from "../../src/storage/deckRepository";
it("Legacy uses Legacy legality independently of Standard and excludes stale/banned/unknown cards",()=>{
 const f=legacyFixture();expect(freshLegacy(f.candidate)).toBe(true);expect(legacyCandidates(f.state,f.deck).candidates).toHaveLength(2);
 f.candidate.legalities={legacy:"banned",standard:"legal"};expect(legacyCandidates(f.state,f.deck).illegal).toBe(1);
 f.candidate.legalities={standard:"legal"};expect(legacyCandidates(f.state,f.deck).unknown).toBe(1);
 f.candidate.legalities={legacy:"legal"};f.candidate.legalityCheckedAt="2000-01-01";expect(legacyCandidates(f.state,f.deck).unknown).toBe(1);
 expect(()=>standardCandidates(f.state,f.deck)).toThrow("another format");
 expect(()=>constructedCandidates(f.state,{...f.deck,format:"commander"})).toThrow("another format");
});
it("Legacy enforces quantity, canonical cross-printing and combined-board limits",()=>{
 const f=legacyFixture();const c=legacyCandidates(f.state,f.deck).candidates.find(c=>c.itemId==="blink-owned")!;
 expect(c.room).toBe(3);expect(compareLegacy(f.state,f.deck,c.itemId,"weak",3).mainCopiesAfter).toBe(3);
 expect(()=>compareLegacy(f.state,f.deck,c.itemId,"weak",4)).toThrow();
 const alternate={...f.candidate,scryfallId:"alternate-legacy",collectorNumber:"99"};f.state.metadata[alternate.scryfallId]=alternate;
 f.deck.entries!.push({id:"other-print",board:"sideboard",name:alternate.name,scryfallId:alternate.scryfallId,cardIdentity:alternate.oracleId!,quantity:2});
 expect(()=>compareLegacy(f.state,f.deck,c.itemId,"weak",2)).toThrow("copy limit");
 expect(()=>compareLegacy(f.state,f.deck,c.itemId,"weak",1.5)).toThrow("one to four");
 expect(()=>compareLegacy(f.state,f.deck,c.itemId,"land",1)).toThrow("nonland");
});
it("Interesting Brews rewards supported novel reuse, not a generic new card or shared type",()=>{
 const f=legacyFixture(),rows=f.deck.entries!.filter(e=>e.board==="main").map(e=>({card:f.state.metadata[e.scryfallId],quantity:e.quantity})),supply=new SupplyIndex(rows.map(r=>({...r,commander:false})));
 const brew=legacyBrew(f.candidate,rows,supply);expect(brew.interesting).toBe(true);expect(brew.score).toBeGreaterThanOrEqual(55);expect(brew.reasons.join(" ")).toContain(f.bodies[0].name);expect(brew.reasons.join(" ")).not.toContain(f.candidate.oracleText);
 const generic={...f.candidate,name:"Unrelated efficient card",oracleText:"Draw two cards.",typeLine:"Sorcery"};
 expect(legacyBrew(generic,rows,supply)).toMatchObject({score:0,interesting:false,novel:false});
 const merelyCreature={...generic,typeLine:"Creature — Soldier",oracleText:"Vigilance"};expect(legacyBrew(merelyCreature,rows,supply).score).toBe(0);
});
it("copies/alternate names do not fabricate novelty and four copies do not become four independent anchors",()=>{
 const f=legacyFixture(),body=f.bodies[0],rows=[{card:body,quantity:4}],supply=new SupplyIndex(rows.map(r=>({...r,commander:false})));
 expect(legacyBrew(f.candidate,rows,supply)).toMatchObject({interesting:false,anchors:[body.name]});
 const twin={...f.candidate,name:"Existing equivalent engine",scryfallId:"equivalent-engine"};rows.push({card:twin,quantity:1});
 const report=legacyBrew(f.candidate,rows,new SupplyIndex(rows.map(r=>({...r,commander:false}))));expect(report.novel).toBe(false);
 const renamed={...f.candidate,name:"Entirely different card name"};expect(legacyBrew(renamed,rows,new SupplyIndex(rows.map(r=>({...r,commander:false})))).score).toBe(report.score);
});
it("a sparse unsupported condition and another card's entry trigger do not fabricate a clever interaction",()=>{
 const f=legacyFixture(),draw={...f.bodies[0],oracleText:"Whenever another creature enters, draw a card."};
 const rows=[{card:draw,quantity:4}],supply=new SupplyIndex(rows.map(r=>({...r,commander:false})));
 expect(legacyBrew(f.candidate,rows,supply).score).toBe(0);
 const conditional={...f.candidate,oracleText:"Whenever you cast a Dragon spell, draw a card."};expect(legacyBrew(conditional,rows,supply).score).toBe(0);
});
it("Legacy confirmation atomically preserves count, owned quantities, sideboard and all other decks",async()=>{
 const f=legacyFixture(),other=standardFixture();other.deck.id="untouched-standard";other.deck.entries=[];other.deck.assignments=[];f.state.decks!.push(other.deck);
 const collection=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());await collection.save(f.state,0);const repo=new LocalDeckRepository(collection);
 const before=structuredClone(f.state),action={type:"legacy-swap" as const,deckId:f.deck.id,incomingItemId:"blink-owned",outgoingEntryId:"weak",quantity:2,verifiedCard:f.candidate};
 const next=await repo.change(f.state,action),deck=next.decks![0];validateState(next);
 expect(deck.entries!.filter(e=>e.board==="main").reduce((n,e)=>n+e.quantity,0)).toBe(60);expect(deck.entries!.find(e=>e.id==="weak")!.quantity).toBe(1);
 expect(deck.entries!.filter(e=>e.board==="sideboard")).toEqual(before.decks![0].entries!.filter(e=>e.board==="sideboard"));
 expect(next.items.map(i=>i.quantityOwned)).toEqual(before.items.map(i=>i.quantityOwned));expect(next.decks![1]).toEqual(before.decks![1]);
 await expect(repo.change(f.state,action)).rejects.toThrow();expect(await collection.load()).toEqual(next);
});
it("Legacy requires same-format fresh proof and never takes unavailable copies",async()=>{
 const f=legacyFixture(),collection=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());await collection.save(f.state,0);const repo=new LocalDeckRepository(collection);
 const action={type:"legacy-swap" as const,deckId:f.deck.id,incomingItemId:"blink-owned",outgoingEntryId:"weak",quantity:1};
 const proofs:(CardMetadata|undefined)[]=[undefined,{...f.candidate,legalities:{standard:"legal"}},{...f.candidate,legalities:{legacy:"banned"}},{...f.candidate,legalityCheckedAt:new Date(Date.now()-6*60000).toISOString()}];
 for(const verifiedCard of proofs)await expect(repo.change(f.state,{...action,verifiedCard})).rejects.toThrow();
 await expect(repo.change(f.state,{...action,type:"standard-swap",verifiedCard:f.candidate})).rejects.toThrow("only for Standard");expect(await collection.load()).toEqual(f.state);
 f.state.items[0].quantityOwned=1;f.state.items[0].quantityUnassigned=0;
 const other=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());await other.save(f.state,0);
 await expect(new LocalDeckRepository(other).change(f.state,{...action,verifiedCard:f.candidate})).rejects.toThrow("No copies are taken");expect(await other.load()).toEqual(f.state);
});
it("frozen real Oracle text identifies copy value with real entry engines, not unrelated utility",async()=>{
 const {readFileSync}=await import("node:fs"),{normalizeCard}=await import("../../src/import/scryfall");
 const snapshots=JSON.parse(readFileSync("tests/audit/recall/cards.scryfall.json","utf8")) as Parameters<typeof normalizeCard>[0][];
 const frozen=(name:string)=>normalizeCard(snapshots.find(c=>c.name===name)!);
 const card=frozen("Clever Impersonator"),rows=["Eternal Witness","Mulldrifter","Solemn Simulacrum"].map(name=>({card:frozen(name),quantity:4}));
 const supply=new SupplyIndex(rows.map(r=>({...r,commander:false}))),result=legacyBrew(card,rows,supply);
 expect(result.interesting).toBe(true);expect(result.anchors).toEqual(expect.arrayContaining(rows.map(r=>r.card.name)));expect(result.mechanisms).toContain("Independent copies");expect(result.reasons.some(r=>r.startsWith("Connects different"))).toBe(false);
 expect(legacyBrew(frozen("Sol Ring"),rows,supply).score).toBe(0);
});
it("a mechanical bridge needs distinct verified partner roles and rejects the wrong counter type",()=>{
 const f=legacyFixture(),engine={...f.candidate,name:"Flexible unnamed engine",oracleText:f.candidate.oracleText+"\nIf one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead."};
 const counters={...f.bodies[1],name:"Counter supplier",oracleText:"When this creature enters, put a +1/+1 counter on target creature."};
 const rows=[{card:f.bodies[0],quantity:4},{card:counters,quantity:4}],report=legacyBrew(engine,rows,new SupplyIndex(rows.map(r=>({...r,commander:false}))));
 expect(report.mechanisms).toContain("Counter interactions");expect(report.reasons.some(r=>r.startsWith("Connects different"))).toBe(true);
 const wrong=[rows[0],{card:{...counters,oracleText:"When this creature enters, put a charge counter on target artifact."},quantity:4}];
 const rejected=legacyBrew(engine,wrong,new SupplyIndex(wrong.map(r=>({...r,commander:false}))));expect(rejected.mechanisms).not.toContain("Counter interactions");
 expect(rejected.reasons.some(r=>r.startsWith("Connects different"))).toBe(false);
});

it("different qualifiers on the same cast event do not fabricate a two-mechanism bridge",()=>{
 const f=legacyFixture(),engine={...f.candidate,oracleText:"Whenever you cast an artifact spell, draw a card.\nWhenever you cast a noncreature spell, gain 1 life."};
 const rows=[{card:{...f.bodies[0],typeLine:"Artifact Creature — Golem"},quantity:4},{card:{...f.weak,typeLine:"Instant",oracleText:"Draw a card."},quantity:4}];
 const report=legacyBrew(engine,rows,new SupplyIndex(rows.map(r=>({...r,commander:false}))));
 expect(report.mechanisms).toEqual(["Spell casts"]);expect(report.reasons.some(r=>r.startsWith("Connects different"))).toBe(false);
});
it("a supplied counter payoff is not misrepresented as counter amplification or repeatable reuse",()=>{
 const f=legacyFixture(),payoff={...f.candidate,oracleText:"Whenever one or more +1/+1 counters are put on a creature you control, draw a card."};
 const rows=[{card:{...f.bodies[0],oracleText:"When this creature enters, put a +1/+1 counter on target creature."},quantity:4}];
 const report=legacyBrew(payoff,rows,new SupplyIndex(rows.map(r=>({...r,commander:false}))));
 expect(report.anchors).toHaveLength(1);expect(report.reasons.some(r=>r.startsWith("Reuses or amplifies"))).toBe(false);
});
