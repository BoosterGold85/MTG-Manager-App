import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const read=(path:string)=>readFileSync(new URL(`../audit/blind617/${path}`,import.meta.url));
const key=(n:string)=>n.replaceAll('’',"'").trim().toLowerCase();
it("preserves source expectations and captures valid offline card coverage without evaluating rankings",()=>{
 const source=JSON.parse(read('source/holdouts.json').toString());
 const capture=JSON.parse(read('capture.json').toString());
 const base=JSON.parse(readFileSync(new URL('../audit/recall/cards.scryfall.json',import.meta.url),'utf8'));
 const cards=[...base,...JSON.parse(read('canonical.json').toString())];
 const names=new Set<string>(cards.flatMap(c=>[c.name,...(c.card_faces?.slice(0,1).map((f:{name:string})=>f.name)||[])].map(key)));
 expect(capture.status).toBe('not-evaluated');expect(capture.decks).toHaveLength(10);
 for(const deck of capture.decks){
  const original=source.holdouts.find((d:{id:number})=>d.id===deck.id);
  expect(deck.expected).toEqual(original.expected);expect(deck.misleading).toEqual(original.misleading);expect(deck.plan).toBe(original.plan);
  expect(createHash('sha256').update(read(`raw/${deck.id}.archidekt.json`)).digest('hex')).toBe(deck.sha256);
  for(const name of [deck.commander,...deck.expected,...deck.misleading,...deck.cards.map((c:{name:string})=>c.name)])expect(names.has(key(name)),name).toBe(true);
  expect(deck.total).toBe(deck.cards.reduce((n:number,c:{quantity:number})=>n+c.quantity,0));
  expect(deck.status).toBe(deck.total===100?'captured-not-evaluated':'incomplete-source-not-evaluated');
 }
 // Source-integrity check, not a completed ten-deck release gate.
 expect(capture.decks.filter((d:{total:number})=>d.total===100)).toHaveLength(9);
 expect(capture.decks.find((d:{id:number})=>d.id===4).total).toBe(83);
});
