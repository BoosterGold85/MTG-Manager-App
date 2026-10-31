import { it, expect } from "vitest";
import {
  archetypeCases,
  dragonScoringFixture,
  namedScoringCard,
  scoringCard,
  genericValue,
} from "../scoringFixtures";
import {
  candidateScorer,
  deckDnaCache,
  DeckDnaCache,
} from "../../src/dna/engine";
import { SCORE_WEIGHTS } from "../../src/synergy/recommendation";
import { scoreBand } from "../../src/dna/strategy";
import { exploreSynergy } from "../../src/synergy/explorer";
import { synergyFixture } from "../synergyFixtures";
const evaluator = (f = dragonScoringFixture()) => {
  const dna = deckDnaCache.get(f.state, f.deck);
  return {
    profile: dna.strategyProfile,
    score: candidateScorer(f.state, f.deck, dna),
    dna,
  };
};
for (const c of archetypeCases)
  it(`${c.name}: actual Commander and composition identify its strategy and rank an engine above an off-plan card`, () => {
    const f = c.fixture(),
      { profile, score } = evaluator(f),
      good = score(c.support),
      weak = score(c.weak);
    expect(profile.primaryArchetypes.map((p) => p.tag)).toContain(c.primary);
    expect(good.score).toBeGreaterThan(weak.score);
    if (c.primary === "goodstuff") expect(good.debug.archetypeFit).toBe(0);
    else expect(good.debug.archetypeFit).toBeGreaterThan(0);
    expect(good.reasons.length).toBeGreaterThan(0);
    if (process.env.SCORING_REPORT)
      console.log(
        c.name,
        good.score,
        weak.score,
        profile.primaryArchetypes.map((p) => p.tag),
      );
  });
it("named beta false positives stay below 50 and at least one below 30; actual Dragon engines outrank all three", () => {
  const { score } = evaluator();
  const weak = [
    "Alania's Pathmaker",
    "Harnesser of Storms",
    "Mongoose Lizard",
  ].map((n) => score(namedScoringCard(n)));
  expect(weak.every((c) => c.score < 50)).toBe(true);
  expect(weak.some((c) => c.score < 30)).toBe(true);
  for (const name of [
    "Dragon Tempest",
    "Utvara Hellkite",
    "Dragonlord's Servant",
  ]) {
    const c = score(namedScoringCard(name));
    expect(c.score).toBeGreaterThan(Math.max(...weak.map((c) => c.score)));
    expect(c.debug.commanderSynergy).toBeGreaterThanOrEqual(20);
  }
});
it("the same ETB draw creature is substantially stronger in a blink deck than in Dragon typal", () => {
  const dragon = evaluator().score(genericValue),
    blink = evaluator(
      archetypeCases.find((c) => c.name === "Creature ETB / Blink")!.fixture(),
    ).score(genericValue);
  expect(dragon.score).toBeLessThan(50);
  expect(blink.score - dragon.score).toBeGreaterThanOrEqual(20);
  expect(blink.debug.commanderSynergy).toBeGreaterThan(
    dragon.debug.commanderSynergy,
  );
});
it("has six bounded components, signed penalties, exact raw arithmetic and deterministic clamping for every archetype", () => {
  const caps = Object.values(SCORE_WEIGHTS).map((w) => w * 100);
  for (const scenario of archetypeCases) {
    const { score } = evaluator(scenario.fixture());
    for (const card of [scenario.support, scenario.weak]) {
      const s = score(card);
      expect(s.components.slice(0, 6)).toHaveLength(6);
      s.components.slice(0, 6).forEach((c, i) => {
        expect(c.points).toBeGreaterThanOrEqual(0);
        expect(c.points).toBeLessThanOrEqual(caps[i]);
      });
      expect(s.debug.rawScore).toBe(
        s.components.reduce((n, c) => n + c.points, 0),
      );
      expect(s.score).toBe(Math.max(0, Math.min(100, s.debug.rawScore)));
      expect(s.debug.finalScore).toBe(s.score);
      expect(
        s.debug.penalties.every((p) => p.value < 0 && p.reason.length > 0),
      ).toBe(true);
      expect(Number.isInteger(s.score)).toBe(true);
    }
  }
});
it("off-tribe negatives defeat generic overlap and never exceed five generic points", () => {
  const s = evaluator().score(genericValue);
  expect(s.debug.genericOverlap).toBeLessThanOrEqual(5);
  expect(s.conflicts.length).toBeGreaterThan(0);
  expect(s.debug.penalties.some((p) => p.name === "wrong_tribal_type")).toBe(
    true,
  );
  expect(s.tier).toBe("Other Legal Cards");
});
it("global graveyard exile has anti-synergy while opponent-only graveyard hate does not", () => {
  const { score } = evaluator(
    archetypeCases.find((c) => c.name === "Graveyard / Reanimator")!.fixture(),
  );
  const broad = score(
    scoringCard(
      "Global Exile",
      "Artifact",
      "When this artifact enters, exile all cards from all graveyards.",
      2,
    ),
  );
  const targeted = score(
    scoringCard(
      "Opponent Exile",
      "Artifact",
      "When this artifact enters, exile all cards from target opponent’s graveyard.",
      2,
    ),
  );
  expect(broad.debug.penalties.some((p) => p.name === "nonbo")).toBe(true);
  expect(targeted.debug.penalties.some((p) => p.name === "nonbo")).toBe(false);
  expect(broad.score).toBeLessThan(targeted.score);
});
it("destroying all artifacts conflicts with an artifact engine", () => {
  const { score } = evaluator(
    archetypeCases.find((c) => c.name === "Artifact")!.fixture(),
  );
  expect(
    score(
      scoringCard("Artifact Reset", "Sorcery", "Destroy all artifacts.", 3),
    ).debug.penalties.some((p) => p.name === "nonbo"),
  ).toBe(true);
});
it("saturated draw receives no need points, while missing removal does; profile reports actual counts and targets", () => {
  const f = archetypeCases.find((c) => c.name === "Spellslinger")!.fixture(),
    { profile, score } = evaluator(f);
  expect(profile.roleNeeds.cardAdvantage.count).toBeGreaterThan(
    profile.roleNeeds.cardAdvantage.target,
  );
  expect(
    score(scoringCard("Another Draw", "Instant", "Draw two cards.", 2)).debug
      .roleNeed,
  ).toBe(0);
  expect(
    score(
      scoringCard("Needed Removal", "Instant", "Destroy target creature.", 2),
    ).debug.roleNeed,
  ).toBeGreaterThan(0);
});
it("crowded expensive curve and weak board impact produce explicit penalties", () => {
  const f = dragonScoringFixture();
  f.deck
    .entries!.filter((e) => e.board === "main")
    .forEach((e) => {
      f.state.metadata[e.scryfallId] = {
        ...f.state.metadata[e.scryfallId],
        manaValue: 6,
      };
    });
  const s = evaluator(f).score(
    scoringCard(
      "Weak Expensive Body",
      "Creature — Human",
      "When this creature enters, gain 1 life.",
      6,
    ),
  );
  expect(s.debug.curveFit).toBeLessThan(5);
  expect(s.debug.penalties.map((p) => p.name)).toEqual(
    expect.arrayContaining(["mana_curve_congestion", "low_impact_card"]),
  );
});
it("exceptional cheap multi-role utility is not automatically penalized for being off tribe", () => {
  const s = evaluator().score(
    scoringCard(
      "Efficient Utility",
      "Creature — Human",
      // Unconditional since v0.6.12: an instant/sorcery trigger earns no credit in this spell-less Dragon deck.
      "When this creature enters, draw two cards.\n{T}: Add {C}{C}.",
      1,
    ),
  );
  expect(s.debug.cardQuality).toBeGreaterThanOrEqual(8);
  expect(s.debug.penalties.some((p) => p.name === "wrong_tribal_type")).toBe(
    false,
  );
});
it("cache reuses profile and scores on reopen, ignores ownership/prices, and refreshes for candidate metadata", () => {
  const f = dragonScoringFixture(),
    cache = new DeckDnaCache(),
    dna = cache.get(f.state, f.deck),
    score = candidateScorer(f.state, f.deck, dna),
    card = namedScoringCard("Dragon Tempest"),
    first = score(card);
  expect(cache.get(f.state, f.deck)).toBe(dna);
  expect(
    score({ ...card, quantity: 999, prices: { usd: "99999" } } as typeof card),
  ).toBe(first);
  expect(score({ ...card, manaValue: 10 })).not.toBe(first);
  f.deck.entries![1].quantity++;
  expect(cache.get(f.state, f.deck).strategyProfile).not.toBe(
    dna.strategyProfile,
  );
});
it("all seven interpretation boundaries are exact", () => {
  expect(
    [0, 34, 35, 49, 50, 59, 60, 69, 70, 79, 80, 89, 90, 100].map(scoreBand),
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
it("score ordering takes precedence over availability, while retaining fully assigned usage", () => {
  const f = synergyFixture();
  f.state.items = f.state.items.filter((i) => i.id !== "utvara-foil");
  const c = exploreSynergy(f.state, f.deck);
  expect(c[0].card.name).toBe("Utvara Hellkite");
  expect(c[0].available).toBe(0);
  expect(c[0].usage[0].name).toBe("Miirym");
  expect(c[0].synergy.score).toBeGreaterThan(c[1].synergy.score);
});

it("opponent-only graveyard replacement is safe while all-graveyard replacement conflicts", () => {
  const { score } = evaluator(
    archetypeCases.find((c) => c.name === "Graveyard / Reanimator")!.fixture(),
  );
  for (const text of [
    "If a card would be put into an opponent's graveyard from anywhere, exile it instead.",
    "If a card would be put into an opponent’s graveyard from anywhere, exile it instead.",
  ])
    expect(
      score(scoringCard(text, "Enchantment", text, 4)).debug.penalties.some(
        (p) => p.name === "nonbo",
      ),
    ).toBe(false);
  expect(
    score(
      scoringCard(
        "Global Replacement",
        "Enchantment",
        "If a card would be put into a graveyard from anywhere, exile it instead.",
        2,
      ),
    ).debug.penalties.some((p) => p.name === "nonbo"),
  ).toBe(true);
});
it("nontoken Commander cast triggers do not treat a spell producing tokens as a Dragon spell", () => {
  const f = dragonScoringFixture();
  const cmd = f.state.metadata[f.deck.commanders[0].scryfallId];
  f.state.metadata[cmd.scryfallId] = {
    ...cmd,
    oracleText: "Whenever you cast a Dragon spell, draw a card.",
  };
  const { score } = evaluator(f);
  expect(
    score(
      scoringCard(
        "Dragon Token Spell",
        "Sorcery",
        "Create a 5/5 Dragon creature token.",
        5,
      ),
    ).debug.commanderSynergy,
  ).toBe(0);
  expect(
    score(
      scoringCard("Actual Dragon", "Creature — Dragon", "Flying", 5, [
        "Flying",
      ]),
    ).debug.commanderSynergy,
  ).toBeGreaterThanOrEqual(20);
});
it("flying-only ETB triggers do not claim a direct relationship with a non-flying creature", () => {
  const f = archetypeCases
    .find((c) => c.name === "Creature ETB / Blink")!
    .fixture();
  const id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText:
      "Whenever another creature you control with flying enters, draw a card.",
  };
  const { score } = evaluator(f);
  const body = scoringCard(
    "Ground Creature",
    "Creature — Human",
    "When this creature enters, draw a card.",
    2,
  );
  expect(score(body).debug.commanderSynergy).toBe(0);
  expect(
    score({ ...body, keywords: ["Flying"] }).debug.commanderSynergy,
  ).toBeGreaterThanOrEqual(20);
});

it("token makers cannot claim nontoken ETB Commander triggers", () => {
  const { score } = evaluator();
  const token = score(
    scoringCard(
      "Nontoken Gate Token Spell",
      "Sorcery",
      "Create a 5/5 red Dragon creature token with flying.",
      5,
    ),
  );
  expect(token.debug.commanderSynergy).toBe(0);
  expect(token.debug.archetypeFit).toBeGreaterThan(0);
});
it("counterspell events are distinct from placing counters", () => {
  const f = archetypeCases.find((c) => c.name === "Spellslinger")!.fixture(),
    id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText: "Whenever you counter a spell, draw a card.",
  };
  const { score } = evaluator(f);
  expect(
    score(scoringCard("Counter Test", "Instant", "Counter target spell.", 2))
      .debug.commanderSynergy,
  ).toBeGreaterThanOrEqual(20);
  expect(
    score(
      scoringCard(
        "Counter Resource Test",
        "Sorcery",
        "Put a +1/+1 counter on target creature.",
        2,
      ),
    ).debug.commanderSynergy,
  ).toBe(0);
});
it("canonical damage events provide explicit Commander interactions", () => {
  const f = dragonScoringFixture(),
    id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText:
      "Whenever another source you control deals damage to an opponent, draw a card.",
  };
  const s = evaluator(f).score(
    scoringCard(
      "Damage Spell",
      "Instant",
      "This spell deals 3 damage to any target.",
      1,
    ),
  );
  expect(s.debug.commanderSynergy).toBeGreaterThanOrEqual(20);
  expect(
    s.debug.commanderInteractions.some((r) => r.includes("deals damage")),
  ).toBe(true);
});
it("explicit additional trigger and nonlegendary copy support are recognized without generic tag overlap", () => {
  const { score } = evaluator();
  const double = score(
    scoringCard(
      "Trigger Amplifier",
      "Artifact",
      "If a creature entering causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.",
      4,
    ),
  );
  expect(double.debug.commanderSynergy).toBeGreaterThanOrEqual(20);
  expect(double.debug.archetypeFit).toBeGreaterThanOrEqual(15);
  const copy = score(
    scoringCard(
      "Nonlegendary Copy",
      "Creature — Illusion",
      "You may have this creature enter as a copy of a creature you control, except it isn't legendary.",
      4,
    ),
  );
  expect(copy.debug.commanderSynergy).toBeGreaterThanOrEqual(20);
});
it("profile and candidate scores depend on mechanics rather than deck title or printing price", () => {
  const f = dragonScoringFixture(),
    first = evaluator(f).score(namedScoringCard("Utvara Hellkite"));
  f.deck.name = "Not a Dragon Hint";
  f.state.metadata[f.deck.commanders[0].scryfallId] = {
    ...f.state.metadata[f.deck.commanders[0].scryfallId],
    prices: { usd: "100000" },
  } as (typeof f.state.metadata)[string];
  expect(evaluator(f).score(namedScoringCard("Utvara Hellkite"))).toEqual(
    first,
  );
});

it("trigger amplifiers respect creature-type and event restrictions rather than awarding generic Commander overlap", () => {
  const { score } = evaluator();
  const shaman = score(
    scoringCard(
      "Restricted Trigger Amplifier",
      "Creature — Human Wizard",
      "If an ability of a Shaman or another Wizard you control triggers, that ability triggers an additional time.",
      2,
    ),
  );
  expect(shaman.debug.commanderSynergy).toBe(0);
  const artifact = score(
    scoringCard(
      "Artifact Entering Amplifier",
      "Artifact",
      "If an artifact entering causes an ability of a permanent you control to trigger, that ability triggers an additional time.",
      4,
    ),
  );
  expect(artifact.debug.commanderSynergy).toBe(0);
  const all = score(
    scoringCard(
      "Compatible Creature Amplifier",
      "Artifact",
      "If a creature entering causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.",
      4,
    ),
  );
  expect(all.debug.commanderSynergy).toBeGreaterThanOrEqual(20);
  expect(all.score).toBeGreaterThan(shaman.score);
});

it("own Commander ETBs are not triggered by unrelated ETB creatures, but blink can reuse them", () => {
  const f = dragonScoringFixture(),
    id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText: "When this creature enters, draw two cards.",
  };
  const { score } = evaluator(f);
  expect(score(genericValue).debug.commanderSynergy).toBe(0);
  expect(
    score(
      scoringCard(
        "Reuse Own ETB",
        "Instant",
        "Exile target creature you control, then return it to the battlefield under your control.",
        1,
      ),
    ).debug.commanderSynergy,
  ).toBeGreaterThanOrEqual(20);
});
it("equipment can strengthen a Commander-specific combat ability without claiming the equipment attacks", () => {
  const f = archetypeCases.find((c) => c.name === "Voltron")!.fixture(),
    id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText:
      "Whenever this creature deals combat damage to a player, draw two cards.",
  };
  const s = evaluator(f).score(
    archetypeCases.find((c) => c.name === "Voltron")!.support,
  );
  expect(s.debug.commanderSynergy).toBeGreaterThanOrEqual(20);
  expect(
    s.debug.commanderInteractions.some((r) => r.includes("combat ability")),
  ).toBe(true);
});
it("exact damage requirements distinguish one-damage effects from generic larger damage", () => {
  const f = dragonScoringFixture(),
    id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText:
      "Whenever another source you control deals exactly 1 damage to a permanent or player, draw a card.",
  };
  const { score } = evaluator(f);
  expect(
    score(namedScoringCard("Mongoose Lizard")).debug.commanderSynergy,
  ).toBeGreaterThanOrEqual(20);
  expect(
    score(
      scoringCard(
        "Three Damage",
        "Instant",
        "This spell deals 3 damage to any target.",
        1,
      ),
    ).debug.commanderSynergy,
  ).toBe(0);
});

it("printed token records cannot claim nontoken or cast Commander triggers", () => {
  const f = dragonScoringFixture(),
    token = scoringCard(
      "Printed Dragon Token",
      "Token Creature — Dragon",
      "",
      0,
    );
  const ownId = f.deck.commanders[0].scryfallId;
  f.state.metadata[ownId] = {
    ...f.state.metadata[ownId],
    oracleText:
      "Whenever another nontoken Dragon you control enters, draw a card.",
  };
  expect(evaluator(f).score(token).debug.commanderSynergy).toBe(0);
  const id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText: "Whenever you cast a Dragon spell, draw a card.",
  };
  expect(evaluator(f).score(token).debug.commanderSynergy).toBe(0);
});

it("one-sided and conditional wipes do not falsely claim they clear the whole friendly engine", () => {
  const dragon = evaluator();
  for (const text of [
    "Destroy all creatures you don't control.",
    "Destroy all creatures with power 1 or less.",
  ])
    expect(
      dragon
        .score(scoringCard(text, "Sorcery", text, 5))
        .debug.penalties.some((p) => p.name === "Creature-engine conflict"),
    ).toBe(false);
  const artifact = evaluator(
    archetypeCases.find((c) => c.name === "Artifact")!.fixture(),
  );
  for (const text of [
    "Destroy all artifacts you don't control.",
    "Destroy all artifacts with mana value 1 or less.",
  ])
    expect(
      artifact
        .score(scoringCard(text, "Sorcery", text, 3))
        .debug.penalties.some((p) => p.name === "nonbo"),
    ).toBe(false);
});

it("static typal compatibility does not bypass a flying-only trigger condition", () => {
  const f = dragonScoringFixture(),
    id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText:
      "Whenever a Dragon you control with flying enters, draw a card.",
  };
  const { score } = evaluator(f);
  expect(
    score(
      scoringCard("Ground Dragon", "Creature — Dragon", "Defender", 3, [
        "Defender",
      ]),
    ).debug.commanderSynergy,
  ).toBe(0);
  expect(
    score(
      scoringCard("Flying Dragon", "Creature — Dragon", "Flying", 3, [
        "Flying",
      ]),
    ).debug.commanderSynergy,
  ).toBeGreaterThanOrEqual(20);
});

it("mono-color and colorless decks do not invent a multicolor mana-fixing deficit", () => {
  const f = dragonScoringFixture(),
    id = f.deck.commanders[0].scryfallId;
  for (const colorIdentity of [
    [],
    ["R"],
  ] as (typeof f.state.metadata)[string]["colorIdentity"][]) {
    f.state.metadata[id] = { ...f.state.metadata[id], colorIdentity };
    expect(evaluator(f).profile.roleNeeds.manaFixing.target).toBe(0);
  }
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    colorIdentity: ["U", "R", "G"],
  };
  expect(evaluator(f).profile.roleNeeds.manaFixing.target).toBeGreaterThan(0);
});

it("an incidental ETB package does not exempt generic bodies from a strongly typal deck’s off-tribe scrutiny", () => {
  const f = dragonScoringFixture(),
    id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText:
      "When this creature enters, draw two cards. Dragon spells you cast cost {1} less to cast.",
  };
  for (let i = 0; i < 12; i++) {
    const c = scoringCard(
      `Typal ETB ${i}`,
      "Creature — Dragon",
      "When this creature enters, draw a card.",
      1 + (i % 7),
    );
    f.state.metadata[c.scryfallId] = c;
    f.deck.entries!.push({
      id: c.scryfallId,
      board: "main",
      name: c.name,
      quantity: 1,
      scryfallId: c.scryfallId,
      cardIdentity: c.oracleId!,
    });
  }
  const blink = scoringCard(
    "Incidental Blink",
    "Instant",
    "Exile target creature you control, then return it to the battlefield under your control.",
    2,
  );
  f.state.metadata[blink.scryfallId] = blink;
  f.deck.entries!.push({
    id: blink.scryfallId,
    board: "main",
    name: blink.name,
    quantity: 1,
    scryfallId: blink.scryfallId,
    cardIdentity: blink.oracleId!,
  });
  const s = evaluator(f).score(genericValue);
  expect(s.debug.penalties.some((p) => p.name === "wrong_tribal_type")).toBe(
    true,
  );
  expect(s.score).toBeLessThan(50);
});
it("an exceptional needed death payoff remains eligible in Zombie aristocrats despite being off tribe", () => {
  const f = archetypeCases.find((c) => c.name === "Aristocrats")!.fixture();
  for (const [id, c] of Object.entries(f.state.metadata))
    f.state.metadata[id] = {
      ...c,
      typeLine: c.typeLine.replace(/—.*/, "— Zombie"),
    };
  const id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText: "Whenever another Zombie you control dies, draw a card.",
  };
  const c = scoringCard(
    "Needed Death Payoff",
    "Creature — Vampire",
    "Whenever a creature dies, each opponent loses 1 life and you gain 1 life.",
    2,
  );
  const s = evaluator(f).score(c);
  expect(s.debug.cardQuality).toBeGreaterThanOrEqual(8);
  expect(s.debug.roleNeed).toBeGreaterThan(0);
  expect(s.debug.penalties.some((p) => p.name === "wrong_tribal_type")).toBe(
    false,
  );
  expect(s.score).toBeGreaterThanOrEqual(50);
});
it("typed death engines reject wrong-tribe fodder while recognizing compatible sacrifice outlets", () => {
  const f = archetypeCases.find((c) => c.name === "Aristocrats")!.fixture(),
    id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText: "Whenever another Zombie you control dies, draw a card.",
  };
  for (const [key, card] of Object.entries(f.state.metadata))
    f.state.metadata[key] = {
      ...card,
      typeLine: card.typeLine.replace(/—.*/, "— Zombie"),
    };
  const { score } = evaluator(f);
  expect(
    score(
      scoringCard(
        "Goblin Fodder",
        "Creature — Goblin",
        "When this creature dies, create a 1/1 Goblin creature token.",
        2,
      ),
    ).debug.commanderSynergy,
  ).toBe(0);
  expect(
    score(
      scoringCard(
        "Any Creature Outlet",
        "Creature — Human",
        "Sacrifice a creature: Scry 1.",
        1,
      ),
    ).debug.commanderSynergy,
  ).toBeGreaterThanOrEqual(20);
});

it("multi-type creatures select the supported primary tribe rather than an alphabetically earlier subtype", () => {
  const f = dragonScoringFixture();
  for (const [id, card] of Object.entries(f.state.metadata))
    f.state.metadata[id] = {
      ...card,
      typeLine: card.typeLine.replace(/Dragon/g, "Elf Druid"),
      oracleText: card.oracleText?.replace(/Dragon/g, "Elf"),
      keywords: [],
    };
  const { profile, score } = evaluator(f);
  expect(profile.primaryCreatureType).toBe("Elf");
  expect(profile.tribalDensity).toBeGreaterThan(0.6);
  expect(
    score(genericValue).debug.penalties.some(
      (p) => p.name === "wrong_tribal_type",
    ),
  ).toBe(true);
});
it("canonical Changeling supplies the referenced creature types without changing stored type lines", () => {
  const { score } = evaluator(),
    card = scoringCard(
      "Changeling Candidate",
      "Creature — Shapeshifter",
      "Changeling",
      3,
      ["Changeling"],
    );
  const normal = score({ ...card, keywords: [], oracleText: "" }),
    changeling = score(card);
  expect(changeling.debug.commanderSynergy).toBeGreaterThan(
    normal.debug.commanderSynergy,
  );
  expect(changeling.debug.archetypeFit).toBeGreaterThan(
    normal.debug.archetypeFit,
  );
  expect(
    changeling.debug.penalties.some((p) => p.name === "wrong_tribal_type"),
  ).toBe(false);
  expect(card.typeLine).toBe("Creature — Shapeshifter");
});

it("generic family overlap cannot bypass the Commander’s actual spell or flying-object restriction", () => {
  const f = archetypeCases.find((c) => c.name === "Spellslinger")!.fixture(),
    id = f.deck.commanders[0].scryfallId;
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText:
      "Whenever you cast an instant spell, put a +1/+1 counter on target creature.",
  };
  let score = evaluator(f).score;
  expect(
    score(scoringCard("Only Sorcery", "Sorcery", "Draw two cards.", 2)).debug
      .commanderSynergy,
  ).toBe(0);
  expect(
    score(scoringCard("Actual Instant", "Instant", "Draw two cards.", 2)).debug
      .commanderSynergy,
  ).toBeGreaterThanOrEqual(20);
  f.state.metadata[id] = {
    ...f.state.metadata[id],
    oracleText:
      "Whenever an artifact you control with flying enters, put a +1/+1 counter on target creature.",
  };
  score = evaluator(f).score;
  expect(
    score(scoringCard("Ground Artifact", "Artifact", "{T}: Add {C}.", 2)).debug
      .commanderSynergy,
  ).toBe(0);
});
