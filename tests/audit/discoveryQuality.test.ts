// Discovery Quality Audit (evaluation only; not part of the unit suite). Run with:
//   AUDIT_OUT=docs/audit/discovery-quality.json npx vitest run tests/audit/discoveryQuality.test.ts
// Owned pool per deck: real card records from the OTHER decklists in the repository, filtered to this Commander's color
// identity and excluding the deck's own cards. These are cards the collection could hold unassigned to this deck. The
// frozen blind holdout corpus is never used. Nothing here writes to the app; the output is a report.
import { it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { milesFixture } from "../milesFixture";
import { reignOfDragonsFixture } from "../recommendationFixtures";
import { valgavothFixture } from "../valgavothFixture";
import { kwainFixture } from "../kwainFixture";
import { uugguuFixture } from "../uugguuFixture";
import { hurskaFixture } from "../hurskaFixture";
import { brewCandidates, candidateGroups, upgradeFor } from "../../src/upgrades";
import { compareBrew } from "../../src/upgrades/brew";
import { deckCount } from "../../src/decks/decks";
import { deckDnaInput } from "../../src/dna/engine";
import { oracleOf, selectDiscoveries } from "../../src/upgrades/discovery";
import type { Discovery, DiscoveryInput } from "../../src/upgrades/discovery";
import type { CardMetadata, CollectionItem, CollectionState } from "../../src/models/collection";
import type { Deck } from "../../src/models/deck";

type Fixture = { state: CollectionState; deck: Deck };
const DECKS: [string, () => Fixture][] = [
  ["Miles 'Tails' Prower", milesFixture],
  ["Lathliss, Dragon Queen", reignOfDragonsFixture],
  ["Valgavoth, Harrower of Souls", valgavothFixture],
  ["Kwain, Itinerant Meddler", kwainFixture],
  ["Uugguu, the Omniplasm", uugguuFixture],
  ["Hurska Sweet-Tooth", hurskaFixture],
];
const POOL_LIMIT = 350;

/** Items the production selection sees: the same inputs as upgrades/index.ts discoveries(), with explicit guard options. */
function inputsFor(state: CollectionState, deck: Deck): DiscoveryInput[] {
  const brew = brewCandidates(state, deck);
  const complete = deckCount(deck) >= 100;
  return candidateGroups(state, deck).map((group) => ({
    group,
    brew: brew.get(group.identity)!,
    ...(complete ? { upgrade: upgradeFor(state, deck, group.canonical, group.identity) } : {}),
  }));
}
const names = (list: Discovery[]) => list.map((d) => d.group.card.name);
const summary = (d: Discovery, rank: number) => ({
  rank,
  card: d.group.card.name,
  strength: d.strength,
  available: `${d.group.available} of ${d.group.owned}`,
  worksWith: d.worksWith,
  happens: d.happens,
  needs: d.needs,
  change: d.upgrade ? (d.upgrade.best ? `Review swap: cut ${d.upgrade.best.cutName} (${d.upgrade.label})` : "No valid one-for-one cut") : "Add to Deck",
  brewScore: d.brew.score,
  caveats: d.caveats,
});

it("discovery quality audit", () => {
  const report: Record<string, unknown>[] = [];
  for (const [label, make] of DECKS) {
    const f = make();
    const own = new Set(deckDnaInput(f.state, f.deck).cards.map((c) => c.card.name));
    const commander = deckDnaInput(f.state, f.deck).cards.find((c) => c.commander)!;
    const colors = commander.card.colorIdentity;
    // Owned pool from the other decklists: real records, not cards removed from this deck.
    const pool = new Map<string, CardMetadata>();
    for (const [otherLabel, otherMake] of DECKS) {
      if (otherLabel === label) continue;
      for (const card of Object.values(otherMake().state.metadata) as CardMetadata[]) {
        if (own.has(card.name) || pool.has(card.name)) continue;
        if (!card.colorIdentity.every((c: string) => colors.includes(c as never))) continue;
        pool.set(card.name, card);
      }
    }
    const ownedCards = [...pool.values()].sort((a, b) => a.name.localeCompare(b.name, "en")).slice(0, POOL_LIMIT);
    f.state.metadata = { ...f.state.metadata };
    f.state.items = [...f.state.items];
    ownedCards.forEach((card, i) => {
      const id = `pool-${i}`;
      f.state.metadata[card.scryfallId] = card;
      const item: CollectionItem = {
        id, scryfallId: card.scryfallId, setCode: card.setCode || "pool", collectorNumber: card.collectorNumber || "1", finish: "nonfoil",
        language: "EN", condition: "NM", binderName: "Audit binder", binderType: "binder", quantityOwned: 1, quantityAssigned: 0, quantityUnassigned: 1, sourceRows: [],
      };
      f.state.items.push(item);
    });
    const text = new Map(deckDnaInput(f.state, f.deck).cards.map((c) => [c.card.name, oracleOf(c.card)] as const));
    const ownedByName = new Map(ownedCards.map((c) => [c.name, c] as const));
    const cardText = (n: string) => text.get(n) ?? (ownedByName.has(n) ? oracleOf(ownedByName.get(n)!) : undefined);
    const items = inputsFor(f.state, f.deck);
    const production = selectDiscoveries(items, { cardText });
    const noCategory = selectDiscoveries(items, { cardText, sharedRuleLimit: Number.POSITIVE_INFINITY });
    const noCap = selectDiscoveries(items, { cardText, maxPerRule: Number.POSITIVE_INFINITY });
    const unguarded = selectDiscoveries(items, { cardText, sharedRuleLimit: Number.POSITIVE_INFINITY, maxPerRule: Number.POSITIVE_INFINITY });
    const shown = new Set(names(production));
    // Two-factor design, so each guard's effect is measured with the other held fixed:
    //   category filter effect = (no rule cap, category filter off) minus (no rule cap, category filter on)
    //   rule cap effect        = (category filter on, no rule cap) minus (production: both on)
    const capOff = new Set(names(noCap));
    const suppressedByCategory = names(unguarded).filter((n) => !capOff.has(n));
    const suppressedByCap = names(noCap).filter((n) => !shown.has(n));
    // Alternative ordering on the SAME production pool: distinct printed-or-supplied support first, then Brew order.
    // Experiment only. It does not replace Brew scoring.
    const altOrder = [...production].sort(
      (a, b) =>
        (b.group.available > 0 ? 1 : 0) - (a.group.available > 0 ? 1 : 0) ||
        ({ "Strongly supported": 0, Plausible: 1, Speculative: 2 } as const)[a.strength] - ({ "Strongly supported": 0, Plausible: 1, Speculative: 2 } as const)[b.strength] ||
        b.worksWith.length - a.worksWith.length ||
        compareBrew({ brew: a.brew, name: a.group.card.name }, { brew: b.brew, name: b.group.card.name }),
    );
    const top = production.slice(0, 10);
    const altTop = altOrder.slice(0, 10);
    const overlap = names(top).filter((n) => names(altTop).includes(n)).length;
    report.push({
      deck: label,
      deckCards: deckCount(f.deck),
      complete: deckCount(f.deck) >= 100,
      owned: items.length,
      ownedAvailable: items.filter((i) => i.group.available > 0).length,
      discoverable: { production: production.length, noCategoryFilter: noCategory.length, noRuleCap: noCap.length, unguarded: unguarded.length },
      suppressedByCategoryFilter: suppressedByCategory.map((n) => summary(unguarded.find((d) => d.group.card.name === n)!, 0)),
      suppressedByRuleCap: suppressedByCap.map((n) => summary(noCap.find((d) => d.group.card.name === n)!, 0)),
      top10: top.map((d, i) => summary(d, i + 1)),
      alternativeTop10: altTop.map((d, i) => ({ rank: i + 1, card: d.group.card.name, strength: d.strength, brewScore: d.brew.score })),
      alternativeOverlapAt10: overlap,
    });
  }
  const out = process.env.AUDIT_OUT ?? "docs/audit/discovery-quality.json";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 1));
}, 600_000);
