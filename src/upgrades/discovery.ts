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
/** The rule clause itself: without the per-card branch note ("For X: it has flying…") and power suffix, which differ per card. */
const ruleBody = (evidence: string) => ruleText(evidence).split(PRINTED_BODY_END)[0];
/**
 * The rule as a key. The candidate's own name is removed: "Exile and return reuses Alharu's own entry effect" is the same rule
 * as "…reuses Stonecloaker's…" once the name is gone, so blinkers that share an enabler collapse into one rule.
 */
const sharedKey = (v: Verified, candidateName: string) => {
  const body = ruleBody(v.evidence[0] || "");
  const own = candidateName.trim();
  // Whole words only, and only names long enough to be a name: a one-letter name must not touch the rule text around it.
  const generic = own.length >= 3 ? body.replace(new RegExp(`\\b${own.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), "THIS") : body;
  return `${v.name}|${norm(generic)}`;
};
/** Commander relationships are the strategy itself, so only deck-card category triggers can be shared-rule noise. */
const categoryRule = (v: Verified, shared: Map<string, Set<string>>, limit: number, candidateName: string) => !v.commander && !!v.evidence[0] && (shared.get(sharedKey(v, candidateName))?.size ?? 0) >= limit;

/** How many distinct candidates lean on the same deck-card rule text: the input to the category-effect rule. */
function sharedRules(items: DiscoveryInput[]): Map<string, Set<string>> {
  const shared = new Map<string, Set<string>>();
  for (const item of items)
    for (const v of item.brew.verified)
      if (!v.commander && v.evidence[0]) {
        const key = sharedKey(v, item.group.card.name);
        shared.set(key, (shared.get(key) ?? new Set<string>()).add(item.group.identity));
      }
  return shared;
}

// Broad events a clause can name without naming what the event happens to: a typed object ("a Vehicle you control enters") is specific.
const BROAD_EVENT = /\b(you draw|draws? a card|draw step|gain(?:s)? life|lose(?:s)? life|enters(?: the battlefield)?|dies|leaves the battlefield|attacks)\b/i;
const TYPED_OBJECT = /\b(?:a|an|another)(?: nontoken)? [A-Z][a-z]+ you control\b/;
// Relations that describe a shared or cost-based setup, not a trigger one card prints about another: at most "Plausible".
// Provisional (see docs/UPGRADES-DISCOVERY-AUDIT.md): mana-spend riders and replacement effects change how one event is recorded;
// they are not triggers one card gives another, so they are at most "Plausible".
const WEAK_RULE = /↔|^Explicit |^Discard enabler|^Counter resources|^Graveyard setup|that mana is spent|\breplaces\b|replacement|does not initiate/i;
/** The verified links that still count as this card's own interaction (category effects removed). */
// A clause that names only a broad card type ("a creature spell", "another creature enters", "any creature") is satisfied by most
// cards of that type, so the link is a category effect, Commander or not. A subtype or a named card is specific.
// Attachment clauses ("equipped creature", "enchanted creature") are broad too: every Equipment or Aura in the deck satisfies them.
const BROAD_TYPE_CLAUSE = /\b(?:a|an|another|each|any|one or more)(?: nontoken| other)? (?:creature|noncreature|artifact|enchantment|land|nonland|permanent|planeswalker|instant|sorcery|spell|token)s?\b|\b(?:equipped|enchanted) (?:creature|permanent)\b/i;
// Only the trigger decides breadth: "Whenever a creature you control enters, create a token" is broad because of the trigger, not
// because the effect makes a token. Untriggered text (a copy effect, a static ability) is read whole.
const triggerOf = (clause: string) => (/^(whenever|when|at the beginning)\b/i.test(clause) ? clause.split(",")[0] : clause);
const broadTypeClause = (v: Verified) => BROAD_TYPE_CLAUSE.test(triggerOf(ruleBody(v.evidence[0] || "")));

function distinctLinks(item: DiscoveryInput, shared: Map<string, Set<string>>, limit: number): Verified[] {
  return item.brew.verified.filter((v) => !categoryRule(v, shared, limit, item.group.card.name) && !broadTypeClause(v));
}

/** Discoverable: a conflict-free card with a distinct verified link, a supplied condition, or a package bridge. */
function isDiscoverable(brew: BrewResult, links: Verified[]): boolean {
  return !conflicted(brew) && (links.length > 0 || suppliedInteraction(brew) || brew.bridge !== undefined);
}

/** Words used to compare a rule with printed card text: letters and digits only, lowercase. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** The branch note and power suffix appended to evidence are not printed text; cut them before comparing. */
const PRINTED_BODY_END = / For [^:]+: it (?:has|lacks) |; can supply a power/;
export interface CardText {
  /** Oracle text (all faces) of a named card; undefined when the name is not known. */
  (name: string): string | undefined;
}
/**
 * Valid support for "Strongly supported": the evidence names both cards, is not a shared or cost-based relation, and quotes
 * a clause (at least 20 characters after normalizing) that is printed on the candidate or on the partner. A paraphrase
 * ("can reuse X's entry effect") is not printed text, so it cannot make a link strongly supported.
 */
export function printedSupport(v: Verified, candidate: { name: string; text: string }, cardText: CardText): boolean {
  const ev = v.evidence[0] || "";
  if (!ev || WEAK_RULE.test(ev) || !ev.includes(candidate.name) || !ev.includes(v.name)) return false;
  const clause = ruleBody(ev);
  // A clause that names only a broad event ("you gain life", "a creature you control leaves the battlefield") matches many cards
  // alike. It is printed, but it does not show a specific interaction, so it cannot be "Strongly supported" on its own.
  if (BROAD_EVENT.test(clause) && !TYPED_OBJECT.test(clause)) return false;
  const body = norm(clause);
  if (body.length < 20) return false;
  return [candidate.text, cardText(v.name) || ""].some((t) => norm(t).includes(body));
}

/**
 * How well the interaction is supported. "Strongly supported" needs a High-confidence analysis and a link at strength 0.8+
 * with printed support (see printedSupport). Other links, and supplied conditions, are "Plausible". A package bridge alone is
 * an inference, so it stays "Speculative".
 */
export function discoveryStrength(brew: BrewResult, links: Verified[], candidate: { name: string; text: string }, cardText: CardText): DiscoveryStrength {
  if (brew.confidence === "Low") return "Speculative";
  if (brew.confidence === "High" && links.some((v) => v.strength >= 0.8 && printedSupport(v, candidate, cardText))) return "Strongly supported";
  if (links.length > 0 || suppliedInteraction(brew)) return "Plausible";
  return "Speculative";
}
/** The candidate's own oracle text, all faces: the card a recommendation is about. */
export const oracleOf = (card: { oracleText?: string; cardFaces?: { oracleText?: string }[] }) =>
  [card.oracleText || "", ...(card.cardFaces || []).map((f) => f.oracleText || "")].join("\n");

function discoveryFor(input: DiscoveryInput, links: Verified[], strength: DiscoveryStrength): Discovery {
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
    strength,
    worksWith: [...new Set(worksWith)].slice(0, 4),
    happens,
    needs,
    caveats: brew.negatives,
    ...(input.upgrade ? { upgrade: input.upgrade } : {}),
  };
}

/** Recommendations never repeat one rule more than this many times: the list shows variety, not eight copies of one trigger. */
export const MAX_PER_RULE = 2;
// A card's rule is its Commander relationship when it has one (the strategy itself), otherwise its first distinct link.
const ruleKey = (links: Verified[], brew: BrewResult, supplied: string[], candidateName: string) => {
  const primary = links.find((v) => v.commander) ?? links[0];
  return primary ? sharedKey(primary, candidateName) : brew.bridge ? `bridge|${brew.bridge.from}|${brew.bridge.to}` : `supplied|${supplied[0] || ""}`;
};
const STRENGTH_ORDER: Record<DiscoveryStrength, number> = { "Strongly supported": 0, Plausible: 1, Speculative: 2 };

export interface SelectionOptions {
  /** Oracle text by card name. Without it, no link can reach "Strongly supported". */
  cardText?: CardText;
  /** Provisional guards (see the audit report). Evaluation can widen them; production uses the defaults. */
  sharedRuleLimit?: number;
  maxPerRule?: number;
}
/** Deterministic selection. Available unassigned copies first, then strength, then the existing Brew order. */
export function selectDiscoveries(items: DiscoveryInput[], options: SelectionOptions = {}): Discovery[] {
  const cardText: CardText = options.cardText ?? (() => undefined);
  const sharedRuleLimit = options.sharedRuleLimit ?? SHARED_RULE_LIMIT;
  const maxPerRule = options.maxPerRule ?? MAX_PER_RULE;
  const shared = sharedRules(items);
  const found: { input: DiscoveryInput; links: Verified[]; strength: DiscoveryStrength }[] = [];
  for (const input of items) {
    const candidate = { name: input.group.card.name, text: oracleOf(input.group.card) };
    // The link that supports the label is quoted first, so the explanation matches the strength shown.
    const links = distinctLinks(input, shared, sharedRuleLimit).sort(
      (a, b) => Number(printedSupport(b, candidate, cardText)) - Number(printedSupport(a, candidate, cardText)) || b.strength - a.strength,
    );
    if (!isDiscoverable(input.brew, links)) continue;
    found.push({ input, links, strength: discoveryStrength(input.brew, links, candidate, cardText) });
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
  for (const { input, links, strength } of found) {
    const supplied = input.brew.needs.filter((n) => n.supplied && !n.crewOnly).map((n) => n.need);
    const key = ruleKey(links, input.brew, supplied, input.group.card.name);
    const count = seen.get(key) ?? 0;
    if (count >= maxPerRule) continue;
    seen.set(key, count + 1);
    out.push(discoveryFor(input, links, strength));
  }
  return out;
}
