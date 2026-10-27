import type { Deck } from "../models/deck";
import { deckIdentity } from "./decks";

export type DeckTab = "overview" | "cards" | "upgrades" | "settings";
export const deckTabs: { id: DeckTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "cards", label: "Cards" },
  { id: "upgrades", label: "Upgrades" },
  { id: "settings", label: "Settings" },
];
export const isDeckTab = (value: string | null): value is DeckTab => deckTabs.some((t) => t.id === value);
const colorNames: Record<string, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
/** Mono-color decks read as "Mono Red"; others list their colors. */
export const identityName = (deck: Deck) => {
  const colors = deckIdentity(deck);
  if (!colors.length) return "Colorless";
  if (colors.length === 1) return `Mono ${colorNames[colors[0]] || colors[0]}`;
  return colors.map((c) => colorNames[c] || c).join(" / ");
};
