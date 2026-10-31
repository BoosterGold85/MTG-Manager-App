import { describe, expect, it } from "vitest";
import { findCard } from "../audit/recall/harness";
import { capabilities, capabilityRelationship } from "../../src/synergy/capabilities";
import { cardFunction, deckCardFunction } from "../../src/upgrades/cardFunction";
import { effectConditions, SupplyIndex, withoutLines } from "../../src/upgrades/conditions";
import { extractCardFacts } from "../../src/synergy/facts";
import { oracleCard } from "../upgradeCandidates";
const card = (name: string) => findCard(name)!;
const synthetic = (text: string, type = "Creature — Test") => oracleCard("Unseen rules example", "{2}", 2, type, text, []);

describe("recall: general semantic capabilities on frozen canonical cards", () => {
  it.each([
    ["Winding Constrictor", "counterReplacement"],
    ["Corpsejack Menace", "counterReplacement"],
    ["Living Death", "recursion"],
    ["Animate Dead", "recursion"],
    ["Scrap Trawler", "recursion"],
    ["Peregrine Drake", "landUntap"],
    ["Ramunap Excavator", "graveyardLandPlay"],
    ["Temur Sabertooth", "friendlyBounce"],
    ["Brass Squire", "attach"],
    ["Ardenn, Intrepid Archaeologist", "attach"],
    ["Kotori, Pilot Prodigy", "crewReduction"],
    ["Mech Hangar", "animateVehicle"],
    ["Peacewalker Colossus", "animateVehicle"],
    ["Mobilizer Mech", "animateVehicle"],
  ] as const)("extracts %s's capability and works under an unrelated name", (name, capability) => {
    const c = card(name);
    expect(capabilities(c)[capability]).toBe(true);
    expect(capabilities({ ...c, name: "Unseen example", oracleText: c.oracleText?.replaceAll(c.name, "Unseen example") })[capability]).toBe(true);
  });
  it("retains anaphoric protection instead of reading only the draw effect", () => {
    expect(cardFunction(card("Inspiring Call")).roles.protection).toBeGreaterThan(0);
    expect(cardFunction(synthetic("Creatures an opponent controls get +1/+1. Those creatures gain indestructible until end of turn.")).roles.protection).toBeUndefined();
    expect(cardFunction(synthetic("Those creatures gain indestructible until end of turn.")).roles.protection).toBeUndefined();
    expect(cardFunction(synthetic("Draw a card for each creature you control with a counter on it. Those creatures gain indestructible until end of turn.")).roles.protection).toBeGreaterThan(0);
  });
  it("Fabricate supplies artifact creature tokens and variable life loss remains a payoff, not damage", () => {
    const c = card("Marionette Master"), facts = extractCardFacts(c);
    expect(facts.faces[0].createsTokens.some(t => t.isCreature && t.creatureTypes.includes("Servo"))).toBe(true);
    expect(cardFunction(c).roles.tokens).toBeGreaterThan(0);
    expect(cardFunction(c).roles.finishers).toBeGreaterThan(0);
    expect(facts.faces[0].damage).toEqual([]);
  });
  it("does not conflate opposing effects, self-animation or land replay with ramp", () => {
    expect(capabilities(synthetic("Return target creature an opponent controls to its owner's hand.")).friendlyBounce).toBe(false);
    expect(capabilities(synthetic("This Vehicle becomes an artifact creature until end of turn.", "Artifact — Vehicle")).animateVehicle).toBe(false);
    expect(capabilities(synthetic("Untap target creature an opponent controls.")).landUntap).toBe(false);
    expect(cardFunction(card("Ramunap Excavator")).roles.ramp).toBeUndefined();
    expect(cardFunction(card("Ramunap Excavator")).roles.recursion).toBe(1);
  });
});

describe("recall: actual two-card interactions and negative controls", () => {
  it.each(["Teleportation Circle", "Thassa, Deep-Dwelling", "Temur Sabertooth"])("connects %s to reusable own ETB effects", name => {
    expect(capabilityRelationship(card(name), card("Peregrine Drake")).length).toBeGreaterThan(0);
    expect(capabilityRelationship(card(name), synthetic("Flying")).length).toBe(0);
  });
  it("does not turn ordinary exile/removal into a blink enabler", () => {
    expect(capabilityRelationship(synthetic("Exile target creature an opponent controls."), card("Peregrine Drake"))).toEqual([]);
  });
  it.each(["Brass Squire", "Ardenn, Intrepid Archaeologist"])("connects %s to Equipment but not unrelated permanents", name => {
    expect(capabilityRelationship(card(name), card("Skullclamp")).length).toBeGreaterThan(0);
    expect(capabilityRelationship(card(name), card("Sol Ring"))).toEqual([]);
  });
  it.each(["Kotori, Pilot Prodigy", "Mech Hangar", "Peacewalker Colossus", "Mobilizer Mech"])("connects %s to a crewed Vehicle", name => {
    expect(capabilityRelationship(card(name), card("Smuggler's Copter")).length).toBeGreaterThan(0);
    expect(capabilityRelationship(card(name), card("Sol Ring"))).toEqual([]);
  });
  it("artifact-tap draw is paid by artifacts; creature type alone is not enough", () => {
    expect(capabilityRelationship(card("Shimmer Dragon"), card("Sol Ring")).length).toBeGreaterThan(0);
    expect(capabilityRelationship(card("Shimmer Dragon"), card("Peregrine Drake"))).toEqual([]);
  });
  it("copy support respects the legend rule and explicit exceptions", () => {
    expect(capabilityRelationship(card("Cursed Mirror"), card("Peregrine Drake")).length).toBeGreaterThan(0);
    expect(capabilityRelationship(card("Cursed Mirror"), card("Lathliss, Dragon Queen"))).toEqual([]);
    expect(capabilityRelationship(card("Sakashima of a Thousand Faces"), card("Lathliss, Dragon Queen")).length).toBeGreaterThan(0);
  });
  it("counter amplifiers need real compatible counter placement, not another amplifier", () => {
    expect(capabilityRelationship(card("Corpsejack Menace"), card("Rishkar, Peema Renegade")).length).toBeGreaterThan(0);
    expect(capabilityRelationship(card("Corpsejack Menace"), card("Winding Constrictor"))).toEqual([]);
  });
});

describe("recall: line identity and conditional supplies", () => {
  it("removes the same historic ability with reminder text before computing conditional role deltas", () => {
    const c = card("Jhoira, Weatherlight Captain"), conditions = effectConditions(c);
    expect(cardFunction(withoutLines(c, conditions.map(x => x.line))).roles.cardAdvantage).toBeUndefined();
    const fn = deckCardFunction(c, new SupplyIndex([{card:card("Sol Ring"),quantity:10,commander:false}]));
    expect(fn.conditions?.[0].adds).toContain("cardAdvantage");
  });
  it("a colored discount has no supply in an off-color deck; other abilities are independent", () => {
    const c = card("Hazoret's Monument");
    const fn = deckCardFunction(c, new SupplyIndex([{card:card("Peregrine Drake"),quantity:10,commander:false}]));
    expect(fn.roles.ramp).toBeUndefined();
    expect(fn.roles.controlledDiscard).toBeGreaterThan(0);
  });
  it("replacement-only and empty decks cannot feed a counter multiplier", () => {
    const c = card("Winding Constrictor");
    expect(effectConditions(c).length).toBeGreaterThan(0);
    const fn = deckCardFunction(c,new SupplyIndex([{card:card("Corpsejack Menace"),quantity:10,commander:false}]));
    expect(fn.conditions?.every(x=>x.supply===0)).toBe(true);
  });
});

describe("recall: condition supply and dependent role regressions", () => {
  it("binds a chosen type to one tribe instead of combining incompatible tribes", () => {
    const horn = card("Herald's Horn");
    const supply = new SupplyIndex([
      {card: synthetic("Flying", "Creature — Dragon"), quantity:5, commander:false},
      {card: synthetic("Vigilance", "Creature — Angel"), quantity:4, commander:false},
    ]);
    for (const condition of effectConditions(horn)) expect(supply.supply(condition).supply).toBe(5);
    expect(deckCardFunction(horn, supply).roles.cardAdvantage).toBeGreaterThan(0);
  });
  it("requires the named number of simultaneous copies rather than two clone names", () => {
    const c = card("Biovisionary"), condition = effectConditions(c)[0];
    expect(condition.understood).toBe(true);
    const two = new SupplyIndex([{card:card("Clone"),quantity:2,commander:false}]);
    expect(deckCardFunction(c,two).conditions?.[0].factor).toBe(0);
    const three = new SupplyIndex([{card:card("Clone"),quantity:3,commander:false}]);
    expect(deckCardFunction(c,three).conditions?.[0].factor).toBe(1);
    expect(condition.minimumSupply).toBe(4);
  });
  it("Primal Amulet's back is conditional on actual spell supply and is not another cast trigger", () => {
    const c = card("Primal Amulet"), condition = effectConditions(c).find(x => x.key.startsWith("transform-cast"))!;
    expect(capabilities(c).transformCastThreshold).toBe(4);
    const low = deckCardFunction(c,new SupplyIndex([{card:card("Ponder"),quantity:2,commander:false}]));
    expect(low.conditions?.find(x=>x.key===condition.key)?.factor).toBe(0);
    expect(capabilityRelationship(c,card("Ponder"))[0]).toContain("does not cast");
    expect(capabilityRelationship(c,card("Sol Ring"))).toEqual([]);
  });
  it("Servo artifacts are valid artifacts, not merely creatures or resource-token names", () => {
    const token = extractCardFacts(card("Marionette Master")).faces[0].createsTokens[0];
    expect(token.isArtifact).toBe(true);
  });
  it("a global token multiplier sees all token sources rather than a tribal-payoff subset", () => {
    const c = card("Doubling Season"), tokens = ["Marionette Master","Avenger of Zendikar","Ophiomancer"];
    const fn = deckCardFunction(c,new SupplyIndex(tokens.map(name=>({card:card(name),quantity:1,commander:false}))));
    expect(fn.conditions?.find(x=>x.key==='token')?.suppliers).toEqual(tokens);
  });
  it("a reusable ETB can expose recursion without duplicating it as independent owned recursion", () => {
    const supply = new SupplyIndex([{card:card("Archaeomancer"),quantity:5,commander:false}]);
    const fn = deckCardFunction(card("Teleportation Circle"),supply);
    expect(fn.roles.recursion).toBe(1);
    expect(fn.intrinsicRoles?.recursion).toBeUndefined();
    expect(fn.conditionNotes?.join(" ")).toContain("Archaeomancer");
    // A death trigger cannot be borrowed by a blink engine.
    const onlyDeath = synthetic("When this creature dies, draw three cards.");
    expect(deckCardFunction(card("Teleportation Circle"),new SupplyIndex([{card:onlyDeath,quantity:5,commander:false}])).roles.cardAdvantage).toBeUndefined();
  });
  it("a bounce clause cannot gate an independent board wipe on ETB supply", () => {
    const fn = deckCardFunction(card("Time Wipe"),new SupplyIndex([]));
    expect(fn.roles.wipes).toBe(1);
  });
  it("1-for-1 looting still emits draw but does not claim net card advantage", () => {
    const c = synthetic("Whenever you cast a creature spell, you may draw a card. If you do, discard a card.", "Artifact");
    expect(extractCardFacts(c).faces[0].drawsCards).toBe(true);
    expect(cardFunction(c).roles.cardAdvantage).toBeUndefined();
    expect(cardFunction(c).roles.controlledDiscard).toBe(1);
    expect(cardFunction(synthetic("Discard a card. Draw two cards.","Instant")).roles.cardAdvantage).toBe(1);
  });
  it("own-entry reuse excludes cast-from-hand prerequisites", async () => {
    const { selfEntryEffect } = await import("../../src/upgrades/abilityScope");
    expect(selfEntryEffect(synthetic("When this creature enters, if you cast it from your hand, draw two cards."))).toBeUndefined();
  });
});
it("linked exile-return is reanimation plus a sacrifice reset, not permanent graveyard exile", () => {
  const c = card("Living Death");
  expect(cardFunction(c).roles.recursion).toBe(1);
  expect(cardFunction(c).roles.wipes).toBe(1);
  expect(extractCardFacts(c).faces[0].answers.some(a=>a.targets.includes("graveyard"))).toBe(false);
  expect(cardFunction(synthetic("Exile all cards from target player's graveyard.", "Sorcery")).coverage).toContain("graveyard");
});
it("recursion role redundancy compares covered target domains instead of unrelated artifact returns", async () => {
  const { recursionOverlaps } = await import("../../src/synergy/capabilities");
  const { dnaFixture } = await import("../dnaFixtures");
  const { currentDeckModel } = await import("../../src/upgrades");
  const { matchingRoleCount } = await import("../../src/upgrades/upgrade");
  const f = dnaFixture(card("Roon of the Hidden Realm"),["Archaeomancer","Myr Retriever","Junk Diver","Workshop Assistant","Eternal Witness"].map(card));
  const fn = cardFunction(card("Archaeomancer"));
  expect(fn.recursionTargets).toEqual(["Instant","Sorcery"]);
  expect(recursionOverlaps(fn.recursionTargets,cardFunction(card("Myr Retriever")).recursionTargets)).toBe(false);
  expect(recursionOverlaps(fn.recursionTargets,cardFunction(card("Eternal Witness")).recursionTargets)).toBe(true);
  const model = currentDeckModel(f.state,f.deck);
  expect(model.totals.roles.recursion).toBeGreaterThanOrEqual(5);
  expect(matchingRoleCount(model,"recursion",fn)).toBe(2);
});
it("uses documented v0.6.16 budgets while retaining global limits", async () => {
  const { SCORE_WEIGHTS, RECOMMENDATION_LIMITS } = await import("../../src/synergy/recommendation");
  const { BREW_WEIGHTS, BREW_BANDS } = await import("../../src/upgrades/brew");
  expect(SCORE_WEIGHTS).toEqual({commander:0.15,theme:0.15,roleNeed:0.25,efficiency:0.15,curve:0.05,deckInteractions:0.05});
  expect(BREW_WEIGHTS).toEqual({contextualSynergy:20,interaction:20,bridge:10,novelty:5,deckSpecific:25,multiplicative:10,commander:5,role:5});
  expect(RECOMMENDATION_LIMITS).toEqual({profiles:4,cards:10000,excellent:80,excellentCap:79,materialSwapDelta:8});
  expect(BREW_BANDS.map(x=>x[0])).toEqual([85,70,50,0]);
});
it.each(["Scrap Trawler","Marionette Master"])("%s requires actual artifact sacrifice or sacrificial tokens, not arbitrary artifacts", name => {
  const c=card(name);
  expect(capabilities(c).artifactDeathPayoff).toBe(true);
  expect(capabilityRelationship(c,card("Wayfarer's Bauble")).length).toBeGreaterThan(0);
  expect(capabilityRelationship(c,card("Sol Ring"))).toEqual([]);
  expect(capabilityRelationship(c,synthetic("{T}: Sacrifice a creature: Add {C}.","Enchantment"))).toEqual([]);
});
it("Tortured Existence retains its Creature exchange and controlled-discard roles despite the remaining ranking miss", () => {
  const fn=cardFunction(card("Tortured Existence"));
  expect(fn.roles.recursion).toBe(1);
  expect(fn.roles.controlledDiscard).toBe(1);
  expect(fn.recursionTargets).toContain("Creature");
});
it("Ashnod's Altar retains actual sacrifice-to-mana roles despite the remaining ranking miss", () => {
  const fn=cardFunction(card("Ashnod's Altar"));
  expect(fn.roles.ramp).toBe(1);
  expect(fn.roles.sacrificeOutlets).toBe(1);
  expect(fn.facts.faces[0].addsMana.some(m=>m.amount===2&&m.timing==="activated")).toBe(true);
});
