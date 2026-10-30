import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { classificationCounts, precisionBounds } from "../audit/recall/model";
import {
  coverage,
  fixedDecks,
  fixedCandidates,
  runDeck,
} from "../audit/recall/harness";
import { candidateGroups } from "../../src/upgrades";
import { dnaFixture } from "../dnaFixtures";
import { brewCard } from "../brewFixture";
import { synergyFixture } from "../synergyFixtures";
import type { CardMetadata } from "../../src/models/collection";
import { normalizeCard } from "../../src/import/scryfall";
import holdout from "../data/holdout-cards.json" with { type: "json" };

const rawCard = (name: string) => {
  const c = holdout.find((c) => c.name === name)!;
  expect(c).toBeDefined();
  return normalizeCard({ ...c, object: "card" } as unknown as Parameters<
    typeof normalizeCard
  >[0]);
};
const source = new URL("../audit/recall/", import.meta.url);

describe("recall audit integrity", () => {
  it("preserves the frozen candidate pool, expectations and complete original 100-card deck fixtures", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("holdouts/manifest.json", source), "utf8"),
    );
    for (const [file, digest] of Object.entries(manifest.frozenResearchInputs))
      expect(
        createHash("sha256")
          .update(readFileSync(new URL(file, source)))
          .digest("hex"),
      ).toBe(digest);
    expect(fixedDecks).toHaveLength(12);
    expect(fixedCandidates).toHaveLength(379);
    for (const d of fixedDecks) {
      expect(d.cards.reduce((n, r) => n + r.quantity, 0)).toBe(100);
      expect(d.obvious).toHaveLength(2);
      expect(d.hidden).toHaveLength(2);
      expect(d.traps).toHaveLength(2);
    }
  });
  it("does not convert unavailable canonical fixture data into misses or precision", () => {
    const original = fixedDecks[0];
    const unavailable = {
      ...original,
      cards: original.cards.map((row, index) =>
        index === 1
          ? { ...row, name: "Unresolvable canonical audit sentinel" }
          : row,
      ),
    };
    expect(coverage(unavailable).ready).toBe(false);
    const report = runDeck(unavailable);
    expect(report.status).toBe("blocked-missing-canonical-fixtures");
    expect(report.metrics).toBeNull();
    expect(report.missed).toEqual([]);
  });
  it("requires exactly one primary classification with rationale/evidence and rejects duplicate or unrelated reviews", () => {
    const missed = [
      { deck: "counters", candidate: "A" },
      { deck: "blink", candidate: "B" },
    ];
    const review = {
      ...missed[0],
      primary: "D" as const,
      rationale: "Actual source was excluded",
      evidence: ["named feeder + Oracle clause"],
    };
    const r = classificationCounts(missed, [review]);
    expect(r.counts.D).toBe(1);
    expect(r.percentages.D).toBe(0.5);
    expect(r.pending).toEqual([missed[1]]);
    expect(() => classificationCounts(missed, [review, review])).toThrow(
      "Duplicate",
    );
    expect(() =>
      classificationCounts(missed, [{ ...review, candidate: "C" }]),
    ).toThrow("out-of-corpus");
    expect(() =>
      classificationCounts(missed, [{ ...review, rationale: "" }]),
    ).toThrow("rationale");
  });
  it("reports precision bounds and review coverage rather than counting unreviewed cards as successes", () => {
    const r = precisionBounds(
      [
        "Excellent contextual fit",
        "Good obvious fit",
        "Interesting / debatable",
        "Weak",
        "False positive",
        null,
        null,
        null,
        null,
        null,
      ],
      10,
    );
    expect(r).toMatchObject({
      lower: 0.2,
      upper: 0.7,
      reviewed: 5,
      pending: 5,
      pointEstimate: null,
    });
    expect(precisionBounds(["Good obvious fit", "Weak"], 2).pointEstimate).toBe(
      0.5,
    );
  });
  it("retains user-provided holdout expectations and requires a real snapshot/hash before capture is complete", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("holdouts/manifest.json", source), "utf8"),
    );
    expect(manifest.decks).toHaveLength(7);
    expect(manifest.legacyDecks).toHaveLength(4);
    for (const legacy of manifest.legacyDecks)
      for (const snapshot of legacy.snapshots)
        expect(
          createHash("sha256")
            .update(readFileSync(new URL(snapshot.rawFile, source)))
            .digest("hex"),
        ).toBe(snapshot.sha256);
    for (const d of manifest.decks) {
      expect(d.expectation.length).toBeGreaterThan(60);
      expect(d.source).toMatch(
        /^https:\/\/archidekt\.com\/api\/decks\/\d+\/\?format=json$/,
      );
      if (d.rawFile) {
        expect(
          createHash("sha256")
            .update(readFileSync(new URL(d.rawFile, source)))
            .digest("hex"),
        ).toBe(d.sha256);
      } else expect(d.sha256).toBeNull();
    }
  });
});

describe("candidate generation coverage through the actual production grouper", () => {
  function fixture(candidates: CardMetadata[]) {
    const f = dnaFixture(brewCard("Vorel of the Hull Clade"), []);
    f.deck.commanders[0].colorIdentity = ["W", "U", "B", "R", "G"];
    for (const c of candidates) {
      f.state.metadata[c.scryfallId] = c;
      f.state.items.push(synergyFixture().owned(c, c.scryfallId, 1));
    }
    return f;
  }
  it.each([
    "Sol Ring",
    "Forest",
    "Lightning Greaves",
    "Rancor",
    "Skysovereign, Consul Flagship",
    "Fire // Ice",
    "Arlinn, the Pack's Hope // Arlinn, the Moon's Fury",
  ])("evaluates an owned legal real-card candidate: %s", (name) => {
    const c = rawCard(name),
      f = fixture([c]);
    expect(candidateGroups(f.state, f.deck).map((g) => g.card.name)).toContain(
      c.name,
    );
  });
  it.each(["modal_dfc", "adventure", "transform", "split"])(
    "does not blacklist the %s layout (structural gate fixture, not a semantic claim)",
    (layout) => {
      const c = { ...brewCard("Mind Stone"), layout };
      const f = fixture([c]);
      expect(candidateGroups(f.state, f.deck)).toHaveLength(1);
    },
  );
  it("groups alternate printings canonically; excludes unowned, in-deck, non-playable and off-identity cards without hiding colorless", () => {
    const c = brewCard("Mind Stone"),
      alternate = { ...c, scryfallId: "alternate-print", setCode: "alt" };
    const blue = brewCard("Counterspell");
    const token = {
      ...c,
      scryfallId: "token",
      oracleId: "token",
      layout: "token",
      name: "Token",
    };
    const f = fixture([c, alternate, blue, token]);
    f.deck.commanders[0].colorIdentity = [];
    const zero = brewCard("Arcane Signet");
    f.state.metadata[zero.scryfallId] = zero;
    f.state.items.push(synergyFixture().owned(zero, zero.scryfallId, 0));
    const groups = candidateGroups(f.state, f.deck);
    expect(groups).toHaveLength(1);
    expect(groups[0].printings).toHaveLength(2);
    f.deck.entries!.push({
      id: "existing",
      name: c.name,
      cardIdentity: c.oracleId!,
      scryfallId: c.scryfallId,
      board: "main",
      quantity: 1,
      sourceLines: [],
    });
    // A fresh state/deck object emulates the production revision boundary.
    expect(
      candidateGroups({ ...f.state }, { ...f.deck, modifiedAt: "changed" }),
    ).toHaveLength(0);
  });
});
