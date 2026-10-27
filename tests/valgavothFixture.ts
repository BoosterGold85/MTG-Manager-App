// Valgavoth, Harrower of Souls punisher / "group chaos" deck, supplied by the user as a permanent regression fixture.
// Oracle wording is written from memory: Scryfall was not reachable from the build environment. Entries marked
// fixture_confidence "low" are reconstructed and should be re-checked against Scryfall when this fixture is refreshed.
import raw from "./data/valgavoth-pings.json" with { type: "json" };
import { normalizeCard } from "../src/import/scryfall";
import { dnaFixture } from "./dnaFixtures";

export const valgavothCards = raw.map((c) =>
  normalizeCard({ ...c, object: "card", set_name: "Valgavoth pings regression" } as unknown as Parameters<typeof normalizeCard>[0]),
);
export const valgavothCard = (name: string) => valgavothCards.find((c) => c.name === name)!;
export function valgavothFixture() {
  const commander = valgavothCard("Valgavoth, Harrower of Souls");
  const f = dnaFixture(commander, valgavothCards.filter((c) => c !== commander));
  f.deck.name = "Valgavoth Pings";
  f.deck.entries!.find((e) => e.name === "Mountain")!.quantity = 7;
  f.deck.entries!.find((e) => e.name === "Swamp")!.quantity = 8;
  return f;
}
