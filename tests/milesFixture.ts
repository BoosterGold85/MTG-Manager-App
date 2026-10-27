// Miles "Tails" Prower Vehicles deck, supplied by the user as a permanent regression fixture.
// Oracle wording is written from memory: Scryfall was not reachable from the build environment. Entries marked
// fixture_confidence "low" (recent, Universes Beyond and Un-set printings) are reconstructed and should be re-checked
// against Scryfall when this fixture is refreshed.
import milesRaw from "./data/miles-tails-vehicles.json" with { type: "json" };
import { normalizeCard } from "../src/import/scryfall";
import { dnaFixture } from "./dnaFixtures";

export const milesCards = milesRaw.map((c) =>
  normalizeCard({ ...c, object: "card", set_name: "Miles Vehicles regression" } as unknown as Parameters<typeof normalizeCard>[0]),
);
export const milesCard = (name: string) => milesCards.find((c) => c.name === name)!;
export function milesFixture() {
  const commander = milesCard('Miles "Tails" Prower');
  const f = dnaFixture(commander, milesCards.filter((c) => c !== commander));
  f.deck.name = "Miles Vehicles";
  for (const basic of ["Island", "Plains"]) f.deck.entries!.find((e) => e.name === basic)!.quantity = 15;
  return f;
}
