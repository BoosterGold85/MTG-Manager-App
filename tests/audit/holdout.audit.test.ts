// Engine-agnosticism audit: runs unseen holdout and adversarial decks and checks the pre-registered expectations.
// Not part of the unit suite: npx vitest run tests/audit/holdout.audit.test.ts [AUDIT_OUT=report.json]
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { holdoutDecks, holdoutFixture, holdoutPool } from "../holdoutFixture";
import { synergyFixture } from "../synergyFixtures";
import { deckDnaCache } from "../../src/dna/engine";
import { analysisConfidence, deckHealth, improveCurrentDeck, commanderBlueprint } from "../../src/upgrades";

it("holdout and adversarial decks", () => {
  const owned = synergyFixture().owned;
  const report = holdoutDecks.map((d) => {
    const f = holdoutFixture(d);
    for (const c of holdoutPool) {
      f.state.metadata[c.scryfallId] = c;
      f.state.items.push(owned(c, c.scryfallId, 1));
    }
    const dna = deckDnaCache.get(f.state, f.deck);
    const themes = dna.themes.filter((t) => t.percent > 0).map((t) => ({ id: t.id, percent: t.percent, cards: t.contributors.length }));
    const health = deckHealth(f.state, f.deck).map((h) => `${h.need} ${h.count.toFixed(1)}/${h.target} ${h.status}`);
    const upgrades = improveCurrentDeck(f.state, f.deck).slice(0, 8).map((c) => `${c.card.name} ${c.upgrade.upgradeValue.toFixed(2)} ${c.upgrade.label} | ${c.upgrade.reasons.join(" ")}`);
    const e = d.expect as { primaryIncludes?: string[]; notTop?: string; healthNotLow?: string[]; maxTopPercent?: number };
    const primaryIds = dna.themes.filter((t) => dna.core.primary.includes(t.label)).map((t) => t.id);
    const checks: string[] = [];
    for (const id of e.primaryIncludes || []) checks.push(`${primaryIds.includes(id) ? "PASS" : "FAIL"} primary includes ${id}`);
    if (e.notTop) checks.push(`${themes[0]?.id !== e.notTop ? "PASS" : "FAIL"} top theme is not ${e.notTop}`);
    for (const need of e.healthNotLow || []) checks.push(`${deckHealth(f.state, f.deck).find((h) => h.need === need)?.status !== "Low" ? "PASS" : "FAIL"} ${need} not Low`);
    if (e.maxTopPercent) checks.push(`${(themes[0]?.percent || 0) <= e.maxTopPercent ? "PASS" : "FAIL"} top theme ≤ ${e.maxTopPercent}%`);
    return {
      id: d.id,
      name: d.name,
      checks,
      primary: dna.core.primary,
      summary: dna.summary,
      payoff: dna.core.payoff,
      themes,
      keyCards: dna.central.slice(0, 6).map((c) => c.name),
      blueprintPlan: commanderBlueprint(f.state, f.deck).plan,
      health,
      confidence: analysisConfidence(f.state, f.deck),
      upgrades,
    };
  });
  if (process.env.AUDIT_OUT) writeFileSync(process.env.AUDIT_OUT, JSON.stringify(report, null, 1));
  for (const r of report) console.log(`\n## ${r.id} ${r.name}\n${r.checks.join("\n")}\nprimary: ${r.primary.join(", ")} | ${r.themes.map((t) => `${t.id} ${t.percent}%`).join(" · ")}\nsummary: ${r.summary}`);
}, 300_000);
