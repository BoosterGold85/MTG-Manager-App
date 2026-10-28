// Kwain, Itinerant Meddler group-draw deck, supplied by the user (v0.6.14 regression fixture).
// Card data is the real Oracle record from Scryfall bulk data (oracle-cards, 2026-10-27).
import raw from "./data/kwain-group-hug.json" with { type: "json" };
import { normalizeCard } from "../src/import/scryfall";
import { dnaFixture } from "./dnaFixtures";

export const kwainCards = raw.map((c) =>
  normalizeCard({ ...c, object: "card", set_name: "Kwain regression" } as unknown as Parameters<typeof normalizeCard>[0]),
);
export const kwainCard = (name: string) => kwainCards.find((c) => c.name === name || c.name.split(" // ").includes(name))!;
export function kwainFixture() {
  const commander = kwainCard("Kwain, Itinerant Meddler");
  const f = dnaFixture(commander, kwainCards.filter((c) => c !== commander));
  f.deck.name = "Kwain Group Draw";
  f.deck.entries!.find((e) => e.name === "Island")!.quantity = 13;
  f.deck.entries!.find((e) => e.name === "Plains")!.quantity = 7;
  return f;
}
