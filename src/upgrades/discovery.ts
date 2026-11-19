// Recommended from your collection (DISCOVERY_VERSION 1.1.0): the owned cards that create a verified interaction with
// THIS deck. Selection only. It reuses Brew's verified links, fed conditions and package bridges, and it adds no numeric
// score. The strength label is a category derived from the kind of evidence, never a ranking value.
//   - A card qualifies only with a rule-backed link to the Commander or a deck card, a condition this deck really
//     supplies, or a package bridge. Shared tags, generic utility and color identity never qualify a card.
//   - Category effects are not discoveries: when the same deck-card rule text ("whenever you cast a noncreature spell")
//     is the reason for three or more candidates, every card of that kind does it, so it is dropped as a reason.
//     Commander relationships are exempt: a payoff the whole deck is built around is the point of the recommendation.
//   - Crew is not an interaction: every creature deck can crew a Vehicle, so it is a prerequisite.
//   - A card the engine flags as conflicting with this deck (Anti-synergy) is never recommended.
//   - Ordering: available unassigned copies first, then strength, then the existing Brew order.
import type { OwnedCandidateGroup } from "../synergy/explorer";
import type { CardMetadata } from "../models/collection";
import type { BrewResult } from "./brew";
import { compareBrew } from "./brew";
import type { UpgradeEvaluation } from "./upgrade";

export const DISCOVERY_VERSION = "1.1.0";
/** Candidates that would share one deck-card rule text before it counts as a category effect. */
export const SHARED_RULE_LIMIT = 3;
export type DiscoveryStrength = "Strongly supported" | "Plausible" | "Speculative";
type Verified = BrewResult["verified"][number];
export interface Discovery {
  identity: string;
  group: OwnedCandidateGroup;
  brew: BrewResult;
  strength: DiscoveryStrength;
  /** Deck cards and the Commander this card distinctly works with, strongest first. */
  worksWith: string[];
  /** The rule text behind the strongest interaction, or the condition it fills. */
  happens: string;
  /** Prerequisites: cost, conditions this deck supplies, and conditions it does not reliably supply. */
  needs: string[];
  /** Caveats the engine recorded (uncertain text, partial support). */
  caveats: string[];
  /** Complete decks only: the best one-for-one swap (Upgrade Value). Undefined for incomplete decks. */
  upgrade?: UpgradeEvaluation;
}
export interface DiscoveryInput {
  group: OwnedCandidateGroup;
  brew: BrewResult;
  upgrade?: UpgradeEvaluation;
}
const MAX_LIST = 3;
const list = (names: string[]) => (names.length > MAX_LIST ? `${names.slice(0, MAX_LIST).join(", ")} and ${names.length - MAX_LIST} more` : names.join(", "));
/** A condition this deck supplies, other than crew (every creature deck can crew a Vehicle, so crew is not an interaction). */
const suppliedInteraction = (brew: BrewResult) => brew.needs.some((n) => n.supplied && !n.crewOnly);
const conflicted = (brew: BrewResult) => brew.penalties.some((p) => p.name === "Anti-synergy");
/** The rule text on the partner's side: "Source → Receiver: text" becomes "text". */
const ruleText = (evidence: string) => evidence.replace(/^[^→]*→[^:]*:\s*/, "");
const sharedKey = (v: Verified) => `${v.name}|${ruleText(v.evidence[0] || "")}`;
/** Commander relationships are the strategy itself, so only deck-card category triggers can be shared-rule noise. */
const categoryRule = (v: Verified, shared: Map<string, Set<string>>) => !v.commander && !!v.evidence[0] && (shared.get(sharedKey(v))?.size ?? 0) >= SHARED_RULE_LIMIT;

/** How many distinct candidates lean on the same deck-card rule text: the input to the category-effect rule. */
function sharedRules(items: DiscoveryInput[]): Map<string, Set<string>> {
  const shared = new Map<string, Set<string>>();
  for (const item of items)
    for (const v of item.brew.verified)
      if (!v.commander && v.evidence[0]) {
        const key = sharedKey(v);
        shared.set(key, (shared.get(key) ?? new Set<string>()).add(item.group.identity));
      }
  return shared;
}

/** Conditions a rule states about the entering or attacking object ("draw a card if it has flying"). */
const STATED_KEYWORD = /\bif it has (flying|trample|lifelink|haste|vigilance|menace|deathtouch|reach|first strike|double strike|hexproof|indestructible|flash)\b/i;
// Any capitalized type or subtype a rule names for the entering or attacking object: "a Vehicle", "a Dragon", "another nontoken Dragon".
const STATED_TYPE = /\b(?:a|an|another)(?: nontoken)? ([A-Z][a-z]+) you control (?:enters|attacks)\b/;
// Relations that describe a shared or cost-based setup, not a trigger one card prints about another: at most "Plausible".
const WEAK_RULE = /↔|^Explicit |^Discard enabler|^Counter resources|^Graveyard setup/;
/**
 * A rule's stated condition must hold for the card when the card is the source of the link ("Source → Receiver: text").
 * Without this, every Vehicle would "work with" a Vehicle-with-flying payoff, whether or not it flies.
 */
export function statedConditionHolds(v: Verified, card: CardMetadata): boolean {
  const evidence = v.evidence[0] || "";
  if (!evidence.startsWith(`${card.name} → `)) return true;
  const text = ruleText(evidence);
  const type = text.match(STATED_TYPE)?.[1];
  if (type && !new RegExp(`\\b${type}\\b`, "i").test(card.typeLine)) return false;
  const keyword = text.match(STATED_KEYWORD)?.[1];
  if (keyword && !(card.keywords || []).some((k) => k.toLowerCase() === keyword.toLowerCase())) return false;
  return true;
}

/** The verified links that still count as this card's own interaction (category effects removed). */
function distinctLinks(item: DiscoveryInput, shared: Map<string, Set<string>>): Verified[] {
  return item.brew.verified.filter((v) => !categoryRule(v, shared) && statedConditionHolds(v, item.group.card));
}

/** Discoverable: a conflict-free card with a distinct verified link, a supplied condition, or a package bridge. */
function isDiscoverable(brew: BrewResult, links: Verified[]): boolean {
  return !conflicted(brew) && (links.length > 0 || suppliedInteraction(brew) || brew.bridge !== undefined);
}

/**
 * How well the interaction is supported. "Strongly supported" needs a High-confidence analysis plus a distinct,
 * rule-backed link at strength 0.8+. A supplied condition is "Plausible"; a package bridge alone is an inference
 * and stays "Speculative".
 */
export function discoveryStrength(brew: BrewResult, links: Verified[]): DiscoveryStrength {
  if (brew.confidence === "Low") return "Speculative";
  const top = Math.max(0, ...links.map((v) => v.strength));
  const printed = links.some((v) => v.strength >= 0.8 && !WEAK_RULE.test(v.evidence[0] || ""));
  if (brew.confidence === "High" && printed && top >= 0.8) return "Strongly supported";
  if (links.length > 0 || suppliedInteraction(brew)) return "Plausible";
  return "Speculative";
}

function discoveryFor(input: DiscoveryInput, links: Verified[]): Discovery {
  const { group, brew } = input;
  const supplied = brew.needs.filter((n) => n.supplied && !n.crewOnly);
  const worksWith = links.length ? links.map((v) => v.name) : supplied.flatMap((n) => n.suppliers);
  const bridgeWhy = brew.why.find((w) => w.title === "Bridge");
  const happens = links[0]?.evidence[0] || (supplied[0] ? `Its "${supplied[0].need}" ability: ${supplied[0].line}` : bridgeWhy?.text || brew.summary);
  const needs: string[] = [];
  if (group.card.manaCost) needs.push(`Costs ${group.card.manaCost}`);
  for (const n of brew.needs) {
    if (n.crewOnly) {
      if (n.supplied) needs.push(`Needs creatures to crew it (${list(n.suppliers)})`);
    } else if (n.supplied) needs.push(`Needs ${n.need}, supplied by ${list(n.suppliers)}`);
    else needs.push(`Needs ${n.need}; this deck has ${n.suppliers.length ? `only ${list(n.suppliers)}` : "nothing"} to supply it`);
  }
  return {
    identity: group.identity,
    group,
    brew,
    strength: discoveryStrength(brew, links),
    worksWith: [...new Set(worksWith)].slice(0, 4),
    happens,
    needs,
    caveats: brew.negatives,
    ...(input.upgrade ? { upgrade: input.upgrade } : {}),
  };
}

/** Recommendations never repeat one rule more than this many times: the list shows variety, not eight copies of one trigger. */
export const MAX_PER_RULE = 2;
const ruleKey = (links: Verified[], brew: BrewResult, supplied: string[]) =>
  links[0] ? sharedKey(links[0]) : brew.bridge ? `bridge|${brew.bridge.from}|${brew.bridge.to}` : `supplied|${supplied[0] || ""}`;
const STRENGTH_ORDER: Record<DiscoveryStrength, number> = { "Strongly supported": 0, Plausible: 1, Speculative: 2 };

/** Deterministic selection. Available unassigned copies first, then strength, then the existing Brew order. */
export function selectDiscoveries(items: DiscoveryInput[]): Discovery[] {
  const shared = sharedRules(items);
  const found: { input: DiscoveryInput; links: Verified[]; strength: DiscoveryStrength }[] = [];
  for (const input of items) {
    const links = distinctLinks(input, shared);
    if (!isDiscoverable(input.brew, links)) continue;
    found.push({ input, links, strength: discoveryStrength(input.brew, links) });
  }
  found.sort(
    (a, b) =>
      Number(b.input.group.available > 0) - Number(a.input.group.available > 0) ||
      STRENGTH_ORDER[a.strength] - STRENGTH_ORDER[b.strength] ||
      compareBrew({ brew: a.input.brew, name: a.input.group.card.name }, { brew: b.input.brew, name: b.input.group.card.name }) ||
      a.input.group.identity.localeCompare(b.input.group.identity, "en"),
  );
  const seen = new Map<string, number>();
  const out: Discovery[] = [];
  for (const { input, links } of found) {
    const supplied = input.brew.needs.filter((n) => n.supplied && !n.crewOnly).map((n) => n.need);
    const key = ruleKey(links, input.brew, supplied);
    const count = seen.get(key) ?? 0;
    if (count >= MAX_PER_RULE) continue;
    seen.set(key, count + 1);
    out.push(discoveryFor(input, links));
  }
  return out;
}
