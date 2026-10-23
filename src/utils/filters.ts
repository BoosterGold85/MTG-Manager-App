import type { SampleCollectionCard } from "../models/card";
export const colorOptions = [
  { value: "W", label: "White", symbol: "☀" },
  { value: "U", label: "Blue", symbol: "◈" },
  { value: "B", label: "Black", symbol: "☾" },
  { value: "R", label: "Red", symbol: "✦" },
  { value: "G", label: "Green", symbol: "♣" },
  { value: "multi", label: "Multicolor", symbol: "✧" },
  { value: "C", label: "Colorless", symbol: "◇" },
];
export const cardTypes = [
  "Creature",
  "Artifact",
  "Enchantment",
  "Instant",
  "Sorcery",
  "Land",
  "Planeswalker",
];
export interface Filters {
  colors: string[];
  types: string[];
  minMana: string;
  maxMana: string;
  rarity: string;
  set: string;
  finish: string;
  tag: string;
}
export const emptyFilters: Filters = {
  colors: [],
  types: [],
  minMana: "",
  maxMana: "",
  rarity: "",
  set: "",
  finish: "",
  tag: "",
};
export function activeFilterCount(f: Filters) {
  return (
    f.colors.length +
    f.types.length +
    [f.minMana, f.maxMana, f.rarity, f.set, f.finish, f.tag].filter(Boolean)
      .length
  );
}
export function filterCards(
  cards: SampleCollectionCard[],
  query: string,
  f: Filters,
) {
  return cards.filter(
    (c) =>
      c.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!f.colors.length ||
        f.colors.some((color) =>
          color === "multi"
            ? c.colorIdentity.length > 1
            : color === "C"
              ? c.colorIdentity.length === 0
              : c.colorIdentity.some((identity) => identity === color),
        )) &&
      (!f.types.length || f.types.some((t) => c.typeLine.includes(t))) &&
      (f.minMana === "" || c.manaValue >= Number(f.minMana)) &&
      (f.maxMana === "" || c.manaValue <= Number(f.maxMana)) &&
      (!f.rarity || c.rarity === f.rarity) &&
      (!f.set || c.setCode === f.set) &&
      (!f.finish || Boolean(c.foil) === (f.finish === "foil")) &&
      (!f.tag || c.tags?.includes(f.tag)),
  );
}
