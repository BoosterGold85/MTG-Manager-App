import { it, expect } from "vitest";
import { analyze } from "../../src/intelligence/tagger";
import { discardOf, extractCardFacts } from "../../src/synergy/facts";
import { analyzeDeckDna, deckDnaInput, candidateScorer, deckDnaCache } from "../../src/dna/engine";
import { dnaFixture, plainCommander, mayhemCards, discardEnablers, opponentDiscard, card } from "../dnaFixtures";

const dna = (main: Parameters<typeof dnaFixture>[1], commander = plainCommander) => {
  const f = dnaFixture(commander, main);
  return { f, result: analyzeDeckDna(deckDnaInput(f.state, f.deck)) };
};
const tags = (c: Parameters<typeof analyze>[0]) => analyze(c).assignments.map((a) => a.tagId);

it("Mayhem is a typed conditional cast from the graveyard after a discard, not reusable recursion", () => {
  const facts = extractCardFacts(mayhemCards[0]);
  expect(facts.typedRoles).toContain("mayhem_card");
  expect(facts.faces[0].castFromDiscard[0]).toMatchObject({ mechanic: "mayhem", cost: "{1}{R}", condition: "discarded-this-turn" });
  expect(tags(mayhemCards[0])).toContain("mayhem");
  expect(tags(mayhemCards[0])).not.toContain("recursion");
  expect(tags(mayhemCards[0])).not.toContain("reanimator");
});
it("discard is typed by who discards: controlled, looting, rummaging, symmetric, opponent", () => {
  expect(discardOf("x", "Draw two cards, then discard two cards.")).toMatchObject({ who: "you", mode: "loot" });
  expect(discardOf("x", "Discard a card, then draw a card.")).toMatchObject({ who: "you", mode: "rummage" });
  expect(discardOf("x", "As an additional cost to cast this spell, discard a card.")).toMatchObject({ who: "you", mode: "cost" });
  expect(discardOf("x", "{1}, Discard a card: Draw a card.")).toMatchObject({ who: "you", mode: "cost" });
  expect(discardOf("x", "Each player discards their hand, then draws seven cards.")).toMatchObject({ who: "each_player", mode: "hand" });
  expect(discardOf("x", "When this creature enters, each opponent discards a card.")).toMatchObject({ who: "opponent" });
  expect(discardOf("x", "Target player discards two cards.")).toMatchObject({ who: "target_player" });
  expect(discardOf("x", "Whenever you discard a card, draw a card.")).toBeNull();
  for (const c of discardEnablers) expect(extractCardFacts(c).typedRoles, c.name).toContain("controlled_discard");
  for (const c of opponentDiscard) expect(extractCardFacts(c).typedRoles, c.name).not.toContain("controlled_discard");
  expect(extractCardFacts(opponentDiscard[2]).typedRoles).toContain("opponent_discard");
  expect(extractCardFacts(card("Payoff", "Creature — Human", "Whenever you discard a card, create a Treasure token.", [], 3)).typedRoles).toContain("discard_payoff");
});
it("a Mayhem deck with controlled discard surfaces Discard / Mayhem in Deck DNA", () => {
  const { result } = dna([...mayhemCards, ...discardEnablers]);
  const theme = result.themes.find((t) => t.id === "discard");
  expect(theme?.label).toBe("Discard / Mayhem");
  expect(result.themes[0].id).toBe("discard");
  expect(theme!.subthemes.map((s) => s.id)).toEqual(expect.arrayContaining(["mayhem", "controlled-discard"]));
  expect(result.summary).toMatch(/discard cards on purpose/);
});
it("opponent discard does not count as Mayhem support", () => {
  const supported = dna([...mayhemCards, ...discardEnablers]).result.themes.find((t) => t.id === "discard")!;
  const disruption = dna([...mayhemCards, ...opponentDiscard]).result.themes.find((t) => t.id === "discard");
  expect(disruption?.subthemes.map((s) => s.id) || []).not.toContain("controlled-discard");
  expect(disruption?.percent || 0).toBeLessThan(supported.percent);
});
it("recommendations use the deck's actual controlled discard, including the Commander", () => {
  const candidate = card("Mayhem Candidate", "Creature — Human Villain", "Haste\nMayhem {2}{R} (You may cast this card from your graveyard for {2}{R} if you discarded it this turn. Timing rules still apply.)", ["Mayhem"], 3);
  candidate.colorIdentity = ["R"];
  const redCommander = card("Red Commander", "Legendary Creature — Human", "", [], 3);
  redCommander.colorIdentity = ["R"];
  const scoreIn = (main: Parameters<typeof dnaFixture>[1], commander = redCommander) => {
    const f = dnaFixture(commander, main);
    return candidateScorer(f.state, f.deck, deckDnaCache.get(f.state, f.deck))(candidate);
  };
  const withSupport = scoreIn([...mayhemCards, ...discardEnablers]);
  const without = scoreIn([...mayhemCards, ...opponentDiscard]);
  expect(withSupport.debug.packageInteractions.join(" ")).toMatch(/Discard enabler: Faithless Looting lets you discard Mayhem Candidate/);
  expect(without.debug.packageInteractions.join(" ")).not.toMatch(/Discard enabler/);
  const interaction = (s: typeof withSupport) =>
    s.components.filter((c) => ["Deck / theme interaction", "Existing-card interaction"].includes(c.label)).reduce((n, c) => n + c.points, 0);
  expect(interaction(withSupport)).toBeGreaterThan(interaction(without));
  const rummager = card("Rummaging Commander", "Legendary Creature — Goblin", "{1}, {T}: Discard a card, then draw a card.", [], 3);
  rummager.colorIdentity = ["R"];
  const commanderLinked = scoreIn(mayhemCards, rummager);
  expect(commanderLinked.recommendation!.commander.direct).toBe(true);
  expect(commanderLinked.recommendation!.commander.evidence.join(" ")).toMatch(/Rummaging Commander lets you discard/);
});
