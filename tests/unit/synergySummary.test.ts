import { expect, it } from "vitest";
import { candidateSummary } from "../../src/synergy/summary";
import { candidateScorer, deckDnaCache } from "../../src/dna/engine";
import { archetypeCases, dragonScoringFixture, namedScoringCard } from "../scoringFixtures";

for (const example of archetypeCases) {
  it(`${example.name}: summary uses existing evidence without changing scores or diagnostics`, () => {
    const fixture = example.fixture();
    const dna = deckDnaCache.get(fixture.state, fixture.deck);
    const score = candidateScorer(fixture.state, fixture.deck, dna)(example.support);
    const before = JSON.stringify(score);
    const summary = candidateSummary(score, dna.strategyProfile);
    expect(summary.length).toBeGreaterThan(20);
    expect(summary.split(/[.!?](?: |$)/).filter(Boolean).length).toBeLessThanOrEqual(2);
    expect(summary).not.toMatch(/\d+\/\d+|contextual target|deficit|\braw\b|clamped|contribution|penalty/i);
    if (summary.includes("directly reinforces")) expect(score.debug.commanderSynergy).toBeGreaterThanOrEqual(20);
    if (summary.includes("fills a needed")) expect(score.debug.roleNeed).toBeGreaterThan(0);
    if (summary.includes("already has plenty")) expect(score.debug.penalties.some((p) => p.name === "Redundant role")).toBe(true);
    expect(JSON.stringify(score)).toBe(before);
    expect(candidateScorer(fixture.state, fixture.deck, dna)(example.support)).toBe(score);
  });
}
it("translates actual role redundancy into plain language and preserves exact math", () => {
  const f = dragonScoringFixture(), dna = deckDnaCache.get(f.state, f.deck);
  const score = candidateScorer(f.state, f.deck, dna)(namedScoringCard("Harnesser of Storms"));
  expect(score.debug.penalties.find((p) => p.name === "Redundant role")?.reason).toMatch(/contextual target/);
  expect(candidateSummary(score, dna.strategyProfile)).toContain("already has plenty of cards serving its roles");
});
it("does not fabricate strategy support or a missing role for an off-plan card", () => {
  const f = dragonScoringFixture(), dna = deckDnaCache.get(f.state, f.deck);
  const score = candidateScorer(f.state, f.deck, dna)(namedScoringCard("Mongoose Lizard"));
  const summary = candidateSummary(score, dna.strategyProfile);
  expect(summary).toContain("Does not meaningfully support");
  expect(summary).toContain("does not fill an identified missing role");
  expect(summary).not.toContain("directly reinforces");
});
