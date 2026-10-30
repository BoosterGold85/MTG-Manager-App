import { it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { holdoutDecks, holdoutFixture } from "../holdoutFixture";
import { cards } from "./recall/harness";
import { synergyFixture } from "../synergyFixtures";
import { currentDeckModel, brewCandidates } from "../../src/upgrades";
import { deckPlayable, deckCount } from "../../src/decks/decks";

it("measures local production analysis at 1,000 / 4,000 / 6,000 candidate identities", () => {
  const templates = cards.filter(deckPlayable);
  const results = [];
  for (const size of [1000, 4000, 6000]) {
    const f = holdoutFixture(holdoutDecks.find((d) => d.id === "H5")!);
    const basic = f.deck.entries!.find((e) => e.name === "Forest")!;
    basic.quantity += 100 - deckCount(f.deck);
    expect(deckCount(f.deck)).toBe(100);
    const owned = synergyFixture().owned;
    for (let i = 0; i < size; i++) {
      const original = templates[i % templates.length],
        name = `${original.name} [benchmark ${size}-${i}]`;
      const card = {
        ...original,
        name,
        scryfallId: `benchmark-print-${size}-${i}`,
        oracleId: `benchmark-oracle-${size}-${i}`,
        oracleText: original.oracleText?.replaceAll(original.name, name),
      };
      f.state.metadata[card.scryfallId] = card;
      f.state.items.push(owned(card, card.scryfallId, 1));
    }
    const before = process.memoryUsage();
    let start = performance.now();
    currentDeckModel(f.state, f.deck);
    const profileMs = performance.now() - start;
    start = performance.now();
    const cold = brewCandidates(f.state, f.deck);
    const coldMs = performance.now() - start;
    expect(cold.size).toBe(size);
    start = performance.now();
    const warm = brewCandidates(f.state, f.deck);
    const warmMs = performance.now() - start;
    expect(warm).toBe(cold);
    const after = process.memoryUsage();
    results.push({
      candidates: size,
      deckCards: 100,
      profileBuildMs: profileMs,
      coldAnalysisMs: coldMs,
      warmAnalysisMs: warmMs,
      cacheHit: "same result map instance; no reanalysis",
      heapBefore: before.heapUsed,
      heapAfter: after.heapUsed,
      rssBefore: before.rss,
      rssAfter: after.rss,
    });
  }
  const report = {
    baseline: "0f90fff",
    method:
      "Sequential isolated Node test; synthetic 100-card Kenrith benchmark deck, filled with basics. Each size uses fresh candidate identities and names; the deck profile may reuse global fact caches. Distinct candidate identities cycle stored real Oracle templates; names/IDs changed only to exercise unique cache entries. No claim of 6,000 different real Oracle cards or phone performance.",
    oracleTemplates: templates.length,
    node: process.version,
    results,
  };
  if (process.env.RECALL_PERF_OUT)
    writeFileSync(
      process.env.RECALL_PERF_OUT,
      JSON.stringify(report, null, 2) + "\n",
    );
}, 300000);
