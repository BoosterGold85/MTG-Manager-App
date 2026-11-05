import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { uugguuCards as cards, uugguuCard as card, uugguuFixture } from "../uugguuFixture";
import { oracleCard } from "../upgradeCandidates";
import { dnaFixture } from "../dnaFixtures";
import { cardCoverage } from "../../src/upgrades/coverage";
import { capabilities, capabilityRelationship } from "../../src/synergy/capabilities";
import { cardFunction, deckCardFunction } from "../../src/upgrades/cardFunction";
import { extractCardFacts } from "../../src/synergy/facts";
import { cardAbilities, hasCapability } from "../../src/synergy/semantics";
import { deathCopy, deathReturn, creatureTypeGrant, isCreatureType } from "../../src/synergy/typal";
import { SupplyIndex } from "../../src/upgrades/conditions";
import { buildDeckStrategyProfile } from "../../src/dna/strategy";
import { deckDnaInput } from "../../src/dna/engine";
import { canonicalInput } from "../../src/upgrades/inputs";
import { scoreRecommendation } from "../../src/synergy/recommendation";

const synthetic = (name: string, type: string, text: string) => oracleCard(name, "{2}{G}", 3, type, text, ["G"]);
const commander = card("Uugguu, the Omniplasm");
const renamed = (c: typeof commander) => ({ ...c, name: "Fixture Specimen", oracleId: `renamed:${c.name}`, oracleText: c.oracleText?.split(c.name).join("Fixture Specimen").split(c.name.split(",")[0]).join("Fixture Specimen"), cardFaces: c.cardFaces?.map(f => ({ ...f, name: "Fixture Face", oracleText: f.oracleText?.split(f.name).join("Fixture Face") })) });
const facts = (name: string) => extractCardFacts(card(name)).faces;
const evidence = (names: string[], candidate: typeof commander) => {
  const f = dnaFixture(commander, names.map(card));
  const profile = buildDeckStrategyProfile(deckDnaInput(f.state, f.deck));
  return scoreRecommendation(profile, canonicalInput(f.state, candidate)).recommendation!.commander;
};

describe("supplied Uugguu deck", () => {
  it("preserves the exact 100-card list and all 92 canonical identities", () => {
    const lines = readFileSync("tests/data/uugguu-deck.txt", "utf8").trim().split("\n");
    expect(lines.reduce((n, l) => n + Number(l.split(" ")[0]), 0)).toBe(100);
    expect(cards).toHaveLength(92);
    expect(commander.legalities?.commander).toBe("not_legal");
    expect(cards.filter(c => c !== commander).every(c => c.legalities?.commander === "legal")).toBe(true);
    expect(cards.every(c => c.colorIdentity.every(color => commander.colorIdentity.includes(color)))).toBe(true);
    expect(lines.every(l => !!card(l.slice(l.indexOf(" ") + 1)))).toBe(true);
    expect(uugguuFixture().deck.entries!.reduce((n, e) => n + e.quantity, 0)).toBe(100);
  });
  for (const c of cards) it(`${c.name}: understands the printed ability shapes under any name`, () => {
    for (const variant of [c, renamed(c)]) {
      expect(cardCoverage(variant).abilities.filter(a => a.status === "unsupported")).toEqual([]);
      expect(["full", "vanilla"]).toContain(cardCoverage(variant).state);
    }
  });
  it("models death-copy restrictions rather than an unrestricted token loop", () => {
    for (const c of [commander, renamed(commander)]) expect(deathCopy(c)).toMatchObject({ type: "Ooze", nontoken: true, another: true, count: 2, nonlegendary: true, fixedBody: "2/2" });
    const token = facts("Uugguu, the Omniplasm")[0].createsTokens[0];
    expect(token).toMatchObject({ isCopy: true, isCreature: true, count: 2, copySourceType: "Ooze" });
    expect(token.creatureTypes).toEqual([]); // External type grants are not copiable characteristics.
    expect(capabilityRelationship(commander, card("Chomping Changeling")).join(" ")).toContain("nontoken Ooze");
    expect(capabilityRelationship(commander, synthetic("Fixture Token", "Token Creature — Ooze", ""))).toEqual([]);
    expect(deathCopy(synthetic("Enemy Engine", "Creature — Ooze", commander.oracleText!.replace("you control", "an opponent controls")))).toBeNull();
  });
  it("matches sacrifice outlets and token multipliers with explicit evidence", () => {
    for (const n of ["Ashnod's Altar", "Phyrexian Altar", "Birthing Pod", "Prime Speaker Vannifar", "Cauldron of Essence", "Village Rites", "Deadly Dispute", "Victimize"])
      expect(capabilityRelationship(commander, card(n)).join(" ")).toContain("can sacrifice");
    for (const n of ["Doubling Season", "Parallel Lives", "Adrix and Nev, Twincasters"])
      expect(capabilityRelationship(commander, card(n)).join(" ")).toContain("doubles the death-copy tokens");
    expect(capabilityRelationship(commander, synthetic("Enemy Altar", "Enchantment", "Whenever an opponent sacrifices a creature, draw a card."))).toEqual([]);
    expect(capabilityRelationship(commander, card("Saw in Half")).join(" ")).toContain("the creature must actually die");
  });
  it("scopes type changes to their actual zones", () => {
    for (const n of ["Maskwood Nexus", "Arcane Adaptation", "March of the World Ooze"]) {
      expect(capabilityRelationship(commander, card(n)).join(" ")).toContain("enabling the printed nontoken Ooze");
      expect(capabilityRelationship(card(n), card("Distant Melody")).join(" ")).toContain("chosen-type draw");
    }
    for (const n of ["Maskwood Nexus", "Arcane Adaptation"])
      expect(capabilityRelationship(card(n), card("Bloodline Bidding")).join(" ")).toContain("outside the battlefield");
    expect(creatureTypeGrant(card("March of the World Ooze"))!.graveyard).toBe(false);
    expect(capabilityRelationship(card("March of the World Ooze"), card("Bloodline Bidding"))).toEqual([]);
    const enemy = synthetic("Enemy Type Changer", "Enchantment", "Creatures your opponents control are every creature type.");
    expect(creatureTypeGrant(enemy)).toBeNull();
    expect(capabilityRelationship(commander, enemy)).toEqual([]);
  });
  it("proves clone targets and type conversion against the actual deck", () => {
    expect(evidence(["Acidic Slime"], card("Clone")).evidence.join(" ")).toContain("nontoken copy of Acidic Slime");
    expect(evidence([], card("Clone")).evidence.join(" ")).not.toContain("nontoken copy of Acidic Slime");
    expect(evidence([], card("Clone")).evidence.join(" ")).toContain("keeping the original under the legend rule");
    expect(evidence(["Maskwood Nexus"], card("Birds of Paradise")).evidence.join(" ")).toContain("requires the type-changing permanent to remain active");
    expect(evidence([], card("Birds of Paradise")).score).toBe(0);
    expect(evidence([], synthetic("Only Tokens", "Sorcery", "Create two 2/2 green Ooze creature tokens.")).score).toBe(0);
    expect(evidence([], synthetic("Token Clone", "Token Creature — Ooze", "")).score).toBe(0);
  });
  it("keeps keyword and animation-based creature types distinct", () => {
    expect(isCreatureType(card("Mutable Explorer"), "Ooze")).toBe(true);
    expect(isCreatureType(card("Omni-Changeling"), "Ooze")).toBe(true);
    expect(isCreatureType(card("Mutavault"), "Ooze")).toBe(false);
    expect(capabilityRelationship(commander, card("Mutavault")).join(" ")).toContain("while animated");
    expect(capabilityRelationship(commander, card("Corrupted Zendikon")).join(" ")).toContain("while animated");
    expect(facts("Mutable Explorer")[0].createsTokens[0]).toMatchObject({ isLand: true, isCreature: false });
    expect(cardFunction(card("Mutable Explorer")).roles.ramp).toBeGreaterThan(0);
    expect(facts("Springleaf Parade")[0].createsTokens[0]).toMatchObject({ isCreature: true, hasChangeling: true });
    expect(cardFunction(card("Springleaf Parade")).impactReasons.join(" ")).toContain("summoning sickness");
    const entry = synthetic("Fixture Ooze Entry", "Legendary Creature — Ooze", "Whenever an Ooze creature you control enters, draw a card.");
    const f = dnaFixture(entry, []), profile = buildDeckStrategyProfile(deckDnaInput(f.state, f.deck));
    expect(scoreRecommendation(profile, canonicalInput(f.state, card("Springleaf Parade"))).recommendation!.commander.score).toBeGreaterThan(0);
  });
  it("recognizes death-return protection with actual death and zone requirements", () => {
    for (const n of ["Feign Death", "Undying Malice", "Not Dead After All", "Malakir Rebirth"]) {
      expect(deathReturn(card(n))).toBe(true);
      expect(cardFunction(card(n)).roles.protection).toBeGreaterThan(0);
      expect(capabilityRelationship(commander, card(n)).join(" ")).toContain("a token cannot return");
    }
    expect(deathReturn(synthetic("Exile Ward", "Instant", 'Target creature gains "When this creature is exiled, return it to the battlefield."'))).toBe(false);
    expect(cardFunction(card("Reanimate")).roles.recursion).toBeGreaterThan(0);
    expect(capabilities(card("Reanimate")).recursionTargets).toContain("Creature");
    expect(cardFunction(card("March of the World Ooze")).impactReasons.join(" ")).toContain("can shrink larger creatures");
    expect(cardAbilities(card("Naga Fleshcrafter")).some(a => a.capabilities.includes("RENEW_COPY"))).toBe(true);
  });
  it("requires a commander for conditional self-copy rather than an arbitrary permanent", () => {
    const blob = card("Biowaste Blob");
    const without = new SupplyIndex([{ card: card("Sol Ring"), quantity: 10, commander: false }]);
    const withCommander = new SupplyIndex([{ card: commander, quantity: 1, commander: true }]);
    expect(deckCardFunction(blob, without).conditions!.find(c => c.key === "control:commander")!.factor).toBe(0);
    expect(deckCardFunction(blob, withCommander).conditions!.find(c => c.key === "control:commander")!.factor).toBe(1);
    expect(hasCapability(card("Roaming Throne"), "TYPAL_TRIGGER_MULTIPLIER")).toBe(true);
    expect(capabilityRelationship(commander, card("Roaming Throne")).join(" ")).toContain("not a cast or activated ability");
  });
  it("analyzes the entire supplied deck offline without changing stored data", () => {
    const f = uugguuFixture(), before = JSON.stringify(f.state);
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Unexpected network access"); });
    try {
      const profile = buildDeckStrategyProfile(deckDnaInput(f.state, f.deck));
      const scores = cards.filter(c => c !== commander).map(c => scoreRecommendation(profile, canonicalInput(f.state, c)));
      expect(scores).toHaveLength(91);
      expect(scores.every(s => Number.isFinite(s.score))).toBe(true);
      expect(network).not.toHaveBeenCalled();
      expect(JSON.stringify(f.state)).toBe(before);
    } finally { network.mockRestore(); }
  });
});
