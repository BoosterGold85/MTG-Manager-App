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

describe("popular cards the untagged review found", () => {
  it("single-target -X/-X and 'up to X targets' damage are removal; bounce is removal", () => {
    for (const name of ["Dismember", "Tragic Slip", "Defile", "Crackle with Power", "Unsummon"]) expect(roles(name).interaction, name).toBeGreaterThan(0);
    for (const name of ["Aetherize", "Cyclonic Rift"]) expect((roles(name).interaction || 0) + (roles(name).wipes || 0), name).toBeGreaterThan(0);
  });
  it("'draw cards equal to', additional draws and Fact or Fiction-style selection are card advantage", () => {
    for (const name of ["Sylvan Library", "Fact or Fiction", "Last March of the Ents"]) expect(roles(name).cardAdvantage, name).toBeGreaterThan(0);
  });
  it("'damage to them' is an opponent ping and life-loss doublers are pings payoffs", async () => {
    const { analyze } = await import("../../src/intelligence/tagger");
    expect(analyze(card("Razorkin Needlehead")).assignments.map((a) => a.tagId)).toContain("opponent-life-loss");
    expect(analyze(card("Bloodletter of Aclazotz")).assignments.map((a) => a.tagId)).toContain("punisher");
    expect(roles("Bloodletter of Aclazotz").finishers).toBe(1);
  });
  it("multi-target blink is blink", async () => {
    const { analyze } = await import("../../src/intelligence/tagger");
    expect(analyze(card("Ghostly Flicker")).assignments.map((a) => a.tagId)).toContain("blink");
  });
});
describe("expensive cards aren't ramp, and ultimates aren't roles (Ugin feedback, v0.6.12)", () => {
  it("a planeswalker ultimate beyond its starting loyalty adds no role", () => {
    expect(roles("Ugin, Eye of the Storms").tutors).toBeUndefined();
    expect(roles("Ugin, the Spirit Dragon").cardAdvantage).toBeUndefined();
    expect(cardFunction(card("Ugin, Eye of the Storms")).impactReasons.join(" ")).toMatch(/ultimate costs more loyalty than it starts with/);
    // Abilities it can actually use still count.
    expect(roles("Ugin, Eye of the Storms").interaction).toBeGreaterThan(0);
    expect(roles("Ugin, the Spirit Dragon").wipes).toBe(1);
  });
  it("ramp credit shrinks with the mana source's own cost", () => {
    expect(roles("Hedron Archive").ramp).toBe(1);
    expect(roles("Gilded Lotus").ramp).toBe(0.7);
    expect(roles("Ugin, Eye of the Storms").ramp).toBe(0.4);
  });
});
