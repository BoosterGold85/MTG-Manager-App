import { it, expect } from "vitest";
import { synergyFixture } from "../synergyFixtures";
import { exploreSynergy } from "../../src/synergy/explorer";
import {
  candidateScorer,
  cardSynergy,
  deckDnaCache,
  deckDnaInput,
} from "../../src/dna/engine";
import { validateState } from "../../src/storage/collectionRepository";
import { cardIdentity } from "../../src/intelligence/tagger";
it("groups printings and finishes, sums physical availability and labels other-deck usage", () => {
  const f = synergyFixture();
  validateState(f.state);
  const candidates = exploreSynergy(f.state, f.deck);
  expect(candidates.map((c) => c.card.name)).toEqual([
    "Utvara Hellkite",
    "Quiet Owned Card",
  ]);
  const c = candidates[0];
  expect(c.owned).toBe(3);
  expect(c.available).toBe(2);
  expect(c.printings).toHaveLength(2);
  expect(c.card.scryfallId).toBe(f.alternate.scryfallId);
  expect(c.usage).toEqual([{ id: "other-deck", name: "Miirym", quantity: 1 }]);
  expect(c.synergy.score).toBeGreaterThan(45);
  expect(c.synergy.connections.some((c) => c.themeId === "typal:Dragon")).toBe(
    true,
  );
});
it("fully assigned strong candidates remain visible below available cards without changing scores", () => {
  const f = synergyFixture();
  const before = exploreSynergy(f.state, f.deck).find(
    (c) => c.card.name === "Utvara Hellkite",
  )!;
  f.state.items = f.state.items.filter((i) => i.id !== "utvara-foil");
  const after = exploreSynergy(f.state, f.deck);
  expect(after[0].card.name).toBe("Quiet Owned Card");
  expect(after[1].available).toBe(0);
  expect(after[1].synergy).toEqual(before.synergy);
});
it("excludes zero ownership, off-identity cards, all missing deck entries, commander and alternate printings of existing cards", () => {
  const f = synergyFixture();
  for (const c of [
    f.state.metadata[f.deck.entries![1].scryfallId],
    f.state.metadata[f.deck.commanders[0].scryfallId],
  ]) {
    const owned = {
      ...c,
      colorIdentity: ["R"] as typeof c.colorIdentity,
      scryfallId: c.scryfallId + "-alternate",
    };
    f.state.metadata[owned.scryfallId] = owned;
    f.state.items.push(f.owned(owned, owned.scryfallId, 1));
  }
  const names = exploreSynergy(f.state, f.deck).map((c) => c.card.name);
  expect(names).toEqual(["Utvara Hellkite", "Quiet Owned Card"]);
});
it("uses color_identity subset including colorless, with mono, two and five-color commanders", () => {
  const f = synergyFixture();
  f.deck.commanders[0].colorIdentity = [];
  expect(exploreSynergy(f.state, f.deck).map((c) => c.card.name)).toEqual([
    "Quiet Owned Card",
  ]);
  f.deck.commanders[0].colorIdentity = ["U", "R"];
  expect(exploreSynergy(f.state, f.deck).map((c) => c.card.name)).toContain(
    "Blue Excluded",
  );
  f.deck.commanders[0].colorIdentity = ["W", "U", "B", "R", "G"];
  expect(exploreSynergy(f.state, f.deck)).toHaveLength(3);
});
it("shares exactly the existing deck-card scores against frozen DNA rather than adding candidates to the deck", () => {
  const f = synergyFixture(),
    dna = deckDnaCache.get(f.state, f.deck),
    score = candidateScorer(f.state, f.deck, dna);
  for (const c of deckDnaInput(f.state, f.deck).cards.filter(
    (c) => !c.commander,
  ))
    expect(score(c.card)).toEqual(cardSynergy(dna, c.card));
  const before = structuredClone(dna);
  exploreSynergy(f.state, f.deck);
  expect(deckDnaCache.get(f.state, f.deck)).toEqual(before);
});
it("is deterministic and read-only across collection, source fields, assignments and existing decks", () => {
  const f = synergyFixture(),
    before = structuredClone(f.state);
  expect(exploreSynergy(f.state, f.deck)).toEqual(
    exploreSynergy(f.state, f.deck),
  );
  expect(f.state).toEqual(before);
});
it("excludes canonical alternate printings even if an older deck entry lacks an oracle ID", () => {
  const f = synergyFixture();
  const card = { ...f.candidate, oracleId: undefined, scryfallId: "old-print" };
  f.state.metadata[card.scryfallId] = card;
  f.deck.entries!.push({
    id: "old-entry",
    board: "main",
    quantity: 1,
    name: card.name,
    cardIdentity: cardIdentity(card),
    scryfallId: card.scryfallId,
  });
  expect(exploreSynergy(f.state, f.deck).map((c) => c.card.name)).not.toContain(
    card.name,
  );
});
it("manual tag suppression changes candidate evidence without changing the deck DNA", () => {
  const f = synergyFixture(),
    before = exploreSynergy(f.state, f.deck)[0],
    dna = deckDnaCache.get(f.state, f.deck);
  f.state.intelligence = {
    auto: {},
    overrides: {
      [cardIdentity(f.candidate)]: {
        added: [],
        suppressed: before.synergy.connections.flatMap((c) =>
          c.signals.map((s) => s.tagId),
        ),
      },
    },
  };
  const after = exploreSynergy(f.state, f.deck).find(
    (c) => c.card.name === f.candidate.name,
  )!;
  expect(after.synergy.score).toBeLessThan(before.synergy.score);
  expect(deckDnaCache.get(f.state, f.deck)).toBe(dna);
});
it("legacy assignment-only decks exclude their assigned canonical cards", () => {
  const f = synergyFixture();
  f.deck.entries = undefined;
  f.deck.assignments = [{ itemId: "utvara-owned", quantity: 1 }];
  expect(exploreSynergy(f.state, f.deck).map((c) => c.card.name)).not.toContain(
    "Utvara Hellkite",
  );
});
it("returns an empty result for an empty collection", () => {
  const f = synergyFixture();
  f.state.items = [];
  expect(exploreSynergy(f.state, f.deck)).toEqual([]);
});
it("ranks 4421 distinct owned candidates deterministically without network or writes", () => {
  const f = synergyFixture();
  f.state.items = [];
  for (let i = 0; i < 4421; i++) {
    const card = {
      ...f.utility,
      scryfallId: `large-${i}`,
      oracleId: `large-${i}`,
      name: `Owned ${String(i).padStart(5, "0")}`,
    };
    f.state.metadata[card.scryfallId] = card;
    f.state.items.push(f.owned(card, card.scryfallId, 1));
  }
  const start = performance.now(),
    candidates = exploreSynergy(f.state, f.deck);
  expect(candidates).toHaveLength(4421);
  expect(candidates[0].card.name).toBe("Owned 00000");
  expect(performance.now() - start).toBeLessThan(5000);
});

it("changing which printing is available does not substitute weaker metadata into candidate scoring", () => {
  const f = synergyFixture();
  f.state.metadata[f.alternate.scryfallId] = {
    ...f.alternate,
    oracleText: "",
    keywords: [],
  };
  const before = exploreSynergy(f.state, f.deck).find(
    (c) => c.card.name === f.candidate.name,
  )!;
  f.state.items.find((i) => i.id === "utvara-owned")!.quantityAssigned = 0;
  f.state.items.find((i) => i.id === "utvara-owned")!.quantityUnassigned = 1;
  const after = exploreSynergy(f.state, f.deck).find(
    (c) => c.card.name === f.candidate.name,
  )!;
  expect(after.synergy).toEqual(before.synergy);
  expect(after.synergy.score).toBeGreaterThan(45);
});
