// Semantic coverage per card (v0.6.23): which abilities the engine recognizes, which it doesn't, and whether
// the card's data is valid. A card with some unsupported clauses still counts for everything it does
// understand; only the unsupported part lowers confidence. Valid empty rules text (vanilla creatures) is data,
// not a missing record.
import type { CardMetadata } from "../models/collection";
import { cardAbilities, understoodCapability } from "../synergy/semantics";
import type { Ability } from "../synergy/semantics";
import { cardFunction } from "./cardFunction";
import { analyze } from "../intelligence/tagger";
import { capabilities } from "../synergy/capabilities";
import { effectConditions } from "./conditions";

export type CoverageState = "vanilla" | "full" | "partial" | "unsupported" | "missing";
export interface AbilityCoverage {
  line: string;
  status: "recognized" | "unsupported" | "procedural" | "inaccessible";
  capabilities: string[];
}
export interface CardCoverage {
  state: CoverageState;
  abilities: AbilityCoverage[];
  recognized: number;
  unsupported: number;
}
/** True only when the card's record has no rules text at all; "" is a valid empty Oracle text (vanilla). */
export function missingCardData(card: Pick<CardMetadata, "oracleText" | "cardFaces" | "typeLine">) {
  if (!card.typeLine) return true;
  if (card.cardFaces?.length) return card.cardFaces.every((f) => f.oracleText === undefined || f.oracleText === null) && (card.oracleText === undefined || card.oracleText === null);
  return card.oracleText === undefined || card.oracleText === null;
}
/** What the pre-existing engine reads from this ability alone (roles, Card Intelligence tags, rules capabilities). */
function legacyRecognized(card: CardMetadata, ability: Ability) {
  const pseudo: CardMetadata = { ...card, oracleText: ability.effect, cardFaces: undefined, keywords: [] };
  if (Object.keys(cardFunction(pseudo).roles).some((r) => r !== "lands")) return true;
  if (analyze(pseudo).assignments.length) return true;
  const caps = capabilities(pseudo);
  return Object.entries(caps).some(([key, value]) => value === true && key !== "text");
}
const cache = new WeakMap<CardMetadata, CardCoverage>();
export function cardCoverage(card: CardMetadata): CardCoverage {
  const known = cache.get(card);
  if (known) return known;
  // An effect the engine understands still isn't usable when its trigger condition can't be verified.
  const unverified = new Set(effectConditions(card).filter((c) => !c.understood).map((c) => c.line));
  const abilities: AbilityCoverage[] = cardAbilities(card).map((a) => ({
    line: a.line,
    capabilities: a.capabilities,
    status:
      a.kind === "procedural" && !a.capabilities.length
        ? "procedural"
        : a.access === "inaccessible"
          ? "inaccessible"
          : unverified.has(a.line)
            ? "unsupported"
            : a.kind === "keyword" || a.capabilities.some(understoodCapability) || legacyRecognized(card, a)
            ? "recognized"
            : "unsupported",
  }));
  const recognized = abilities.filter((a) => a.status === "recognized").length;
  const unsupported = abilities.filter((a) => a.status === "unsupported").length;
  const state: CoverageState = missingCardData(card)
    ? "missing"
    : !abilities.some((a) => a.status !== "procedural")
      ? "vanilla"
      : !unsupported
        ? "full"
        : recognized
          ? "partial"
          : "unsupported";
  const result = { state, abilities, recognized, unsupported };
  cache.set(card, result);
  return result;
}
