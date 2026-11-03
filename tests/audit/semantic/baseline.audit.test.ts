// Records how each observed card is classified by the current engine. Not part of the unit suite:
//   SEMANTIC_OUT=docs/semantic/coverage-<label>.json npx vitest run tests/audit/semantic
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { observedCards } from "../../semanticFixture";
import { cardFunction } from "../../../src/upgrades/cardFunction";
import { analyze } from "../../../src/intelligence/tagger";
import { effectConditions } from "../../../src/upgrades/conditions";
import { capabilities } from "../../../src/synergy/capabilities";
import { tagFamily } from "../../../src/dna/families";
import * as coverageModule from "../../../src/upgrades/coverage";

it("observed card classification", async () => {
  const coverage = (coverageModule as { cardCoverage?: (c: (typeof observedCards)[number]) => unknown }).cardCoverage;
  const rows = observedCards.map((card) => {
    const fn = cardFunction(card);
    const tags = analyze(card).assignments.map((a) => a.tagId);
    const caps = Object.entries(capabilities(card)).filter(([k, v]) => v === true && k !== "text").map(([k]) => k);
    const text = card.oracleText ?? card.cardFaces?.map((f) => f.oracleText ?? "").join("\n");
    const dnaTags = tags.filter((t) => t.startsWith("typal:") || tagFamily.has(t));
    const legacyState = !fn.isLand && !(text || "").trim() ? "missing-text (warning)" : !Object.keys(fn.roles).length && !dnaTags.length && (text || "").length > 40 ? "untracked (warning)" : "counted";
    return {
      name: card.name,
      legacyState,
      roles: fn.roles,
      tags,
      capabilities: caps,
      conditions: effectConditions(card).map((c) => `${c.needs}${c.understood ? "" : " [unverified]"}`),
      coverage: coverage ? coverage(card) : undefined,
    };
  });
  if (process.env.SEMANTIC_OUT) writeFileSync(process.env.SEMANTIC_OUT, JSON.stringify(rows, null, 1) + "\n");
  for (const r of rows) console.log(`${r.name} | ${r.legacyState} | roles ${JSON.stringify(r.roles)} | tags ${r.tags.join(",")} | caps ${r.capabilities.join(",")} | cond ${r.conditions.join(";")}`);
});
