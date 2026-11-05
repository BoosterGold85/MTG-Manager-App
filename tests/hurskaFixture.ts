import raw from "./data/hurska-deck.json" with { type: "json" };
import list from "./data/hurska-decklist.json" with { type: "json" };
import { normalizeCard } from "../src/import/scryfall";
import { dnaFixture } from "./dnaFixtures";
export const hurskaCards = raw.map(c => normalizeCard(c as unknown as Parameters<typeof normalizeCard>[0]));
export const hurskaCard = (name: string) => {
 const c=hurskaCards.find(c=>c.name===name);
 if(!c)throw new Error(`Missing Hurska fixture card: ${name}`);
 return c;
};
export function hurskaFixture(){
 const commander=hurskaCard("Hurska Sweet-Tooth"),f=dnaFixture(commander,hurskaCards.filter(c=>c!==commander));
 f.deck.name="Hurska Sweet-Tooth — Food and life gain";
 for(const e of f.deck.entries||[])e.quantity=list.find(r=>r.name===e.name)!.quantity;
 return f;
}
