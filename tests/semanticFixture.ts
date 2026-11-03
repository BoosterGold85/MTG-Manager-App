// Cards observed in the user's production decks (v0.6.23 semantic coverage pass). Real Scryfall Oracle records.
// They are test fixtures only: production rules never refer to card names.
import raw from "./data/semantic-coverage.json" with { type: "json" };
import { normalizeCard } from "../src/import/scryfall";
import type { CardMetadata } from "../src/models/collection";

export const observedCards = raw.map((c) =>
  normalizeCard({ ...c, object: "card", set_name: "Semantic coverage" } as unknown as Parameters<typeof normalizeCard>[0]),
);
export const observed = (name: string): CardMetadata => {
  const c = observedCards.find((x) => x.name === name || x.name.split(" // ").includes(name));
  if (!c) throw new Error(`Observed card missing: ${name}`);
  return c;
};
