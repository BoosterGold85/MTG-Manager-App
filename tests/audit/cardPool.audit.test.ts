// Card-pool audit: runs every Commander-legal card in a Scryfall "oracle-cards" bulk file through the evaluator and
// reports where Oracle wording clearly implies a role that the engine did not assign. Not part of the unit suite.
//   CARD_POOL=/path/oracle-cards.jsonl AUDIT_OUT=/path/report.json npx vitest run tests/audit
import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeCard } from "../../src/import/scryfall";
import type { CardMetadata } from "../../src/models/collection";
import { cardFunction } from "../../src/upgrades/cardFunction";
import { buildCommanderBlueprint } from "../../src/upgrades/blueprint";
import { analyze } from "../../src/intelligence/tagger";
import { commanderEligible, deckPlayable } from "../../src/decks/decks";
import { emptyCollection } from "../../src/models/collection";
import { canonicalInput } from "../../src/upgrades/inputs";
import { stripReminderText } from "../../src/utils/rulesText";

type Raw = Parameters<typeof normalizeCard>[0] & { legalities?: Record<string, string>; layout?: string };
const text = (c: CardMetadata) => stripReminderText(c.oracleText || c.cardFaces?.map((f) => f.oracleText || "").join("\n") || "");
// Wording that clearly implies a role. Deliberately simple: each hit the engine misses is a candidate gap to review.
const expectations: { id: string; role: string; pattern: RegExp; check: (fn: ReturnType<typeof cardFunction>) => boolean }[] = [
  { id: "wipe", role: "wipes", pattern: /\b(?:destroy|exile) (?:all|each) (?:other )?(?:nonland permanents|creatures|permanents|nontoken creatures)\b|\bdeals? \w+ damage to each creature\b|\ball creatures get -\d+\/-\d+|\beach player sacrifices (?:all|\w+) creatures/i, check: (f) => !!f.roles.wipes },
  { id: "removal", role: "interaction", pattern: /\b(?:destroy|exile) target (?:creature|artifact|enchantment|planeswalker|nonland permanent|permanent)/i, check: (f) => !!f.roles.interaction || !!f.roles.wipes },
  { id: "counterspell", role: "interaction", pattern: /\bcounter target (?:spell|noncreature spell|creature spell|instant|activated)/i, check: (f) => !!f.roles.interaction },
  { id: "ramp-rock", role: "ramp", pattern: /^\{T\}: Add \{[WUBRGC]\}|\{T\}: Add (?:one mana of any color|\{C\}\{C\}|two mana)/im, check: (f) => !!f.roles.ramp || f.isLand },
  { id: "ramp-land", role: "ramp", pattern: /search your library for (?:a|up to (?:one|two)) basic land cards?[^.]*onto the battlefield/i, check: (f) => !!f.roles.ramp || f.isLand },
  { id: "draw", role: "cardAdvantage", pattern: /\b(?:you )?draws? (?:two|three|four|x|\d+) cards\b|\bwhenever [^.]*, (?:you may )?draw a card/i, check: (f) => !!f.roles.cardAdvantage },
  { id: "tutor", role: "tutors", pattern: /search your library for (?:a|an|up to one) (?!basic land|land)[^.]*card/i, check: (f) => !!f.roles.tutors },
  { id: "recursion", role: "recursion", pattern: /\breturn (?:target|up to one target|a|another target) [^.]*card from your graveyard to (?:your hand|the battlefield)/i, check: (f) => !!f.roles.recursion },
  { id: "protection", role: "protection", pattern: /\b(?:creatures? you control|target creature you control|equipped creature|enchanted creature|permanents you control) (?:gains?|has|have) (?:hexproof|indestructible|shroud|protection)/i, check: (f) => !!f.roles.protection },
];
it("audits the Commander-legal card pool", () => {
  const path = process.env.CARD_POOL;
  if (!path) return;
  const cards: CardMetadata[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const raw = JSON.parse(line) as Raw;
    if (raw.legalities?.commander !== "legal" || ["token", "double_faced_token", "art_series", "emblem"].includes(raw.layout || "")) continue;
    const card = normalizeCard(raw);
    if (deckPlayable(card)) cards.push(card);
  }
  const started = performance.now();
  const gaps: Record<string, { name: string; text: string }[]> = {};
  const failures: { name: string; error: string }[] = [];
  let untagged = 0;
  for (const card of cards) {
    try {
      const fn = cardFunction(card);
      const t = text(card);
      for (const e of expectations)
        if (e.pattern.test(t) && !e.check(fn)) (gaps[e.id] ||= []).push({ name: card.name, text: t.replace(/\s+/g, " ").slice(0, 220) });
      if (!fn.isLand && !Object.keys(fn.roles).length && !analyze(card).assignments.length && t.length > 40) untagged++;
    } catch (e) {
      failures.push({ name: card.name, error: String(e) });
    }
  }
  // Commander triggers the engine can't classify fall back to "Acts every turn".
  const state = emptyCollection();
  const commanders = cards.filter((c) => commanderEligible({ ...c, id: c.scryfallId, quantity: 1 }));
  const unclassified: { name: string; trigger: string }[] = [];
  for (const c of commanders) {
    try {
      state.metadata[c.scryfallId] = c;
      const bp = buildCommanderBlueprint([canonicalInput(state, c, true)]);
      const unknown = bp.profile.commanderSynergyTags.filter((t) => t.event === "turn" && !t.selfOnly && !/^(?:[^—]{1,40} — )?(?:At the beginning of (?:your|each|combat on your turn|the next|your first|your second|your precombat|your postcombat)|When you do\b|.{0,80}\bat the beginning of the next end step)/i.test(t.evidence.snippet));
      for (const t of unknown) unclassified.push({ name: c.name, trigger: t.evidence.snippet.slice(0, 200) });
    } catch (e) {
      failures.push({ name: c.name, error: String(e) });
    }
  }
  const report = {
    cards: cards.length,
    commanders: commanders.length,
    seconds: Math.round((performance.now() - started) / 100) / 10,
    failures,
    untaggedNonVanilla: untagged,
    gaps: Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, { count: v.length, examples: v }])),
    unclassifiedCommanderTriggers: { count: unclassified.length, commanders: new Set(unclassified.map((u) => u.name)).size, examples: unclassified },
  };
  if (process.env.AUDIT_OUT) writeFileSync(process.env.AUDIT_OUT, JSON.stringify(report, null, 1));
  console.log(
    JSON.stringify({ ...report, failures: failures.length, gaps: Object.fromEntries(Object.entries(report.gaps).map(([k, v]) => [k, v.count])), unclassifiedCommanderTriggers: { count: unclassified.length, commanders: report.unclassifiedCommanderTriggers.commanders } }),
  );
}, 1_800_000);
