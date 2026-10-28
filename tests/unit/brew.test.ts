// Brew Score v1 (v0.6.13). Calibration decks: tests/brewFixture.ts (real Scryfall data). Holdout decks are checked in
// tests/audit/holdout.audit.test.ts, never used to choose values.
import { describe, expect, it } from "vitest";
import { brewCard, tatyovaLandfallFixture, vorelCountersFixture } from "../brewFixture";
import { oracleCard } from "../upgradeCandidates";
import { synergyFixture } from "../synergyFixtures";
import { brewCandidates, brewFor, candidateGroups, currentDeckModel, synergyFor } from "../../src/upgrades";
import { brewBand, brewContext, brewLabel, compareBrew, evaluateBrew, BREW_WEIGHTS } from "../../src/upgrades/brew";
import type { BrewResult } from "../../src/upgrades/brew";
import { deckDnaCache } from "../../src/dna/engine";
import type { CardMetadata } from "../../src/models/collection";

type Fixture = ReturnType<typeof vorelCountersFixture>;
const asCandidate = (c: CardMetadata) => ({ ...c, id: c.scryfallId, quantity: 1 });
const brewOf = (f: Fixture, name: string) => brewFor(f.state, f.deck, asCandidate(brewCard(name)), brewCard(name).scryfallId);
const brewOfCard = (f: Fixture, card: CardMetadata) => brewFor(f.state, f.deck, asCandidate(card), card.scryfallId);
const component = (b: BrewResult, name: string) => b.components.find((c) => c.name === name)!.points;
const witnessText = (brewCard("Evolution Witness").oracleText || "").replace(/\(.*?\)/g, "");
const variant = (name: string, typeLine: string, text = witnessText) => oracleCard(name, "{2}{G}", 3, typeLine, text, ["G"], { power: "2", toughness: "1" });

describe("Brew Score is a separate, deck-relative lens", () => {
  it("never changes Synergy, and reports the unchanged Synergy score beside it", () => {
    const f = vorelCountersFixture();
    const before = synergyFor(f.state, f.deck, asCandidate(brewCard("Evolution Witness"))).score;
    const brew = brewOf(f, "Evolution Witness");
    expect(brew.synergy).toBe(before);
    expect(synergyFor(f.state, f.deck, asCandidate(brewCard("Evolution Witness"))).score).toBe(before);
  });
  it("the same card scores differently in different decks: Evolution Witness positive fixture and negative control", () => {
    const positive = brewOf(vorelCountersFixture(), "Evolution Witness");
    const negative = brewOf(tatyovaLandfallFixture(), "Evolution Witness");
    expect(positive.score).toBeGreaterThanOrEqual(75);
    expect(["Interesting Brew", "Hidden Gem"]).toContain(positive.band);
    expect(positive.bridge).toMatchObject({ from: "Counters", to: "Graveyard" });
    expect(positive.why.map((w) => w.title)).toEqual(expect.arrayContaining(["Bridge", "Copy support", "Commander"]));
    expect(negative.score).toBeLessThanOrEqual(positive.score - 30);
    expect(negative.bridge).toBeUndefined();
  });
  it("Evolution Witness ranks meaningfully above generic cards that merely share one tag", () => {
    const f = vorelCountersFixture();
    const witness = brewOf(f, "Evolution Witness").score;
    for (const name of ["Llanowar Elves", "Elvish Visionary", "Scavenging Ooze", "Gyre Sage"]) expect(witness - brewOf(f, name).score, name).toBeGreaterThanOrEqual(25);
    const ranked = candidateGroups(f.state, f.deck).sort((a, b) => compareBrew({ brew: brewCandidates(f.state, f.deck).get(a.identity)!, name: a.card.name }, { brew: brewCandidates(f.state, f.deck).get(b.identity)!, name: b.card.name }));
    expect(ranked[0].card.name).toBe("Evolution Witness");
  });
  it("generic staples are good cards but not brews; obscure unsupported cards stay low", () => {
    const f = vorelCountersFixture();
    for (const name of ["Arcane Signet", "Mind Stone"]) {
      const b = brewOf(f, name);
      expect(b.score, name).toBeLessThan(30);
      expect(component(b, "Bridge strength")).toBe(0);
      expect(component(b, "Novelty")).toBe(0);
    }
    expect(brewOf(f, "Psychic Battle").score).toBeLessThan(15);
    expect(brewOf(f, "Biomass Mutation").score).toBeLessThan(15);
  });
});

describe("components", () => {
  it("bridge cards get bridge credit; redundant bridges lower novelty and add a redundancy penalty", () => {
    const base = brewOf(vorelCountersFixture(), "Evolution Witness");
    expect(component(base, "Bridge strength")).toBe(BREW_WEIGHTS.bridge);
    const copies = ["Fixture Bridge A", "Fixture Bridge B", "Fixture Bridge C", "Fixture Bridge D", "Fixture Bridge E"].map((n) => variant(n, "Creature — Elf"));
    const crowded = brewOf(vorelCountersFixture({ extra: copies }), "Evolution Witness");
    expect(component(crowded, "Novelty")).toBeLessThan(component(base, "Novelty"));
    expect(crowded.penalties.some((p) => p.name === "Redundancy")).toBe(true);
    expect(crowded.bridge!.existing.length).toBeGreaterThan(base.bridge!.existing.length);
  });
  it("copy support adds value only when copies stay independently useful", () => {
    const withClones = vorelCountersFixture(), without = vorelCountersFixture({ clones: false });
    expect(component(brewOf(withClones, "Evolution Witness"), "Multiplicative potential")).toBeGreaterThan(0);
    expect(component(brewOf(without, "Evolution Witness"), "Multiplicative potential")).toBe(0);
    const normal = component(brewOfCard(withClones, variant("Plain Witness", "Creature — Elf")), "Multiplicative potential");
    const legendary = brewOfCard(withClones, variant("Legendary Witness", "Legendary Creature — Elf"));
    const once = brewOfCard(withClones, variant("Once Witness", "Creature — Elf", `${witnessText}\nThis ability triggers only once each turn.`));
    expect(component(legendary, "Multiplicative potential")).toBeLessThan(normal);
    expect(component(once, "Multiplicative potential")).toBeLessThan(normal);
    expect(once.negatives.join(" ")).toMatch(/only once each turn/);
  });
  it("speculative, unverifiable conditions are penalized", () => {
    const f = vorelCountersFixture();
    const dice = brewOfCard(f, variant("Dice Witness", "Creature — Elf", "Whenever you roll one or more dice, return target permanent card from your graveyard to your hand."));
    expect(dice.penalties.some((p) => p.name === "Speculation")).toBe(true);
    expect(dice.score).toBeLessThan(brewOf(f, "Evolution Witness").score);
  });
  it("working against the deck's own package is anti-synergy (graveyard hate in a graveyard deck)", () => {
    const ooze = brewOf(vorelCountersFixture(), "Scavenging Ooze");
    expect(ooze.penalties).toEqual(expect.arrayContaining([{ name: "Anti-synergy", points: -10 }]));
  });
  it("Why this brew? only states evidence from this deck", () => {
    const f = vorelCountersFixture();
    const names = new Set(currentDeckModel(f.state, f.deck).cards.map((c) => c.name));
    const b = brewOf(f, "Evolution Witness");
    for (const line of b.why) {
      const mentioned = [...names].filter((n) => line.text.includes(n));
      if (line.title !== "Novelty" && line.title !== "Role") expect(mentioned.length, line.text).toBeGreaterThan(0);
    }
    expect(Math.round(b.components.reduce((n, c) => n + c.points, 0) + b.penalties.reduce((n, p) => n + p.points, 0))).toBe(b.score);
  });
});

describe("bands, confidence, ownership and caching", () => {
  it("bands describe originality, and Low-confidence analysis never says Hidden Gem", () => {
    expect([brewBand(92), brewBand(70), brewBand(50), brewBand(49)]).toEqual(["Hidden Gem", "Interesting Brew", "Some Brew Potential", "Conventional / Weak Brew Fit"]);
    expect(brewLabel(92, "High")).toBe("Hidden Gem");
    expect(brewLabel(92, "Medium")).toBe("Hidden Gem");
    expect(brewLabel(92, "Low")).toBe("Potential Brew");
    const f = vorelCountersFixture();
    const low = evaluateBrew(brewContext(deckDnaCache.get(f.state, f.deck), currentDeckModel(f.state, f.deck), "Low"), brewCard("Evolution Witness"), synergyFor(f.state, f.deck, asCandidate(brewCard("Evolution Witness"))));
    expect(low.confidence).toBe("Low");
    expect(low.label).not.toBe("Hidden Gem");
  });
  it("ownership and availability never change the score", () => {
    const a = vorelCountersFixture(), b = vorelCountersFixture();
    const witness = brewCard("Evolution Witness");
    b.state.items.push(synergyFixture().owned(witness, "extra-witness", 4, 4));
    expect(brewOf(b, "Evolution Witness").score).toBe(brewOf(a, "Evolution Witness").score);
  });
  it("the batch is computed once per deck revision and is deterministic", () => {
    const f = vorelCountersFixture();
    const first = brewCandidates(f.state, f.deck);
    expect(brewCandidates(f.state, f.deck)).toBe(first);
    const again = brewCandidates(vorelCountersFixture().state, vorelCountersFixture().deck);
    expect([...again].map(([, b]) => b.score)).toEqual([...first].map(([, b]) => b.score));
  });
  it("evaluates a large owned collection within budget", () => {
    const f = vorelCountersFixture(), owned = synergyFixture().owned;
    const pool = ["Gyre Sage", "Llanowar Elves", "Elvish Visionary", "Scavenging Ooze", "Mind Stone", "Arcane Signet"].map(brewCard);
    for (let i = 0; i < 600; i++) {
      const base = pool[i % pool.length];
      const card = { ...base, scryfallId: `bulk-${i}`, oracleId: `bulk-${i}`, name: `${base.name} ${String(i).padStart(4, "0")}` };
      f.state.metadata[card.scryfallId] = card;
      f.state.items.push(owned(card, card.scryfallId, 1));
    }
    const start = performance.now();
    expect(brewCandidates(f.state, f.deck).size).toBeGreaterThan(600);
    expect(performance.now() - start).toBeLessThan(15000);
  }, 30000);
});
