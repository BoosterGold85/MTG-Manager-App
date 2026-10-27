import { describe, expect, it } from "vitest";
import { milesCard, milesFixture } from "../milesFixture";
import { oracleCard } from "../upgradeCandidates";
import { deckDnaCache } from "../../src/dna/engine";
import { cardFunction } from "../../src/upgrades/cardFunction";
import { extractCardFacts } from "../../src/synergy/facts";
import { deckHealth } from "../../src/upgrades";
import { deckCount } from "../../src/decks/decks";

const dna = () => {
  const f = milesFixture();
  return { f, dna: deckDnaCache.get(f.state, f.deck) };
};
describe("Miles \"Tails\" Prower Vehicles regression deck", () => {
  it("is a legal 100-card deck whose primary plan is Vehicles / Combat", () => {
    const { f, dna: d } = dna();
    expect(deckCount(f.deck)).toBe(100);
    expect(d.core.primary).toEqual(["Vehicles", "Combat"]);
    expect(d.summary).toContain("crew Vehicles and attack with them");
  });
  it("Cleansing Nova and Time Wipe count as board wipes in Deck Health", () => {
    for (const name of ["Cleansing Nova", "Time Wipe"]) expect(cardFunction(milesCard(name)).roles.wipes).toBe(1);
    const { f } = dna();
    expect(deckHealth(f.state, f.deck).find((h) => h.need === "wipes")!.count).toBeGreaterThanOrEqual(2);
  });
  it("key cards are strategic: Mu Yanling is one, Mishra's Bauble is not", () => {
    const { dna: d } = dna();
    const names = d.central.map((c) => c.name);
    expect(names).toContain("Mu Yanling, Wind Rider");
    expect(names).not.toContain("Mishra's Bauble");
    // General fit alone never makes a key card: every key card has a primary-theme connection.
    for (const c of d.central) expect(d.cards[c.identity].connections.some((con) => ["vehicles", "combat"].includes(con.themeId))).toBe(true);
  });
  it("identifies the Commander's Vehicle-ETB flying/card-draw reward as the primary payoff", () => {
    const { dna: d } = dna();
    expect(d.core.payoff).toMatch(/^Vehicles payoff via Miles "Tails" Prower: Whenever a Vehicle you control enters.*draw a card/);
    expect(d.strategyProfile.commanderSynergyTags.some((t) => t.event === "enters" && t.objects.includes("Vehicle"))).toBe(true);
  });
  it("Parhelion-style repeatable evasive attack engines get meaningful finisher credit", () => {
    const parhelion = cardFunction(milesCard("Parhelion II"));
    expect(parhelion.roles.finishers).toBeGreaterThanOrEqual(0.8);
    expect(parhelion.impactReasons.join(" ")).toMatch(/Each attack adds more attacking creatures/);
    expect(parhelion.engines.combatThreat).toBeGreaterThan(0);
    const { f } = dna();
    expect(deckHealth(f.state, f.deck).find((h) => h.need === "finishers")!.count).toBeGreaterThanOrEqual(4);
  });
});

describe("generic evaluator rules behind the Miles fixes", () => {
  const roles = (text: string, type = "Sorcery") => cardFunction(oracleCard(`Wipe ${text.length}`, "{3}{W}{W}", 5, type, text, ["W"])).roles;
  it("mass removal is found after modal bullets, choices and earlier clauses", () => {
    expect(roles("Choose one —\n• Exile all creatures.\n• Exile all graveyards.").wipes).toBe(1);
    expect(roles("Choose one or both —\n• Destroy all artifacts.\n• Destroy all creatures.").wipes).toBe(1);
    expect(roles("Return up to one target creature you control to its owner's hand. Then destroy all other creatures.").wipes).toBe(1);
    expect(roles("You gain 2 life, then exile all creatures.").wipes).toBe(1);
    expect(roles("Destroy target creature. Its controller draws a card.").wipes).toBeUndefined();
    const nonCreature = extractCardFacts(oracleCard("Artifact Sweep", "{2}{W}", 3, "Sorcery", "Choose one —\n• Destroy all artifacts.\n• Destroy all enchantments.", ["W"])).faces[0].answers;
    expect(nonCreature.every((a) => a.mass)).toBe(true);
  });
  it("attack-added attackers and crewed Vehicles count as threats without card names", () => {
    const tokens = cardFunction(oracleCard("Generic Attack Engine", "{4}{W}", 5, "Creature — Human Soldier", "Whenever this creature attacks, create two 1/1 white Soldier creature tokens that are tapped and attacking.", ["W"], { power: "3", toughness: "3" }));
    expect(tokens.roles.finishers).toBeGreaterThanOrEqual(0.8);
    const vehicle = cardFunction(oracleCard("Generic Skyship", "{5}", 5, "Artifact — Vehicle", "Flying\nCrew 3", [], { power: "6", toughness: "6", keywords: ["Flying", "Crew"] }));
    expect(vehicle.roles.finishers).toBeGreaterThanOrEqual(0.8);
    const small = cardFunction(oracleCard("Generic Skiff", "{2}", 2, "Artifact — Vehicle", "Crew 1", [], { power: "3", toughness: "2", keywords: ["Crew"] }));
    expect(small.roles.finishers).toBeUndefined();
  });
});
