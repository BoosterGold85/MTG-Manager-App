// Holdout and adversarial decks for the engine-agnosticism audit. Real Scryfall card data; the decks were written
// and their expectations recorded before the engine was run on them (tests/audit/holdout-decks.json).
import raw from "./data/holdout-cards.json" with { type: "json" };
import spec from "./audit/holdout-decks.json" with { type: "json" };
import { normalizeCard } from "../src/import/scryfall";
import type { CardMetadata } from "../src/models/collection";
import { dnaFixture } from "./dnaFixtures";

export const holdoutCards = raw.map((c) =>
  normalizeCard({ ...c, object: "card", set_name: "Holdout audit" } as unknown as Parameters<typeof normalizeCard>[0]),
);
const byName = new Map<string, CardMetadata>();
for (const c of holdoutCards) for (const n of [c.name, ...c.name.split(" // ")]) if (!byName.has(n)) byName.set(n, c);
export const holdoutCard = (name: string) => {
  const c = byName.get(name);
  if (!c) throw new Error(`Holdout card missing: ${name}`);
  return c;
};
export type HoldoutDeck = (typeof spec.decks)[number];
export const holdoutDecks = spec.decks as HoldoutDeck[];
export const holdoutPool = spec.candidatePool.map(holdoutCard);
const BASICS: Record<string, string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };
/** Commander + listed cards + basics in the Commander's colors, up to a normal 36-land mana base. */
export function holdoutFixture(d: HoldoutDeck) {
  const commander = holdoutCard(d.commander);
  const main = d.cards.map(holdoutCard);
  const colors = commander.colorIdentity.length ? commander.colorIdentity : ["W"];
  const basics = colors.map((c) => holdoutCard(BASICS[c]));
  const f = dnaFixture(commander, [...main, ...basics]);
  f.deck.name = d.name;
  const lands = main.filter((c) => /\bLand\b/.test((c.cardFaces?.[0]?.typeLine || c.typeLine).split("—")[0])).length;
  const fill = Math.max(basics.length, 36 - lands);
  basics.forEach((b, i) => {
    f.deck.entries!.find((e) => e.name === b.name)!.quantity = Math.floor(fill / basics.length) + (i < fill % basics.length ? 1 : 0);
  });
  return f;
}
