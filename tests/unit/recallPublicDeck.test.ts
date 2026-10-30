import { it, expect } from "vitest";
import { parsePublicDeck } from "../audit/recall/archidekt";
const fixture = () => ({
  categories: [
    { name: "Commander", includedInDeck: true },
    { name: "Land", includedInDeck: true },
    { name: "Maybeboard", includedInDeck: false },
  ],
  cards: [
    {
      id: 1,
      quantity: 1,
      categories: ["Commander"],
      card: { oracleCard: { name: 'Henzie "Toolbox" Torre' } },
    },
    {
      id: 2,
      quantity: 99,
      categories: ["Land"],
      card: { oracleCard: { name: "Mountain" } },
    },
    {
      id: 3,
      quantity: 5,
      categories: ["Maybeboard"],
      card: { oracleCard: { name: "Sol Ring" } },
    },
  ],
});
it("keeps quantities and raw row references, excludes maybeboard, and normalizes quotation marks without guessing the commander", () => {
  const d = parsePublicDeck(fixture(), "Henzie “Toolbox” Torre");
  expect(d.total).toBe(100);
  expect(d.rows).toHaveLength(2);
  expect(d.rows[1].sourceRowIds).toEqual([2]);
  expect(d.rows[1].quantity).toBe(99);
});
it("rejects uncertain boards, invalid quantities, mismatched commanders and incomplete decks", () => {
  const unknown = fixture();
  unknown.cards[1].categories = ["Unmodeled"];
  expect(() => parsePublicDeck(unknown, 'Henzie "Toolbox" Torre')).toThrow(
    "Unknown board",
  );
  const qty = fixture();
  qty.cards[1].quantity = 0;
  expect(() => parsePublicDeck(qty, 'Henzie "Toolbox" Torre')).toThrow(
    "quantity",
  );
  expect(() => parsePublicDeck(fixture(), "Another commander")).toThrow(
    "differs",
  );
  const size = fixture();
  size.cards[1].quantity = 98;
  expect(() => parsePublicDeck(size, 'Henzie "Toolbox" Torre')).toThrow(
    "got 99",
  );
});
it("does not silently drop a second commander or select a commander from an unmarked row", () => {
  const two = fixture();
  two.cards[1].categories = ["Commander"];
  expect(() => parsePublicDeck(two, 'Henzie "Toolbox" Torre')).toThrow(
    "differs",
  );
  const none = fixture();
  none.cards[0].categories = ["Land"];
  expect(() => parsePublicDeck(none, 'Henzie "Toolbox" Torre')).toThrow(
    "explicit commander",
  );
});
