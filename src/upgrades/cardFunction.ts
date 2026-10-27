// Shared functional profile of one canonical card, derived only from typed Oracle facts.
// Both Upgrades I Own modes read this; neither price, popularity nor rarity is an input.
import type { CardMetadata } from "../models/collection";
import { stripReminderText } from "../utils/rulesText";
import { cardKeywords } from "../utils/cardKeywords";
import { extractCardFacts, benefitsYou } from "../synergy/facts";
import type { AnswerFact, AnswerTarget, CardFacts } from "../synergy/facts";
import { isBasicLand } from "../decks/decks";
import { conditionFactor, crewCondition, effectConditions, withoutLines } from "./conditions";
import type { ConditionCredit, SupplyIndex } from "./conditions";

export const CARD_FUNCTION_VERSION = "1.0.0";
export type Need =
  | "lands"
  | "ramp"
  | "cardAdvantage"
  | "interaction"
  | "wipes"
  | "protection"
  | "recursion"
  | "tutors"
  | "finishers"
  | "tokens"
  | "sacrificeOutlets"
  | "controlledDiscard";
export const needLabels: Record<Need, string> = {
  lands: "Lands",
  ramp: "Ramp",
  cardAdvantage: "Card advantage",
  interaction: "Interaction",
  wipes: "Board wipes",
  protection: "Protection",
  recursion: "Recursion",
  tutors: "Tutors",
  finishers: "Finishers",
  tokens: "Token generation",
  sacrificeOutlets: "Sacrifice outlets",
  controlledDiscard: "Controlled discard",
};
/** Scoped engine pieces: a multiplier is only as good as the matching sources it amplifies. */
export interface EnginePieces {
  noncombatDamageSources: number;
  combatThreat: number;
  attackTriggers: number;
  damageMultipliers: number;
  extraCombats: number;
  tokenSourcesByScope: Record<string, number>;
  /** Scope → multiplier strength (twice = 1, +1 extra token = 0.6). */
  tokenMultipliers: Record<string, number>;
  controlledDiscard: number;
  wantsDiscard: number;
}
export interface CardFunction {
  version: string;
  name: string;
  manaValue: number;
  /** Typical cost actually paid: self-reducing costs (Blasphemous Act, affinity, convoke…) are cheaper than printed. */
  effectiveManaValue: number;
  isLand: boolean;
  isBasicLand: boolean;
  isCreature: boolean;
  creatureTypes: string[];
  changeling: boolean;
  facts: CardFacts;
  roles: Partial<Record<Need, number>>;
  answers: AnswerFact[];
  coverage: AnswerTarget[];
  instantInteraction: boolean;
  repeatable: boolean;
  engines: EnginePieces;
  /** Standalone usefulness 0–1: what the card does without the Commander. */
  impact: number;
  impactReasons: string[];
  /** A creature contributing little beyond its type line, body and minor combat ability. */
  lowImpactBody: boolean;
  bodyScore: number;
  confidence: "High" | "Medium" | "Low";
  uncertainties: string[];
  /** Deck-relative only: each conditional ability, the deck cards that satisfy it and the credit it earned. */
  conditions?: ConditionCredit[];
}
const cache = new Map<string, CardFunction>();
const pieces0 = (facts: CardFacts) => [...new Set(facts.faces.flatMap((f) => f.tokenMultipliers).flatMap((m) => m.scopes))];
const countWords: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, x: 2 };
const or = (values: number[]) => 1 - values.reduce((p, v) => p * (1 - Math.max(0, Math.min(1, v))), 1);
const textOf = (card: CardMetadata) =>
  stripReminderText(
    (card.cardFaces?.length ? card.cardFaces.map((f) => f.oracleText || "").join("\n") : card.oracleText || "").replace(/[’‘]/g, "'"),
  );
function drawAmount(text: string) {
  let best = 0;
  for (const m of text.matchAll(/\bdraws? (a|an|one|two|three|four|five|six|seven|x|\d+) cards?\b/gi))
    best = Math.max(best, countWords[m[1].toLowerCase()] ?? Number(m[1]));
  return best;
}
// A loyalty ability costing more than the planeswalker's starting loyalty needs several turns of survival
// ("−11: …" on a 7-loyalty walker). It is not a role the deck can count on, so roles ignore it.
const ULTIMATE = /^[−-](\d+):[^\n]*\n?/gm;
function withoutUltimates(card: CardMetadata): { card: CardMetadata; dropped: boolean } {
  let dropped = false;
  const strip = (text: string | undefined, loyalty: string | undefined) => {
    const start = Number(loyalty);
    if (!text || !Number.isFinite(start)) return text;
    return text.replace(ULTIMATE, (line, cost: string) => (Number(cost) > start ? ((dropped = true), "") : line)).trimEnd();
  };
  const next = {
    ...card,
    oracleText: strip(card.oracleText, card.loyalty),
    cardFaces: card.cardFaces?.map((f) => ({ ...f, oracleText: strip(f.oracleText, f.loyalty ?? card.loyalty) })),
  };
  return dropped ? { card: next, dropped } : { card, dropped };
}
export function cardFunction(original: CardMetadata): CardFunction {
  const key = JSON.stringify([original.name, original.manaValue, original.typeLine, original.oracleText, original.keywords, original.cardFaces, original.power, original.toughness, original.loyalty]);
  const cached = cache.get(key);
  if (cached) return cached;
  const { card, dropped: ultimateIgnored } = withoutUltimates(original);
  const facts = extractCardFacts(card),
    text = textOf(card),
    keywords = cardKeywords(card).map((k) => k.toLowerCase()),
    faces = facts.faces,
    front = (card.cardFaces?.[0]?.typeLine || card.typeLine).split("—")[0];
  const isLand = /\bLand\b/.test(front),
    isCreature = faces.some((f) => f.cardTypes.includes("Creature")),
    printedMv = card.manaValue || 0,
    mv = /this spell costs \{\d+\} less to cast for each|\baffinity for\b|\bconvoke\b|\bimprovise\b|\bdelve\b/i.test(card.oracleText || "") || (card.keywords || []).some((k) => /^(?:affinity|convoke|improvise|delve)$/i.test(k))
      ? Math.max(2, Math.ceil(printedMv / 3))
      : printedMv,
    roles: Partial<Record<Need, number>> = {},
    reasons: { value: number; reason: string }[] = [];
  const has = (role: string) => facts.typedRoles.includes(role as never);
  const add = (need: Need, value: number) => (roles[need] = Math.max(roles[need] || 0, value));
  const repeatable =
    /\bwhenever\b|at the beginning|would[^.]*instead/i.test(text) ||
    (/^[^\n]*:/m.test(text) && !/sacrifice this|discard this/i.test(text));
  if (isLand) add("lands", 1);
  // Mana
  const activatedMana = faces.some((f) => f.addsMana.some((m) => benefitsYou(m.controller) && m.scope === "card" && m.timing === "activated"));
  const landRamp = has("land_ramp");
  if (!isLand && activatedMana) {
    const fast = mv <= 2 ? 0.9 : mv <= 3 ? 0.7 : 0.5;
    // Ramp means getting ahead early: a mana source that itself costs 6+ arrives after the game is set up.
    add("ramp", mv <= 4 ? 1 : mv === 5 ? 0.7 : 0.4);
    reasons.push({ value: mv >= 6 ? 0.3 : fast, reason: mv >= 6 ? "Makes mana, but costs too much to count as ramp." : isCreature ? "Repeatable mana from a creature." : "Repeatable mana source." });
  }
  if (landRamp) {
    add("ramp", 1);
    reasons.push({ value: mv <= 3 ? 0.65 : 0.5, reason: "Puts extra lands onto the battlefield." });
  }
  if (has("cost_reduction") || has("tribal_cost_reduction")) {
    add("ramp", 0.8);
    reasons.push({ value: mv <= 3 ? 0.6 : 0.45, reason: has("tribal_cost_reduction") ? "Reduces the cost of a creature type's spells." : "Reduces spell costs." });
  }
  if (has("treasure_generation")) {
    add("ramp", repeatable ? 0.8 : 0.5);
    reasons.push({ value: repeatable ? 0.55 : 0.35, reason: "Creates Treasure." });
  }
  // Auras, Equipment and anthems that grant a mana ability ('Enchanted land has "{T}: Add two mana…"').
  if (!roles.ramp && /\b(?:enchanted|equipped) (?:land|creature|permanent) has "\{T\}: Add|\b(?:creatures|lands|slivers|elves) you control have "\{T\}: Add/i.test(text)) {
    add("ramp", 0.8);
    reasons.push({ value: 0.4, reason: "Grants a mana ability." });
  }
  if (has("ritual") && !roles.ramp) {
    add("ramp", 0.3);
    reasons.push({ value: 0.2, reason: "One-shot mana burst." });
  }
  // Cards
  const draw = drawAmount(text);
  // Impulse draw, and card selection that puts cards from the top of your library into your hand (Fact or Fiction).
  const impulse =
    /exile the top[^\n]*?\b(?:you may )?(?:play|cast)\b|(?:play|cast)[^.\n]*exiled card/i.test(text) ||
    /\b(?:reveal|look at) the top (?:two|three|four|five|six|seven|x|\d+) cards of your library\b[^\n]*\b(?:put|puts) (?:one pile|those cards|that pile|them|\w+ of (?:them|those cards)|any number of [^.]{0,40}|up to \w+ of them|all [^.]{0,30}) into your hand/i.test(text);
  // Free spells (discover, cascade, "cast it without paying its mana cost") are card and tempo advantage.
  const freeSpell = /\b(?:discover|cascade)\b|cast (?:it|that card|that spell|the exiled card)[^.\n]*without paying/i.test(text);
  if (freeSpell) {
    add("cardAdvantage", 1);
    reasons.push({ value: 0.55, reason: "Casts a spell for free from the library." });
  }
  // "Target player draws" is your choice of player, so it is card advantage you control.
  if (faces.some((f) => f.cardDrawEffects.some((d) => benefitsYou(d.controller) || d.controller === "target_player")) || impulse) {
    const value = repeatable ? 0.8 : draw >= 3 ? 0.7 : draw === 2 ? 0.55 : 0.35;
    add("cardAdvantage", repeatable ? 1.2 : draw >= 2 ? 1 : 0.6);
    reasons.push({ value, reason: repeatable ? "Repeatable card advantage." : `Draws ${draw || "extra"} card${draw === 1 ? "" : "s"}.` });
  }
  // Interaction: specific coverage, not a single removal count
  const answers = faces.flatMap((f) => f.answers).filter((a) => benefitsYou(a.controller));
  const coverage = [...new Set(answers.flatMap((a) => a.targets))];
  for (const answer of answers) {
    const broad = answer.targets.some((t) => t === "permanent" || t === "nonland_permanent") ? 0.2 : answer.targets.length > 1 ? 0.1 : 0;
    const value = Math.min(0.9, 0.45 + broad + (answer.instantSpeed ? 0.08 : 0) + (mv <= 2 ? 0.1 : 0) + (answer.mode === "exile" || answer.mode === "shuffle" ? 0.05 : 0));
    if (answer.mass && answer.targets.some((t) => t === "creature" || t === "permanent" || t === "nonland_permanent")) add("wipes", 1);
    else if (answer.targets.includes("graveyard")) add("interaction", 0.4);
    else add("interaction", answer.mass ? 1.2 : 1);
    reasons.push({ value: answer.mass ? Math.max(value, 0.6) : value, reason: `${answer.mass ? "Mass" : "Targeted"} ${answer.mode} answer for ${answer.targets.join(" / ").replaceAll("_", " ")}${answer.instantSpeed ? " at instant speed" : ""}.` });
  }
  const instantInteraction = answers.some((a) => a.instantSpeed);
  // Protection & resilience
  if (/\b(?:target|you control|creatures you control|each creature you control)[^.\n]*\b(?:hexproof|indestructible|shroud|protection from|phase out)|(?:equipped|enchanted) (?:creature|permanent) (?:has|have|gains?)[^.]*(?:hexproof|indestructible|shroud|protection from)|counter target spell that targets/i.test(text)) {
    // One protection mode (only hexproof, only indestructible…) is partial; several modes, protection from,
    // phasing or countering the removal spell are full protection.
    const modes = ["hexproof", "indestructible", "shroud", "protection from", "phase out", "counter target spell that targets"].filter((m) => text.toLowerCase().includes(m));
    const full = modes.length > 1 || modes.some((m) => m === "protection from" || m === "phase out" || m.startsWith("counter"));
    add("protection", full ? 1 : 0.7);
    reasons.push({ value: (full ? 0.45 : 0.35) + (front.includes("Instant") ? 0.1 : 0) + (mv <= 2 ? 0.1 : 0), reason: full ? "Protects your permanents." : `Partial protection (${modes[0] || "one mode"} only).` });
  }
  // Recursion: "return … from your graveyard" and reanimation worded "put(s) … from a graveyard onto the battlefield".
  if (/return[^.\n]*from (?:your|a) graveyard[^.\n]*(?:hand|battlefield)|\bputs? [^.\n]{0,60}\bcards? from (?:your|their|a|an opponent's|each player's|any) graveyards? onto the battlefield/i.test(text)) {
    add("recursion", 1);
    reasons.push({ value: repeatable ? 0.55 : 0.35, reason: "Returns cards from your graveyard." });
  }
  const tutors = faces.flatMap((f) => f.searchesLibrary).filter((s) => benefitsYou(s.controller) && s.roles.some((r) => !/^(?:basic_land|land_tutor)/.test(r)));
  if (tutors.length) {
    add("tutors", 1);
    reasons.push({ value: tutors.some((t) => t.unrestricted) ? 0.75 : 0.5, reason: tutors.some((t) => t.unrestricted) ? "Finds any card." : `Searches for a specific card type.` });
  }
  // Tokens
  const ownTokens = faces.flatMap((f) => f.createsTokens).filter((t) => benefitsYou(t.controller) && t.controller !== "each_player");
  if (ownTokens.some((t) => t.isCreature)) {
    const n = ownTokens.reduce((sum, t) => sum + (t.count || 1), 0);
    add("tokens", repeatable ? 1.2 : 0.8);
    reasons.push({ value: Math.min(0.75, (repeatable ? 0.55 : 0.3) + 0.05 * n), reason: repeatable ? "Repeatedly creates creature tokens." : `Creates ${n} creature token${n === 1 ? "" : "s"}.` });
  }
  if (/sacrifice (?:another |a |an? |any number of )?(?:creature|artifact|permanent)[^:]*:/i.test(text)) add("sacrificeOutlets", 1);
  if (has("controlled_discard")) add("controlledDiscard", 1);
  // Finishing and engines
  const evasive = keywords.some((k) => ["flying", "trample", "menace", "shadow", "fear", "intimidate", "unblockable"].includes(k));
  const power = Number(card.power), toughness = Number(card.toughness);
  // Vehicles are threats too: printed power that attacks once crewed (a little less reliable than a creature).
  const isVehicle = /\bVehicle\b/.test(card.cardFaces?.[0]?.typeLine || card.typeLine),
    threatBody = (isCreature || isVehicle) && Number.isFinite(power),
    crewFactor = isCreature ? 1 : 0.85;
  if (has("additional_combat")) {
    add("finishers", 1);
    reasons.push({ value: 0.55, reason: "Grants an additional combat phase." });
  }
  // Doubling opponents' life loss is a multiplier for drain / pings plans.
  if (/\bif an? opponent would lose life\b[^.]*\b(?:twice|double|three times)\b/i.test(text)) {
    add("finishers", 1);
    reasons.push({ value: 0.65, reason: "Multiplies the life your opponents lose." });
  }
  if (has("damage_multiplier")) {
    add("finishers", 1);
    reasons.push({ value: 0.7, reason: "Multiplies the damage your sources deal." });
  }
  if (has("combat_multiplier") && !has("additional_combat")) {
    add("finishers", 0.8);
    reasons.push({ value: 0.45, reason: "Doubles combat damage (double strike)." });
  }
  if (has("token_doubler")) reasons.push({ value: 0.45, reason: "Doubles every token you create." });
  else if (has("scoped_token_multiplier")) reasons.push({ value: 0.2, reason: `Adds extra ${pieces0(facts).join(" / ")} tokens.` });
  // Team pumps, including qualified anthems ("Creatures you control with flying get +1/+1", "Other Vehicles you control get +1/+1").
  if (/creatures you control(?: with [\w ]{1,20})? get \+(?:\d+|x)\/\+(?:\d+|x)|\bother [\w ]{1,25} you control get \+\d+\/\+\d+/i.test(text)) {
    add("finishers", repeatable ? 0.8 : 0.7);
    reasons.push({ value: 0.45, reason: "Pumps your whole team." });
  }
  if (/damage equal to (?:its|that creature's|target creature's) power to[^.\n]*\beach opponent\b/i.test(text)) {
    add("finishers", 0.6);
    reasons.push({ value: 0.5, reason: "Turns a big creature's power into damage to each opponent." });
  }
  if (answers.some((a) => a.mass && a.targets.includes("creature") && !a.opponentsOnly) && /target creature you control[^.\n]*each other creature/i.test(text))
    reasons.push({ value: 0.65, reason: "Board wipe that spares the creature you choose." });
  const damage = faces.flatMap((f) => f.damage).filter((d) => d.role === "source" && benefitsYou(d.controller));
  if (damage.some((d) => d.triggered) && repeatable)
    reasons.push({ value: 0.5, reason: "Repeatable triggered damage engine." });
  if (/enters with x \+1\/\+1 counters|\bx\/x\b|base power and toughness x\/x/i.test(text) && isCreature) {
    add("finishers", 0.7);
    reasons.push({ value: 0.5, reason: "Scales with the mana spent (X)." });
  }
  if (/\b(?:each opponent loses|deals? \d+ damage to each opponent)/i.test(text) && repeatable) {
    add("finishers", 0.8);
    reasons.push({ value: 0.5, reason: "Repeatedly damages or drains each opponent." });
  }
  const bodyScore = threatBody
    ? crewFactor * Math.min(0.5, ((power + (Number.isFinite(toughness) ? toughness : 0)) / Math.max(2, 2 * mv)) * 0.35 + (evasive ? 0.12 : 0) + (keywords.includes("haste") ? 0.05 : 0))
    : 0;
  if (threatBody && power >= 5 && evasive) {
    add("finishers", 0.8);
    reasons.push({ value: 0.45, reason: `Large evasive threat (${power} power${isVehicle && !isCreature ? ", once crewed" : ""}).` });
  }
  // A repeatable attack trigger that puts more creatures into the attack converts the plan into lethal pressure.
  if (has("on_attack_token_generation") && ownTokens.some((t) => t.isCreature)) {
    add("finishers", 0.9);
    reasons.push({ value: 0.55, reason: "Each attack adds more attacking creatures: a repeatable threat." });
  }
  if (bodyScore) reasons.push({ value: bodyScore, reason: `Body ${card.power}/${card.toughness}${evasive ? " with evasion" : ""}.` });
  // Repeatable engine value from triggered/static abilities not already explained above.
  const engineTriggers = faces.flatMap((f) => f.triggers).filter((t) => !/^When (?:this|~)\b/i.test(t) && /whenever|at the beginning/i.test(t));
  if (engineTriggers.length && reasons.every((r) => r.value < 0.4))
    reasons.push({ value: 0.35, reason: "Repeatable triggered ability." });
  // Standalone impact: probabilistic union of distinct functions, then a mana-cost efficiency curve.
  const functional = reasons.filter((r) => !r.reason.startsWith("Body "));
  const efficiency = mv <= 3 ? 1 : Math.max(0.72, 1 - 0.06 * (mv - 3));
  const impact = isLand
    ? isBasicLand(card) ? 0.3 : Math.min(0.75, 0.3 + or(functional.map((r) => r.value)) * 0.5)
    : Math.min(1, or(reasons.map((r) => r.value)) * efficiency);
  const lowImpactBody = isCreature && or(functional.map((r) => r.value)) < 0.25;
  const pieces: EnginePieces = {
    noncombatDamageSources: faces.flatMap((f) => f.damage).filter((d) => d.role === "source" && benefitsYou(d.controller)).reduce((n, d) => n + (d.triggered ? 1 : 0.4), 0),
    combatThreat: threatBody ? crewFactor * Math.min(1.5, (Math.max(0, power) / 4) * (evasive ? 1 : 0.5)) : 0,
    attackTriggers: faces.flatMap((f) => f.attackTriggers).length,
    // Doubling/tripling outweighs a flat "+N" bonus.
    damageMultipliers: faces.flatMap((f) => f.damage).filter((d) => d.role === "multiplier").reduce((n, d) => Math.max(n, /triple|three times/i.test(d.text) ? 1.4 : /double|twice/i.test(d.text) ? 1.2 : 0.8), 0),
    extraCombats: has("additional_combat") ? 1 : 0,
    tokenSourcesByScope: {},
    tokenMultipliers: Object.fromEntries(faces.flatMap((f) => f.tokenMultipliers).flatMap((m) => m.scopes.map((scope) => [scope, /twice|double|three times/i.test(m.text) ? 1 : 0.6]))),
    controlledDiscard: has("controlled_discard") ? 1 : 0,
    wantsDiscard: has("mayhem_card") || has("madness_card") || has("discard_payoff") ? 1 : 0,
  };
  for (const token of ownTokens) {
    const scopes = [...token.tokenTypes, ...token.creatureTypes, ...(token.isCreature ? ["creature"] : []), "any"];
    for (const scope of new Set(scopes)) pieces.tokenSourcesByScope[scope] = (pieces.tokenSourcesByScope[scope] || 0) + (repeatable ? 1 : 0.5);
  }
  const uncertainties = [...facts.uncertainties];
  if (ultimateIgnored) reasons.push({ value: 0, reason: "Its ultimate costs more loyalty than it starts with, so it isn't counted." });
  if (!text && !isLand) uncertainties.push("No Oracle text available; impact is not inferred.");
  const result: CardFunction = {
    version: CARD_FUNCTION_VERSION,
    name: card.name,
    manaValue: printedMv,
    effectiveManaValue: mv,
    isLand,
    isBasicLand: isBasicLand(card),
    isCreature,
    creatureTypes: [...new Set(faces.flatMap((f) => f.creatureTypes))],
    changeling: faces.some((f) => f.hasChangeling),
    facts,
    roles,
    answers,
    coverage,
    instantInteraction,
    repeatable,
    engines: pieces,
    impact: Math.round(impact * 1000) / 1000,
    impactReasons: [...reasons].sort((a, b) => b.value - a.value).map((r) => r.reason),
    lowImpactBody,
    bodyScore,
    confidence: !text && !isLand ? "Low" : uncertainties.length > 1 ? "Low" : uncertainties.length || /choose (?:one|two)|at random|mutate|phase out/i.test(text) ? "Medium" : "High",
    uncertainties,
  };
  cache.set(key, result);
  if (cache.size > 10000) cache.delete(cache.keys().next().value!);
  return result;
}

const ENGINE_KEYS = ["noncombatDamageSources", "combatThreat", "attackTriggers", "damageMultipliers", "extraCombats", "controlledDiscard", "wantsDiscard"] as const;
const lowerConfidence = (a: CardFunction["confidence"], b: CardFunction["confidence"]) => (a === "Low" || b === "Low" ? "Low" : a === "Medium" || b === "Medium" ? "Medium" : "High");
const listNames = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", "));
/**
 * The card's function in one deck. An ability that needs a condition ("Whenever you cast a colorless spell") earns
 * credit only in proportion to the deck cards that reliably satisfy it; with fewer than two suppliers it earns none.
 * Unconditional abilities are unaffected. Without a supply index this is the context-free card function.
 */
export function deckCardFunction(card: CardMetadata, supply?: SupplyIndex): CardFunction {
  if (!supply) return cardFunction(card);
  const fn = conditionedFunction(card, supply);
  const crew = crewCondition(card);
  if (!crew) return fn;
  // A Vehicle's attacks and body need creatures to crew it; its other abilities don't.
  const { supply: amount, suppliers } = supply.supply(crew, card);
  const f = conditionFactor(crew, amount);
  const credit: ConditionCredit = { needs: crew.needs, line: crew.line, understood: true, supply: amount, suppliers, factor: f };
  const note =
    f >= 1
      ? `Crewed by the ${amount} creatures here.`
      : `Only ${amount} creature${amount === 1 ? "" : "s"} here to crew it, so its attacks get ${f > 0 ? "partial" : "no"} credit.`;
  if (f >= 1) return { ...fn, impactReasons: [...fn.impactReasons, note], conditions: [...(fn.conditions || []), credit] };
  const roles = { ...fn.roles };
  if (roles.finishers) roles.finishers *= f;
  if (!roles.finishers) delete roles.finishers;
  return {
    ...fn,
    roles,
    engines: { ...fn.engines, combatThreat: fn.engines.combatThreat * f, attackTriggers: fn.engines.attackTriggers * f },
    impact: Math.round((fn.impact - (1 - f) * fn.bodyScore) * 1000) / 1000,
    impactReasons: [...fn.impactReasons, note],
    conditions: [...(fn.conditions || []), credit],
  };
}
function conditionedFunction(card: CardMetadata, supply: SupplyIndex): CardFunction {
  const full = cardFunction(card);
  const conditions = effectConditions(card);
  if (!conditions.length) return full;
  const credits: (ConditionCredit & { lineIndex: number })[] = conditions.map((condition, lineIndex) => {
    const { supply: amount, suppliers } = supply.supply(condition, card);
    return { needs: condition.needs, line: condition.line, understood: condition.understood, supply: amount, suppliers, factor: conditionFactor(condition, amount), lineIndex };
  });
  const confidence = credits.some((c) => !c.understood) ? lowerConfidence(full.confidence, "Medium") : full.confidence;
  const notes = credits.map((c) =>
    !c.understood
      ? `Couldn't check whether this deck supports "${c.line.slice(0, 90)}", so that ability gets half credit.`
      : c.factor >= 1
        ? `Its "${c.needs}" ability is fed by ${c.supply >= 10 ? c.supply : c.suppliers.length} cards here: ${listNames(c.suppliers)}.`
        : c.factor > 0
          ? `Its "${c.needs}" ability is fed by only ${c.suppliers.length} cards here (${listNames(c.suppliers)}), so it gets partial credit.`
          : `Its "${c.needs}" ability has ${c.suppliers.length ? `only ${listNames(c.suppliers)}` : "no cards"} to feed it here, so it gets no credit.`,
  );
  const strip = (c: ConditionCredit) => ({ needs: c.needs, line: c.line, understood: c.understood, supply: c.supply, suppliers: c.suppliers, factor: c.factor });
  if (credits.every((c) => c.factor >= 1)) return { ...full, impactReasons: [...full.impactReasons, ...notes], conditions: credits.map(strip) };
  const lines = [...new Set(conditions.map((c) => c.line))];
  const base = cardFunction(withoutLines(card, lines));
  const roles: Partial<Record<Need, number>> = { ...base.roles };
  const engines: EnginePieces = { ...base.engines, tokenSourcesByScope: { ...base.engines.tokenSourcesByScope }, tokenMultipliers: { ...base.engines.tokenMultipliers } };
  let impact = base.impact;
  const answers = [...base.answers];
  const reasons = [...base.impactReasons];
  let repeatable = base.repeatable;
  // Each condition's own ability, scaled by its supply. Several conditions on one line share the weakest supply.
  const byLine = new Map<string, number>();
  for (const c of credits) byLine.set(c.line, Math.min(byLine.get(c.line) ?? 1, c.factor));
  for (const [line, f] of byLine) {
    if (f <= 0) continue;
    const withLine = cardFunction(withoutLines(card, lines.filter((l) => l !== line)));
    for (const need of Object.keys(withLine.roles) as Need[]) {
      const b = base.roles[need] || 0;
      roles[need] = Math.max(roles[need] || 0, b + f * ((withLine.roles[need] || 0) - b));
    }
    for (const key of ENGINE_KEYS) engines[key] += f * (withLine.engines[key] - base.engines[key]);
    for (const [scope, n] of Object.entries(withLine.engines.tokenSourcesByScope)) engines.tokenSourcesByScope[scope] = (engines.tokenSourcesByScope[scope] || 0) + f * (n - (base.engines.tokenSourcesByScope[scope] || 0));
    for (const [scope, n] of Object.entries(withLine.engines.tokenMultipliers)) engines.tokenMultipliers[scope] = Math.max(engines.tokenMultipliers[scope] || 0, f * n);
    impact = Math.max(impact, base.impact + f * (withLine.impact - base.impact));
    if (f >= 0.5) {
      for (const a of withLine.answers) if (!answers.some((b) => b.text === a.text)) answers.push(a);
      repeatable ||= withLine.repeatable;
    }
    for (const r of withLine.impactReasons) if (!reasons.includes(r)) reasons.push(r);
  }
  for (const need of Object.keys(roles) as Need[]) if ((roles[need] || 0) < 0.05) delete roles[need];
  return {
    ...full,
    roles,
    engines,
    answers,
    coverage: [...new Set(answers.flatMap((a) => a.targets))],
    instantInteraction: answers.some((a) => a.instantSpeed),
    repeatable,
    impact: Math.round(impact * 1000) / 1000,
    impactReasons: [...reasons, ...notes],
    lowImpactBody: full.isCreature && impact < 0.25,
    confidence,
    conditions: credits.map(strip),
  };
}
