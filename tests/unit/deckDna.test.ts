import { it, expect, vi } from "vitest";
import {
  analyzeDeckDna,
  deckDnaInput,
  DeckDnaCache,
  cardSynergy,
} from "../../src/dna/engine";
import {
  deckRows,
  visibleDeckRows,
  emptyDeckFilters,
} from "../../src/decks/deckBrowse";
import {
  dnaFixture,
  regressionDecks,
  lathliss,
  dragons,
  atraxa,
  counters,
  graveyard,
  ghave,
  aristocrats,
  incidental,
  plainCommander,
} from "../dnaFixtures";
import { sol, meren } from "../importFixtures";
const dna = (f = dnaFixture()) => analyzeDeckDna(deckDnaInput(f.state, f.deck));
const themeIds = (result: ReturnType<typeof dna>) =>
  result.themes.map((t) => t.id);
for (const regression of regressionDecks)
  it(`${regression.name} has deterministic normalized descriptive themes and evidence`, () => {
    const fixture = dnaFixture(regression.commander, regression.main);
    const first = dna(fixture),
      second = dna(fixture);
    expect(first).toEqual(second);
    expect(first.themes.reduce((n, t) => n + t.percent, 0)).toBe(100);
    expect(first.themes.length).toBeGreaterThan(0);
    expect(first.themes.length).toBeLessThanOrEqual(7);
    for (const theme of first.themes) {
      expect(theme.evidence.length).toBeGreaterThan(0);
      expect(theme.commanderWeight).toBeLessThanOrEqual(
        theme.deckWeight * 0.45,
      );
    }
  });
it("Dragon typal connects explicit type payoffs, creature tokens, combat and ramp without artifact-type inflation", () => {
  const result = dna();
  expect(themeIds(result)).toEqual(
    expect.arrayContaining(["typal:Dragon", "tokens", "combat", "ramp"]),
  );
  expect(result.themes[0].id).toBe("typal:Dragon");
  expect(themeIds(result)).not.toContain("artifacts");
  expect(result.summary).toContain("Lathliss");
  expect(result.summary).not.toMatch(/wins|win condition|turn \d/i);
});
it("counters family combines proliferation, placing counters and explicit payoffs", () => {
  const result = dna(dnaFixture(atraxa, counters));
  expect(result.themes[0].id).toBe("counters");
  expect(result.themes[0].subthemes.map((t) => t.id)).toEqual(
    expect.arrayContaining(["proliferate", "counter-payoff", "plus-counters"]),
  );
  expect(cardSynergy(result, counters[1])!.score).toBeGreaterThan(
    cardSynergy(result, counters[6])!.score,
  );
});
it("graveyard family retains recursion, reanimation, self-mill and resource/payoff evidence", () => {
  const result = dna(dnaFixture(meren, graveyard));
  expect(result.themes[0].id).toBe("graveyard");
  expect(result.themes[0].subthemes.map((t) => t.id)).toEqual(
    expect.arrayContaining([
      "graveyard",
      "recursion",
      "reanimator",
      "self-mill",
      "graveyard-payoff",
    ]),
  );
});
it("tokens/aristocrats links tokens, sacrifice outlets and death payoffs", () => {
  const result = dna(dnaFixture(ghave, aristocrats));
  expect(themeIds(result)).toEqual(
    expect.arrayContaining(["tokens", "sacrifice"]),
  );
  expect(
    result.themes.find((t) => t.id === "sacrifice")!.subthemes.map((t) => t.id),
  ).toEqual(expect.arrayContaining(["death-triggers", "sacrifice-outlet"]));
});
it("incidental Treasure cannot become a displayed major theme and expensive staples are not automatically central", () => {
  const result = dna(dnaFixture(lathliss, [...dragons, incidental]));
  expect(themeIds(result)).not.toContain("treasure");
  expect(cardSynergy(result, dragons[0])!.score).toBeGreaterThan(
    cardSynergy(result, incidental)!.score,
  );
  expect(cardSynergy(result, dragons[0])!.score).toBeGreaterThan(
    cardSynergy(result, sol)!.score,
  );
  expect(cardSynergy(result, dragons[2])!.commanderConnections[0].name).toBe(
    lathliss.name,
  );
  expect(cardSynergy(result, dragons[2])!.recommendation!.commander.score).toBeGreaterThanOrEqual(20);
});
it("Commander influence is capped; the actual deck controls the strategy", () => {
  const result = dna(dnaFixture(lathliss, graveyard));
  expect(result.themes[0].id).toBe("graveyard");
  expect(themeIds(result)).not.toContain("typal:Dragon");
  const withCommander = dna(),
    without = dna(dnaFixture(plainCommander, dragons));
  expect(cardSynergy(withCommander, dragons[0])!.score).toBeGreaterThan(
    cardSynergy(without, dragons[0])!.score,
  );
});
it("changing composition changes DNA and relative Synergy", () => {
  const first = dna(),
    second = dna(dnaFixture(lathliss, [...graveyard, dragons[0], dragons[1]]));
  expect(themeIds(second)[0]).not.toBe(themeIds(first)[0]);
  expect(cardSynergy(second, dragons[0])!.debug.profileRevision).not.toBe(cardSynergy(first, dragons[0])!.debug.profileRevision);
  expect(cardSynergy(second, dragons[0])!.debug.componentReasons).not.toEqual(cardSynergy(first, dragons[0])!.debug.componentReasons);
});
it("missing and owned printings have identical conceptual analysis; prices and source fields are excluded", () => {
  const fixture = dnaFixture();
  const first = dna(fixture);
  const assigned = structuredClone(fixture);
  assigned.state.items = dragons.map((c, i) => ({
    id: `item-${i}`,
    scryfallId: c.scryfallId,
    setCode: c.setCode,
    collectorNumber: c.collectorNumber!,
    quantityOwned: 99,
    quantityAssigned: 1,
    quantityUnassigned: 98,
    finish: "foil",
    language: "en",
    condition: "nm",
    binderName: "Main",
    binderType: "binder",
    sourceRows: [{ Price: "9000" }],
  }));
  assigned.deck.assignments = assigned.state.items.map((i, n) => ({
    itemId: i.id,
    quantity: 1,
    entryId: `entry-${n + 1}`,
  }));
  Object.assign(assigned.state.metadata[dragons[0].scryfallId], {
    prices: { usd: "90000" },
    edhrec_rank: 1,
  });
  expect(dna(assigned)).toEqual(first);
  expect(Object.values(first.cards)).toHaveLength(dragons.length);
});
it("explanations name actual evidence, roles and Commander connections; all scores are bounded with exact signed breakdowns", () => {
  const result = dna();
  const card = cardSynergy(result, dragons[0])!;
  expect(
    card.connections.some((c) =>
      c.signals.some((s) =>
        s.evidence.some((e) => e.snippet.includes("Dragon")),
      ),
    ),
  ).toBe(true);
  expect(
    card.commanderConnections.some((c) =>
      c.evidence.some((e) => e.snippet.includes("Dragon")),
    ),
  ).toBe(true);
  for (const fit of Object.values(result.cards)) {
    expect(fit.score).toBeGreaterThanOrEqual(0);
    expect(fit.score).toBeLessThanOrEqual(100);
    expect(Number.isInteger(fit.score)).toBe(true);
    expect(fit.debug.rawScore).toBe(fit.components.reduce((n,c)=>n+c.points,0));
    expect(fit.explanation).not.toBe("");
  }
});
it("weak/empty decks do not invent a strategy or fill seven themes with incidental labels", () => {
  const empty = dna(dnaFixture(plainCommander, []));
  expect(empty.themes).toEqual([]);
  expect(empty.summary).toContain("not enough");
  expect(empty.core.payoff).toContain("No explicit");
  const sparse = dna(dnaFixture(plainCommander, [incidental]));
  expect(sparse.themes).toEqual([]);
});
it("theme weights are not raw card counts and are stable across input order", () => {
  const f = dnaFixture();
  const original = dna(f);
  f.deck.entries!.reverse();
  expect(dna(f)).toEqual(original);
  const dragon = original.themes.find((t) => t.id === "typal:Dragon")!;
  expect(dragon.percent).not.toBe(
    Math.round((dragon.contributors.length / dragons.length) * 100),
  );
});
it("cache reuses unchanged decks through navigation, sorting, filtering, rename and unrelated inventory changes", () => {
  const compute = vi.fn(analyzeDeckDna),
    cache = new DeckDnaCache(compute),
    f = dnaFixture();
  const first = cache.get(f.state, f.deck);
  for (let i = 0; i < 10; i++) expect(cache.get(f.state, f.deck)).toBe(first);
  f.deck.name = "Renamed";
  f.deck.modifiedAt = "2030-01-01T00:00:00Z";
  f.state.revision++;
  expect(cache.get(f.state, f.deck)).toBe(first);
  const rows = deckRows(f.state, f.deck);
  for (const sort of ["type", "synergy-desc", "synergy-asc"] as const)
    visibleDeckRows(
      rows,
      sort,
      { ...emptyDeckFilters(), theme: first.themes[0].id },
      first,
    );
  expect(compute).toHaveBeenCalledTimes(1);
});
it("cache invalidates for composition, Commander, relevant metadata, manual overrides and ruleset version", () => {
  const compute = vi.fn(analyzeDeckDna),
    cache = new DeckDnaCache(compute),
    f = dnaFixture();
  cache.get(f.state, f.deck);
  f.deck.entries![1].quantity++;
  cache.get(f.state, f.deck);
  f.state.metadata[lathliss.scryfallId] = {
    ...lathliss,
    oracleText: lathliss.oracleText + "\nDraw a card.",
  };
  cache.get(f.state, f.deck);
  f.state.intelligence = {
    auto: {},
    overrides: {
      [dragons[0].oracleId!]: { added: ["ramp"], suppressed: ["typal:Dragon"] },
    },
  };
  cache.get(f.state, f.deck);
  cache.get(f.state, f.deck, "future-ruleset");
  expect(compute).toHaveBeenCalledTimes(5);
});
it("canonical duplicate printings are analyzed once, quantities aggregate with diminishing influence", () => {
  const f = dnaFixture();
  const clone = {
    ...dragons[0],
    scryfallId: "alternate-print",
    setCode: "alt",
  };
  f.state.metadata[clone.scryfallId] = clone;
  f.deck.entries!.push({
    ...f.deck.entries![1],
    id: "alt",
    scryfallId: clone.scryfallId,
  });
  const input = deckDnaInput(f.state, f.deck);
  expect(
    input.cards.filter((c) => c.identity === dragons[0].oracleId),
  ).toHaveLength(1);
  expect(
    input.cards.find((c) => c.identity === dragons[0].oracleId)!.quantity,
  ).toBe(2);
});
it("Synergy sorts and theme filter define the same stable navigable sequence, including missing cards", () => {
  const f = dnaFixture(),
    result = dna(f),
    rows = deckRows(f.state, f.deck);
  const sorted = visibleDeckRows(
      rows,
      "synergy-desc",
      emptyDeckFilters(),
      result,
    ),
    scores = sorted.map((r) => cardSynergy(result, r.card)!.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  const filtered = visibleDeckRows(
    rows,
    "synergy-asc",
    { ...emptyDeckFilters(), theme: "typal:Dragon" },
    result,
  );
  expect(filtered.length).toBeGreaterThan(0);
  expect(
    filtered.every(
      (r) =>
        !r.assigned &&
        cardSynergy(result, r.card)!.connections.some(
          (c) => c.themeId === "typal:Dragon",
        ),
    ),
  ).toBe(true);
});
it("a Commander replacement invalidates cached analysis even if an older commander entry remains", () => {
  const f = dnaFixture(),
    compute = vi.fn(analyzeDeckDna),
    cache = new DeckDnaCache(compute);
  const first = cache.get(f.state, f.deck);
  f.state.metadata[plainCommander.scryfallId] = plainCommander;
  f.deck.commanders = [
    {
      name: plainCommander.name,
      scryfallId: plainCommander.scryfallId,
      cardIdentity: plainCommander.oracleId!,
      colorIdentity: plainCommander.colorIdentity,
    },
  ];
  const next = cache.get(f.state, f.deck);
  expect(compute).toHaveBeenCalledTimes(2);
  expect(next.summary).not.toContain("Lathliss");
  expect(cardSynergy(next, dragons[0])!.score).toBeLessThan(
    cardSynergy(first, dragons[0])!.score,
  );
});
it("legacy assignment-only decks retain conceptual analysis without a schema migration", () => {
  const f = dnaFixture();
  const first = dna(f);
  f.state.items = dragons.map((c, i) => ({
    id: `legacy-${i}`,
    scryfallId: c.scryfallId,
    setCode: c.setCode,
    collectorNumber: c.collectorNumber!,
    quantityOwned: 1,
    quantityAssigned: 1,
    quantityUnassigned: 0,
    finish: "nonfoil",
    language: "en",
    condition: "nm",
    binderName: "Main",
    binderType: "binder",
    sourceRows: [],
  }));
  f.deck.assignments = f.state.items.map((i) => ({
    itemId: i.id,
    quantity: 1,
  }));
  delete f.deck.entries;
  expect(dna(f)).toEqual(first);
});
it("manual suppression changes deck-relative evidence without rewriting universal tags", () => {
  const f = dnaFixture(),
    before = structuredClone(f.state);
  f.state.intelligence = {
    auto: {},
    overrides: {
      [dragons[0].oracleId!]: {
        added: [],
        suppressed: ["typal:Dragon", "tokens", "attack-triggers"],
      },
    },
  };
  const result = dna(f);
  expect(
    cardSynergy(result, dragons[0])!.connections.flatMap((c) =>
      c.signals.map((s) => s.tagId),
    ),
  ).not.toContain("tokens");
  expect(before.metadata).toEqual(f.state.metadata);
});
it("100 distinct canonical cards analyze promptly and an unchanged deck reuses the result", () => {
  const commander = lathliss;
  const main = Array.from({ length: 99 }, (_, i) => ({
    ...dragons[i % dragons.length],
    scryfallId: `performance-print-${i}`,
    oracleId: `performance-card-${i}`,
    name: `Performance Card ${i}`,
  }));
  const f = dnaFixture(commander, main),
    cache = new DeckDnaCache();
  const start = performance.now();
  const result = cache.get(f.state, f.deck);
  const elapsed = performance.now() - start;
  expect(Object.keys(result.cards)).toHaveLength(99);
  expect(elapsed).toBeLessThan(1000);
  expect(cache.get(f.state, f.deck)).toBe(result);
});
it("a few incidental cards in a large deck cannot define its strategy", () => {
  const unrelated = Array.from({ length: 70 }, (_, i) => ({
    ...incidental,
    scryfallId: `vanilla-${i}`,
    oracleId: `vanilla-${i}`,
    name: `Vanilla ${i}`,
    typeLine: "Creature",
    oracleText: "",
    keywords: [],
  }));
  const result = dna(
    dnaFixture(plainCommander, [
      ...unrelated,
      counters[6],
      {
        ...counters[6],
        scryfallId: "other-counter",
        oracleId: "other-counter",
        name: "Other Counter",
      },
    ]),
  );
  expect(themeIds(result)).not.toContain("counters");
  expect(result.summary).toContain("not enough");
});
it("discard costs alone do not imply Graveyard, and life drain alone does not imply sacrifice", () => {
  const cards = Array.from({ length: 4 }, (_, i) => ({
    ...incidental,
    scryfallId: `cost-${i}`,
    oracleId: `cost-${i}`,
    name: `Cost ${i}`,
    typeLine: "Sorcery",
    oracleText:
      "You may discard a card. Each opponent loses 2 life and you gain 2 life.",
  }));
  const result = dna(dnaFixture(plainCommander, cards));
  expect(themeIds(result)).not.toContain("graveyard");
  expect(themeIds(result)).not.toContain("sacrifice");
});
