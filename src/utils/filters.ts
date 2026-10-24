import type { Color, SampleCollectionCard } from "../models/card";
export const colorOptions = [
  { value: "W", label: "White", symbol: "☀" },
  { value: "U", label: "Blue", symbol: "◈" },
  { value: "B", label: "Black", symbol: "☾" },
  { value: "R", label: "Red", symbol: "✦" },
  { value: "G", label: "Green", symbol: "♣" },
  { value: "multi", label: "Multicolor", symbol: "✧" },
  { value: "C", label: "Colorless", symbol: "◇" },
];
// All 32 identities, including the empty (colorless) identity. Null means off.
const commanderColors: Color[] = ["W", "U", "B", "R", "G"];
export const commanderIdentityOptions = Array.from(
  { length: 32 },
  (_, mask) => {
    const identity = commanderColors.filter((_, index) => mask & (1 << index));
    return {
      identity,
      value: identity.join("") || "C",
      label: identity.length
        ? identity
            .map(
              (color) =>
                colorOptions.find((option) => option.value === color)!.label,
            )
            .join(" / ") + ` (${identity.join("/")})`
        : "Colorless",
    };
  },
).sort((a, b) => a.identity.length - b.identity.length);
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
  commanderColors: Color[] | null;
  types: string[];
  minMana: string;
  maxMana: string;
  rarity: string;
  set: string;
  finish: string;
  tag: string;
  synergyTags?: string[];
  tagMatch?: "ANY" | "ALL";
}
export const emptyFilters: Filters = {
  colors: [],
  commanderColors: null,
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
    Number(f.commanderColors !== null) +
    (f.synergyTags?.length || 0) +
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
  const commanderIdentity = f.commanderColors;
  const tags=f.synergyTags || [];
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
      (commanderIdentity === null ||
        c.colorIdentity.every((color) => commanderIdentity.includes(color))) &&
      (!f.types.length || f.types.some((t) => c.typeLine.includes(t))) &&
      (f.minMana === "" || c.manaValue >= Number(f.minMana)) &&
      (f.maxMana === "" || c.manaValue <= Number(f.maxMana)) &&
      (!f.rarity || c.rarity === f.rarity) &&
      (!f.set || c.setCode === f.set) &&
      (!f.finish || Boolean(c.foil) === (f.finish === "foil")) &&
      (!f.tag || c.tags?.includes(f.tag)) &&
      (!tags.length || (f.tagMatch === "ALL" ? tags.every(id=>c.intelligentTags?.includes(id)) : tags.some(id=>c.intelligentTags?.includes(id)))),
  );
}
