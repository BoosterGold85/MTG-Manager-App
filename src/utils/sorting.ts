import type { SampleCollectionCard } from "../models/card";
export type Sort = "name" | "mana" | "color" | "set";
export const sortLabels = {
  name: "Name A–Z",
  mana: "Mana value",
  color: "Color",
  set: "Set",
};
const colorOrder = ["W", "U", "B", "R", "G"];
const rank = (c: SampleCollectionCard) =>
  c.colorIdentity.length === 0
    ? 6
    : c.colorIdentity.length > 1
      ? 5
      : colorOrder.indexOf(c.colorIdentity[0]);
export function sortCards(cards: SampleCollectionCard[], sort: Sort) {
  return [...cards].sort(
    (a, b) =>
      (sort === "mana"
        ? a.manaValue - b.manaValue
        : sort === "color"
          ? rank(a) - rank(b)
          : sort === "set"
            ? a.setCode.localeCompare(b.setCode)
            : 0) || a.name.localeCompare(b.name),
  );
}
