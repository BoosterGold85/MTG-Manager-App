// Engine outputs captured from v0.6.6 (09b82e3) before the v0.6.7 UI refactor; they must not drift.
// Regenerate only for an intentional, reviewed scoring change. Reviewed changes so far:
//   v0.6.8  Utvara Hellkite gained attack-token finisher credit: three near-tie alternative cuts reordered.
//   v0.6.10 The Elder Dragon War reads as card draw + tokens: Reign best cuts move from Chain Reaction to
//           Hit the Mother Lode; values within ±0.03, labels unchanged. Drakuseth now counts as removal, so
//           Vandalblast's Reign value moves 0.25 → 0.18 (still Minor Upgrade).
//   v0.6.12 Mana sources costing 5 count as 0.7 ramp (6+ as 0.4), and planeswalker ultimates beyond starting
//           loyalty no longer count: the Artifact case's 5-mana rocks count for less, so its two cheap mana
//           candidates rise 0.38 → 0.46 (Minor → Moderate) and 0.19 → 0.27. Nothing else moved.
//   v0.6.12 Deck-relative conditions and deck-derived targets: Landfall's two candidates rise (its payoffs have
//           few lands to feed them); Reign values move ≤ 0.02 and three best cuts become Chandra's Ignition;
//           synthetic cases move ≤ 0.1; the blink case's Generic Fight now has a valid (Downgrade) cut.
import { expect, it } from "vitest";
import { reignOfDragonsFixture, canonicalFactsCards } from "../recommendationFixtures";
import { synergyFixture } from "../synergyFixtures";
import { candidates } from "../upgradeCandidates";
import { archetypeCases } from "../scoringFixtures";
import { buildAroundCommander, improveCurrentDeck } from "../../src/upgrades";
import type { CollectionState } from "../../src/models/collection";
import type { Deck } from "../../src/models/deck";

function outputs(state: CollectionState, deck: Deck) {
  return {
    build: buildAroundCommander(state, deck).map((c) => ({
      identity: c.identity,
      name: c.card.name,
      commanderFit: c.build.commanderFit,
      fitLabel: c.build.fitLabel,
      buildPriority: c.build.buildPriority,
      priorityLabel: c.build.priorityLabel,
      confidence: c.build.confidence,
    })),
    improve: improveCurrentDeck(state, deck).map((c) => ({
      identity: c.identity,
      upgradeValue: c.upgrade.upgradeValue,
      label: c.upgrade.label,
      best: c.upgrade.best?.cutName ?? null,
      alternatives: c.upgrade.alternatives.map((a) => a.cutName),
      confidence: c.upgrade.confidence,
    })),
  };
}
export function goldenOutputs() {
  const reign = reignOfDragonsFixture(), owned = synergyFixture().owned;
  for (const card of [...Object.values(candidates), ...canonicalFactsCards]) {
    reign.state.metadata[card.scryfallId] = card;
    reign.state.items.push(owned(card, card.scryfallId, 1));
  }
  const result: Record<string, ReturnType<typeof outputs>> = { "Reign of Dragons": outputs(reign.state, reign.deck) };
  for (const a of archetypeCases) {
    const f = a.fixture();
    for (const card of [a.support, a.weak]) {
      if (f.state.items.some((i) => i.scryfallId === card.scryfallId)) continue;
      f.state.metadata[card.scryfallId] = card;
      f.state.items.push(owned(card, card.scryfallId, 1));
    }
    result[a.name] = outputs(f.state, f.deck);
  }
  return result;
}
it("Upgrades I Own engine output matches the reviewed golden fixture", async () => {
  await expect(JSON.stringify(goldenOutputs(), null, 1)).toMatchFileSnapshot("../golden/upgrades-v0.6.6.json");
});
