// Scoped Oracle-derived creature identity and death-copy relationships. No card-name rules.
import type { CardMetadata } from "../models/collection";
import { stripReminderText } from "../utils/rulesText";
import { cardKeywords } from "../utils/cardKeywords";
import { creatureTypePatterns } from "../intelligence/subtypes";

const texts = new WeakMap<CardMetadata, string>();
export function rulesText(card: CardMetadata) {
  let text = texts.get(card);
  if (text === undefined) {
    text = stripReminderText((card.cardFaces?.length ? card.cardFaces.map(f => f.oracleText || "").join("\n") : card.oracleText || "").replace(/[’‘]/g, "'"));
    texts.set(card, text);
  }
  return text;
}
export const creatureBody = (card: CardMetadata) => /\bCreature\b/.test((card.cardFaces?.[0]?.typeLine || card.typeLine).split("—")[0]);
export function isCreatureType(card: CardMetadata, type: string) {
  const face = card.cardFaces?.[0];
  return creatureBody(card) && (cardKeywords(card).some(k => /^changeling$/i.test(k)) || /^Changeling\b/im.test(face?.oracleText || card.oracleText || "") ||
    (face?.typeLine || card.typeLine).split("—")[1]?.trim().split(/\s+/).some(t => t.toLowerCase() === type.toLowerCase()) === true);
}
export interface TypeGrant { all: boolean; chosen: boolean; types: string[]; graveyard: boolean }
const grants = new WeakMap<CardMetadata, TypeGrant | null>();
export function creatureTypeGrant(card: CardMetadata): TypeGrant | null {
  const known = grants.get(card);
  if (known !== undefined) return known;
  const text = rulesText(card);
  if (!text.includes("Creatures you control")) { grants.set(card, null); return null; }
  const line = text.split("\n").find(l => /^Creatures you control (?:are |have base power and toughness \d+\/\d+ and are )/i.test(l));
  const match = line?.match(/^Creatures you control (?:have base power and toughness \d+\/\d+ and )?are (every creature type|the chosen type|[A-Z][a-z]+s?)\b/);
  const result = match ? {
    all: match[1] === "every creature type", chosen: match[1] === "the chosen type",
    types: /^(?:every|the chosen)/.test(match[1]) ? [] : creatureTypePatterns.filter(p => p.reference.test(match[1])).map(p => p.type),
    graveyard: /creature cards you own that aren't on the battlefield/i.test(line!),
  } : null;
  grants.set(card, result);
  return result;
}
export const grantsCreatureType = (card: CardMetadata, type: string) => {
  const grant = creatureTypeGrant(card);
  return !!grant && (grant.all || grant.chosen || grant.types.some(t => t.toLowerCase() === type.toLowerCase()));
};
export interface DeathCopy { type: string; nontoken: boolean; another: boolean; count: number; nonlegendary: boolean; fixedBody?: string }
const deathCopies = new WeakMap<CardMetadata, DeathCopy | null>();
export function deathCopy(card: CardMetadata): DeathCopy | null {
  const known = deathCopies.get(card);
  if (known !== undefined) return known;
  const match = rulesText(card).match(/(?:^|\n)Whenever (another )?(nontoken )?([A-Z][a-z-]+) creature you control dies, create (two|three|\d+) tokens that are copies of that creature([^\n]*)/);
  const result = match ? { type: match[3], nontoken: !!match[2], another: !!match[1], count: ({ two: 2, three: 3 } as Record<string, number>)[match[4]] || Number(match[4]), nonlegendary: /aren't legendary/.test(match[5]), fixedBody: match[5].match(/they're (\d+\/\d+)/)?.[1] } : null;
  deathCopies.set(card, result);
  return result;
}
export const creatureSacrificeOutlet = (card: CardMetadata) => /(?:^|\n)[^:\n]*\bSacrifice (?:a|another) creature:[^\n]+/i.test(rulesText(card));
export const creatureSacrificeEffect = (card: CardMetadata) => creatureSacrificeOutlet(card) || /(?:^|\n)As an additional cost to cast this spell, sacrifice (?:a creature|an artifact or creature)\.|(?:^|\. )Sacrifice a creature\./i.test(rulesText(card));
export const deathSplit = (card: CardMetadata) => /\bDestroy target creature\. If that creature dies this way, its controller creates two tokens that are copies of that creature\b/i.test(rulesText(card));
export const deathReturn = (card: CardMetadata) => {
  const text = rulesText(card);
  return /\btarget creature(?: you control)? gains "When this creature dies, return it to the battlefield[^"\n]*under its owner's control/i.test(text) ||
    /Choose target creature\. [^\n]*that creature gains "When this creature dies, return it to the battlefield[^"\n]*under its owner's control/i.test(text);
};
export const entryClone = (card: CardMetadata) => creatureBody(card) && /\benter as a copy of (?:any |a )?(?:artifact or creature|creature|nonland permanent)\b/i.test(rulesText(card));
export const typalTriggerMultiplier = (card: CardMetadata) => /If a triggered ability of another creature you control of the chosen type triggers, it triggers an additional time/i.test(rulesText(card));
export function animatedLandType(card: CardMetadata, type: string) {
  const text = rulesText(card);
  if (/\bLand\b/.test((card.cardFaces?.[0]?.typeLine || card.typeLine).split("—")[0]) && !/\bToken\b/.test(card.typeLine) && /\bthis land becomes a \d+\/\d+ creature with all creature types until end of turn\b/i.test(text)) return true;
  return /\bAura\b/.test(card.typeLine) && /\bEnchant land\b/.test(text) && new RegExp(`Enchanted land is a \\d+/\\d+ [^.]*\\b${type} creature\\b`, "i").test(text);
}

export function typeGrantRelationship(source: CardMetadata, payoff: CardMetadata): string[] {
  const grant = creatureTypeGrant(source);
  if (!grant) return [];
  const text = rulesText(payoff);
  const choice = /Choose a creature type\.|choose a creature type\./i.test(text);
  if (!choice) return [];
  if (/Return all creature cards of the chosen type from your graveyard to the battlefield/i.test(text))
    return grant.graveyard ? [`${source.name} changes creature-card types outside the battlefield, so ${payoff.name} can return those creature cards when the same type is chosen; battlefield-only type changes do not apply in the graveyard.`] : [];
  if (/Draw a card for each permanent you control of that type|Whenever a creature you control of the chosen type enters or attacks, draw a card/i.test(text))
    return [`${source.name} supplies matching creature types for ${payoff.name}'s chosen-type draw effect while the type change is active.`];
  return [];
}

export function deathCopyRelationship(engine: CardMetadata, support: CardMetadata): string[] {
  const effect = deathCopy(engine);
  if (!effect) return [];
  const out: string[] = [];
  if (isCreatureType(support, effect.type) && !/\bToken\b/.test(support.typeLine.split("—")[0]) && (!effect.another || support.name !== engine.name))
    out.push(`${support.name} is a nontoken ${effect.type} that can die to create ${effect.count} ${effect.fixedBody || ""} copy tokens${effect.nonlegendary ? " that aren't legendary" : ""}; tokens do not retrigger a nontoken death condition.`);
  if (grantsCreatureType(support, effect.type))
    out.push(`${support.name} makes your creatures ${effect.type}s on the battlefield, enabling the printed ${effect.nontoken ? "nontoken " : ""}${effect.type} death condition; it does not turn tokens into nontokens.`);
  if (animatedLandType(support, effect.type))
    out.push(`${support.name} can make a nontoken land an eligible ${effect.type} creature while animated; this requires the animation cost or Aura, and land tokens still cannot satisfy a nontoken death condition.`);
  if (creatureSacrificeEffect(support))
    out.push(`${support.name} can sacrifice an eligible ${effect.nontoken ? "nontoken " : ""}${effect.type} to feed the death-copy trigger; activation costs and timing still apply.`);
  if (deathSplit(support))
    out.push(`${support.name} can destroy your eligible nontoken ${effect.type} to feed the death trigger and make its own smaller copy tokens; the creature must actually die, and the tokens do not retrigger a nontoken condition.`);
  if (deathReturn(support))
    out.push(`${support.name} can return a dying nontoken ${effect.type} while the death-copy trigger creates tokens; a token cannot return from the graveyard.`);
  if (/If (?:an effect would create|one or more tokens would be created)[^\n]*under your control[^\n]*twice|If an effect would create[^\n]*under your control[^\n]*twice/i.test(rulesText(support)))
    out.push(`${support.name} doubles the death-copy tokens; those tokens still cannot satisfy a nontoken death trigger.`);
  if (typalTriggerMultiplier(support) && creatureBody(engine))
    out.push(`${support.name} can choose ${effect.type} to add a trigger from ${engine.name}; this copies a trigger, not a cast or activated ability.`);
  return out;
}
