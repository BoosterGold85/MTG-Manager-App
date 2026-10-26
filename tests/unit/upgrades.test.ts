import { describe, expect, it } from "vitest";
import { reignOfDragonsFixture, reignCards } from "../recommendationFixtures";
import { candidates, oracleCard } from "../upgradeCandidates";
import { archetypeCases } from "../scoringFixtures";
import { candidateScorer, deckDnaCache, deckDnaInput } from "../../src/dna/engine";
import { buildCommanderBlueprint } from "../../src/upgrades/blueprint";
import { evaluateForBuild, compareBuild, fitLabel, priorityLabel } from "../../src/upgrades/build";
import { buildDeckModel, evaluateUpgrade, scopedEngineValue, simulateSwap, upgradeLabel, UPGRADE_BANDS } from "../../src/upgrades/upgrade";
import { canonicalInput } from "../../src/upgrades/inputs";
import { cardFunction } from "../../src/upgrades/cardFunction";
import type { Component } from "../../src/upgrades/upgrade";
import type { CardMetadata, CollectionState } from "../../src/models/collection";
import type { Deck } from "../../src/models/deck";

type Fixture = { state: CollectionState; deck: Deck };
const blueprintOf = (f: Fixture) => buildCommanderBlueprint(deckDnaInput(f.state, f.deck).cards.filter((c) => c.commander));
const build = (f: Fixture, card: CardMetadata) => evaluateForBuild(blueprintOf(f), canonicalInput(f.state, card));
function upgradeIn(f: Fixture, card: CardMetadata) {
  const dna = deckDnaCache.get(f.state, f.deck);
  const model = buildDeckModel(dna, blueprintOf(f));
  return evaluateUpgrade(model, card, canonicalInput(f.state, card).identity, candidateScorer(f.state, f.deck, dna)(card).recommendation);
}
/** Deck-state mutation: drop main-deck entries whose typed card function matches. */
function without(predicate: (card: CardMetadata) => boolean): Fixture {
  const f = reignOfDragonsFixture();
  f.deck.entries = f.deck.entries!.filter((e) => e.board === "commander" || !predicate(f.state.metadata[e.scryfallId]));
  return f;
}
/** Component gain from a fixed, role-free cut, so only the candidate's own context changes. */
function componentGain(f: Fixture, card: CardMetadata, component: Component, cutName = "Anger") {
  const dna = deckDnaCache.get(f.state, f.deck);
  const model = buildDeckModel(dna, blueprintOf(f));
  const cut = model.cards.find((c) => c.name === cutName)!;
  const swap = simulateSwap(model, card, candidateScorer(f.state, f.deck, dna)(card).recommendation, cut.identity);
  if ("invalid" in swap) throw new Error(swap.invalid);
  return swap.after[component] - model.vector[component];
}
const roles = (card: CardMetadata) => cardFunction(card).facts.typedRoles as string[];
const reign = (name: string) => reignCards.find((c) => c.name === name)!;

describe("Mode 1 — Build Around My Commander (Lathliss)", () => {
  const f = reignOfDragonsFixture();
  it("Dragon Hatchling fits strongly, but its Build Priority stays lower because it does little alone", () => {
    const e = build(f, candidates.dragonHatchling);
    expect(e.commanderFit).toBeGreaterThanOrEqual(68);
    expect(["Strong", "Excellent", "Exceptional"]).toContain(e.fitLabel);
    expect(e.fitReasons.join(" ")).toMatch(/nontoken Dragon/);
    expect(e.buildPriority).toBeLessThan(e.commanderFit);
    expect(["Consider", "Situational", "Low Priority"]).toContain(e.priorityLabel);
    expect(e.priorityConcerns.join(" ")).toMatch(/Low standalone impact/);
    expect(e.dependency).toBe("Heavy Commander dependency");
  });
  it("Hoarding Dragon fits strongly and its artifact search raises Build Priority above Hatchling's", () => {
    const hoarding = build(f, candidates.hoardingDragon), hatchling = build(f, candidates.dragonHatchling);
    expect(hoarding.commanderFit).toBeGreaterThanOrEqual(68);
    expect(hoarding.buildPriority).toBeGreaterThan(hatchling.buildPriority + 15);
    expect(hoarding.priorityReasons.join(" ")).toMatch(/Searches for a specific card type/);
  });
  it("Fiery Emancipation is recognized for damage-heavy Dragons, high impact but costly", () => {
    const e = build(f, candidates.fieryEmancipation);
    expect(e.commanderFit).toBeGreaterThanOrEqual(55);
    expect(e.fitReasons.join(" ")).toMatch(/Multiplies the damage/);
    expect(e.buildPriority).toBeGreaterThanOrEqual(60);
    expect(e.priorityConcerns.join(" ")).toMatch(/6 mana/);
  });
  it("staples rank high on Build Priority without pretending to fit the Commander", () => {
    const sol = build(f, reign("Sol Ring")), warp = build(f, reign("Chaos Warp"));
    expect(sol.priorityLabel).toBe("Core");
    expect(sol.commanderFit).toBeLessThan(40);
    expect(warp.buildPriority).toBeGreaterThan(build(f, candidates.dragonHatchling).buildPriority);
  });
  it("Death by Dragons and Xorn get no Lathliss or token-plan credit from the wrong token scope", () => {
    const death = build(f, candidates.deathByDragons), xorn = build(f, candidates.xorn);
    expect(death.trace.commanderScore).toBe(0);
    expect(death.commanderFit).toBeLessThan(35);
    expect(xorn.fitReasons.join(" ")).not.toMatch(/tokens plan|token/i);
    expect(xorn.commanderFit).toBeLessThan(35);
  });
  it("the blueprint is derived generically from Lathliss's mechanics and cost", () => {
    const bp = blueprintOf(f);
    expect(bp.mechanics.map((m) => m.id)).toEqual(expect.arrayContaining(["enters:Dragon:nontoken", "creates:Dragon"]));
    expect(bp.supportedTypes).toEqual(["Dragon"]);
    expect(bp.needs.ramp.target).toBe(12);
    expect(bp.needs.ramp.reasons.join(" ")).toMatch(/costs 6/);
    expect(bp.needs.tokens.target).toBeGreaterThan(0);
  });
  it("default ordering is Build Priority, then Commander Fit, confidence and name", () => {
    const list = Object.values(candidates).filter((c) => c.colorIdentity.every((x) => x === "R")).map((c) => build(f, c)).sort(compareBuild);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].buildPriority).toBeGreaterThanOrEqual(list[i].buildPriority);
    expect(list.map((e) => e.name).indexOf("Dragon Hatchling")).toBeGreaterThan(list.map((e) => e.name).indexOf("Hoarding Dragon"));
  });
});

describe("Mode 2 — Improve My Current Deck (Reign of Dragons)", () => {
  const f = reignOfDragonsFixture();
  const named = ["dragonHatchling", "hoardingDragon", "fieryEmancipation", "savageBeating", "combatCelebrant", "xorn", "vandalblast", "deathByDragons"] as const;
  const results = Object.fromEntries(named.map((k) => [k, upgradeIn(f, candidates[k])]));
  it("every upgrade names a real best cut and explains it with component deltas", () => {
    for (const k of named) {
      const r = results[k];
      expect(r.best, k).toBeDefined();
      expect(f.deck.entries!.some((e) => e.name === r.best!.cutName && e.board === "main")).toBe(true);
      expect(Object.keys(r.best!.deltas).length).toBeGreaterThan(0);
      expect(r.label).toBe(upgradeLabel(r.upgradeValue));
    }
  });
  it("Dragon Hatchling is not a top recommendation: Dragon density is already healthy", () => {
    const order = [...named].sort((a, b) => results[b].upgradeValue - results[a].upgradeValue);
    expect(order.indexOf("dragonHatchling")).toBeGreaterThanOrEqual(4);
    expect(results.dragonHatchling.concerns.join(" ")).toMatch(/already saturated|little beyond/);
  });
  it("Fiery Emancipation is valued through the deck's actual damage engines", () => {
    expect(results.fieryEmancipation.trace.scopedEngines.join(" ")).toBeDefined();
    expect((results.fieryEmancipation.best!.deltas.engines || 0)).toBeGreaterThan(0);
    expect(results.fieryEmancipation.upgradeValue).toBeGreaterThan(results.dragonHatchling.upgradeValue);
  });
  it("Hoarding Dragon ranks only because a real swap improves the deck, not because it is a Dragon", () => {
    expect(results.hoardingDragon.upgradeValue).toBeGreaterThan(results.dragonHatchling.upgradeValue);
    expect(results.hoardingDragon.best!.deltas.resilience || 0).toBeGreaterThan(0);
  });
  it("Death by Dragons gains nothing from Lathliss and is at best a sidegrade", () => {
    expect(results.deathByDragons.trace.commanderRelationships).toEqual([]);
    expect(results.deathByDragons.best!.deltas.commanderPlan || 0).toBeLessThanOrEqual(0);
    expect(["Sidegrade", "Downgrade"]).toContain(results.deathByDragons.label);
  });
  it("Vandalblast is valued for artifact coverage, not penalized for a high removal count", () => {
    expect(results.vandalblast.best!.deltas.interaction || 0).toBeGreaterThan(0);
    expect(results.vandalblast.label).not.toBe("Downgrade");
  });
  it("labels have exact calibrated boundaries", () => {
    expect(UPGRADE_BANDS.map(([n, l]) => [n, l])).toEqual([[2, "Major Upgrade"], [1, "Strong Upgrade"], [0.45, "Moderate Upgrade"], [0.15, "Minor Upgrade"], [-0.15, "Sidegrade"], [-Infinity, "Downgrade"]]);
    expect(upgradeLabel(0.45)).toBe("Moderate Upgrade");
    expect(upgradeLabel(0.1499)).toBe("Sidegrade");
    expect(fitLabel(68)).toBe("Strong");
    expect(priorityLabel(85)).toBe("Core");
  });
  it("cuts protect functions: the only artifact answer or the last protection piece is never removed for a candidate that does not replace it", () => {
    const model = buildDeckModel(deckDnaCache.get(f.state, f.deck), blueprintOf(f));
    const boots = model.cards.find((c) => c.name === "Swiftfoot Boots")!;
    const swap = simulateSwap(model, candidates.dragonHatchling, undefined, boots.identity);
    expect("invalid" in swap && swap.invalid).toMatch(/protection/);
    const mountain = model.cards.find((c) => c.name === "Mountain")!;
    expect("invalid" in simulateSwap(model, candidates.dragonHatchling, undefined, mountain.identity)).toBe(true);
  });
  it("a better protection spell may replace the only protection piece", () => {
    const model = buildDeckModel(deckDnaCache.get(f.state, f.deck), blueprintOf(f));
    const boots = model.cards.find((c) => c.name === "Swiftfoot Boots")!;
    const shield = { ...candidates.vandalblast, name: "Shielding Ward", scryfallId: "c:ward", oracleId: "c:ward", typeLine: "Instant", manaValue: 1, keywords: [], oracleText: "Target creature you control gains hexproof and indestructible until end of turn." };
    expect("invalid" in simulateSwap(model, shield, undefined, boots.identity)).toBe(false);
  });
});

describe("Mode 2 mutation tests: value follows deck context, not card names", () => {
  it("Xorn: Treasure-engine value falls to zero when Treasure sources are removed; Dragon tokens never count", () => {
    const xornScope = (fx: Fixture) => {
      const model = buildDeckModel(deckDnaCache.get(fx.state, fx.deck), blueprintOf(fx));
      const engines = { ...model.totals.engines, tokenMultipliers: { Treasure: 0.6 } };
      return scopedEngineValue(engines).find((p) => p.name.startsWith("Treasure"))!.value;
    };
    const base = reignOfDragonsFixture();
    expect(xornScope(base)).toBeGreaterThan(0);
    const noTreasure = without((c) => roles(c).includes("treasure_token"));
    expect(xornScope(noTreasure)).toBe(0);
    expect(upgradeIn(noTreasure, candidates.xorn).upgradeValue).toBeLessThan(upgradeIn(base, candidates.xorn).upgradeValue);
  });
  it("extra combat loses engine value when attack triggers are removed", () => {
    // One added extra combat, valued against the deck's own attack triggers and attackers.
    const combatScope = (fx: Fixture) => {
      const model = buildDeckModel(deckDnaCache.get(fx.state, fx.deck), blueprintOf(fx));
      return scopedEngineValue({ ...model.totals.engines, extraCombats: 1 }).find((p) => p.name.startsWith("extra combat"))!.value;
    };
    const noTriggers = without((c) => roles(c).includes("attack_trigger"));
    expect(combatScope(noTriggers)).toBeLessThan(combatScope(reignOfDragonsFixture()));
    for (const card of [candidates.savageBeating, candidates.combatCelebrant]) expect(cardFunction(card).engines.extraCombats).toBeGreaterThan(0);
    expect(upgradeIn(noTriggers, candidates.combatCelebrant).trace.scopedEngines.join(" ")).not.toBe(upgradeIn(reignOfDragonsFixture(), candidates.combatCelebrant).trace.scopedEngines.join(" "));
  });
  it("a damage multiplier loses engine value when damage engines are removed", () => {
    const noDamage = without((c) => roles(c).includes("damage_source"));
    expect(componentGain(noDamage, candidates.fieryEmancipation, "engines")).toBeLessThan(componentGain(reignOfDragonsFixture(), candidates.fieryEmancipation, "engines"));
  });
  it("fewer Dragons raise a useful Dragon's marginal value; more Dragons lower a low-impact Dragon's", () => {
    const fewer = without((c) => /\bDragon\b/.test(c.typeLine) && /Creature/.test(c.typeLine) && !/Legendary/.test(c.typeLine));
    expect(upgradeIn(fewer, candidates.hoardingDragon).best!.deltas.commanderPlan || 0).toBeGreaterThan(upgradeIn(reignOfDragonsFixture(), candidates.hoardingDragon).best!.deltas.commanderPlan || 0);
    const more = reignOfDragonsFixture();
    for (let i = 0; i < 12; i++) {
      const extra = { ...candidates.dragonHatchling, name: `Extra Dragon ${i}`, scryfallId: `extra-dragon-${i}`, oracleId: `extra-dragon-${i}` };
      more.state.metadata[extra.scryfallId] = extra;
      more.deck.entries!.push({ id: `extra-${i}`, board: "main", name: extra.name, quantity: 1, scryfallId: extra.scryfallId, cardIdentity: extra.oracleId });
    }
    expect(upgradeIn(more, candidates.dragonHatchling).best!.deltas.commanderPlan || 0).toBeLessThan(upgradeIn(reignOfDragonsFixture(), candidates.dragonHatchling).best!.deltas.commanderPlan || 0.0001);
  });
  it("Chaos Warp's coverage value rises when broad permanent answers are removed", () => {
    // Base: the deck also runs broad permanent answers. Mutation: remove them again.
    const strip = (fx: Fixture) => {
      fx.deck.entries = fx.deck.entries!.filter((e) => e.name !== "Chaos Warp");
      return fx;
    };
    const withBroad = strip(reignOfDragonsFixture());
    for (let i = 0; i < 3; i++) {
      const answer = oracleCard(`Broad Answer ${i}`, "{1}{R}", 2, "Instant", "Destroy target nonland permanent.");
      withBroad.state.metadata[answer.scryfallId] = answer;
      withBroad.deck.entries!.push({ id: `broad-${i}`, board: "main", name: answer.name, quantity: 1, scryfallId: answer.scryfallId, cardIdentity: answer.oracleId! });
    }
    const broadless = strip(reignOfDragonsFixture());
    const warp = reign("Chaos Warp");
    expect(componentGain(broadless, warp, "interaction")).toBeGreaterThan(componentGain(withBroad, warp, "interaction"));
  });
});

describe("cross-archetype: the same generic system across seven strategies", () => {
  const required = ["Dragon typal", "Spellslinger", "Aristocrats", "Landfall", "Voltron", "Artifact", "Tokens", "Graveyard / Reanimator"];
  for (const name of required) {
    const archetype = archetypeCases.find((a) => a.name === name)!;
    it(`${name}: on-plan support fits better than an off-plan card, and the blueprint adapts`, () => {
      const f = archetype.fixture();
      const support = build(f, archetype.support), weak = build(f, archetype.weak);
      expect(support.commanderFit, `${support.fitReasons.join(" | ")} vs ${weak.fitReasons.join(" | ")}`).toBeGreaterThan(weak.commanderFit);
      const bp = blueprintOf(f);
      if (name === "Spellslinger") expect(bp.needs.cardAdvantage.target).toBeGreaterThan(10);
      if (name === "Aristocrats") expect(bp.needs.sacrificeOutlets.target).toBeGreaterThan(0);
      if (name === "Landfall") expect(bp.needs.lands.target).toBeGreaterThan(36);
      if (name === "Graveyard / Reanimator") expect(bp.needs.recursion.target).toBeGreaterThan(2);
      if (name === "Tokens") expect(bp.needs.tokens.target).toBeGreaterThan(0);
      if (name === "Dragon typal") expect(bp.supportedTypes).toContain("Dragon");
      // Mode 2 on these small fixtures: the commander-plan component of the best swap favors on-plan support.
      const up = upgradeIn(f, archetype.support), down = upgradeIn(f, archetype.weak);
      expect(up.best?.deltas.commanderPlan ?? 0).toBeGreaterThanOrEqual(down.best?.deltas.commanderPlan ?? 0);
    });
  }
});

describe("large collections", () => {
  it("evaluates both goals for 1500 distinct owned candidates deterministically within budget", async () => {
    const { synergyFixture } = await import("../synergyFixtures");
    const { buildAroundCommander, improveCurrentDeck } = await import("../../src/upgrades");
    const f = reignOfDragonsFixture(), owned = synergyFixture().owned, pool = Object.values(candidates);
    for (let i = 0; i < 1500; i++) {
      const base = pool[i % pool.length];
      const card = { ...base, scryfallId: `large-${i}`, oracleId: `large-${i}`, name: `${base.name} ${String(i).padStart(4, "0")}` };
      f.state.metadata[card.scryfallId] = card;
      f.state.items.push(owned(card, card.scryfallId, 1));
    }
    const start = performance.now();
    const build = buildAroundCommander(f.state, f.deck), improve = improveCurrentDeck(f.state, f.deck);
    expect(performance.now() - start).toBeLessThan(15000);
    expect(build.length).toBe(improve.length);
    expect(build.length).toBeGreaterThan(1000);
    expect(improve.map((c) => c.identity)).toEqual(improveCurrentDeck(f.state, f.deck).map((c) => c.identity));
  }, 30000);
});
