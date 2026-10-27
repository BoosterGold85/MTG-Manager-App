// Rules found by auditing the full Scryfall card pool (v0.6.10 audit). Card text is the real Oracle record.
import { describe, expect, it } from "vitest";
import raw from "../data/card-pool-rules.json" with { type: "json" };
import { normalizeCard } from "../../src/import/scryfall";
import { cardFunction } from "../../src/upgrades/cardFunction";
import { extractCardFacts } from "../../src/synergy/facts";
import { buildCommanderBlueprint } from "../../src/upgrades/blueprint";
import { canonicalInput } from "../../src/upgrades/inputs";
import { emptyCollection } from "../../src/models/collection";

const cards = raw.map((c) => normalizeCard({ ...c, object: "card", set_name: "card-pool rules" } as unknown as Parameters<typeof normalizeCard>[0]));
const card = (name: string) => cards.find((c) => c.name === name)!;
const roles = (name: string) => cardFunction(card(name)).roles;
const triggers = (name: string) => {
  const state = emptyCollection();
  state.metadata[card(name).scryfallId] = card(name);
  return buildCommanderBlueprint([canonicalInput(state, card(name), true)]).profile.commanderSynergyTags;
};
describe("effect scope comes from the clause, not the whole line", () => {
  it("draws are read from their own subject", () => {
    for (const name of ["Weight of Memory", "Sram, Senior Edificer", "Dangerous Wager", "Mind Spiral", "Plan the Heist"]) expect(roles(name).cardAdvantage, name).toBeGreaterThan(0);
    expect(extractCardFacts(card("Weight of Memory")).faces[0].cardDrawEffects[0].controller).toBe("you");
  });
  it("removal stays yours even when a later sentence names another player", () => {
    expect(roles("Fractured Identity").interaction).toBeGreaterThan(0);
    expect(roles("Soul Snare").interaction).toBeGreaterThan(0);
  });
});
describe("mass removal", () => {
  it("shrink sweeps, permanent sweeps with exceptions, multi-sentence and 'except creatures you control' sweeps are wipes", () => {
    for (const name of ["Drown in Sorrow", "Scourglass", "Ultimate Nullification", "Wildfire", "Flame Sweep"]) expect(roles(name).wipes, name).toBe(1);
    expect(roles("Marsh Gas").wipes).toBeUndefined();
    const wurm = extractCardFacts(card("Massacre Wurm")).faces[0].answers[0];
    expect(wurm).toMatchObject({ mode: "shrink", mass: true, opponentsOnly: true });
  });
});
describe("protection, ramp, tutors and recursion wording", () => {
  it("Aura protection and shroud count as protection", () => {
    expect(roles("Red Ward").protection).toBeGreaterThan(0);
    expect(roles("Lightning Greaves").protection).toBe(0.7);
  });
  it("Auras that grant a mana ability are ramp", () => expect(roles("Abundant Growth").ramp).toBeGreaterThan(0));
  it("type tutors count; named-card searches do not", () => {
    expect(roles("Solve the Equation").tutors).toBe(1);
    expect(roles("Avarax").tutors).toBeUndefined();
  });
  it("'put onto the battlefield from a graveyard' is recursion", () => expect(roles("Exhume").recursion).toBe(1));
});
describe("Commander triggers", () => {
  it("names with commas don't cut the trigger short", () => {
    const gregor = triggers("Gregor, Shrewd Magistrate");
    expect(gregor[0]).toMatchObject({ event: "combat-damage", selfOnly: true });
    expect(gregor[0].evidence.snippet).toContain("Gregor, Shrewd Magistrate deals combat damage");
  });
  it("discard, leaves-the-battlefield, token creation, scry and proliferate are understood", () => {
    expect(triggers("Anje Falkenrath").map((t) => t.event)).toContain("discard");
    expect(triggers("Taeko, the Patient Avalanche").map((t) => t.event)).toContain("leaves");
    expect(triggers("Akim, the Soaring Wind").map((t) => t.event)).toContain("token-created");
    expect(triggers("Elrond, Master of Healing").map((t) => t.event)).toContain("scry");
    expect(triggers("Ezuri, Stalker of Spheres").map((t) => t.event)).toContain("counters");
  });
});
