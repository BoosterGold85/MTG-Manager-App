import { describe, expect, it } from "vitest";
import { milesCard, milesCards, milesFixture } from "../milesFixture";
import { reignOfDragonsFixture } from "../recommendationFixtures";
import { dnaFixture } from "../dnaFixtures";
import { oracleCard } from "../upgradeCandidates";
import { analysisConfidence } from "../../src/upgrades";
import { cardFunction } from "../../src/upgrades/cardFunction";
import { observed } from "../semanticFixture";

const milesMain = () => milesCards.filter((c) => c.name !== 'Miles "Tails" Prower');
describe("analysis confidence (\"the app isn't sure\" warnings)", () => {
  it("regression decks the engine understands stay High; a few partly understood cards are listed, not alarming", () => {
    for (const f of [milesFixture(), reignOfDragonsFixture(), dnaFixture()]) {
      const c = analysisConfidence(f.state, f.deck);
      expect(c.level, f.deck.name).toBe("High");
      expect(c.notes.every((n) => n.kind === "partial-cards"), f.deck.name).toBe(true);
    }
    expect(analysisConfidence(dnaFixture().state, dnaFixture().deck)).toEqual({ level: "High", notes: [] });
  });
  it("a Commander trigger the engine can't classify is Low and quotes the ability", () => {
    const clash = oracleCard("Clash Captain", "{2}{W}{U}", 4, "Legendary Creature — Human Soldier", "Whenever you win a clash, draw a card.", ["W", "U"]);
    const f = dnaFixture(clash, milesMain());
    const c = analysisConfidence(f.state, f.deck);
    expect(c.level).toBe("Low");
    const note = c.notes.find((n) => n.kind === "commander-trigger")!;
    expect(note.message).toContain("Clash Captain");
    expect(note.items.join(" ")).toMatch(/win a clash/);
  });
  it("separates unmodeled mechanics, partly understood cards and missing records; vanilla creatures are valid", () => {
    const odd = ["Odd One", "Odd Two", "Odd Three", "Odd Four", "Odd Five"].map((n) =>
      oracleCard(n, "{2}{W}", 3, "Enchantment", "At the beginning of each upkeep, each player chooses a number. Reveal those numbers simultaneously.", ["W"]),
    );
    // Missing data is an absent rules text; "" is a valid empty Oracle text.
    const blank = { ...milesCard("Parhelion II"), oracleText: undefined, cardFaces: undefined };
    const vanilla = [observed("Walking Corpse"), observed("Wandering Tombshell")];
    const main = milesMain().filter((c) => c.name !== "Parhelion II");
    const f = dnaFixture(milesCard('Miles "Tails" Prower'), [...main.slice(0, main.length - odd.length - 3), ...odd, blank, ...vanilla, observed("Delina, Wild Mage")]);
    const c = analysisConfidence(f.state, f.deck);
    expect(c.level).toBe("Medium");
    const note = (kind: string) => c.notes.find((n) => n.kind === kind);
    expect(note("unsupported-cards")!.items).toEqual(odd.map((o) => o.name).sort());
    expect(note("unsupported-cards")!.message).toMatch(/^5 cards use mechanics the app doesn't model yet\.$/);
    expect(note("partial-cards")!.items).toEqual(expect.arrayContaining(["Delina, Wild Mage"]));
    expect(note("partial-cards")!.message).toMatch(/Recognized effects still count/);
    expect(note("missing-data")!.items).toEqual(["Parhelion II"]);
    for (const n of c.notes) for (const v of vanilla) expect(n.items).not.toContain(v.name);
    expect(c.notes.map((n) => n.message).join(" ")).not.toMatch(/don't count/);
  });
  it("cards the warning first surfaced in the Miles deck are now tracked", () => {
    expect(cardFunction(milesCard("Condemn")).roles.interaction).toBeGreaterThan(0);
    expect(Object.keys(cardFunction(milesCard("Favorable Winds")).roles)).not.toEqual([]);
    // Library tucks are removal; a mass tuck is a wipe.
    expect(cardFunction(oracleCard("Hallowed Burial", "{3}{W}{W}", 5, "Sorcery", "Put all creatures on the bottom of their owners' libraries.", ["W"])).roles.wipes).toBe(1);
  });
});
