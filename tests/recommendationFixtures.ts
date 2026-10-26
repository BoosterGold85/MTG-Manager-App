import raw from "./data/recommendation-vnext.scryfall.json" with { type: "json" };
import reignRaw from "./data/reign-of-dragons.scryfall.json" with { type: "json" };
import { normalizeCard } from "../src/import/scryfall";
import { scoringCard } from "./scoringFixtures";
import { dnaFixture } from "./dnaFixtures";
import type { Color } from "../src/models/card";
export const canonicalFactsCards = raw.map((c) => ({
  ...scoringCard(c.name, c.type_line, c.oracle_text, c.cmc, c.keywords),
  scryfallId: c.id,
  oracleId: c.oracle_id,
  colors: c.colors as Color[],
  colorIdentity: c.color_identity as Color[],
}));
export const reignCards = reignRaw.map((c) =>
  normalizeCard({
    ...c,
    object: "card",
    set_name: "Reign of Dragons regression",
  } as Parameters<typeof normalizeCard>[0]),
);
export function reignOfDragonsFixture() {
  const commander = reignCards.find(
    (c) => c.name === "Lathliss, Dragon Queen",
  )!;
  const f = dnaFixture(
    commander,
    reignCards.filter((c) => c !== commander),
  );
  f.deck.name = "Reign of Dragons";
  f.deck.entries!.find((e) => e.name === "Mountain")!.quantity = 32;
  return f;
}
