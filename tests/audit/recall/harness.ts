import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { normalizeCard } from "../../../src/import/scryfall";
import type { CardMetadata } from "../../../src/models/collection";
import type { FixedDeck, FailureReview } from "./model";
import { classificationCounts, precisionBounds } from "./model";
import { dnaFixture } from "../../dnaFixtures";
import { synergyFixture } from "../../synergyFixtures";
import {
  candidateGroups,
  brewCandidates,
  currentDeckModel,
  analysisConfidence,
} from "../../../src/upgrades";
import { deckDnaCache } from "../../../src/dna/engine";
import { deckCardFunction } from "../../../src/upgrades/cardFunction";
import { extractCardFacts } from "../../../src/synergy/facts";
import { analyze, cardIdentity } from "../../../src/intelligence/tagger";
import { legalInDeck, deckPlayable } from "../../../src/decks/decks";

const base = new URL("./", import.meta.url);
const json = <T>(path: string) =>
  JSON.parse(readFileSync(new URL(path, base), "utf8")) as T;
export const fixedDecks = json<FixedDeck[]>("fixed-decks.json");
export const fixedCandidates = json<string[]>("fixed-candidates.json");
const raw = json<Parameters<typeof normalizeCard>[0][]>("cards.scryfall.json");
export const rejectedSnapshots: { name: string; error: string }[] = [];
export const cards = raw.flatMap((c) => {
  try {
    return [normalizeCard({ ...c, object: "card" })];
  } catch (error) {
    rejectedSnapshots.push({ name: c.name, error: String(error) });
    return [];
  }
});
const key = (name: string) =>
  name.replaceAll("’", "'").trim().toLocaleLowerCase("en");
const aliases = new Map<string, CardMetadata>();
for (const c of cards)
  for (const name of [c.name, ...(c.cardFaces || []).map((f) => f.name)])
    aliases.set(key(name), c);
export const findCard = (name: string) => aliases.get(key(name));
export function coverage(deck: FixedDeck) {
  const required = [
    ...new Set([
      ...deck.cards.map((r) => r.name),
      ...deck.obvious,
      ...deck.hidden,
      ...deck.traps,
      ...fixedCandidates,
    ]),
  ];
  return {
    deck: deck.id,
    required: required.length,
    missingOracle: required.filter((n) => !findCard(n)),
    ready: required.every((n) => !!findCard(n)),
  };
}
export function runDeck(deck: FixedDeck) {
  const source = coverage(deck);
  if (!source.ready)
    return {
      ...source,
      status: "blocked-missing-canonical-fixtures" as const,
      metrics: null,
      missed: [],
      candidates: [],
    };
  const commander = findCard(deck.commander)!;
  const f = dnaFixture(
    commander,
    deck.cards.filter((r) => !r.commander).map((r) => findCard(r.name)!),
  );
  for (const entry of f.deck.entries || []) {
    const row = deck.cards.find((r) => key(r.name) === key(entry.name));
    if (row) entry.quantity = row.quantity;
  }
  f.deck.name = deck.id;
  const owned = synergyFixture().owned;
  for (const c of cards) f.state.metadata[c.scryfallId] = c;
  for (const name of fixedCandidates) {
    const c = findCard(name)!;
    f.state.items.push(owned(c, "research:" + c.scryfallId, 1));
  }
  const groups = candidateGroups(f.state, f.deck),
    results = brewCandidates(f.state, f.deck),
    model = currentDeckModel(f.state, f.deck);
  const ranking = groups
    .map((g) => ({
      name: g.card.name,
      identity: g.identity,
      brew: results.get(g.identity)!,
    }))
    .sort(
      (a, b) =>
        b.brew.score - a.brew.score ||
        b.brew.synergy - a.brew.synergy ||
        a.name.localeCompare(b.name, "en"),
    );
  const positions = new Map(ranking.map((r, i) => [key(r.name), i + 1]));
  const top20 = ranking.slice(0, 20).map((r) => ({
    ...r,
    provisionalLabel: deck.hidden.some((n) => key(n) === key(r.name))
      ? ("Excellent contextual fit" as const)
      : deck.obvious.some((n) => key(n) === key(r.name))
        ? ("Good obvious fit" as const)
        : deck.traps.some((n) => key(n) === key(r.name))
          ? ("False positive" as const)
          : null,
  }));
  const expected = [
    ...deck.obvious.map((name) => ({ name, kind: "obvious" })),
    ...deck.hidden.map((name) => ({ name, kind: "hidden" })),
    ...deck.traps.map((name) => ({ name, kind: "trap" })),
  ].map((row) => {
    const c = findCard(row.name)!;
    const generated = groups.some((g) => g.identity === cardIdentity(c));
    const fn = deckCardFunction(c, model.supply),
      facts = extractCardFacts(c);
    const conditionReport = (fn.conditions || []).map((x) => ({
      ...x,
      support:
        x.factor >= 1
          ? "High"
          : x.factor >= 0.5
            ? "Medium"
            : x.factor > 0
              ? "Low"
              : "None",
      engineWeightedSupply: x.supply,
      eligibleMainDeckCopies: deck.cards
        .filter(
          (r) =>
            !r.commander &&
            x.suppliers.some(
              (name) => key(name) === key(findCard(r.name)!.name),
            ),
        )
        .reduce((n, r) => n + r.quantity, 0),
      mainDeckCopies: deck.cards
        .filter((r) => !r.commander)
        .reduce((n, r) => n + r.quantity, 0),
      commanderFeeders: deck.cards
        .filter(
          (r) =>
            r.commander &&
            x.suppliers.some(
              (name) => key(name) === key(findCard(r.name)!.name),
            ),
        )
        .map((r) => r.name),
      candidateSelfSetup: x.suppliers.filter(
        (name) =>
          !deck.cards.some((r) => key(name) === key(findCard(r.name)!.name)),
      ),
    }));
    const reason = generated
      ? null
      : !legalInDeck(c, f.deck)
        ? "commander-color-identity"
        : !deckPlayable(c)
          ? "non-playable-layout-or-type"
          : deck.cards.some(
                (r) => cardIdentity(findCard(r.name)!) === cardIdentity(c),
              )
            ? "already-in-deck"
            : "owned-grouping-or-filter";
    return {
      deck: deck.id,
      candidate: row.name,
      kind: row.kind,
      generated,
      exclusionReason: reason,
      rank: positions.get(key(c.name)) || null,
      hit: (positions.get(key(c.name)) || Infinity) <= 20,
      oracle: c.oracleText || c.cardFaces?.map((f) => f.oracleText).join("\n"),
      typeLine: c.typeLine,
      layout: c.layout,
      roles: fn.roles,
      conditions: conditionReport,
      intelligence: analyze(c).assignments,
      facts,
      uncertainties: fn.uncertainties,
      confidence: fn.confidence,
    };
  });
  const hitRate = (kind: string) => {
    const rows = expected.filter((e) => e.kind === kind);
    return rows.filter((e) => e.hit).length / rows.length;
  };
  return {
    ...source,
    status: "evaluated" as const,
    metrics: {
      obviousRecall: hitRate("obvious"),
      hiddenRecall: hitRate("hidden"),
      trapRejection: 1 - hitRate("trap"),
      precisionAt10: precisionBounds(
        top20.slice(0, 10).map((r) => r.provisionalLabel),
        10,
      ),
      precisionAt20: precisionBounds(
        top20.map((r) => r.provisionalLabel),
        20,
      ),
    },
    missed: expected.filter((r) => r.kind !== "trap" && !r.hit),
    expected,
    candidates: top20,
    uncertainty: analysisConfidence(f.state, f.deck),
    themes: deckDnaCache.get(f.state, f.deck).themes.map((t) => ({
      id: t.id,
      percent: t.percent,
      contributors: t.contributors,
    })),
  };
}
export function runCorpus(reviews: FailureReview[] = []) {
  const results = fixedDecks.map(runDeck),
    missed = results.flatMap((r) => r.missed);
  return {
    baseline: "0f90fff",
    engine:
      "production v0.6.14; original prototype metrics are not substituted",
    snapshotHashes: Object.fromEntries(
      ["fixed-candidates.json", "fixed-decks.json", "cards.scryfall.json"].map(
        (file) => [
          file,
          createHash("sha256")
            .update(readFileSync(new URL(file, base)))
            .digest("hex"),
        ],
      ),
    ),
    corpusHash: createHash("sha256")
      .update(readFileSync(new URL("fixed-expectations.json", base)))
      .digest("hex"),
    candidatePool: fixedCandidates.length,
    canonicalSnapshots: cards.length,
    rejectedSnapshots,
    evaluated: results.filter((r) => r.status === "evaluated").length,
    total: results.length,
    metricsValid: results.every((r) => r.status === "evaluated"),
    classification: results.every((r) => r.status === "evaluated")
      ? classificationCounts(missed, reviews)
      : null,
    results,
    precisionNote:
      "Expected labels are provisional author-curated labels. Unreviewed candidates are null, not successes. No independent human precision claim.",
  };
}
