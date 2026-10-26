import { it, expect } from "vitest";
import { analyze } from "../../src/intelligence/tagger";
import { analyzeDeckDna, deckDnaInput } from "../../src/dna/engine";
import { dnaFixture, jackal, clones } from "../dnaFixtures";
import { sol } from "../importFixtures";
import type { CardMetadata } from "../../src/models/collection";

const tags = (c: CardMetadata) => analyze(c).assignments.map((a) => a.tagId);
const byName = (name: string) => clones.find((c) => c.name === name)!;
const plain = (name: string, typeLine: string, oracleText: string): CardMetadata => ({ ...sol, scryfallId: name, oracleId: `t:${name}`, name, typeLine, oracleText, keywords: [] });

it("clone wording is recognized: enters as, becomes, and token copies of permanents", () => {
  for (const name of ["Body Double", "Clever Impersonator", "Mockingbird", "Gigantoplasm", "Mercurial Pretender", "Doppelgang", "Deepfathom Echo", "Haunting Imitation", "Vesuva"])
    expect(tags(byName(name)), name).toContain("clones");
  const evidence = analyze(byName("Body Double")).assignments.find((a) => a.tagId === "clones")!.evidence[0];
  expect(evidence.snippet).toContain("enter as a copy of any creature card");
});
it("copying a creature spell is a clone engine, not spellslinger support", () => {
  const jackalTags = tags(jackal);
  expect(jackalTags).toContain("copy-creature-spells");
  expect(jackalTags).not.toContain("copy-spells");
  expect(jackalTags).not.toContain("spellslinger");
  expect(tags(byName("Narset's Reversal"))).toContain("copy-spells");
  expect(tags(byName("Narset's Reversal"))).not.toContain("clones");
  expect(tags(plain("Sea Gate Stormcaller", "Creature — Human Wizard", "Kicker {4}{U}\nWhen Sea Gate Stormcaller enters, copy the next instant or sorcery spell with mana value 2 or less you cast this turn when you cast it."))).toContain("copy-spells");
});
it("reminder text and incidental 'copy' wording do not create a clone signal", () => {
  expect(tags(plain("Populate Card", "Sorcery", "Create a 1/1 green Saproling creature token. Populate. (Create a token that's a copy of a creature token you control.)"))).not.toContain("clones");
  expect(tags(plain("Counterspell Copy", "Instant", "Counter target spell. Copy that card's text into your notes."))).not.toContain("clones");
  expect(tags(byName("Unsummon"))).not.toContain("clones");
});
it("the Jackal clone deck's DNA leads with Clones & Copies and does not read as Spellslinger", () => {
  const fixture = dnaFixture(jackal, clones);
  const result = analyzeDeckDna(deckDnaInput(fixture.state, fixture.deck));
  expect(result.themes[0].id).toBe("clones");
  expect(result.themes[0].label).toBe("Clones & Copies");
  expect(result.themes[0].subthemes.map((s) => s.id)).toEqual(expect.arrayContaining(["clones", "copy-creature-spells"]));
  expect(result.themes.find((t) => t.id === "spells")?.percent || 0).toBeLessThan(result.themes[0].percent / 2);
  expect(result.summary).toMatch(/copy creatures and permanents/);
});
it("Synergy Explorer's strategy profile names Clones / Copies as a primary archetype", async () => {
  const { buildDeckStrategyProfile } = await import("../../src/dna/strategy");
  const fixture = dnaFixture(jackal, clones);
  const profile = buildDeckStrategyProfile(deckDnaInput(fixture.state, fixture.deck));
  expect(profile.primaryArchetypes.map((a) => a.label)).toContain("Clones / Copies");
  expect(profile.primaryArchetypes[0].label).not.toBe("Spellslinger");
});
