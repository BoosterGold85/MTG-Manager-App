// Kwain, Itinerant Meddler group-draw deck (user-supplied, v0.6.14). Real Scryfall card data.
import { describe, expect, it } from "vitest";
import { kwainCard, kwainFixture } from "../kwainFixture";
import { deckDnaCache } from "../../src/dna/engine";
import { analysisConfidence, deckHealth } from "../../src/upgrades";
import { cardFunction } from "../../src/upgrades/cardFunction";
import { deckCount } from "../../src/decks/decks";

const health = (need: string) => deckHealth(kwainFixture().state, kwainFixture().deck).find((h) => h.need === need)!;
describe("Kwain group-draw deck", () => {
  it("reads as group draw, not a pings deck", () => {
    const f = kwainFixture(), dna = deckDnaCache.get(f.state, f.deck);
    expect(deckCount(f.deck)).toBe(100);
    expect(dna.core.primary[0]).toBe("Group Draw");
    expect(dna.themes.map((t) => t.id)).not.toContain("pings");
    expect(dna.summary).toMatch(/give every player extra cards/);
    expect(dna.summary).not.toMatch(/ping/);
  });
  it("alternate wins and repeatable mill are finishers", () => {
    for (const name of ["Approach of the Second Sun", "Laboratory Maniac", "Triskaidekaphile"]) expect(cardFunction(kwainCard(name)).roles.finishers, name).toBe(1);
    expect(cardFunction(kwainCard("Psychic Corrosion")).roles.finishers).toBe(0.7);
    expect(health("finishers").status).toBe("Good");
  });
  it("pillowfort and restriction cards fill Defense, tracked once the deck runs several", () => {
    for (const name of ["Ghostly Prison", "Propaganda", "Windborn Muse", "Tidal Barracuda"]) expect(cardFunction(kwainCard(name)).roles.defense, name).toBeGreaterThan(0);
    expect(health("defense").count).toBeGreaterThanOrEqual(3);
    expect(health("defense").reasons.join(" ")).toMatch(/pillowfort or restriction cards/);
  });
  it("neutralizing opposing creatures is interaction, even when their controller chooses", () => {
    const fn = cardFunction(kwainCard("Hunted by The Family"));
    expect(fn.roles.interaction).toBe(0.8);
    expect(fn.impactReasons.join(" ")).toMatch(/their controller chooses how/);
  });
  it("heavy card draw lowers the land target; nothing is left untracked", () => {
    const lands = health("lands");
    expect(lands.target).toBe(34);
    expect(lands.reasons.join(" ")).toMatch(/draws heavily/);
    const f = kwainFixture();
    expect(analysisConfidence(f.state, f.deck).notes.map((n) => n.kind)).not.toContain("untracked-cards");
  });
});
