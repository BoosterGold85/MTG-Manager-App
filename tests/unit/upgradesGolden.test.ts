// v0.6.7 is a UX pass: these engine outputs were captured from v0.6.6 (09b82e3) before any UI refactor
// and must not drift. Regenerate only for an intentional, reviewed scoring change (v0.6.8: Utvara Hellkite gained
// attack-token finisher credit, shifting three near-tie alternative cuts; values, labels, best cuts and order unchanged).
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
