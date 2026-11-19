import { describe, expect, it } from "vitest";
import { milesCards, milesFixture } from "../milesFixture";
import { candidateScorer, deckDnaCache } from "../../src/dna/engine";
import type { CardMetadata } from "../../src/models/collection";
import {
  branchNote,
  grantedKeywords,
  hasKeyword,
  parseStatedCondition,
  statedConditionSatisfied,
  subjectOf,
} from "../../src/synergy/stateConditions";

// Stated conditions in trigger text, for the card that is the source of a relationship. Generic rules: the names
// below are only for readability; the logic reads keywords, types and rule text. Synthetic names prove that.
const card = (name: string, typeLine: string, oracleText = "", keywords: string[] = []) =>
  ({ name, typeLine, oracleText, keywords, manaCost: "{1}" }) as unknown as CardMetadata;
const milesPayoff = "Whenever a Vehicle you control enters, draw a card if it has flying. Otherwise, put a flying counter on it.";
const byName = (name: string) => milesCards.find((c) => c.name === name)!;

describe("parsing stated conditions", () => {
  it("reads the object type, the keyword test and the Otherwise branch from rule text", () => {
    expect(parseStatedCondition(milesPayoff)).toEqual({
      type: "Vehicle",
      keyword: "flying",
      otherwise: "put a flying counter on it",
    });
  });
  it("reads an object type with no keyword test, and works for any named type", () => {
    expect(parseStatedCondition("Whenever a Glider you control attacks, scry 1")).toEqual({ type: "Glider" });
    expect(parseStatedCondition("Whenever another nontoken Dragon you control enters, deal 1 damage")).toEqual({ type: "Dragon" });
  });
  it("ignores dies triggers for the type gate: the object is what another effect destroys", () => {
    expect(parseStatedCondition("Whenever another Zombie you control dies, draw a card.")).toBeUndefined();
  });
});

describe("keywords: printed, missing, and granted by other cards", () => {
  it("printed flying holds with no granting card", () => {
    expect(hasKeyword(byName("Smuggler's Copter"), "flying", [])).toEqual({ holds: true });
  });
  it("a Vehicle without flying does not hold flying", () => {
    expect(hasKeyword(byName("Subterranean Schooner"), "flying", [])).toEqual({ holds: false });
  });
  it("flying granted by another deck card to Vehicles holds, and names the granting card", () => {
    const grants = grantedKeywords(milesCards);
    expect(grants.map((g) => g.source)).toContain("Aeronaut Admiral");
    expect(hasKeyword(byName("Subterranean Schooner"), "flying", grants)).toEqual({ holds: true, via: "Aeronaut Admiral" });
  });
  it("a grant reaches only the types it names: creature flying does not fly a non-creature Vehicle", () => {
    const grants = grantedKeywords([card("Synthetic Lord", "Creature — Lord", "Creatures you control have flying.")]);
    expect(grants).toEqual([{ keyword: "flying", type: "creature", source: "Synthetic Lord" }]);
    expect(hasKeyword(byName("Subterranean Schooner"), "flying", grants)).toEqual({ holds: false });
    expect(hasKeyword(card("Plain Bear", "Creature — Bear"), "flying", grants)).toEqual({ holds: true, via: "Synthetic Lord" });
  });
  it("a created token takes its keywords from its own creation text and from grants that reach it", () => {
    const grants = grantedKeywords(milesCards);
    const token = subjectOf(byName("Mu Yanling, Wind Rider"), "Vehicle");
    expect(token?.viaToken).toBe(true);
    expect(token?.card.typeLine).toContain("Vehicle");
    // Mu Yanling grants flying to Vehicles; the token is one, so it has flying through that grant.
    expect(hasKeyword(token!.card, "flying", grants).holds).toBe(true);
    expect(hasKeyword(token!.card, "flying", []).holds).toBe(false);
  });
});

describe("validator: a stated condition must hold, or an Otherwise branch must exist", () => {
  const glide = parseStatedCondition("Whenever a Glider you control enters, draw a card if it has flying.");
  it("a keyword test with no alternative fires only for a source that has the keyword", () => {
    expect(statedConditionSatisfied(glide, card("Test Glider", "Artifact — Glider", "", ["Flying"]), [])).toBe(true);
    expect(statedConditionSatisfied(glide, card("Test Glider", "Artifact — Glider", "", []), [])).toBe(false);
  });
  it("with an Otherwise branch, both branches are real effects, so the source is kept", () => {
    expect(statedConditionSatisfied(parseStatedCondition(milesPayoff), byName("Subterranean Schooner"), [])).toBe(true);
  });
  it("a named type must match: a non-Vehicle artifact is not a Vehicle", () => {
    expect(statedConditionSatisfied(parseStatedCondition(milesPayoff), byName("Arcane Signet"), [])).toBe(false);
  });
  it("a Changeling creature is every creature type, but not a non-creature subtype", () => {
    const dragon = parseStatedCondition("Whenever a Dragon you control enters, deal 1 damage to any target.");
    const changeling = card("Test Changeling", "Creature — Shapeshifter", "Changeling", ["Changeling"]);
    expect(statedConditionSatisfied(dragon, changeling, [])).toBe(true);
    expect(statedConditionSatisfied(parseStatedCondition("Whenever a Vehicle you control enters, scry 1."), changeling, [])).toBe(false);
  });
});

describe("branch note: says which branch applies to the source", () => {
  const cond = parseStatedCondition(milesPayoff);
  it("printed flying: the first branch applies", () => {
    expect(branchNote(cond, byName("Smuggler's Copter"), [])).toBe(" For Smuggler's Copter: it has flying, so the first branch applies.");
  });
  it("missing flying: the Otherwise branch applies, and says what it does", () => {
    expect(branchNote(cond, byName("Subterranean Schooner"), [])).toContain("it lacks flying, so the Otherwise branch applies: put a flying counter on it.");
  });
  it("granted flying names the granting card", () => {
    // Both Aeronaut Admiral and Mu Yanling grant flying to Vehicles; the note names whichever grant the deck order reaches first.
    expect(branchNote(cond, byName("Subterranean Schooner"), grantedKeywords(milesCards))).toMatch(/\(granted by (Aeronaut Admiral|Mu Yanling, Wind Rider)\)/);
  });
});

describe("scoring through the shared validator (Miles fixture)", () => {
  const scoreOf = (f: ReturnType<typeof milesFixture>, name: string) => {
    const score = candidateScorer(f.state, f.deck, deckDnaCache.get(f.state, f.deck));
    return score(byName(name)).recommendation?.links.find((l) => l.name === 'Miles "Tails" Prower' && l.commander);
  };
  it("the flying Vehicle keeps the draw branch and names it", () => {
    const link = scoreOf(milesFixture(), "Smuggler's Copter");
    expect(link?.evidence?.[0]).toContain("it has flying, so the first branch applies");
  });
  it("the non-flying Vehicle keeps its link through the Otherwise branch when no grant applies; strength is unchanged", () => {
    const f = milesFixture();
    f.deck.entries = f.deck.entries!.filter((e) => e.name !== "Aeronaut Admiral" && e.name !== "Mu Yanling, Wind Rider");
    const link = scoreOf(f, "Subterranean Schooner");
    // No grant: the Schooner has no flying, so the rule's Otherwise branch applies. The link stands because the rule has one.
    expect(link?.strength).toBe(0.9);
    expect(link?.evidence?.[0]).toContain("Otherwise branch applies");
  });
  it("Aeronaut Admiral's grant changes which branch applies to a non-flying Vehicle", () => {
    const f = milesFixture();
    expect(f.deck.entries!.some((e) => e.name === "Aeronaut Admiral")).toBe(true);
    const withGrant = scoreOf(f, "Subterranean Schooner");
    expect(withGrant?.evidence?.[0]).toMatch(/it has flying \(granted by (Aeronaut Admiral|Mu Yanling, Wind Rider)\)/);
    const without = milesFixture();
    without.deck.entries = without.deck.entries!.filter((e) => e.name !== "Aeronaut Admiral" && e.name !== 'Mu Yanling, Wind Rider');
    const withoutGrant = scoreOf(without, "Subterranean Schooner");
    expect(withoutGrant?.evidence?.[0]).toContain("Otherwise branch applies");
  });
});
