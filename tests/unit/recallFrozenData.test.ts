import { it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { findCard, coverage, fixedDecks } from "../audit/recall/harness";
import { parsePublicDeck } from "../audit/recall/archidekt";
import { classificationCounts, PRECISION_LABELS } from "../audit/recall/model";
const root = new URL("../audit/recall/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root));
const sha = (raw: Uint8Array) => createHash("sha256").update(raw).digest("hex");
it("freezes canonical data and resolves all 151 previously missing names without network", () => {
  const frozen = JSON.parse(read("capture-completion.json").toString());
  expect(sha(read(frozen.canonicalFile))).toBe(frozen.canonicalSha256);
  expect(frozen.previouslyMissingNames).toHaveLength(151);
  for (const name of frozen.previouslyMissingNames)
    expect(findCard(name), name).toBeDefined();
  for (const d of fixedDecks) expect(coverage(d).ready).toBe(true);
});
it("never resolves a standalone spell to another card’s prepared spell face", () => {
  expect(findCard("Reanimate")!.name).toBe("Reanimate");
  expect(findCard("Reanimate")!.manaValue).toBe(1);
  expect(findCard("Rampant Growth")!.name).toBe("Rampant Growth");
  expect(findCard("Grave Researcher // Reanimate")!.oracleId).not.toBe(
    findCard("Reanimate")!.oracleId,
  );
});
it("checks all seven raw public holdout hashes and explicit 100-card boards offline", () => {
  const fetch = vi.fn(() => {
    throw new Error("Network is forbidden in frozen validation");
  });
  vi.stubGlobal("fetch", fetch);
  try {
    const manifest = JSON.parse(read("holdouts/manifest.json").toString());
    const frozen = JSON.parse(read("capture-completion.json").toString());
    const plans = manifest.decks.map(
      (d: { id: string; commander: string; source: string; expectation: string }) =>
        [d.id, d.commander, d.source, d.expectation],
    );
    expect(sha(Buffer.from(JSON.stringify(plans)))).toBe(
      frozen.publicHoldoutPlansHash,
    );
    for (const deck of manifest.decks) {
      const raw = read(deck.rawFile);
      expect(sha(raw)).toBe(deck.sha256);
      expect(
        parsePublicDeck(JSON.parse(raw.toString()), deck.commander).total,
      ).toBe(100);
    }
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
it("keeps failure and precision judgments complete, explicit and separate from scoring inputs", () => {
  const failures = JSON.parse(
    read("reviews/failure-classification.json").toString(),
  );
  expect(failures.reviews).toHaveLength(29);
  const counts = classificationCounts(
    failures.reviews.map((r: { deck: string; candidate: string }) => ({
      deck: r.deck,
      candidate: r.candidate,
    })),
    failures.reviews,
  );
  expect(counts.reviewed).toBe(29);
  expect(counts.pending).toEqual([]);
  const precision = JSON.parse(
    read("reviews/precision-review.json").toString(),
  );
  expect(precision.reviews).toHaveLength(240);
  const unique = new Set<string>();
  for (const row of precision.reviews) {
    expect(PRECISION_LABELS).toContain(row.label);
    expect(row.rationale.length).toBeGreaterThan(20);
    unique.add(JSON.stringify([row.deck, row.candidate]));
  }
  expect(unique.size).toBe(240);
});
