import { expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { emptyCollection } from "../../src/models/collection";
import { IndexedDbCollectionRepository, validateState } from "../../src/storage/collectionRepository";
import { LocalDeckRepository } from "../../src/storage/deckRepository";
import { formatOf, formatWarnings, copyLimit } from "../../src/decks/formats";
import { parseDeckText } from "../../src/decks/deckText";
import { buildDeckImportPreview, resolveDeckLines, initialChoices, finalizeDeckImport } from "../../src/decks/deckImport";
import { deckRows, filterDeckRows, emptyDeckFilters } from "../../src/decks/deckBrowse";
import { legalInDeck } from "../../src/decks/decks";
import { metadata, sol, forest } from "../importFixtures";
import { synergyFixture } from "../synergyFixtures";
const state=()=>({...emptyCollection(),metadata:structuredClone(metadata)});
async function imported(format:"standard"|"legacy"){
 const s=state(),parsed=parseDeckText("Deck\n56 Forest\n4 Sol Ring\nSideboard\n1 Sol Ring\n14 Forest",true);
 const rows=await resolveDeckLines(parsed,s.metadata,{lookupDeckCards:async()=>{throw new Error("Cached only");}},new AbortController().signal);
 const preview=buildDeckImportPreview(parsed,rows,s,{format,name:"Sixty plus fifteen"});
 return {s,preview,...finalizeDeckImport(preview,s,initialChoices(preview))};
}
it("old decks default to Commander; Standard and Legacy do not restrict colors",async()=>{
 expect(formatOf({})).toBe("commander");
 for(const format of ["standard","legacy"]as const){const {deck}=await imported(format);expect(deck.commanders).toEqual([]);expect(legalInDeck({colorIdentity:["W","U","B","R","G"]},deck)).toBe(true);}
});
it("imports 60 main and 15 sideboard cards preview-first, preserving missing copies and both boards",async()=>{
 const {s,deck}=await imported("standard");
 expect(deck.entries!.filter(e=>e.board==="main").reduce((n,e)=>n+e.quantity,0)).toBe(60);
 expect(deck.entries!.filter(e=>e.board==="sideboard").reduce((n,e)=>n+e.quantity,0)).toBe(15);
 expect(deck.assignments).toEqual([]);expect(s.decks).toBeUndefined();
 const rows=deckRows(s,deck);expect(rows.reduce((n,r)=>n+r.quantity,0)).toBe(75);
 expect(filterDeckRows(rows,{...emptyDeckFilters(),board:"sideboard"}).reduce((n,r)=>n+r.quantity,0)).toBe(15);
 expect(formatWarnings(s,deck).join(" ")).toContain("5 copies across main deck and sideboard");
 expect(formatWarnings(s,deck).join(" ")).toContain("unverified");
});
it("checks canonical legality, missing/stale data, counts and text-based copy exceptions",async()=>{
 const {s,deck}=await imported("legacy");
 s.metadata[sol.scryfallId]={...s.metadata[sol.scryfallId],legalities:{legacy:"banned",standard:"not_legal"},legalityCheckedAt:new Date().toISOString()};
 expect(formatWarnings(s,deck).join(" ")).toContain("banned in Legacy");
 s.metadata[sol.scryfallId].legalityCheckedAt="2000-01-01T00:00:00.000Z";
 expect(formatWarnings(s,deck).join(" ")).toContain("older than seven days");
 const alternative={...s.metadata[sol.scryfallId],scryfallId:"alternate-printing",collectorNumber:"999"};
 s.metadata[alternative.scryfallId]=alternative;
 deck.entries!.find(e=>e.name==="Sol Ring"&&e.board==="sideboard")!.scryfallId=alternative.scryfallId;
 expect(formatWarnings(s,deck).join(" ")).toContain("5 copies across main deck and sideboard");
 expect(copyLimit(s.metadata[forest.scryfallId],"standard")).toBe(Infinity);
 expect(copyLimit({...s.metadata[sol.scryfallId],oracleText:"A deck can have any number of cards named Test."},"standard")).toBe(Infinity);
 expect(copyLimit({...s.metadata[sol.scryfallId],oracleText:"A deck can have up to seven cards named Test."},"legacy")).toBe(7);
 deck.entries![0].quantity=20;deck.entries!.find(e=>e.board==="sideboard")!.quantity=16;
 const warnings=formatWarnings(s,deck).join(" ");expect(warnings).toContain("at least 60");expect(warnings).toContain("maximum is 15");
});
it("persists commander-free decks, reserves sideboard copies and removes from the exact board",async()=>{
 const collection=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());
 const initial=state();initial.revision=1;initial.items.push(synergyFixture().owned(initial.metadata[sol.scryfallId],"owned-ring",2));
 await collection.save(initial,0);const repo=new LocalDeckRepository(collection);
 let next=await repo.change(initial,{type:"create",name:"Legacy",format:"legacy"});const id=next.decks![0].id;
 next=await repo.change(next,{type:"add",deckId:id,itemId:"owned-ring"});
 next=await repo.change(next,{type:"add",deckId:id,itemId:"owned-ring",board:"sideboard"});
 expect(next.items[0].quantityOwned).toBe(2);expect(next.items[0].quantityAssigned).toBe(2);
 next=await repo.change(next,{type:"create",format:"standard",name:"Other deck"});
 await expect(repo.change(next,{type:"add",deckId:next.decks![1].id,itemId:"owned-ring"})).rejects.toThrow("No unassigned copy");
 expect(await collection.load()).toEqual(next);
 const side=next.decks![0].entries!.find(e=>e.board==="sideboard")!;
 next=await repo.change(next,{type:"remove",deckId:id,itemId:"owned-ring",entryId:side.id});
 expect(next.decks![0].entries!.map(e=>e.board)).toEqual(["main"]);
 expect(next.items[0].quantityAssigned).toBe(1);expect(validateState(await collection.load()).decks![0].format).toBe("legacy");
});
it("Commander parser keeps prior sideboard behavior and non-Commander saved data rejects a command zone",async()=>{
 const parsed=parseDeckText("1 Sol Ring\nSideboard\n1 Forest");expect(parsed.lines).toHaveLength(1);expect(parsed.issues).toHaveLength(1);
 const {s,deck}=await imported("standard");deck.entries![0].board="commander";s.decks=[deck];expect(()=>validateState(s)).toThrow("boards");
});
it("fresh legality lookup batches identifiers and bypasses prior cached legality",async()=>{
 const {ScryfallClient}=await import("../../src/import/scryfall");
 const batches:number[]=[];
 const fetcher:typeof fetch=async(_input,init)=>{
  const ids=(JSON.parse(String(init?.body)).identifiers as {id:string}[]).map(i=>i.id);batches.push(ids.length);
  return new Response(JSON.stringify({object:"list",data:ids.map(id=>({object:"card",id,oracle_id:id,name:"Test",set:"tst",collector_number:"1",cmc:1,color_identity:[],type_line:"Artifact",rarity:"common",legalities:{standard:"legal",legacy:"legal"},image_uris:{normal:sol.imageUrl}}))}),{status:200});
 };
 const client=new ScryfallClient(fetcher,0,{sleep:async()=>{}});
 const ids=Array.from({length:151},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,"0")}`);
 expect(Object.keys(await client.refreshLegalities(ids,new AbortController().signal))).toHaveLength(151);
 expect(batches).toEqual([75,75,1]);
 await client.refreshLegalities([ids[0]],new AbortController().signal);expect(batches).toEqual([75,75,1,1]);
});
it("legality refresh failure is atomic and missing basics remain removable without ownership changes",async()=>{
 const {s,deck}=await imported("standard");s.revision=1;s.decks=[deck];
 const collection=new IndexedDbCollectionRepository(crypto.randomUUID(),new IDBFactory());await collection.save(s,0);
 const repo=new LocalDeckRepository(collection),before=await collection.load();
 await expect(repo.change(s,{type:"check-legality",deckId:deck.id,metadata:{unknown:s.metadata[sol.scryfallId]}})).rejects.toThrow("Deck changed");
 expect(await collection.load()).toEqual(before);
 const entry=deck.entries!.find(e=>e.name==="Forest"&&e.board==="main")!;
 const next=await repo.change(s,{type:"remove-missing",deckId:deck.id,entryId:entry.id});
 expect(next.decks![0].entries!.find(e=>e.id===entry.id)!.quantity).toBe(55);expect(next.items).toEqual(s.items);
});
