// Acceptance rule (v0.6.12): a recommendation cannot receive major credit for an effect unless the engine can point
// to actual cards in this deck that reliably satisfy the condition required to use that effect.
// Decks are the holdout / adversarial decks from the engine-agnosticism audit (real Scryfall data).
import { describe, expect, it } from "vitest";
import { holdoutCard, holdoutDecks, holdoutFixture, holdoutPool } from "../holdoutFixture";
import { synergyFixture } from "../synergyFixtures";
import { analysisConfidence, buildFor, commanderBlueprint, currentDeckModel, deckHealth, upgradeFor } from "../../src/upgrades";
import { cardFunction, deckCardFunction } from "../../src/upgrades/cardFunction";
import type { Need } from "../../src/upgrades/cardFunction";
import { effectConditions, withoutLines } from "../../src/upgrades/conditions";
import { candidateScorer, deckDnaCache } from "../../src/dna/engine";
import { analyze } from "../../src/intelligence/tagger";

const asCandidate = (c: ReturnType<typeof holdoutCard>) => ({ ...c, id: c.scryfallId, quantity: 1 });
const fixture = (id: string) => holdoutFixture(holdoutDecks.find((d) => d.id === id)!);
const needs = (c: (typeof holdoutPool)[number]) => effectConditions(c).map((x) => x.needs);

describe("acceptance: no credit for an effect without cards in this deck that satisfy it", () => {
  it("in every holdout deck, an ability with no suppliers adds nothing to any role or to impact", () => {
    let checked = 0;
    for (const d of holdoutDecks) {
      const f = holdoutFixture(d);
      const model = currentDeckModel(f.state, f.deck);
      const deckNames = new Set(model.cards.map((c) => c.name));
      for (const card of [...holdoutPool, ...model.cards.map((c) => f.state.metadata[Object.values(f.state.metadata).find((m) => m.name === c.name)!.scryfallId])]) {
        const fn = deckCardFunction(card, model.supply);
        if (!fn.conditions?.length) continue;
        const unsupplied = fn.conditions.filter((c) => c.understood && c.factor === 0).map((c) => c.line);
        const ceiling = cardFunction(withoutLines(card, unsupplied));
        for (const need of Object.keys(fn.roles) as Need[]) expect(fn.roles[need]!, `${card.name} ${need} in ${d.id}`).toBeLessThanOrEqual((ceiling.roles[need] || 0) + 1e-9);
        expect(fn.impact).toBeLessThanOrEqual(ceiling.impact + 1e-9);
        // Credit that is given always names real suppliers from this deck (or the card itself).
        for (const c of fn.conditions.filter((x) => x.understood && x.factor > 0)) {
          expect(c.supply).toBeGreaterThanOrEqual(2);
          for (const name of c.suppliers) expect(deckNames.has(name) || name === card.name, `${name} supplies ${card.name}`).toBe(true);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
  it("Sarkhan's Unsealing: no wipe or finisher credit in an enchantress deck; credited, with named suppliers, among big creatures", () => {
    const card = holdoutCard("Sarkhan's Unsealing");
    const enchantress = fixture("H5"), dragons = fixture("A1");
    const weak = deckCardFunction(card, currentDeckModel(enchantress.state, enchantress.deck).supply);
    expect(weak.roles.wipes).toBeUndefined();
    expect(weak.roles.finishers).toBeUndefined();
    expect(weak.conditionNotes!.join(" ")).toMatch(/power 7\+" ability has no cards to feed it here/);
    const strong = deckCardFunction(card, currentDeckModel(dragons.state, dragons.deck).supply);
    expect(strong.roles.interaction).toBe(1);
    expect(strong.conditions![0].suppliers).toEqual(expect.arrayContaining(["Glorybringer", "Thundermaw Hellkite"]));
    const u = upgradeFor(enchantress.state, enchantress.deck, asCandidate(card), "sarkhan");
    expect(["Major Upgrade", "Strong Upgrade"]).not.toContain(u.label);
    expect(u.concerns.join(" ")).toMatch(/power 7\+" ability has nothing in this deck to feed it/);
  });
  it("Ugin, Eye of the Storms: the colorless-spell trigger is credited only where colorless spells exist", () => {
    const ugin = holdoutCard("Ugin, Eye of the Storms");
    const artifacts = fixture("H3"), enchantress = fixture("H5");
    const inArtifacts = deckCardFunction(ugin, currentDeckModel(artifacts.state, artifacts.deck).supply).conditions![0];
    expect(inArtifacts.factor).toBe(1);
    expect(inArtifacts.suppliers.length).toBeGreaterThanOrEqual(8);
    const inEnchantress = deckCardFunction(ugin, currentDeckModel(enchantress.state, enchantress.deck).supply).conditions![0];
    expect(inEnchantress.factor).toBeLessThan(0.5);
  });
  it("no Upgrade or Build explanation credits a conditional ability without naming the cards that feed it", () => {
    for (const d of holdoutDecks) {
      const f = holdoutFixture(d);
      const supply = currentDeckModel(f.state, f.deck).supply;
      for (const card of holdoutPool) {
        const fn = deckCardFunction(card, supply);
        if (!fn.conditions?.length) continue;
        const u = upgradeFor(f.state, f.deck, asCandidate(card), card.scryfallId);
        const b = buildFor(f.state, f.deck, asCandidate(card));
        for (const c of fn.conditions.filter((x) => x.understood)) {
          const said = [...u.reasons, ...u.concerns].find((r) => r.includes(`"${c.needs}"`) || (c.needs === "creatures to crew it" && /crew/i.test(r)));
          const built = b.priorityReasons.find((r) => r.includes(`"${c.needs}"`) || (c.needs === "creatures to crew it" && /crew/i.test(r)));
          for (const text of [said, built]) {
            expect(text, `${card.name} in ${d.id}: ${c.needs}`).toBeDefined();
            if (c.factor > 0 && c.needs !== "creatures to crew it") expect(c.suppliers.some((n) => text!.includes(n)), `${card.name} in ${d.id}: ${text}`).toBe(true);
          }
        }
      }
    }
  });
  it("Synergy follows the same rule: no role for an unfed ability, and it says why", () => {
    const synergy = (id: string, name: string) => {
      const f = fixture(id);
      return candidateScorer(f.state, f.deck, deckDnaCache.get(f.state, f.deck))(holdoutCard(name));
    };
    const weak = synergy("H5", "Sarkhan's Unsealing");
    expect(weak.roles).not.toContain("Removal");
    expect(weak.conflicts.join(" ")).toMatch(/power 7\+" ability has nothing in this deck to feed it/);
    expect(synergy("A1", "Sarkhan's Unsealing").roles).toContain("Removal");
    expect(synergy("H5", "Ugin, Eye of the Storms").roles).not.toContain("Tutors");
  });
  it("explanations point at the deck's cards", () => {
    const f = fixture("A3");
    const u = upgradeFor(f.state, f.deck, asCandidate(holdoutCard("Evolution Witness")), "witness");
    expect(u.reasons.join(" ")).toMatch(/cards that put \+1\/\+1 counters" ability has \d+ cards here to feed it: .*(?:Hardened Scales|Branching Evolution|Experiment One)/);
  });
});

describe("condition parsing (real Oracle text)", () => {
  it("reads the condition each ability needs from the deck", () => {
    expect(needs(holdoutCard("Sarkhan's Unsealing"))).toEqual(["creature spells with power 4, 5, or 6", "creature spells with power 7+"]);
    expect(needs(holdoutCard("Ugin, Eye of the Storms"))).toEqual(["colorless spells"]);
    expect(needs(holdoutCard("Dragon Tempest"))).toEqual(["creature with flyings entering", "Dragons entering"]);
    expect(needs(holdoutCard("Evolution Witness"))).toEqual(["cards that put +1/+1 counters"]);
    expect(needs(holdoutCard("Hardened Scales"))).toEqual(["cards that put +1/+1 counters"]);
    expect(needs(holdoutCard("Ivy Lane Denizen"))).toEqual(["green creatures entering"]);
    expect(needs(holdoutCard("Crucible of Fire"))).toEqual(["Dragon creatures"]);
    expect(needs(holdoutCard("Zulaport Cutthroat"))).toEqual(["creatures that can die"]);
    expect(needs(holdoutCard("Marionette Master"))).toEqual(["artifacts that can die"]);
    expect(needs(holdoutCard("Guttersnipe"))).toEqual(["instant or sorcery spells"]);
  });
  it("self triggers, phase triggers and table-supplied triggers are not deck conditions", () => {
    for (const name of ["Kaalia of the Vast", "Blood Artist", "Skullclamp", "Smothering Tithe", "Rhystic Study", "Niv-Mizzet, Parun", "Ziatora, the Incinerator"])
      expect(effectConditions(holdoutCard(name)), name).toEqual([]);
  });
});

describe("engine-agnosticism audit fixes", () => {
  const commanderLink = (id: string, name: string) => {
    const f = fixture(id);
    const rec = candidateScorer(f.state, f.deck, deckDnaCache.get(f.state, f.deck))(holdoutCard(name)).recommendation!;
    return Math.max(0, ...rec.links.filter((l) => l.commander).map((l) => l.strength));
  };
  it("a Commander that only satisfies a candidate's trigger by being such a card is a weak link", () => {
    expect(commanderLink("H5", "Sarkhan's Unsealing")).toBeLessThanOrEqual(0.3);
    expect(commanderLink("A1", "Dragon Tempest")).toBeLessThanOrEqual(0.3);
  });
  it("'non-Human' is not Human support", () => {
    expect(commanderLink("H5", "Mikaeus, the Unhallowed")).toBeLessThan(0.5);
    expect(analyze(holdoutCard("Mikaeus, the Unhallowed")).assignments.map((a) => a.tagId)).not.toContain("typal:Human");
  });
  it("Vehicles are not go-wide cards (Crew reminder text)", () => {
    for (const name of ["Smuggler's Copter", "Renegade Freighter", "Skysovereign, Consul Flagship"]) expect(analyze(holdoutCard(name)).assignments.map((a) => a.tagId)).not.toContain("go-wide");
  });
  it("a Treasure-making Commander doesn't raise the creature-token target", () => {
    const f = fixture("A1");
    expect(commanderBlueprint(f.state, f.deck).needs.tokens.target).toBe(0);
  });
  it("a delayed 'your next end step' return is not an unknown Commander trigger", () => {
    const f = fixture("A2");
    expect(analysisConfidence(f.state, f.deck).notes.map((n) => n.kind)).not.toContain("commander-trigger");
  });
  it("targets follow the 99: curve-based ramp, plans the 99 doesn't pursue, and the Commander's own roles", () => {
    const niv = fixture("H4"), kenrith = fixture("H5");
    const nivModel = currentDeckModel(niv.state, niv.deck);
    expect(nivModel.targets.ramp).toBeLessThan(commanderBlueprint(niv.state, niv.deck).needs.ramp.target);
    expect(nivModel.targetReasons.ramp.join(" ")).toMatch(/average mana value/);
    const recursion = deckHealth(kenrith.state, kenrith.deck).find((h) => h.need === "recursion")!;
    expect(recursion.target).toBe(2);
    expect(recursion.reasons.join(" ")).toMatch(/doesn't pursue graveyard/);
    // Kenrith's own reanimation ability counts toward the deck's recursion.
    expect(recursion.count).toBeGreaterThanOrEqual(cardFunction(holdoutCard("Kenrith, the Returned King")).roles.recursion || 0);
  });
  it("a Vehicle's attacks need creatures in this deck to crew it", () => {
    const sky = holdoutCard("Skysovereign, Consul Flagship");
    const creatures = fixture("A1"), crew = deckCardFunction(sky, currentDeckModel(creatures.state, creatures.deck).supply);
    expect(crew.conditions!.find((c) => c.needs === "creatures to crew it")!.factor).toBe(1);
    const spells = fixture("H4"), uncrewed = deckCardFunction(sky, currentDeckModel(spells.state, spells.deck).supply);
    expect(uncrewed.conditions!.find((c) => c.needs === "creatures to crew it")!.factor).toBeLessThan(1);
    expect(uncrewed.engines.combatThreat).toBeLessThan(crew.engines.combatThreat);
  });
  it("ownership never changes deck-relative credit", () => {
    const f = fixture("A3"), owned = synergyFixture().owned;
    const card = holdoutCard("Evolution Witness");
    const before = upgradeFor(f.state, f.deck, asCandidate(card), "w").upgradeValue;
    const g = fixture("A3");
    g.state.metadata[card.scryfallId] = card;
    g.state.items.push(owned(card, card.scryfallId, 3));
    expect(upgradeFor(g.state, g.deck, asCandidate(card), "w").upgradeValue).toBe(before);
  });
});
