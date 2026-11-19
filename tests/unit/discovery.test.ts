import { describe, expect, it } from "vitest";
import { milesFixture } from "../milesFixture";
import { reignOfDragonsFixture } from "../recommendationFixtures";
import { discoveries } from "../../src/upgrades";
import { MAX_PER_RULE, SHARED_RULE_LIMIT, selectDiscoveries, statedConditionHolds } from "../../src/upgrades/discovery";
import type { BrewResult } from "../../src/upgrades/brew";
import type { OwnedCandidateGroup } from "../../src/synergy/explorer";
import type { CollectionState } from "../../src/models/collection";
import type { Deck } from "../../src/models/deck";

type Verified = BrewResult["verified"][number];
type Fixture = { state: CollectionState; deck: Deck };
const BASIC = /^(Plains|Island|Swamp|Mountain|Forest|Wastes)$/;

/** Owned, unassigned copies of the last `n` non-basic main-deck cards, so the deck is incomplete with owned additions. */
function withOwned(f: Fixture, n: number): Fixture {
  const moved = f.deck.entries!.filter((e) => e.board === "main" && !BASIC.test(e.name)).slice(-n);
  f.deck.entries = f.deck.entries!.filter((e) => !moved.includes(e));
  f.state.items = moved.map((e, i) => ({
    id: `own-${i}`,
    scryfallId: e.scryfallId,
    setCode: "tst",
    collectorNumber: "1",
    finish: "nonfoil",
    language: "EN",
    condition: "NM",
    binderName: "Main",
    binderType: "binder",
    quantityOwned: 1,
    quantityAssigned: 0,
    quantityUnassigned: 1,
    sourceRows: [],
  }));
  return f;
}
/** Fill the main deck to 100 cards with extra Plains, so the deck is complete. */
function complete(f: Fixture): Fixture {
  const main = f.deck.entries!.filter((e) => e.board === "main").reduce((n, e) => n + e.quantity, 0);
  const plains = f.deck.entries!.find((e) => e.name === "Plains");
  if (plains) plains.quantity += 100 - main;
  return f;
}

function brew(partial: Partial<BrewResult> = {}): BrewResult {
  return {
    score: 50,
    band: "Some Brew Potential",
    label: "Some Brew Potential",
    synergy: 50,
    components: [],
    penalties: [],
    headline: "",
    summary: "",
    why: [],
    negatives: [],
    confidence: "High",
    verified: [],
    needs: [],
    ...partial,
  };
}
function group(identity: string, name: string, available = 1, typeLine = "Creature", keywords: string[] = []): OwnedCandidateGroup {
  const card = { name, typeLine, keywords, manaCost: "{2}", colorIdentity: [], scryfallId: identity, id: identity, oracleText: "" } as unknown as OwnedCandidateGroup["card"];
  return { identity, card, canonical: card, printings: [card], owned: Math.max(1, available), available, usage: [] };
}
const link = (name: string, strength: number, evidence: string, commander = false): Verified => ({ name, commander, strength, evidence: [evidence] });

describe("Recommended from your collection: selection rules (synthetic, pure)", () => {
  it("drops a category effect that many candidates share, but keeps a distinct interaction", () => {
    const shared = ["Sol Ring", "Time Wipe", "Ugin"].map((n) =>
      ({ group: group(n, n), brew: brew({ verified: [link("Chrome Host", 1, `${n} → Chrome Host: Whenever you cast a noncreature spell, incubate X`)] }) }),
    );
    const distinct = { group: group("Copter", "Copter", 1, "Artifact — Vehicle", ["Flying"]), brew: brew({ verified: [link("Kitsune Ace", 0.9, "Copter → Kitsune Ace: Whenever a Vehicle you control attacks, choose one")] }) };
    const out = selectDiscoveries([...shared, distinct]).map((d) => d.identity);
    expect(out).toEqual(["Copter"]);
    expect(SHARED_RULE_LIMIT).toBe(3);
  });

  it("caps identical commander rules at MAX_PER_RULE so the list shows variety", () => {
    const items = ["A", "B", "C", "D"].map((n) => ({
      group: group(n, n, 1, "Creature — Dragon"),
      brew: brew({ score: 60 - n.charCodeAt(0), verified: [link("Lathliss", 0.9, `${n} → Lathliss: Whenever another Dragon you control enters, create a token`, true)] }),
    }));
    const out = selectDiscoveries(items);
    expect(out).toHaveLength(MAX_PER_RULE);
    expect(out.map((d) => d.identity)).toEqual(["A", "B"]);
  });

  it("requires a stated condition to hold for the card (a non-flying Vehicle does not fire a flying payoff)", () => {
    const flyer = group("Copter", "Copter", 1, "Artifact — Vehicle", ["Flying"]);
    const grounded = group("Schooner", "Schooner", 1, "Artifact — Vehicle", []);
    const copterLink = link("Miles", 0.9, "Smuggler's Copter → Miles: Whenever a Vehicle you control enters, draw a card if it has flying", true);
    const schoonerLink = link("Miles", 0.9, "Subterranean Schooner → Miles: Whenever a Vehicle you control enters, draw a card if it has flying", true);
    expect(statedConditionHolds(copterLink, { name: "Smuggler's Copter", typeLine: "Artifact — Vehicle", keywords: ["Flying"] } as never)).toBe(true);
    expect(statedConditionHolds(schoonerLink, { name: "Subterranean Schooner", typeLine: "Artifact — Vehicle", keywords: [] } as never)).toBe(false);
    const out = selectDiscoveries([
      { group: { ...flyer, card: { ...flyer.card, name: "Smuggler's Copter" } }, brew: brew({ verified: [copterLink] }) },
      { group: { ...grounded, card: { ...grounded.card, name: "Subterranean Schooner" } }, brew: brew({ verified: [schoonerLink] }) },
    ]).map((d) => d.identity);
    expect(out).toEqual(["Copter"]);
  });

  it("never counts crew as an interaction, and never recommends a card the engine flags as conflicting", () => {
    const out = selectDiscoveries([
      { group: group("OnlyCrew", "OnlyCrew"), brew: brew({ needs: [{ need: "creatures to crew it", line: "Crew 2", suppliers: ["Bear"], supplied: true, crewOnly: true }] }) },
      { group: group("Conflict", "Conflict"), brew: brew({ verified: [link("Lathliss", 1, "Conflict → Lathliss: text", true)], penalties: [{ name: "Anti-synergy", points: -3 }] }) },
    ]);
    expect(out).toEqual([]);
  });

  it("labels a bridge-only connection Speculative, and a Low-confidence analysis never Strongly supported", () => {
    const bridgeOnly = { group: group("Bridge", "Bridge"), brew: brew({ bridge: { from: "Dragons", to: "Tokens", strength: 0.6, existing: [] }, why: [{ title: "Bridge", text: "Dragons → Tokens." }] }) };
    const lowConfidence = { group: group("Low", "Low"), brew: brew({ confidence: "Low", verified: [link("Lathliss", 1, "Low → Lathliss: text", true)] }) };
    const [b, l] = selectDiscoveries([bridgeOnly, lowConfidence]);
    expect(b.strength).toBe("Speculative");
    expect(l.strength).toBe("Speculative");
  });

  it("ranks available unassigned copies first, then strength, without treating shared tags as support", () => {
    const strong = { group: group("Strong", "Strong", 0), brew: brew({ score: 90, verified: [link("Lathliss", 1, "Strong → Lathliss: a", true)] }) };
    const plausible = { group: group("Plausible", "Plausible", 2), brew: brew({ score: 30, verified: [link("Lathliss", 0.6, "Plausible → Lathliss: b", true)] }) };
    const out = selectDiscoveries([strong, plausible]).map((d) => d.identity);
    expect(out).toEqual(["Plausible", "Strong"]);
  });
});

describe("Recommended from your collection: Miles 'Tails' Prower (Vehicles and flying)", () => {
  it("surfaces flying Vehicles for the Vehicle-with-flying payoff, and not grounded Vehicles", () => {
    const f = withOwned(milesFixture(), 25);
    const names = discoveries(f.state, f.deck).map((d) => d.group.card.name);
    expect(names).toContain("Smuggler's Copter");
    expect(names).toContain("Skysovereign, Consul Flagship");
    // Negative controls: both are Vehicles without flying; the payoff's stated condition does not hold for them.
    expect(names).not.toContain("Subterranean Schooner");
    expect(names).not.toContain("Tangle Tumbler");
  });

  it("every recommendation is owned, not already in the deck, not the Commander, and inside Commander color identity", () => {
    const f = withOwned(milesFixture(), 25);
    const commander = f.deck.commanders[0];
    const inDeck = new Set(f.deck.entries!.map((e) => e.name));
    const result = discoveries(f.state, f.deck);
    const identities = result.map((d) => d.identity);
    expect(new Set(identities).size).toBe(identities.length);
    for (const d of result) {
      expect(inDeck.has(d.group.card.name)).toBe(false);
      expect(d.group.card.name).not.toBe(commander.name);
      expect(d.group.owned).toBeGreaterThan(0);
      expect(d.group.card.colorIdentity.every((c) => commander.colorIdentity.includes(c))).toBe(true);
    }
  });

  it("an incomplete deck gets add-only recommendations: no cut is proposed", () => {
    const f = withOwned(milesFixture(), 25);
    const result = discoveries(f.state, f.deck);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((d) => d.upgrade === undefined)).toBe(true);
  });

  it("a complete deck gets a potential one-for-one cut from its existing cards, and nothing is written", () => {
    const f = complete(withOwned(milesFixture(), 25));
    const stateBefore = JSON.stringify(f.state);
    const deckBefore = JSON.stringify(f.deck);
    const result = discoveries(f.state, f.deck);
    expect(result.length).toBeGreaterThan(0);
    const deckNames = new Set(f.deck.entries!.map((e) => e.name));
    for (const d of result) {
      expect(d.upgrade).toBeDefined();
      if (d.upgrade!.best) expect(deckNames.has(d.upgrade!.best.cutName)).toBe(true);
    }
    // Evaluating recommendations is read-only: the collection and the saved deck are byte-identical afterwards.
    expect(JSON.stringify(f.state)).toBe(stateBefore);
    expect(JSON.stringify(f.deck)).toBe(deckBefore);
  });

  it("prefers available copies in the first results", () => {
    const f = withOwned(milesFixture(), 25);
    const result = discoveries(f.state, f.deck);
    const firstUnavailable = result.findIndex((d) => d.group.available < 1);
    if (firstUnavailable >= 0) expect(result.slice(firstUnavailable).every((d) => d.group.available < 1)).toBe(true);
  });
});

describe("Recommended from your collection: Lathliss, Dragon Queen (Dragons)", () => {
  it("ranks a real Dragon engine above unrelated generic value, and repeats one Dragon trigger at most twice", () => {
    const f = withOwned(reignOfDragonsFixture(), 25);
    const result = discoveries(f.state, f.deck);
    const names = result.map((d) => d.group.card.name);
    const utvara = names.indexOf("Utvara Hellkite");
    const orb = names.indexOf("Orb of Dragonkind");
    expect(utvara).toBeGreaterThanOrEqual(0);
    if (orb >= 0) expect(utvara).toBeLessThan(orb);
    const sameRule = result.filter((d) => d.happens.includes("another nontoken Dragon you control enters"));
    expect(sameRule.length).toBeLessThanOrEqual(MAX_PER_RULE);
  });
});
