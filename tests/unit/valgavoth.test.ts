import { describe, expect, it } from "vitest";
import { valgavothCard, valgavothFixture } from "../valgavothFixture";
import { oracleCard } from "../upgradeCandidates";
import { deckDnaCache } from "../../src/dna/engine";
import { cardFunction } from "../../src/upgrades/cardFunction";
import { commanderBlueprint, deckHealth } from "../../src/upgrades";
import { deckCount } from "../../src/decks/decks";
import { analyze } from "../../src/intelligence/tagger";
import { opponentLifeLoss } from "../../src/synergy/facts";

const load = () => {
  const f = valgavothFixture();
  const dna = deckDnaCache.get(f.state, f.deck);
  const card = (name: string) => Object.values(dna.cards).find((c) => c.name === name)!;
  const commanderLink = (name: string) => Math.max(0, ...(card(name).recommendation?.links || []).filter((l) => l.commander).map((l) => l.strength));
  return { f, dna, card, commanderLink };
};
describe("Valgavoth punisher / group-chaos regression deck", () => {
  it("reads as Pings / Punisher first, not Spells, with the Commander reinforcing it", () => {
    const { f, dna } = load();
    expect(deckCount(f.deck)).toBe(100);
    expect(dna.core.primary[0]).toBe("Pings / Punisher");
    expect(dna.core.primary).not.toContain("Spells");
    expect(dna.summary).toContain("ping opponents a little at a time");
    expect(dna.summary).toMatch(/Valgavoth, Harrower of Souls reinforces Pings \/ Punisher/);
  });
  it("understands the Commander's 'opponent loses life' trigger and links it to every way the deck pings", () => {
    const { f, dna, commanderLink } = load();
    expect(dna.strategyProfile.commanderSynergyTags.some((t) => t.event === "life-loss")).toBe(true);
    expect(commanderBlueprint(f.state, f.deck).mechanics.map((m) => m.label)).toContain("Rewards opponents losing life (pings, drain, punisher effects)");
    // Triggers that fire on opponents' turns feed "first time during each of their turns" fully…
    for (const name of ["Spiteful Visions", "Fate Unraveler", "Kaervek the Merciless", "Mogis, God of Slaughter", "Kederekt Parasite"]) expect(commanderLink(name), name).toBe(1);
    // …your-turn burst still counts, but less.
    expect(commanderLink("Gray Merchant of Asphodel")).toBeGreaterThan(0);
    expect(commanderLink("Gray Merchant of Asphodel")).toBeLessThan(1);
    // Paying your own life is not a ping.
    expect(commanderLink("Infernal Grasp")).toBe(0);
  });
  it("key cards are punisher engines", () => {
    const { dna } = load();
    expect(dna.central).toHaveLength(3);
    for (const c of dna.central) expect(dna.cards[c.identity].connections.some((con) => con.themeId === "pings"), c.name).toBe(true);
  });
  it("Lightning Greaves counts as (partial) protection and Exhume as recursion", () => {
    expect(cardFunction(valgavothCard("Lightning Greaves")).roles.protection).toBe(0.7);
    expect(cardFunction(valgavothCard("Exhume")).roles.recursion).toBe(1);
    const { f } = load();
    const health = deckHealth(f.state, f.deck);
    expect(health.find((h) => h.need === "protection")!.count).toBeGreaterThan(0);
    expect(health.find((h) => h.need === "recursion")!.count).toBeGreaterThan(0);
  });
});

describe("generic opponent life-loss rules", () => {
  const tags = (text: string) => analyze(oracleCard(`Ping ${text.length}`, "{2}{B}", 3, "Enchantment", text, ["B"])).assignments.map((a) => a.tagId);
  it("tags opponent life loss, punishers and symmetric draw, never your own life payments", () => {
    expect(tags("At the beginning of your upkeep, each opponent loses 1 life.")).toContain("opponent-life-loss");
    expect(tags("Whenever a player casts a spell, this enchantment deals 1 damage to that player.")).toEqual(expect.arrayContaining(["opponent-life-loss", "punisher"]));
    expect(tags("Whenever an opponent casts a spell, this deals damage equal to that spell's mana value to any target.")).toContain("punisher");
    expect(tags("At the beginning of each player's draw step, that player draws an additional card.")).toContain("symmetric-draw");
    expect(tags("Draw two cards. You lose 2 life.")).not.toContain("opponent-life-loss");
    expect(tags("Lightning deals 3 damage to any target.")).not.toContain("opponent-life-loss");
  });
  it("classifies when a source can hurt opponents", () => {
    expect(opponentLifeLoss("Whenever an opponent draws a card, this deals 1 damage to that player.")).toEqual({ direct: true, theirTurn: true, anyTarget: false });
    expect(opponentLifeLoss("When this enters, each opponent loses 3 life.")).toEqual({ direct: true, theirTurn: false, anyTarget: false });
    expect(opponentLifeLoss("This deals 2 damage to any target.")).toEqual({ direct: false, theirTurn: false, anyTarget: true });
    expect(opponentLifeLoss("You lose 2 life.").direct).toBe(false);
  });
});
