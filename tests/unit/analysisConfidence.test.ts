import { describe, expect, it } from "vitest";
import { milesCard, milesCards, milesFixture } from "../milesFixture";
import { valgavothFixture } from "../valgavothFixture";
import { reignOfDragonsFixture } from "../recommendationFixtures";
import { dnaFixture } from "../dnaFixtures";
import { oracleCard } from "../upgradeCandidates";
import { analysisConfidence } from "../../src/upgrades";
import { cardFunction } from "../../src/upgrades/cardFunction";

const milesMain = () => milesCards.filter((c) => c.name !== 'Miles "Tails" Prower');
describe("analysis confidence (\"the app isn't sure\" warnings)", () => {
  it("regression decks the engine understands report High with no notes", () => {
    for (const f of [milesFixture(), valgavothFixture(), reignOfDragonsFixture(), dnaFixture()]) expect(analysisConfidence(f.state, f.deck)).toEqual({ level: "High", notes: [] });
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
  it("lists cards that do things the app doesn't track, and cards with no rules text", () => {
    const odd = ["Odd One", "Odd Two", "Odd Three", "Odd Four", "Odd Five"].map((n) =>
      oracleCard(n, "{2}{W}", 3, "Enchantment", "At the beginning of each upkeep, each player chooses a number. Reveal those numbers simultaneously.", ["W"]),
    );
    const blank = { ...milesCard("Parhelion II"), oracleText: "", cardFaces: undefined };
    const main = milesMain().filter((c) => c.name !== "Parhelion II");
    const f = dnaFixture(milesCard('Miles "Tails" Prower'), [...main.slice(0, main.length - odd.length), ...odd, blank]);
    const c = analysisConfidence(f.state, f.deck);
    expect(c.level).toBe("Medium");
    expect(c.notes.find((n) => n.kind === "untracked-cards")!.items).toEqual(expect.arrayContaining(odd.map((o) => o.name)));
    expect(c.notes.find((n) => n.kind === "missing-text")!.items).toEqual(["Parhelion II"]);
  });
  it("cards the warning first surfaced in the Miles deck are now tracked", () => {
    expect(cardFunction(milesCard("Condemn")).roles.interaction).toBeGreaterThan(0);
    expect(Object.keys(cardFunction(milesCard("Favorable Winds")).roles)).not.toEqual([]);
    // Library tucks are removal; a mass tuck is a wipe.
    expect(cardFunction(oracleCard("Hallowed Burial", "{3}{W}{W}", 5, "Sorcery", "Put all creatures on the bottom of their owners' libraries.", ["W"])).roles.wipes).toBe(1);
  });
});
