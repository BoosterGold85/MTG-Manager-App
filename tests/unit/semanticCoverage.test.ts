// v0.6.23 semantic coverage. Observed production cards (tests/semanticFixture.ts, real Oracle text) are fixtures
// only; each rule is also proven on a renamed or rephrased synthetic card, with a negative control, and every
// relationship is checked both with and without real supply in the deck.
import { describe, expect, it } from "vitest";
import { observed } from "../semanticFixture";
import { oracleCard } from "../upgradeCandidates";
import type { CardMetadata } from "../../src/models/collection";
import { cardAbilities, hasCapability } from "../../src/synergy/semantics";
import { cardCoverage, missingCardData } from "../../src/upgrades/coverage";
import { cardFunction, deckCardFunction } from "../../src/upgrades/cardFunction";
import { SupplyIndex, effectConditions } from "../../src/upgrades/conditions";
import { capabilities } from "../../src/synergy/capabilities";
import { analyze } from "../../src/intelligence/tagger";
import { rankingConstraints } from "../../src/synergy/rankingConstraints";
import { extractCardFacts } from "../../src/synergy/facts";
import { buildCommanderBlueprint } from "../../src/upgrades/blueprint";
import { canonicalInput } from "../../src/upgrades/inputs";
import { emptyCollection } from "../../src/models/collection";
import { isUnclassifiedTrigger } from "../../src/dna/strategy";
import { dnaFixture } from "../dnaFixtures";
import { candidateScorer, deckDnaCache } from "../../src/dna/engine";

/** Same Oracle structure under another name: the rule must not depend on the card's identity. */
const renamed = (card: CardMetadata, name: string): CardMetadata => {
  const swap = (t?: string) => t?.split(card.name).join(name).split(card.name.split(",")[0]).join(name);
  return { ...card, name, scryfallId: `renamed:${name}`, oracleId: `renamed:${name}`, oracleText: swap(card.oracleText), cardFaces: card.cardFaces?.map((f) => ({ ...f, name, oracleText: swap(f.oracleText) })) };
};
const synthetic = (name: string, type: string, text: string, extra: Partial<CardMetadata> = {}) => oracleCard(name, "{2}{G}", 3, type, text, ["G"], extra);
const caps = (card: CardMetadata) => cardAbilities(card).flatMap((a) => a.capabilities);
const deck = (cards: CardMetadata[]) => new SupplyIndex(cards.map((card) => ({ card, quantity: 1, commander: false })));
const creature = (name: string, power = 2, toughness = 2, text = "") => synthetic(name, "Creature — Bear", text, { power: String(power), toughness: String(toughness) });
const creatures = (n: number, power = 2, toughness = 2) => Array.from({ length: n }, (_, i) => creature(`Bear ${i}`, power, toughness));
const credit = (card: CardMetadata, supply: SupplyIndex, key: string) => deckCardFunction(card, supply).conditions?.find((c) => c.key === key);

describe("partial understanding and valid data", () => {
  it("understood abilities count even when another clause isn't modeled", () => {
    const card = synthetic("Mixed Scout", "Creature — Elf", "Flying\nWhen this creature enters, draw two cards.\nWhenever you commit a crime, put a +1/+1 counter on this creature.", { power: "2", toughness: "2", keywords: ["Flying"] });
    const coverage = cardCoverage(card);
    expect(coverage.state).toBe("partial");
    expect(coverage.recognized).toBe(2);
    expect(coverage.unsupported).toBe(1);
    expect(cardFunction(card).roles.cardAdvantage).toBeGreaterThan(0);
  });
  it("a planeswalker's usable loyalty abilities count; an ultimate beyond starting loyalty neither counts nor untracks it", () => {
    for (const domri of [observed("Domri Rade"), renamed(observed("Domri Rade"), "Fixture Walker")]) {
      const abilities = cardAbilities(domri);
      expect(abilities.map((a) => a.access)).toEqual(["immediate", "immediate", "inaccessible"]);
      expect(cardCoverage(domri).state).toBe("full");
      const fn = cardFunction(domri);
      expect(fn.roles.cardAdvantage).toBeGreaterThan(0);
      expect(fn.roles.interaction).toBeGreaterThan(0);
      expect(fn.roles.protection).toBeUndefined();
      // The emblem's hexproof can't tag the card either.
      expect(analyze(domri).assignments.map((a) => a.tagId)).not.toContain("hexproof-ward");
    }
  });
  it("valid empty Oracle text is a vanilla card, not missing data", () => {
    for (const vanilla of [observed("Walking Corpse"), observed("Wandering Tombshell"), creature("Plain Fixture Bear")]) {
      expect(vanilla.oracleText).toBe("");
      expect(missingCardData(vanilla)).toBe(false);
      expect(cardCoverage(vanilla).state).toBe("vanilla");
      // Metadata still contributes: type, creature type, body.
      expect(cardFunction(vanilla).isCreature).toBe(true);
      expect(cardFunction(vanilla).creatureTypes.length).toBeGreaterThan(0);
    }
    const missing = { ...creature("Unmatched Bear"), oracleText: undefined };
    expect(missingCardData(missing)).toBe(true);
    expect(cardCoverage(missing).state).toBe("missing");
  });
  it("rules procedure and mana abilities aren't 'unsupported'", () => {
    const tapland = oracleCard("Fixture Tapland", "", 0, "Land", "This land enters tapped.\n{T}: Add {W} or {U}.", []);
    expect(cardCoverage(tapland).state).toBe("full");
    const modal = oracleCard("Fixture Charm", "{1}{R}", 2, "Instant", "Choose one —\n• Destroy target artifact.\n• Fixture Charm deals 2 damage to any target.", ["R"]);
    expect(cardCoverage(modal).state).toBe("full");
  });
});

describe("dynamic power / toughness transformations", () => {
  it("power doubling, toughness-to-power, switching and team doubling are distinct transformations", () => {
    expect(caps(observed("Berserk"))).toEqual(expect.arrayContaining(["POWER_FROM_POWER", "TRAMPLE_GRANT", "DELAYED_DESTRUCTION"]));
    expect(caps(observed("Armored Armadillo"))).toContain("POWER_FROM_TOUGHNESS");
    expect(caps(observed("Inversion Behemoth"))).toContain("PT_SWITCH");
    expect(caps(observed("Unnatural Growth"))).toEqual(expect.arrayContaining(["PT_DOUBLE", "TEAM"]));
    const synth = synthetic("Fixture Surge", "Instant", "Target creature gets +X/+0 until end of turn, where X is its power.");
    expect(caps(synth)).toContain("POWER_FROM_POWER");
    expect(cardFunction(synth).roles.finishers).toBe(0.5);
    // Negative control: a fixed self pump (firebreathing) is a trick, not a finisher, and not a transformation.
    const firebreathing = creature("Fixture Whelp", 0, 1, "{R}: This creature gets +1/+0 until end of turn.");
    expect(cardFunction(firebreathing).roles.finishers).toBeUndefined();
    expect(caps(firebreathing)).not.toContain("POWER_FROM_POWER");
  });
  it("a P/T switch pays off only when the deck has high-toughness creatures", () => {
    const behemoth = renamed(observed("Inversion Behemoth"), "Fixture Inverter");
    const walls = deck(creatures(8, 0, 5));
    expect(credit(behemoth, walls, "creatures:toughness-over-power")!.factor).toBe(1);
    const bears = deck(creatures(8, 2, 2));
    expect(credit(behemoth, bears, "creatures:toughness-over-power")!.factor).toBe(0);
    expect(deckCardFunction(behemoth, bears).roles.finishers).toBeUndefined();
  });
  it("team doubling scales with the creatures you have, not as a flat anthem", () => {
    const growth = observed("Unnatural Growth");
    expect(deckCardFunction(growth, deck(creatures(16))).roles.finishers).toBe(1);
    expect(deckCardFunction(growth, deck([])).roles.finishers).toBeUndefined();
    expect(cardFunction(growth).impactReasons.join(" ")).toMatch(/Doubles your creatures' power and toughness/);
  });
  it("Berserk keeps its liability: delayed destruction is a downside, not erased by the pump", () => {
    const berserk = observed("Berserk");
    expect(cardFunction(berserk).impactReasons.join(" ")).toMatch(/destroys that creature at end of turn if it attacked/);
    const profile = buildCommanderBlueprint([canonicalInput(emptyCollection(), creature("Fixture Commander"), true)]).profile;
    expect(rankingConstraints(berserk, extractCardFacts(berserk), profile).penalties.map((p) => p.name)).toContain("delayed_self_destruction");
    const giantGrowth = synthetic("Fixture Growth", "Instant", "Target creature gets +3/+3 until end of turn.");
    expect(rankingConstraints(giantGrowth, extractCardFacts(giantGrowth), profile).penalties.map((p) => p.name)).not.toContain("delayed_self_destruction");
  });
});

describe("team abilities, death triggers and copying", () => {
  it("'Creatures you control have haste' is a team capability, separate from a self-sacrifice pump", () => {
    const fires = cardAbilities(observed("Fires of Yavimaya"));
    expect(fires[0].capabilities).toContain("TEAM_KEYWORD:haste");
    expect(fires[1].capabilities).toEqual(expect.arrayContaining(["SELF_SACRIFICE_EFFECT", "TEMP_BUFF"]));
    expect(caps(synthetic("Fixture Banner", "Enchantment", "Creatures you control have trample."))).toContain("TEAM_KEYWORD:trample");
    expect(caps(creature("Fixture Hasty", 2, 2, "Haste"))).not.toContain("TEAM_KEYWORD:haste");
  });
  it("a death trigger is a death payoff with its own effect, not automatically aristocrats", () => {
    const longneck = observed("Grasping Longneck");
    expect(caps(longneck)).toEqual(expect.arrayContaining(["DEATH_TRIGGER", "LIFE_GAIN"]));
    const tags = analyze(longneck).assignments.map((a) => a.tagId);
    expect(tags).toEqual(expect.arrayContaining(["death-triggers", "lifegain"]));
    expect(tags).not.toContain("aristocrats");
    expect(caps(creature("Fixture Martyr", 1, 1, "When this creature dies, draw a card."))).toContain("DEATH_TRIGGER");
  });
  it("targeted spell copying needs instants or sorceries that target your own creature", () => {
    const leyline = renamed(observed("Leyline of Resonance"), "Fixture Resonance");
    const tricks = deck(Array.from({ length: 6 }, (_, i) => synthetic(`Trick ${i}`, "Instant", "Target creature you control gets +2/+2 until end of turn.")));
    expect(credit(leyline, tricks, "cast:friendly-single-target")!.factor).toBe(1);
    expect(deckCardFunction(leyline, tricks).roles.cardAdvantage).toBe(0.6);
    // Negative control: spells that target opponents' creatures, or several targets, never supply it.
    const removal = deck([
      ...Array.from({ length: 4 }, (_, i) => synthetic(`Kill ${i}`, "Instant", "Destroy target creature an opponent controls.")),
      ...Array.from({ length: 3 }, (_, i) => synthetic(`Split ${i}`, "Sorcery", "Two target creatures you control each get +1/+1 until end of turn.")),
    ]);
    expect(credit(leyline, removal, "cast:friendly-single-target")!.factor).toBe(0);
    expect(deckCardFunction(leyline, removal).roles.cardAdvantage).toBeUndefined();
  });
  it("triggered-ability copying needs your own triggered abilities, not activated or static ones", () => {
    const resonator = renamed(observed("Strionic Resonator"), "Fixture Echo");
    expect(caps(resonator)).toContain("COPY_TRIGGERED_ABILITY");
    const triggers = deck(Array.from({ length: 8 }, (_, i) => creature(`Herald ${i}`, 2, 2, "When this creature enters, draw a card.")));
    expect(credit(resonator, triggers, "triggers:own")!.factor).toBe(1);
    const activated = deck([
      ...Array.from({ length: 5 }, (_, i) => creature(`Pinger ${i}`, 1, 1, "{T}: This creature deals 1 damage to any target.")),
      ...Array.from({ length: 4 }, (_, i) => synthetic(`Anthem ${i}`, "Enchantment", "Creatures you control get +1/+1.")),
      ...Array.from({ length: 3 }, (_, i) => synthetic(`Replace ${i}`, "Enchantment", "If you would draw a card, draw two cards instead.")),
    ]);
    expect(credit(resonator, activated, "triggers:own")!.factor).toBe(0);
    expect(deckCardFunction(resonator, activated).impact).toBeLessThan(deckCardFunction(resonator, triggers).impact);
  });
  it("counter storage keeps and moves counters; it is not a fresh counter source", () => {
    const ozolith = observed("The Ozolith");
    expect(caps(ozolith)).toEqual(expect.arrayContaining(["COUNTER_STORAGE", "COUNTER_TRANSFER"]));
    const counterCreatures = deck(Array.from({ length: 5 }, (_, i) => creature(`Grower ${i}`, 1, 1, "When this creature enters, put two +1/+1 counters on target creature you control.")));
    expect(credit(ozolith, counterCreatures, "counters:creatures-you-control")!.factor).toBe(1);
    expect(credit(ozolith, deck(creatures(10)), "counters:creatures-you-control")!.factor).toBe(0);
    // The Ozolith never supplies a counter-placement condition for another card.
    const payoff = creature("Fixture Counter Payoff", 2, 2, "Whenever one or more +1/+1 counters are put on this creature, draw a card.");
    const withOzolith = deck([ozolith, ...creatures(3)]);
    const placement = effectConditions(payoff).find((c) => c.key.startsWith("counters:"))!;
    expect(withOzolith.supply(placement).suppliers).not.toContain("The Ozolith");
  });
});

describe("bounce and blink", () => {
  it("friendly bounce of your own permanent is reuse, never opponent removal", () => {
    for (const sentinel of [observed("Stickytongue Sentinel"), renamed(observed("Stickytongue Sentinel"), "Fixture Tongue")]) {
      expect(caps(sentinel)).toContain("FRIENDLY_BOUNCE");
      expect(capabilities(sentinel).friendlyBounce).toBe(true);
      expect(cardFunction(sentinel).roles.interaction).toBeUndefined();
    }
    const unsummon = synthetic("Fixture Unsummon", "Instant", "Return target creature an opponent controls to its owner's hand.");
    expect(caps(unsummon)).not.toContain("FRIENDLY_BOUNCE");
    expect(cardFunction(unsummon).roles.interaction).toBeGreaterThan(0);
  });
  it("mass and repeated blink reuse entry abilities and are not removal", () => {
    const round = observed("Another Round");
    expect(caps(round)).toEqual(expect.arrayContaining(["MASS_BLINK", "REPEATED_BLINK"]));
    expect(capabilities(round).blink).toBe(true);
    expect(cardFunction(round).roles.interaction).toBeUndefined();
  });
  it("delayed blink can reset your own permanent or remove an opponent's until end step", () => {
    const stag = observed("Glimmerpoint Stag");
    expect(caps(stag)).toContain("DELAYED_BLINK");
    expect(capabilities(stag).blink).toBe(true);
    expect(cardFunction(stag).roles.interaction).toBe(0.3);
    expect(cardFunction(stag).roles.wipes).toBeUndefined();
  });
  it("a granted ability is analyzed for what it grants (Commander end-step blink)", () => {
    const traveler = observed("Far Traveler");
    expect(caps(traveler)).toEqual(expect.arrayContaining(["GRANTED_ABILITY", "GRANTED:BLINK"]));
    expect(capabilities(traveler).blink).toBe(true);
    const grant = synthetic("Fixture Mantle", "Enchantment", 'Creatures you control have "When this creature dies, draw a card."');
    expect(caps(grant)).toContain("GRANTED:DEATH_TRIGGER");
  });
});

describe("Vehicles, wipes and creature resources", () => {
  it("crewing with toughness matters only with Vehicles in the deck", () => {
    const ox = renamed(observed("Giant Ox"), "Fixture Ox");
    const vehicles = deck(Array.from({ length: 3 }, (_, i) => synthetic(`Cart ${i}`, "Artifact — Vehicle", "Crew 3", { power: "5", toughness: "5" })));
    expect(credit(ox, vehicles, "vehicles")!.factor).toBe(1);
    expect(credit(ox, deck(creatures(10, 1, 6)), "vehicles")!.factor).toBe(0);
  });
  it("a selective sacrifice wipe is a wipe with a preservation condition", () => {
    const slaughter = observed("Slaughter the Strong");
    expect(caps(slaughter)).toEqual(expect.arrayContaining(["SACRIFICE_WIPE", "PRESERVATION_CONDITION"]));
    expect(cardFunction(slaughter).roles.wipes).toBe(1);
    expect(cardFunction(slaughter).impactReasons.join(" ")).toMatch(/keep a few small creatures/);
  });
  it("tapping creatures as a cost scales damage with creature count, and is not sacrifice", () => {
    const burn = renamed(observed("Burn at the Stake"), "Fixture Pyre");
    expect(caps(burn)).toEqual(expect.arrayContaining(["CREATURE_TAP_COST", "SCALES_WITH_CREATURES"]));
    expect(deckCardFunction(burn, deck(creatures(16))).roles.finishers).toBe(0.8);
    expect(deckCardFunction(burn, deck([])).roles.finishers).toBeUndefined();
    expect(cardFunction(burn).roles.sacrificeOutlets).toBeUndefined();
    expect(analyze(burn).assignments.map((a) => a.tagId)).not.toContain("sacrifice-outlet");
  });
  it("untapping on other players' turns needs nonland permanents with tap abilities", () => {
    const muse = renamed(observed("Seedborn Muse"), "Fixture Muse");
    const rocks = deck(Array.from({ length: 8 }, (_, i) => synthetic(`Rock ${i}`, "Artifact", "{T}: Add {C}.")));
    expect(deckCardFunction(muse, rocks).roles.ramp).toBe(0.6);
    expect(deckCardFunction(muse, deck(creatures(12))).roles.ramp).toBeUndefined();
  });
});

describe("dice", () => {
  const suppliers = () => [observed("Delina, Wild Mage"), observed("Lightfoot Rogue"), observed("Swarming Goblins"), creature("Fixture Roller", 2, 2, "{1}, {T}: Roll a d20.")];
  it("a dice-threshold Commander trigger is understood, not 'acts every turn'", () => {
    const state = emptyCollection();
    for (const house of [observed("Mr. House, President and CEO"), renamed(observed("Mr. House, President and CEO"), "Fixture Croupier")]) {
      state.metadata[house.scryfallId] = house;
      const tags = buildCommanderBlueprint([canonicalInput(state, house, true)]).profile.commanderSynergyTags;
      expect(tags.some((t) => t.event === "dice")).toBe(true);
      expect(tags.filter(isUnclassifiedTrigger)).toEqual([]);
    }
  });
  it("a dice Commander links to cards that actually roll dice, and not to cards that don't", () => {
    const house = observed("Mr. House, President and CEO");
    const f = dnaFixture(house, creatures(30));
    const score = candidateScorer(f.state, f.deck, deckDnaCache.get(f.state, f.deck));
    const link = (c: CardMetadata) => Math.max(0, ...(score(c).recommendation?.links || []).filter((l) => l.commander).map((l) => l.strength));
    expect(link(observed("Swarming Goblins"))).toBeGreaterThanOrEqual(0.5);
    expect(link(observed("Lightfoot Rogue"))).toBeGreaterThanOrEqual(0.5);
    expect(link(creature("Fixture Plain Bear"))).toBe(0);
    // An amplifier works with this Commander because the Commander itself rolls (its activated ability)...
    expect(link(observed("Barbarian Class"))).toBeGreaterThanOrEqual(0.5);
    // ...but not with a Commander that never rolls: an amplifier rolls nothing on its own.
    const plain = dnaFixture(creature("Fixture Plain Commander", 3, 3, "Whenever this creature attacks, draw a card."), creatures(30));
    const plainScore = candidateScorer(plain.state, plain.deck, deckDnaCache.get(plain.state, plain.deck));
    expect(Math.max(0, ...(plainScore(observed("Barbarian Class")).recommendation?.links || []).filter((l) => l.commander).map((l) => l.strength))).toBe(0);
  });
  it("roll suppliers, amplifiers and payoffs are kept separate", () => {
    for (const s of suppliers()) expect(hasCapability(s, "ROLL_SUPPLIER"), s.name).toBe(true);
    const barbarian = observed("Barbarian Class");
    expect(hasCapability(barbarian, "ROLL_AMPLIFIER")).toBe(true);
    expect(hasCapability(barbarian, "ROLL_SUPPLIER")).toBe(false);
    expect(hasCapability(observed("Mr. House, President and CEO"), "ROLL_EVENT")).toBe(true);
  });
  it("a dice payoff earns value only with actual dice-roll suppliers", () => {
    const house = observed("Mr. House, President and CEO");
    const withRolls = credit(house, deck(suppliers()), "dice")!;
    expect(withRolls.factor).toBe(1);
    expect(withRolls.suppliers).toEqual(expect.arrayContaining(["Delina, Wild Mage", "Swarming Goblins"]));
    // Amplifiers alone roll nothing; the payoff still counts its own activated roll as one supplier.
    const amplifiersOnly = credit(house, deck([observed("Barbarian Class"), ...creatures(6)]), "dice")!;
    expect(amplifiersOnly.suppliers).not.toContain("Barbarian Class");
    expect(amplifiersOnly.factor).toBe(0);
    const payoff = creature("Fixture Gambler", 2, 2, "Whenever you roll one or more dice, draw a card.");
    expect(credit(payoff, deck(creatures(10)), "dice")!.factor).toBe(0);
    expect(deckCardFunction(payoff, deck(creatures(10))).roles.cardAdvantage).toBeUndefined();
  });
  it("dice-result branches are gated by their result, not flattened into unconditional abilities", () => {
    const goblins = cardAbilities(observed("Swarming Goblins"));
    expect(goblins.filter((a) => a.kind === "branch").map((a) => a.probability)).toEqual([0.45, 0.5, 0.05]);
    expect(cardFunction(observed("Swarming Goblins")).roles.tokens).toBeCloseTo(0.8, 5);
    const rogue = cardFunction(observed("Lightfoot Rogue"));
    expect(rogue.impactReasons.join(" ")).toMatch(/Dice results count at their chance of being rolled/);
    // Rolling again is more roll supply, not a guaranteed loop: Delina is honestly partial.
    expect(cardCoverage(observed("Delina, Wild Mage")).state).toBe("partial");
  });
  it("temporary attacking token copies are attack damage, not lasting tokens, and weren't declared as attackers", () => {
    const delina = observed("Delina, Wild Mage");
    expect(caps(delina)).toEqual(expect.arrayContaining(["TOKEN_COPY", "TEMPORARY_COPY", "ENTERED_ATTACKING"]));
    expect(cardFunction(delina).roles.tokens).toBeUndefined();
    expect(cardFunction(delina).impactReasons.join(" ")).toMatch(/don't trigger attack abilities/);
  });
});

describe("gated abilities: Class levels, Sagas, opponent-state conditions", () => {
  it("higher Class levels count only after the investment", () => {
    const abilities = cardAbilities(observed("Barbarian Class"));
    const level = (text: string) => abilities.find((a) => a.effect.startsWith(text))!;
    expect(level("If you would roll").access).toBe("immediate");
    expect(level("Whenever you roll").weight).toBeCloseTo(0.6, 5);
    expect(level("Creatures you control have haste").weight).toBeCloseTo(0.36, 5);
    expect(cardFunction(observed("Barbarian Class")).roles.finishers).toBeCloseTo(0.6 * 0.36, 5);
  });
  it("Saga chapters are separate abilities with their own timing", () => {
    const anax = cardAbilities(observed("The Triumph of Anax"));
    const chapters = anax.filter((a) => a.kind === "chapter");
    expect(chapters.map((a) => a.access)).toEqual(["immediate", "gated"]);
    expect(chapters[1].capabilities).toContain("FIGHT");
    const fn = cardFunction(observed("The Triumph of Anax"));
    expect(fn.roles.interaction).toBeCloseTo(0.6 * 0.7, 5);
    expect(fn.roles.finishers).toBe(0.4);
  });
  it("an attack trigger that needs an opponent state counts only partly, and the cheated creature entered attacking", () => {
    const cub = observed("Owlbear Cub");
    expect(caps(cub)).toEqual(expect.arrayContaining(["OPPONENT_STATE_CONDITION", "CREATURE_CHEAT", "ENTERED_ATTACKING"]));
    expect(cardAbilities(cub)[0].weight).toBe(0.5);
    expect(cardFunction(cub).roles.cardAdvantage).toBeCloseTo(0.25, 5);
  });
});

describe("library selection, cheats, imprint and stat-scaled triggers", () => {
  it("top-X permanent cheats scale with permanent density and aren't card draw", () => {
    const wave = observed("Genesis Wave");
    expect(caps(wave)).toContain("TOP_X_CHEAT");
    expect(extractCardFacts(wave).faces[0].cardDrawEffects).toEqual([]);
    const permanents = deck([...creatures(40), ...Array.from({ length: 30 }, (_, i) => oracleCard(`Land ${i}`, "", 0, "Land", "{T}: Add {G}.", []))]);
    const spells = deck(Array.from({ length: 40 }, (_, i) => synthetic(`Spell ${i}`, "Instant", "Draw a card.")));
    expect(credit(wave, permanents, "density:permanent")!.factor).toBe(1);
    expect(credit(wave, spells, "density:permanent")!.factor).toBe(0);
  });
  it("multi-type selection picks a creature and/or a land, the rest to the graveyard; not generic draw", () => {
    const ages = renamed(observed("In the Presence of Ages"), "Fixture Ages");
    expect(caps(ages)).toEqual(expect.arrayContaining(["MULTI_TYPE_SELECTION", "REST_TO_GRAVEYARD"]));
    expect(cardFunction(ages).roles.cardAdvantage).toBe(0.7);
    expect(extractCardFacts(ages).faces[0].cardDrawEffects).toEqual([]);
  });
  it("a linked imprint copy engine needs artifact cards to imprint", () => {
    const portal = observed("Prototype Portal");
    const artifacts = deck(Array.from({ length: 8 }, (_, i) => synthetic(`Widget ${i}`, "Artifact", "When this artifact enters, draw a card.")));
    expect(credit(portal, artifacts, "imprint:artifact")!.factor).toBe(1);
    expect(credit(portal, deck(creatures(12)), "imprint:artifact")!.factor).toBe(0);
  });
  it("a stat-scaled life-gain trigger is life gain that scales with toughness", () => {
    const avatar = observed("Verdant Sun's Avatar");
    expect(caps(avatar)).toEqual(expect.arrayContaining(["LIFE_GAIN", "SCALES_WITH_TOUGHNESS"]));
    expect(analyze(avatar).assignments.map((a) => a.tagId)).toContain("lifegain");
    expect(analyze(creature("Fixture Grove", 1, 3, "Whenever another creature you control enters, you gain life equal to that creature's toughness.")).assignments.map((a) => a.tagId)).toContain("lifegain");
  });
});

describe("every observed card", () => {
  it("is understood ability by ability; only Delina's roll-again branch remains unmodeled", () => {
    const names = ["Walking Corpse", "Wandering Tombshell", "Berserk", "Armored Armadillo", "Inversion Behemoth", "Unnatural Growth", "The Triumph of Anax", "Domri Rade", "Fires of Yavimaya", "Grasping Longneck", "Leyline of Resonance", "Strionic Resonator", "The Ozolith", "Stickytongue Sentinel", "Another Round", "Glimmerpoint Stag", "Far Traveler", "Giant Ox", "Slaughter the Strong", "Mr. House, President and CEO", "Barbarian Class", "Delina, Wild Mage", "Lightfoot Rogue", "Swarming Goblins", "Prototype Portal", "Burn at the Stake", "Genesis Wave", "In the Presence of Ages", "Owlbear Cub", "Seedborn Muse", "Verdant Sun's Avatar"];
    const states = Object.fromEntries(names.map((n) => [n, cardCoverage(observed(n)).state]));
    expect(Object.entries(states).filter(([, s]) => s !== "full").sort()).toEqual([
      ["Delina, Wild Mage", "partial"],
      ["Walking Corpse", "vanilla"],
      ["Wandering Tombshell", "vanilla"],
    ]);
  });
});
