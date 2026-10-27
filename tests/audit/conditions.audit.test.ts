// Condition-parser coverage over the Commander-legal card pool. Not part of the unit suite:
//   CARD_POOL=/path/oracle-cards.jsonl AUDIT_OUT=/path/report.json npx vitest run tests/audit/conditions.audit.test.ts
import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeCard } from "../../src/import/scryfall";
import { deckPlayable } from "../../src/decks/decks";
import { effectConditions } from "../../src/upgrades/conditions";

it("condition parser coverage", () => {
  const path = process.env.CARD_POOL;
  if (!path) return;
  const counts = new Map<string, number>(), unknown: { name: string; needs: string }[] = [];
  let cards = 0, conditional = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const raw = JSON.parse(line);
    if (raw.legalities?.commander !== "legal" || ["token", "double_faced_token", "art_series", "emblem"].includes(raw.layout || "")) continue;
    const card = normalizeCard(raw);
    if (!deckPlayable(card)) continue;
    cards++;
    const conds = effectConditions(card);
    if (conds.length) conditional++;
    for (const c of conds) {
      const kind = c.understood ? c.key.split(":")[0] : "unknown";
      counts.set(kind, (counts.get(kind) || 0) + 1);
      if (!c.understood) unknown.push({ name: card.name, needs: c.needs });
    }
  }
  const report = { cards, conditional, kinds: Object.fromEntries([...counts].sort((a, b) => b[1] - a[1])), unknown };
  if (process.env.AUDIT_OUT) writeFileSync(process.env.AUDIT_OUT, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report, unknown: unknown.length }));
}, 600_000);
