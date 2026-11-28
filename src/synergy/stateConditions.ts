// Stated conditions in a trigger's rule text, evaluated for the card that is the source of a relationship.
// Shared by the relationship validator (synergy/recommendation.ts via dna/strategy.ts) and the evidence text, so both
// describe the same branch. Generic: nothing here names a card. Keywords come from the card's own printed keywords or
// from static "<Type> you control have/gain <keyword>" lines on other cards in the same deck.
import type { CardMetadata } from "../models/collection";

export interface StatedCondition {
  /** Object type the trigger names: "a Vehicle you control enters" → "Vehicle". */
  type?: string;
  /** Keyword the trigger tests: "if it has flying" → "flying". */
  keyword?: string;
  /** The alternative branch: "Otherwise, put a flying counter on it" → "put a flying counter on it". */
  otherwise?: string;
}
export interface KeywordGrant {
  keyword: string;
  /** Singular type the grant applies to ("vehicle", "creature"). */
  type: string;
  source: string;
}
export type Grants = KeywordGrant[];

const EVERGREEN = "flying|first strike|double strike|trample|lifelink|haste|vigilance|menace|deathtouch|reach|hexproof|indestructible|flash";
// Only events the named object performs itself. A "dies" trigger watches what another effect destroys, so a sacrifice outlet can relate to it.
const TYPE_WORD = /\b(?:a|an|another)(?: nontoken)? ([A-Z][a-z]+) you control (?:enters|attacks)\b/;
const KEYWORD_TEST = new RegExp(`\\bif it has (${EVERGREEN})\\b`, "i");
const OTHERWISE = /\bOtherwise,\s*([^.]+)\./i;
const GRANT_LINE = new RegExp(`^((?:[A-Z][a-z]+)s) you control (?:have|gain) ((?:(?:${EVERGREEN})(?:, | and | or )?)+)`, "i");

/**
 * The full rule line that a relationship's snippet came from. The snippet can stop before an "Otherwise" clause, so a
 * condition is parsed from the whole line of the receiver's own oracle text when it is available.
 */
export function ruleLineFor(snippet: string, oracle?: string): string {
  if (!oracle) return snippet;
  const key = snippet.slice(0, 40).toLowerCase();
  return oracle.split("\n").find((line) => line.toLowerCase().includes(key)) ?? snippet;
}

/** Parse the stated condition the rule text names about the entering or attacking object. */
export function parseStatedCondition(text: string): StatedCondition | undefined {
  const type = text.match(TYPE_WORD)?.[1];
  const keyword = text.match(KEYWORD_TEST)?.[1]?.toLowerCase();
  const otherwise = text.match(OTHERWISE)?.[1];
  if (!type && !keyword) return undefined;
  return { ...(type ? { type } : {}), ...(keyword ? { keyword } : {}), ...(otherwise ? { otherwise } : {}) };
}

/** Static keyword grants printed on the deck's own cards ("Vehicles you control have flying"). */
export function grantedKeywords(cards: CardMetadata[]): Grants {
  const grants: Grants = [];
  for (const card of cards) {
    const faces = card.cardFaces?.length ? card.cardFaces.map((f) => f.oracleText || "") : [card.oracleText || ""];
    for (const line of faces.join("\n").split("\n")) {
      const match = line.trim().match(GRANT_LINE);
      if (!match) continue;
      const type = match[1].replace(/s$/, "").toLowerCase();
      for (const keyword of match[2].toLowerCase().split(/, | and | or /)) {
        if (keyword) grants.push({ keyword, type, source: card.name });
      }
    }
  }
  return grants;
}

/** Whether a card has a keyword, printed or granted by another card to a type the card has. */
export function hasKeyword(card: CardMetadata, keyword: string, grants: Grants): { holds: boolean; via?: string } {
  const kw = keyword.toLowerCase();
  const printed = (card.keywords || []).some((k) => k.toLowerCase() === kw) || (card.oracleText || "").split("\n").some((l) => l.trim().toLowerCase().startsWith(kw));
  if (printed) return { holds: true };
  const typeLine = (card.typeLine || "").toLowerCase();
  // A grant reaches only the types it names: "Creatures you control have flying" does not give flying to a non-creature Vehicle.
  const grant = grants.find((g) => g.keyword === kw && typeLine.includes(g.type));
  return grant ? { holds: true, via: grant.source } : { holds: false };
}

/** The object a trigger watches: the source itself when it has the named type, or the token it creates. */
export interface Subject {
  card: CardMetadata;
  viaToken: boolean;
}
const oracleOf = (card: CardMetadata) => [card.oracleText || "", ...(card.cardFaces || []).map((f) => f.oracleText || "")].join("\n");
/**
 * A card matches a named type if it has the type (card type or subtype). A card that creates tokens of the type also matches:
 * the trigger watches the token ("create a 3/2 colorless Vehicle artifact token with crew 1"). The token's keywords are those
 * its creation text prints ("with flying"); grants from other cards still apply to it.
 */
// Subtypes that are not creature types: a Changeling creature is every creature type, but not a Vehicle or Equipment.
const NON_CREATURE_SUBTYPE = /^(Vehicle|Equipment|Aura|Saga|Food|Clue|Treasure|Lander|Powerstone|Blood|Map|Gold|Incubator|Role|Siege|Background|Class|Fortification|Curse|Shard|Cartouche)$/;
export function subjectOf(card: CardMetadata, type: string): Subject | undefined {
  if (new RegExp(`\\b${type}\\b`, "i").test(card.typeLine || "")) return { card, viaToken: false };
  // Changeling: a creature has every creature type, so it matches any creature-type trigger.
  const changeling = /\bchangeling\b/i.test(oracleOf(card)) || (card.keywords || []).some((k) => /^changeling$/i.test(k));
  if (changeling && /\bCreature\b/.test(card.typeLine || "") && !NON_CREATURE_SUBTYPE.test(type)) return { card, viaToken: false };
  const creation = oracleOf(card).match(new RegExp(`\\bcreates?\\b[^.]*\\b${type}\\b[^.]*\\btokens?\\b[^.]*`, "i"));
  if (!creation) return undefined;
  const printed = (creation[0].match(/\bwith ([a-z ,]+)/i)?.[1] || "").toLowerCase().split(/, | and /).map((k) => k.trim()).filter((k) => new RegExp(`^(${EVERGREEN})$`).test(k));
  const token = { ...card, name: `${card.name}'s ${type} token`, typeLine: `Token Artifact — ${type}`, keywords: printed, oracleText: "" } as CardMetadata;
  return { card: token, viaToken: true };
}

/**
 * Whether the stated condition is satisfied for this card. A trigger that names an object type must match it (directly or
 * through a token it creates). A keyword test with no "Otherwise" alternative fires only when the keyword holds for that
 * object; with an alternative, both branches are real effects, so the relationship stands and the evidence says which applies.
 */
export function statedConditionSatisfied(cond: StatedCondition | undefined, card: CardMetadata, grants: Grants): boolean {
  if (!cond) return true;
  const subject = cond.type ? subjectOf(card, cond.type) : { card, viaToken: false };
  if (!subject) return false;
  if (cond.keyword && !cond.otherwise && !hasKeyword(subject.card, cond.keyword, grants).holds) return false;
  return true;
}

/** Evidence sentence naming the branch that applies to this card (empty when the rule states no keyword test). */
export function branchNote(cond: StatedCondition | undefined, card: CardMetadata, grants: Grants): string {
  if (!cond?.keyword) return "";
  const subject = (cond.type && subjectOf(card, cond.type)) || { card, viaToken: false };
  const who = subject.viaToken ? `the ${cond.type} it creates` : card.name;
  const has = hasKeyword(subject.card, cond.keyword, grants);
  if (has.holds) return ` For ${who}: it has ${cond.keyword}${has.via ? ` (granted by ${has.via})` : ""}, so the first branch applies.`;
  return cond.otherwise
    ? ` For ${who}: it lacks ${cond.keyword}, so the Otherwise branch applies: ${cond.otherwise}.`
    : ` For ${who}: it lacks ${cond.keyword}, so this effect does not apply.`;
}
