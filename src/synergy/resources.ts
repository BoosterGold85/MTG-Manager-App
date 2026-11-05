// Event producers, observers and resource transformations are deliberately separate.
// These facts describe conditional options, not a simulation of current mana or board state.
import type { CardMetadata } from "../models/collection";
import { stripAbilityWord, stripReminderText } from "../utils/rulesText";
import { cardKeywords } from "../utils/cardKeywords";

export type Resource = "Food" | "Clue" | "Treasure";
export interface ResourceSemantics {
  text: string;
  creates: Resource[];
  createsTokens: boolean;
  foodAccess: boolean;
  foodGrant: boolean;
  foodDiscount: boolean;
  bundleReplacement: boolean;
  extraFood: boolean;
  lifeMultiplier: number;
  lifeAddition: number;
  directLife: boolean;
  targetedLife: boolean;
  lifelink: boolean;
  lifeObserver: boolean;
  aboveBaseCombat: boolean;
  raisesPower: boolean;
  relationshipSource: boolean;
}
const cache = new WeakMap<CardMetadata, ResourceSemantics>();
// Reprints and ownership-only identity changes share immutable text-derived semantics.
const byMeaning = new Map<string, ResourceSemantics>();
const EMPTY: ResourceSemantics = {
  text: "", creates: [], createsTokens: false, foodAccess: false, foodGrant: false,
  foodDiscount: false, bundleReplacement: false, extraFood: false, lifeMultiplier: 1,
  lifeAddition: 0, directLife: false, targetedLife: false, lifelink: false,
  lifeObserver: false, aboveBaseCombat: false, raisesPower: false, relationshipSource: false,
};
/** Only the resolved effect is an event source; the triggering condition is not. */
export function effectText(line: string) {
  let effect = stripAbilityWord(line.trim()).replace(/^[•●]\s*/, "");
  if (/^If (?:you would|one or more|an effect would)\b/i.test(effect) && /\binstead\b/i.test(effect)) return "";
  for (let i = 0; i < 3; i++) effect = effect.replace(/^(?:When(?:ever)?|At the beginning|If|As long as)\b[^,]*,\s*/i, "");
  return effect;
}
export function resourceSemantics(card: CardMetadata): ResourceSemantics {
  const known = cache.get(card);
  if (known) return known;
  const raw = card.cardFaces?.length ? card.cardFaces.map(f => f.oracleText || "").join("\n") : card.oracleText || "";
  if (!raw && !card.keywords?.length && !card.cardFaces?.some(f => f.keywords?.length)) {
    cache.set(card, EMPTY);
    return EMPTY;
  }
  const keywords = cardKeywords(card), type = card.cardFaces?.[0]?.typeLine || card.typeLine;
  const key = JSON.stringify([raw, type, keywords]);
  const shared = byMeaning.get(key);
  if (shared) { cache.set(card, shared); return shared; }
  const text = stripReminderText(raw.replace(/[’‘]/g, "'"));
  const lines = text.split("\n"), effects = lines.map(effectText).filter(Boolean);
  const creation = effects.filter(l => /\bcreate\b[^.]*\btokens?\b/i.test(l) && !/\b(?:opponent|each other player) creates?\b|under (?:an?|your|target|that) opponent's control/i.test(l));
  const creates = (["Food", "Clue", "Treasure"] as Resource[]).filter(t => creation.some(l => new RegExp(`\\b${t}\\b[^.]*\\btokens?\\b`, "i").test(l)));
  const foodGrant = /^During your turn, artifacts you control are Foods[^\n]*have "\{2\}, \{T\}, Sacrifice this artifact: You gain 3 life/im.test(text);
  const multiplier = text.match(/If you would gain life, you gain (twice|three times) that much life instead/i);
  const addition = text.match(/If you would gain life, you gain that much life plus (\d+) instead/i);
  const ownGain = /\byou gain (?:\d+|x|one|two|three|four|five|six|seven|eight|ten|that much|that many|twice x|life equal to)\b|(?:^|[:,.]\s*|\bthen )Gain (?:\d+|x|one|two|three|four|twice x) life\b/i;
  const directLife = effects.some(l => ownGain.test(l));
  const targetedLife = effects.some(l => /\btarget player gains (?:\d+|x|twice x|life equal to)\b/i.test(l));
  const result: ResourceSemantics = {
    text, creates, createsTokens: creation.length > 0,
    foodAccess: creates.includes("Food") || directLife && /\bFood\b/.test((card.cardFaces?.[0]?.typeLine || card.typeLine).split("—")[1] || "") || foodGrant,
    foodGrant,
    foodDiscount: /Activated abilities of Foods you control cost \{\d+\} less to activate/i.test(text),
    bundleReplacement: /If you would create a Clue, Food, or Treasure token, instead create one of each/i.test(text),
    extraFood: /If one or more tokens would be created under your control,[^\n]*an additional Food token[^\n]*instead/i.test(text),
    lifeMultiplier: multiplier ? multiplier[1].toLowerCase() === "twice" ? 2 : 3 : 1,
    lifeAddition: addition ? Number(addition[1]) : 0,
    directLife, targetedLife,
    lifelink: keywords.some(k => /^lifelink$/i.test(k)),
    lifeObserver: /(?:Whenever|When) you gain life\b|if you gained life this turn/i.test(text),
    aboveBaseCombat: /with power greater than its base power deals? combat damage to a player/i.test(text),
    raisesPower: effects.some(l => !/\bcreatures? (?:an opponent controls|your opponents control|you don't control)\b/i.test(l) && /\b(?:target creature(?: you control)?|creatures you control|each creature you control|this creature|equipped creature|enchanted creature) gets? \+(?:\d+|X)\/\+(?:\d+|X)\b|\bput (?:[^.]* )?\+1\/\+1 counters? on (?:target creature(?: you control)?|each creature you control|this creature)\b|\bdistribute [^.]*\+1\/\+1 counters? among [^.]*target creatures\b/i.test(l)),
    relationshipSource: false,
  };
  result.relationshipSource = result.foodAccess || result.lifelink || result.targetedLife || result.lifeMultiplier > 1 || result.lifeAddition > 0 || result.bundleReplacement || result.extraFood || result.foodDiscount || result.foodGrant;
  cache.set(card, result);
  byMeaning.set(key, result);
  if (byMeaning.size > 10000) byMeaning.delete(byMeaning.keys().next().value!);
  return result;
}
export const suppliesLifeGain = (card: CardMetadata) => {
  const s = resourceSemantics(card);
  return s.directLife || s.targetedLife || s.lifelink || s.foodAccess;
};
export function suppliesResourceSacrifice(card: CardMetadata, resource: Resource) {
  const s = resourceSemantics(card);
  if (s.creates.includes(resource) || resource === "Food" && s.foodAccess) return true;
  if (new RegExp(`\\b${resource}\\b`).test((card.cardFaces?.[0]?.typeLine || card.typeLine).split("—")[1] || "")) return true;
  return s.text.split("\n").map(effectText).some(l => new RegExp(`\\bSacrifice (?:a|an|one|two|three|four|X|any number of) ${resource}s?\\b`, "i").test(l));
}
export function resourceRelationship(source: CardMetadata, recipient: CardMetadata): string[] {
  const a = resourceSemantics(source);
  if (!a.relationshipSource) return [];
  const b = resourceSemantics(recipient), out: string[] = [];
  if (a.foodAccess && b.lifeObserver)
    out.push(`${source.name} supplies access to Food's life-gain activation for ${recipient.name}; pay the applicable mana cost, tap and sacrifice that Food. Sacrificing Food for another effect does not automatically gain life.`);
  if (a.lifelink && b.lifeObserver)
    out.push(`${source.name}'s lifelink can supply life gain for ${recipient.name} only when it actually deals damage; merely controlling it does not gain life.`);
  if (a.targetedLife && b.lifeObserver)
    out.push(`${source.name} can supply ${recipient.name}'s life-gain event only if you are the chosen recipient and the selected mode/cost produces positive life gain; an opponent gaining life does not qualify.`);
  if ((a.lifeMultiplier > 1 || a.lifeAddition) && (b.lifeObserver || suppliesLifeGain(recipient)))
    out.push(`${source.name} replaces the amount of a real life-gain event for ${recipient.name}; it does not originate life gain or multiply the number of life-gain triggers.`);
  if (a.bundleReplacement && b.creates.length)
    out.push(`${source.name} replaces ${recipient.name}'s qualifying resource-token creation with Clue, Food and Treasure; it requires the incoming event, not merely controlling the replacement.`);
  if (a.extraFood && b.createsTokens)
    out.push(`${source.name} adds Food to ${recipient.name}'s controlled token-creation event; the replacement does not initiate its own event.`);
  if (a.foodDiscount && (b.foodAccess || /\bFood\b/.test((recipient.cardFaces?.[0]?.typeLine || recipient.typeLine).split("—")[1] || "")))
    out.push(`${source.name} reduces generic activation costs of the Foods supplied by ${recipient.name}; colored costs, tapping and sacrifices remain. Making Food is not itself an ability of a Food.`);
  if (a.foodGrant && b.foodDiscount)
    out.push(`${source.name} makes your artifacts Foods during your turn, allowing ${recipient.name}'s Food activation discount on those objects only while the grant applies.`);
  return out;
}
