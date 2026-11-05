import raw from "./data/uugguu-deck.json" with { type: "json" };
import { normalizeCard } from "../src/import/scryfall";
import { dnaFixture } from "./dnaFixtures";
export const uugguuCards = raw.map(c => normalizeCard(c as unknown as Parameters<typeof normalizeCard>[0]));
export function uugguuCard(name: string) {
  const c = uugguuCards.find(c => c.name === name || c.name.split(" // ").includes(name));
  if (!c) throw new Error(`Supplied deck card missing: ${name}`);
  return c;
}
export function uugguuFixture() {
  const commander = uugguuCard("Uugguu, the Omniplasm");
  const fixture = dnaFixture(commander, uugguuCards.filter(c => c !== commander));
  fixture.deck.name = "Uugguu — supplied Ooze deck";
  for (const e of fixture.deck.entries || []) {
    if (e.name === "Forest") e.quantity = 5;
    if (e.name === "Island" || e.name === "Swamp") e.quantity = 3;
  }
  return fixture;
}
