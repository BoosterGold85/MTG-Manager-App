import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import data from "../../src/data/sampleCards.json";
import type { SampleCollectionCard } from "../../src/models/card";
import {
  activeFilterCount,
  emptyFilters,
  filterCards,
} from "../../src/utils/filters";
import { sortCards } from "../../src/utils/sorting";
import { CardDetail } from "../../src/components/CardDetail";
const cards = data as SampleCollectionCard[];
describe("sample collection and filtering", () => {
  it("has canonical, varied data with locally cached real artwork", () => {
    expect(cards).toHaveLength(32);
    expect(new Set(cards.map((c) => c.id)).size).toBe(32);
    expect(
      cards.every(
        (c) => c.id === c.scryfallId && c.imageUrl.startsWith("/cards/"),
      ),
    ).toBe(true);
    expect(new Set(cards.flatMap((c) => c.colorIdentity)).size).toBe(5);
    expect(cards.some((c) => c.colorIdentity.length > 1)).toBe(true);
    expect(cards.some((c) => !c.colorIdentity.length)).toBe(true);
    expect(cards.some((c) => c.foil)).toBe(true);
  });
  it("searches exact, partial, case-insensitive names with whitespace trimmed", () => {
    expect(
      filterCards(cards, "SOL RING", emptyFilters).map((c) => c.name),
    ).toEqual(["Sol Ring"]);
    expect(
      filterCards(cards, "  titan ", emptyFilters).map((c) => c.name),
    ).toEqual(["Sun Titan"]);
    expect(filterCards(cards, "not-a-card", emptyFilters)).toHaveLength(0);
  });
  it("matches any chosen color, including multicolor and colorless", () => {
    expect(
      filterCards(cards, "", { ...emptyFilters, colors: ["W", "U"] }).every(
        (c) => c.colorIdentity.includes("W") || c.colorIdentity.includes("U"),
      ),
    ).toBe(true);
    expect(
      filterCards(cards, "", { ...emptyFilters, colors: ["multi"] }).every(
        (c) => c.colorIdentity.length > 1,
      ),
    ).toBe(true);
    expect(
      filterCards(cards, "", { ...emptyFilters, colors: ["C"] }).every(
        (c) => !c.colorIdentity.length,
      ),
    ).toBe(true);
  });
  it("combines categories with AND; multiple types with OR", () => {
    const found = filterCards(cards, "", {
      ...emptyFilters,
      colors: ["G"],
      types: ["Creature"],
      tag: "Landfall",
    });
    expect(found.map((c) => c.name).sort()).toEqual([
      "Avenger of Zendikar",
      "Scute Swarm",
      "Tatyova, Benthic Druid",
    ]);
    const types = filterCards(cards, "", {
      ...emptyFilters,
      types: ["Artifact", "Land"],
    });
    expect(types.length).toBeGreaterThan(4);
    expect(types.every((c) => /Artifact|Land/.test(c.typeLine))).toBe(true);
  });
  it("supports inclusive mana range, set, rarity, foil and sample tag", () => {
    const c = cards.find((c) => c.name === "Hardened Scales")!;
    const f = {
      ...emptyFilters,
      minMana: "1",
      maxMana: "1",
      set: "ktk",
      rarity: "rare",
      finish: "foil",
      tag: "+1/+1 Counters",
    };
    expect(filterCards(cards, "", f)).toEqual([c]);
    expect(activeFilterCount(f)).toBe(6);
    expect(filterCards(cards, "", { ...f, finish: "nonfoil" })).toHaveLength(0);
    expect(
      filterCards(cards, "", { ...emptyFilters, minMana: "8", maxMana: "1" }),
    ).toHaveLength(0);
  });
  it("reset returns every sample without mutating original records", () => {
    expect(filterCards(cards, "", { ...emptyFilters })).toHaveLength(32);
    expect(activeFilterCount(emptyFilters)).toBe(0);
  });
});
describe("sorting and missing optional metadata", () => {
  it("sorts by name, mana value, Magic color order and set without mutation", () => {
    const original = cards.map((c) => c.id);
    for (const mode of ["name", "mana", "color", "set"] as const) {
      const sorted = sortCards(cards, mode);
      expect(sorted).toHaveLength(32);
      if (mode === "name")
        expect(sorted[0].name).toBe("Adeline, Resplendent Cathar");
      if (mode === "mana") expect(sorted[0].manaValue).toBe(0);
      if (mode === "color") {
        expect(sorted[0].colorIdentity).toEqual(["W"]);
        expect(sorted.at(-1)?.colorIdentity).toEqual([]);
      }
      if (mode === "set")
        expect(sorted.map((c) => c.setCode)).toEqual(
          cards.map((c) => c.setCode).sort(),
        );
    }
    expect(cards.map((c) => c.id)).toEqual(original);
  });
  it("renders details safely with only required metadata", () => {
    const card: SampleCollectionCard = {
      id: "sample",
      scryfallId: "sample",
      name: "Sample",
      imageUrl: "/missing.jpg",
      setCode: "abc",
      manaValue: 0,
      colorIdentity: [],
      typeLine: "Land",
      rarity: "common",
      quantity: 1,
    };
    const html = renderToStaticMarkup(
      <CardDetail card={card} onClose={() => {}} />,
    );
    expect(html).toContain("Colorless");
    expect(html).toContain("ABC");
    expect(html).toContain("No confident automatic tags yet");
    expect(html).not.toContain("undefined");
  });
});

describe("Commander Colors subset filtering", () => {
  const identities = {
    colorless: [],
    white: ["W"],
    blue: ["U"],
    black: ["B"],
    red: ["R"],
    green: ["G"],
    blackGreen: ["B", "G"],
    blackGreenBlue: ["B", "G", "U"],
    whiteBlackGreen: ["W", "B", "G"],
    blueBlackRed: ["U", "B", "R"],
    fiveColor: ["W", "U", "B", "R", "G"],
  } as const;
  const fixture = Object.entries(identities).map(
    ([name, identity]) =>
      ({
        ...cards[0],
        id: name,
        name,
        colorIdentity: [...identity],
        // Deliberately different from identity, like a visually colorless/devoid card.
        colors: [],
      }) as SampleCollectionCard & { colors: string[] },
  );
  const names = (identity: SampleCollectionCard["colorIdentity"] | null) =>
    filterCards(fixture, "", {
      ...emptyFilters,
      commanderColors: identity,
    }).map((c) => c.name);

  it("supports a mono-color Commander, using identity rather than visual colors", () => {
    expect(names(["B"])).toEqual(["colorless", "black"]);
  });
  it("supports a two-color Commander and all of its subsets", () => {
    expect(names(["B", "G"])).toEqual([
      "colorless",
      "black",
      "green",
      "blackGreen",
    ]);
  });
  it("supports a three-color Commander and all of its subsets", () => {
    expect(names(["W", "B", "G"])).toEqual([
      "colorless",
      "white",
      "black",
      "green",
      "blackGreen",
      "whiteBlackGreen",
    ]);
  });
  it("supports a five-color Commander", () => {
    expect(names(["W", "U", "B", "R", "G"])).toEqual(
      fixture.map((c) => c.name),
    );
  });
  it("distinguishes a colorless Commander from a disabled filter", () => {
    expect(names([])).toEqual(["colorless"]);
    expect(names(null)).toEqual(fixture.map((c) => c.name));
    expect(activeFilterCount({ ...emptyFilters, commanderColors: [] })).toBe(1);
    expect(activeFilterCount(emptyFilters)).toBe(0);
  });
  it.each([
    ["W"],
    ["U"],
    ["B"],
    ["R"],
    ["G"],
    ["B", "G"],
    ["W", "B", "G"],
    [],
  ] as SampleCollectionCard["colorIdentity"][])(
    "includes colorless cards with Commander identity %j",
    (...identity) => {
      expect(names(identity)).toContain("colorless");
    },
  );
  it("excludes a card with even one disallowed color, regardless of order", () => {
    expect(names(["G", "B"])).not.toContain("blackGreenBlue");
    expect(names(["B", "G"])).not.toContain("whiteBlackGreen");
  });
  it("combines independently with normal Color and search", () => {
    expect(
      filterCards(fixture, "", {
        ...emptyFilters,
        commanderColors: ["B", "G"],
        colors: ["G"],
      }).map((c) => c.name),
    ).toEqual(["green", "blackGreen"]);
    expect(
      filterCards(fixture, "black", {
        ...emptyFilters,
        commanderColors: ["B", "G"],
      }).map((c) => c.name),
    ).toEqual(["black", "blackGreen"]);
    expect(
      filterCards(fixture, "", { ...emptyFilters, colors: ["G"] }).map(
        (c) => c.name,
      ),
    ).toEqual([
      "green",
      "blackGreen",
      "blackGreenBlue",
      "whiteBlackGreen",
      "fiveColor",
    ]);
  });
});
