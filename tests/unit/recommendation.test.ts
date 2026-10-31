import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  canonicalFactsCards,
  reignCards,
  reignOfDragonsFixture,
} from "../recommendationFixtures";
import {
  candidateScorer,
  deckDnaCache,
  deckDnaInput,
} from "../../src/dna/engine";
import {
  recommendationBand,
  recommendationProfile,
  SCORE_WEIGHTS,
} from "../../src/synergy/recommendation";
import { recommendationTrace } from "../../src/synergy/developerTrace";
import { suggestReplacements } from "../../src/synergy/replacements";
import {
  archetypeCases,
  namedScoringCard,
  scoringCard,
} from "../scoringFixtures";
import { dnaFixture, plainCommander } from "../dnaFixtures";
import { extractCardFacts } from "../../src/synergy/facts";
import { parseDeckText } from "../../src/decks/deckText";
import { resolveDeckLines } from "../../src/decks/deckImport";
const evaluate = (f = reignOfDragonsFixture()) => {
  const dna = deckDnaCache.get(f.state, f.deck);
  return { f, dna, score: candidateScorer(f.state, f.deck, dna) };
};
it("permanent Reign regression uses all 69 exact printings and 100 supplied cards", () => {
  const f = reignOfDragonsFixture();
  expect(reignCards).toHaveLength(69);
  expect(f.deck.entries!.reduce((n, e) => n + e.quantity, 0)).toBe(100);
  expect(f.deck.entries!.find((e) => e.name === "Mountain")!.quantity).toBe(32);
  expect(f.deck.commanders[0].colorIdentity).toEqual(["R"]);
  const typed = recommendationProfile(
    deckDnaCache.get(f.state, f.deck).strategyProfile,
  );
  expect(typed.roleNeeds.lands.count).toBe(38);
  expect(typed.tokenTypePriorities.Dragon).toBe(1);
  expect(typed.tokenTypePriorities.generic).toBeLessThan(1);
});
it("actual Reign: Wayfinder has the calibrated v0.6.16 score, proves nontoken Dragon entry and smooths basics without unrestricted tutor/ramp credit", () => {
  const { score } = evaluate(),
    s = score(canonicalFactsCards[0]),
    data = s.recommendation!;
  expect(s.score).toBe(67);
  expect(data.commander.direct).toBe(true);
  expect(data.commander.score).toBeGreaterThanOrEqual(20);
  expect(data.commander.evidence.join(" ")).toMatch(
    /Changeling.*Dragon.*entering triggers Lathliss/,
  );
  expect(data.typedRoles).toContain("basic_land_to_hand");
  expect(data.typedRoles).not.toContain("unrestricted_tutor");
  expect(data.typedRoles).not.toContain("land_ramp");
  expect(s.roles).not.toContain("Tutors");
  expect(s.roles).not.toContain("Ramp");
  expect(s.explanation).toContain("basic land to hand");
  expect(s.explanation).not.toMatch(/unrestricted tutor|needed tutor/);
});
it("actual Reign: Fire Nation makes Soldiers with token-scoped firebending, never a Lathliss trigger or Dragon bonus", () => {
  const { score } = evaluate(),
    s = score(canonicalFactsCards[1]);
  expect(s.score).toBeLessThan(50);
  expect(s.recommendation!.commander).toMatchObject({
    score: 0,
    direct: false,
    evidence: [],
  });
  expect(s.recommendation!.typedRoles).toContain("soldier_token");
  expect(s.recommendation!.typedRoles).not.toContain("dragon_token");
  expect(
    s.recommendation!.facts.faces[0].addsMana.every(
      (m) => m.scope === "created-token",
    ),
  ).toBe(true);
  expect(s.explanation).toContain("Soldier");
  expect(s.explanation).toContain("do not satisfy");
  expect(s.debug.penalties.some((p) => p.name === "wrong_token_type")).toBe(
    true,
  );
  expect(s.explanation).not.toMatch(
    /directly reinforces|Dragon token generation|Excellent Fit/,
  );
});
it("actual Reign ranks meaningful Dragon engines above named generic beta false positives", () => {
  const { score } = evaluate();
  const weak = [
    "Alania's Pathmaker",
    "Harnesser of Storms",
    "Mongoose Lizard",
  ].map((n) => score(namedScoringCard(n)).score);
  expect(weak.every((n) => n < 50)).toBe(true);
  for (const name of ["Dragon Tempest", "Utvara Hellkite"])
    expect(
      score(reignCards.find((c) => c.name === name)!).score,
    ).toBeGreaterThanOrEqual(65);
});
it("role-only removal retains unmet-role credit with zero Commander points", () => {
  const f = reignOfDragonsFixture();
  f.deck.entries = f.deck.entries!.filter(
    (e) =>
      e.board === "commander" ||
      !extractCardFacts(f.state.metadata[e.scryfallId]).faces.some(
        (face) => face.removal.length,
      ),
  );
  const s = evaluate(f).score(reignCards.find((c) => c.name === "Chaos Warp")!);
  expect(s.recommendation!.commander.score).toBe(0);
  expect(s.debug.roleNeed).toBeGreaterThanOrEqual(20);
  expect(s.score).toBe(41);
  expect(s.recommendation!.evidence.roleEvidence.join(" ")).toContain(
    "Removal",
  );
});
it("Dragon-specific reduction has stronger verified tribal support than generic reduction", () => {
  const { score } = evaluate();
  const specific = score(
    reignCards.find((c) => c.name === "Dragonlord's Servant")!,
  );
  const generic = score(
    scoringCard(
      "General discount",
      "Artifact",
      "Spells you cast cost {1} less to cast.",
      2,
    ),
  );
  expect(specific.debug.archetypeFit).toBeGreaterThan(
    generic.debug.archetypeFit,
  );
  expect(specific.recommendation!.typedRoles).toContain(
    "tribal_cost_reduction",
  );
});
it("token doubling needs meaningful producers and is not itself a token source", () => {
  const doubler = scoringCard(
    "Multiplier",
    "Enchantment",
    "If one or more tokens would be created under your control, twice that many of those tokens are created instead.",
    3,
  );
  const empty = evaluate(dnaFixture(plainCommander, [])),
    supported = evaluate();
  expect(extractCardFacts(doubler).faces[0].createsTokens).toEqual([]);
  expect(
    empty
      .score(doubler)
      .debug.penalties.some((p) => p.name === "requires_missing_enabler"),
  ).toBe(true);
  expect(supported.score(doubler).debug.archetypeFit).toBeGreaterThan(
    empty.score(doubler).debug.archetypeFit,
  );
});
it("unsupported sacrifice and wrong tribal tokens cannot win through broad labels", () => {
  const { score } = evaluate();
  for (const token of ["Goblin", "Soldier"]) {
    const s = score(
      scoringCard(
        `${token} maker`,
        "Sorcery",
        `Create two 1/1 ${token} creature tokens.`,
        5,
      ),
    );
    expect(s.score).toBeLessThan(50);
    expect(s.recommendation!.commander.score).toBe(0);
    expect(s.recommendation!.typedRoles).not.toContain("dragon_token");
  }
  expect(
    score(
      scoringCard(
        "Unsupported sacrifice",
        "Enchantment",
        "Whenever you sacrifice a creature, each opponent loses 1 life.",
        4,
      ),
    ).score,
  ).toBeLessThan(50);
});
it("six base weights plus deck-specific budget total 100; confidence is separate; 80+ satisfies its evidence gate", () => {
  expect(Object.values(SCORE_WEIGHTS).reduce((n, w) => n + w, 0)).toBeCloseTo(
    0.8,
  );
  for (const example of archetypeCases) {
    const s = evaluate(example.fixture()).score(example.support),
      caps = s.recommendation!.componentCaps;
    expect(s.components.slice(0, 6)).toHaveLength(6);
    s.components
      .slice(0, 6)
      .forEach((c, i) => expect(c.points).toBeLessThanOrEqual(caps[i]));
    expect(s.components.reduce((n, c) => n + c.points, 0)).toBe(
      s.debug.rawScore,
    );
    expect(s.score).toBe(Math.max(0, Math.min(100, s.debug.rawScore)));
    expect(["High", "Medium", "Low"]).toContain(s.recommendation!.confidence);
    if (s.score >= 80)
      expect(s.recommendation!.gate.excellentEligible).toBe(true);
  }
});
it("one-engine card stays below Excellent without fabricated Commander evidence", () => {
  const commander = scoringCard(
    "Death Observer",
    "Legendary Creature — Human",
    "Whenever another creature you control dies, draw a card.",
  );
  const f = dnaFixture(commander, [
    scoringCard(
      "Engine A",
      "Enchantment",
      "Whenever a Dragon enters under your control, draw a card.",
      1,
    ),
    scoringCard(
      "Engine B",
      "Enchantment",
      "Whenever a Dragon enters under your control, gain 1 life.",
      1,
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      scoringCard(`Neutral ${i}`, "Artifact", "", 5),
    ),
  ]);
  const s = evaluate(f).score(
    scoringCard(
      "Role Dragon",
      "Creature — Dragon",
      "{T}: Destroy target artifact.\n{1}: Add {R}.",
      1,
    ),
  );
  expect(s.recommendation!.commander.score).toBeLessThan(20);
  expect(s.recommendation!.gate.excellentEligible).toBe(false);
  expect(s.score).toBe(66);
  expect(s.recommendation!.gate.reasons).toEqual([]);
});
it("missing metadata and modes reduce confidence without adding score points", () => {
  const { score } = evaluate();
  expect(
    score({
      ...scoringCard("Unknown", "Creature", "", 2),
      oracleText: undefined,
    }).recommendation!.confidence,
  ).toBe("Low");
  const modal = score(
    scoringCard(
      "Modal",
      "Instant",
      "Choose one —\nDestroy target artifact.\nDraw a card.",
      2,
    ),
  );
  expect(modal.recommendation!.confidence).toBe("Medium");
  expect(modal.components.some((c) => /confidence/i.test(c.label))).toBe(false);
});
it("identity incompatibility is a real eligibility failure", () => {
  const s = evaluate().score({
    ...canonicalFactsCards[0],
    colorIdentity: ["U"],
  });
  expect(s.score).toBe(0);
  expect(
    s.debug.penalties.some((p) => p.name === "color_or_identity_issue"),
  ).toBe(true);
});
it("developer trace preserves exact typed evidence without prices or physical-copy inputs", () => {
  const { f, dna } = evaluate();
  const input = {
    ...deckDnaInput(f.state, f.deck).cards[0],
    card: canonicalFactsCards[0],
    identity: canonicalFactsCards[0].oracleId!,
  };
  const trace = recommendationTrace(dna.strategyProfile, input);
  expect(trace.typedRoles).toContain("basic_land_to_hand");
  expect(trace.components.reduce((n, c) => n + c.points, 0)).toBe(
    trace.rawScore,
  );
  expect(JSON.stringify(trace)).not.toMatch(
    /prices|quantityOwned|quantityAssigned/,
  );
});
it("optional swap targets are compatible and lower-scoring, never unsuitable lands or Commanders, with no writes", () => {
  const { f, dna, score } = evaluate(),
    before = JSON.stringify(f.state),
    candidate = score(canonicalFactsCards[0]);
  const suggestions = suggestReplacements(candidate, dna);
  expect(suggestions.length).toBeGreaterThan(0);
  for (const suggestion of suggestions) {
    expect(suggestion.delta).toBeGreaterThanOrEqual(8);
    const card = dna.strategyProfile.cards.find(
      (c) => c.card.identity === suggestion.identity,
    )!;
    expect(card.card.commander).toBe(false);
    expect(card.card.card.typeLine).not.toContain("Land");
    expect(suggestion.reasons.join(" ")).toContain("local Synergy");
  }
  expect(JSON.stringify(f.state)).toBe(before);
  expect(
    suggestReplacements(
      {
        ...candidate,
        recommendation: { ...candidate.recommendation!, confidence: "Low" },
      },
      dna,
    ),
  ).toEqual([]);
});
it("suggestions protect uncovered removal when the addition has no removal", () => {
  const f = reignOfDragonsFixture();
  f.deck.entries = f.deck.entries!.filter(
    (e) =>
      e.name === "Chaos Warp" ||
      e.name === "Mountain" ||
      e.board === "commander",
  );
  const { dna, score } = evaluate(f);
  expect(
    suggestReplacements(score(canonicalFactsCards[0]), dna).some(
      (s) => s.name === "Chaos Warp",
    ),
  ).toBe(false);
});
it("fit labels have exact boundaries", () => {
  expect(
    [0, 34, 35, 49, 50, 59, 60, 69, 70, 79, 80, 89, 90, 100].map(
      recommendationBand,
    ),
  ).toEqual([
    "Poor Fit",
    "Poor Fit",
    "Weak Fit",
    "Weak Fit",
    "Situational",
    "Situational",
    "Reasonable Fit",
    "Reasonable Fit",
    "Strong Fit",
    "Strong Fit",
    "Excellent Fit",
    "Excellent Fit",
    "Exceptional Fit",
    "Exceptional Fit",
  ]);
});
it("supplied text resolves all exact printings offline after an explicit main-board boundary", async () => {
  const text = readFileSync(
    new URL("../data/reign-of-dragons.manabox.txt", import.meta.url),
    "utf8",
  );
  const parsed = parseDeckText(
      text.replace("\n\n1 Abrade", "\n\n// MAIN\n1 Abrade"),
    ),
    f = reignOfDragonsFixture();
  expect(parsed.issues).toEqual([]);
  expect(parsed.lines.reduce((n, l) => n + l.quantity, 0)).toBe(100);
  expect(parsed.lines.filter((l) => l.explicitCommander)).toHaveLength(1);
  const resolved = await resolveDeckLines(
    parsed,
    f.state.metadata,
    {
      lookupDeckCards: async () => {
        throw new Error("All exact printings must be cached");
      },
    },
    new AbortController().signal,
  );
  expect(resolved).toHaveLength(69);
  expect(resolved.every((row) => row.printing && !row.note && !row.error)).toBe(
    true,
  );
});
it("ability words cannot turn a self-only attack into a trigger supplied by another creature", () => {
  expect(
    evaluate()
      .score(canonicalFactsCards[0])
      .debug.packageInteractions.some((e) =>
        e.includes("→ Minion of the Mighty: Pack tactics"),
      ),
  ).toBe(false);
});
it("opponent search/draw facts do not fill the player’s ramp/tutor/draw gaps", () => {
  const s = evaluate(dnaFixture(plainCommander, [])).score(
    scoringCard(
      "Opponent Gift",
      "Sorcery",
      "Target opponent searches their library for a basic land card, puts it onto the battlefield, then shuffles. Target opponent draws two cards.",
      3,
    ),
  );
  expect(s.debug.roleNeed).toBe(0);
  expect(s.roles).not.toContain("Ramp");
  expect(s.roles).not.toContain("Card advantage");
});
it("giving an opponent Dragon tokens cannot satisfy the player’s entry/payoff condition", () => {
  const s = evaluate().score(
    scoringCard(
      "Opponent Dragons",
      "Sorcery",
      "Target opponent creates two 4/4 Dragon creature tokens.",
      3,
    ),
  );
  expect(s.recommendation!.commander.score).toBe(0);
  expect(s.debug.matchedTags).not.toContain("typal:Dragon");
});
it("opponent draw triggers require an opponent draw, not the player’s own draw spell", () => {
  const commander = scoringCard(
    "Opponent Draw Observer",
    "Legendary Creature — Demon",
    "Whenever an opponent draws a card, that player loses 1 life.",
  );
  const { score } = evaluate(dnaFixture(commander, []));
  expect(
    score(scoringCard("Own Draw", "Instant", "Draw two cards.", 2))
      .recommendation!.commander.score,
  ).toBe(0);
  expect(
    score(
      scoringCard(
        "Forced Draw",
        "Instant",
        "Target opponent draws two cards.",
        2,
      ),
    ).recommendation!.commander.score,
  ).toBeGreaterThan(0);
});
it("a conditional token Commander without required inputs is not three unconditional token sources", () => {
  const f = reignOfDragonsFixture();
  f.deck.entries = f.deck.entries!.filter(
    (e) => e.board === "commander" || e.name === "Mountain",
  );
  const { dna, score } = evaluate(f);
  expect(
    recommendationProfile(dna.strategyProfile).meaningfulTokenSources,
  ).toBe(0);
  expect(
    score(
      scoringCard(
        "Unsupported multiplier",
        "Enchantment",
        "If one or more tokens would be created under your control, twice that many of those tokens are created instead.",
        3,
      ),
    ).debug.penalties.some((p) => p.name === "requires_missing_enabler"),
  ).toBe(true);
});
it("opponent-only token triggers never prioritize the player’s own tokens", () => {
  const commander = scoringCard(
    "Opponent Token Observer",
    "Legendary Creature — Human",
    "Whenever a token enters under an opponent’s control, draw a card.",
  );
  const { dna, score } = evaluate(dnaFixture(commander, []));
  expect(recommendationProfile(dna.strategyProfile).genericTokenEngine).toBe(
    false,
  );
  const s = score(
    scoringCard(
      "Own Soldiers",
      "Sorcery",
      "Create two 1/1 Soldier creature tokens.",
      3,
    ),
  );
  expect(s.recommendation!.commander.score).toBe(0);
  expect(s.debug.archetypeFit).toBe(0);
});
