// Deck-relative conditions. A card only gets credit for an effect when actual cards in this deck reliably satisfy the
// condition that effect needs ("Whenever you cast a colorless spell", "creature spell with power 4 or greater",
// "+1/+1 counters are put on …"). The effect's share of the card's roles is scaled by that supply, and the cards that
// supply it are named in the explanation.
import type { CardMetadata } from "../models/collection";
import { stripAbilityWord, stripReminderText } from "../utils/rulesText";
import { cardKeywords } from "../utils/cardKeywords";
import { counterRecipient, placesCountersOn, countersTargetSelf, suppliesCounterEvent } from "./counterSupply";
import { capabilities } from "../synergy/capabilities";
import { benefitsYou, extractCardFacts } from "../synergy/facts";

export const CONDITIONS_VERSION = "1.1.0";
export interface DeckSupplier {
  card: CardMetadata;
  quantity: number;
  commander: boolean;
}
export interface EffectCondition {
  /** Stable key for the predicate, shared by every card with the same condition. */
  key: string;
  /** The ability line the condition gates (removed to compute the card's unconditional part). */
  line: string;
  /** What the deck must supply, in plain words: "colorless spells". */
  needs: string;
  /** Supply at which the condition is reliable enough for full credit. */
  reliableAt: number;
  /** False when the trigger wasn't recognized: it gets partial credit and lowers confidence. */
  understood: boolean;
  supplies: (card: CardMetadata) => boolean;
  /** The card itself can satisfy it ("Adapt 2" for "+1/+1 counters are put on this creature"). */
  selfSupplies: boolean;
  /** Self-only placement is not an external supplier for another permanent. */
  selfProvides?: (card: CardMetadata) => boolean;
  chooseCreatureType?: boolean;
  minimumSupply?: number;
}
export interface ConditionCredit {
  /** The condition's predicate key ("cast:colorless", "counters:+1/+1"). */
  key: string;
  /** Roles this ability adds to the card when its condition is met (what it turns the condition into). */
  adds: string[];
  needs: string;
  line: string;
  understood: boolean;
  supply: number;
  suppliers: string[];
  /** 0–1: the share of this effect's credit the deck earns. */
  factor: number;
}
const front = (c: CardMetadata) => (c.cardFaces?.[0]?.typeLine || c.typeLine || "").split("—");
const types = (c: CardMetadata) => front(c)[0];
const subtypes = (c: CardMetadata) => (front(c)[1] || "").trim().split(/\s+/).filter(Boolean);
const textOf = (c: CardMetadata) =>
  stripReminderText((c.cardFaces?.length ? c.cardFaces.map((f) => f.oracleText || "").join("\n") : c.oracleText || "").replace(/[’‘]/g, "'"));
const isLand = (c: CardMetadata) => /\bLand\b/.test(types(c));
const isCreature = (c: CardMetadata) => /\bCreature\b/.test(types(c));
const changeling = (c: CardMetadata) => cardKeywords(c).some((k) => /^changeling$/i.test(k));
const hasType = (c: CardMetadata, type: string) => changeling(c) && isCreature(c) ? true : subtypes(c).some((t) => t.toLowerCase() === type.toLowerCase());
const colorless = (c: CardMetadata) => !isLand(c) && !/\{[^}]*[WUBRG][^}]*\}/.test(c.manaCost || "");
const power = (c: CardMetadata) => Number(c.power ?? c.cardFaces?.[0]?.power);
const ownTokens = (c: CardMetadata) => extractCardFacts(c).faces.flatMap((f) => f.createsTokens).filter((t) => benefitsYou(t.controller) && t.controller !== "each_player");
const NOT_TYPES = new Set(["Creatures", "Creature", "Spells", "Artifacts", "Artifact", "Enchantments", "Enchantment", "Lands", "Land", "Permanents", "Tokens", "Nontoken", "Noncreature", "Legendary", "Instant", "Sorcery", "Each", "Other", "All", "Target", "Players", "Opponents", "You", "Your", "Equipped", "Enchanted", "Colorless", "Multicolored", "White", "Blue", "Black", "Red", "Green"]);


/** The spell or permanent a trigger is about: "colorless", "creature with power 4 or greater", "Dragon", "artifact"… */
interface Qualifier {
  key: string;
  needs: string;
  test: (c: CardMetadata) => boolean;
  understood: boolean;
}
function qualifier(phrase: string): Qualifier {
  const parts: ((c: CardMetadata) => boolean)[] = [];
  const labels: string[] = [];
  let understood = true;
  let rest = phrase.replace(/instant and sorcery/gi, "instant or sorcery").trim().replace(/^(?:a|an|another|other|one or more(?: other)?|two or more)(?:\s+|$)/i, "");
  // "a creature or planeswalker", "an artifact or enchantment spell": either one satisfies it.
  const alternatives = rest.split(/\s+or\s+(?:an?\s+)?(?!sorcery\b|\d)/i);
  if (alternatives.length > 1 && !/\bpower \d+, /i.test(rest)) {
    const each = alternatives.map((a) => qualifier(a));
    if (each.every((q) => q.understood && q.key !== "any"))
      return { key: each.map((q) => q.key).join("|"), needs: each.map((q) => q.needs).join(" or "), test: (c) => each.some((q) => q.test(c)), understood: true };
  }
  const take = (re: RegExp, label: string, test: (c: CardMetadata, m: RegExpMatchArray) => boolean) => {
    const m = rest.match(new RegExp(re.source, "i"));
    if (!m) return;
    parts.push((c) => test(c, m));
    labels.push(label.replace(/\$(\d)/g, (_, i) => m[Number(i)].toLowerCase()));
    rest = rest.replace(new RegExp(re.source, "i"), " ").replace(/\s+/g, " ").trim();
  };
  take(/\bnontoken\b/, "nontoken", () => true);
  take(/\bnon-([a-z]+)\b/, "non-$1", (c, m) => isCreature(c) && !hasType(c, m[1]));
  take(/\bkicked\b/, "kicked", (c) => cardKeywords(c).some((k) => /kicker$/i.test(k)));
  take(/\bcolorless\b/, "colorless", (c) => colorless(c));
  take(/\bmulticolored\b/, "multicolored", (c) => new Set((c.manaCost || "").match(/[WUBRG]/g) || []).size >= 2);
  take(/\b(white|blue|black|red|green)\b/, "$1", (c, m) => (c.manaCost || "").includes(`{${({ white: "W", blue: "U", black: "B", red: "R", green: "G" } as Record<string, string>)[m[1].toLowerCase()]}`));
  take(/\bnoncreature\b/, "noncreature", (c) => !isCreature(c));
  take(/\binstant or sorcery\b/, "instant or sorcery", (c) => /\b(?:Instant|Sorcery)\b/.test(types(c)));
  take(/\binstant\b/, "instant", (c) => /\bInstant\b/.test(types(c)));
  take(/\bsorcery\b/, "sorcery", (c) => /\bSorcery\b/.test(types(c)));
  take(/\blegendary\b/, "legendary", (c) => /\bLegendary\b/.test(types(c)));
  take(/\bhistoric\b/, "historic", (c) => /\b(?:Legendary|Artifact)\b/.test(types(c)) || subtypes(c).includes("Saga"));
  take(/\bartifacts?\b/, "artifact", (c) => /\bArtifact\b/.test(types(c)));
  take(/\benchantments?\b/, "enchantment", (c) => /\bEnchantment\b/.test(types(c)));
  take(/\bplaneswalkers?\b/, "planeswalker", (c) => /\bPlaneswalker\b/.test(types(c)));
  take(/\b(aura|equipment|vehicle)s?\b/, "$1", (c, m) => hasType(c, m[1]));
  take(/\bcreatures?\b/, "creature", (c) => isCreature(c));
  take(/\blands?\b/, "land", (c) => isLand(c));
  take(/\bwith (?:mana value|converted mana cost) (\d+) or greater\b/, "with mana value $1+", (c, m) => (c.manaValue || 0) >= Number(m[1]));
  take(/\bwith power (\d+) or greater\b/, "with power $1+", (c, m) => power(c) >= Number(m[1]));
  take(/\bwith power ((?:\d+, )+(?:or )?\d+)\b/, "with power $1", (c, m) => m[1].match(/\d+/g)!.map(Number).includes(power(c)));
  take(/\bwith (flying|trample|haste|deathtouch|lifelink|vigilance|menace|defender)\b/, "with $1", (c, m) => cardKeywords(c).some((k) => k.toLowerCase() === m[1]));
  take(/\btokens?\b/, "token", (c) => /\bToken\b/.test(c.typeLine));
  rest = rest.replace(/\b(?:spells?|permanents?|cards?|you control|under your control|creatures?)\b/gi, " ").replace(/\s+/g, " ").trim();
  // Anything left must be capitalized creature types ("Dragon", "Elf or Warrior"); other wording isn't modeled.
  if (rest) {
    const typed = rest.split(/\s+(?:or|and)\s+|,\s*(?:or\s+)?/).filter(Boolean);
    if (typed.every((t) => /^[A-Z][a-z-]+$/.test(t))) {
      const singular = typed.map((t) => t.replace(/(?:es|s)$/, ""));
      parts.push((c) => typed.some((t, i) => hasType(c, t) || hasType(c, singular[i])));
      labels.push(typed.join(" or "));
    } else understood = false;
  }
  if (!labels.length && !rest) return { key: "any", needs: "", test: () => true, understood };
  return { key: `${labels.join(" ")}${understood ? "" : `?${rest}`}`, needs: labels.join(" ") || rest, test: (c) => parts.every((t) => t(c)), understood };
}

/** A token as a card, so the same qualifier can test it ("Dragon", "artifact", "creature"). */
const tokenCard = (t: { creatureTypes: string[]; tokenTypes: string[]; isCreature: boolean; isArtifact?: boolean }) =>
  ({ name: "token", typeLine: `Token ${t.isArtifact || t.tokenTypes.length ? "Artifact " : ""}${t.isCreature ? "Creature " : ""}— ${[...t.creatureTypes, ...t.tokenTypes].join(" ")}`, manaCost: "", manaValue: 0 }) as unknown as CardMetadata;
const tokenMakes = (c: CardMetadata, q: (t: { creatureTypes: string[]; tokenTypes: string[]; isCreature: boolean; isArtifact?: boolean }) => boolean) => ownTokens(c).some(q);

/** Conditions gating this card's abilities. Self triggers ("When this creature enters"), phase triggers and triggers
 * every table supplies (opponents' actions, "a creature dies") are not conditions on the deck. */
function computeConditions(card: CardMetadata): EffectCondition[] {
  const text = textOf(card);
  const short = /\bLegendary\b/.test(types(card)) ? card.name.split(/[ ,]/)[0] : "";
  const names = [card.name, ...card.name.split(" // "), card.name.split(",")[0], short].filter((n) => n.length > 3).sort((a, b) => b.length - a.length);
  const out: EffectCondition[] = [];
  for (const raw of text.split("\n")) {
    let line = stripAbilityWord(raw.trim());
    for (const n of names) line = line.split(n).join("~");
    const cond = (key: string, needs: string, reliableAt: number, supplies: (c: CardMetadata) => boolean, selfSupplies = false, understood = true) =>
      out.push({ key, line: raw.trim(), needs, reliableAt, supplies, selfSupplies, understood });
    if (/of the chosen type/i.test(line) && /choose a creature type/i.test(text)) {
      cond("chosen:creature-type", "one chosen creature type", 8, c => isCreature(c));
      out[out.length - 1].chooseCreatureType = true;
      continue;
    }
    const named = line.match(/if you control (\w+) or more creatures named ~,/i);
    if (named) {
      const n = ({ two: 2, three: 3, four: 4, five: 5 } as Record<string, number>)[named[1]] || Number(named[1]);
      if (Number.isFinite(n)) {
        cond(`named-copies:${card.oracleId || card.name}`, `${n} simultaneous creatures with this name`, n, c => capabilities(c).permanentCopy && (!/Legendary/.test(types(card)) || capabilities(c).ignoresLegend), true);
        out[out.length - 1].selfProvides = c => c.oracleId === card.oracleId || c.name === card.name;
        out[out.length - 1].minimumSupply = n;
        continue;
      }
    }
    const costs = line.match(/^(.+?) spells you cast cost /i);
    if (costs) {
      const q = qualifier(costs[1]);
      if (q.key !== "any") {
        cond(`cast:${q.key}`, `${q.needs} spells`, 8, (c) => !isLand(c) && q.test(c), false, q.understood);
        continue;
      }
    }
    const transformation = capabilities(card).transformCastThreshold;
    if (transformation && /When that mana is spent to cast an instant or sorcery spell, copy that spell/i.test(line)) {
      cond("transform-cast:instant-or-sorcery", "instant or sorcery casts to transform before copying", 8, c => /\b(?:Instant|Sorcery)\b/.test(types(c)));
      out[out.length - 1].minimumSupply = transformation;
      continue;
    }
    if (/draw[^\n]*for each creature you control with a \+1\/\+1 counter/i.test(line)) {
      const recipient = { ...card, typeLine: "Creature", cardFaces: undefined };
      cond("counters:+1/+1:Creature:board", "cards that put +1/+1 counters", 5, c => suppliesCounterEvent(c, recipient, false));
      continue;
    }
    // General counter replacement wording includes “put counters” and “counters would be put”.
    if (/^If[^\n]*counters?[^\n]*on (?:an? |one or more )?(?:artifact or creature|creature|permanent)[^\n]*you control/i.test(line) && /instead/.test(line)) {
      const recipient = counterRecipient(card, line);
      cond(`counters:+1/+1:${types(recipient).trim()}:board`, "cards that put +1/+1 counters", 5, (source) => suppliesCounterEvent(source, recipient, false));
      continue;
    }
    // Replacement effects that only do something when the deck produces the event (Hardened Scales, Doubling Season).
    if (/^If (?:one or more )?\+1\/\+1 counters? would be put on/i.test(line)) {
      const recipient=counterRecipient(card,line), selfTarget=countersTargetSelf(card,line);
      cond(`counters:+1/+1:${types(recipient).trim()}:${selfTarget ? "self" : "board"}`, "cards that put +1/+1 counters", 5, (source)=>suppliesCounterEvent(source,recipient,selfTarget));
      continue;
    }
    if (/^If (?:you|an effect) would create (?:one or more |a )?tokens?/i.test(line)) {
      cond("token", "token makers", 5, (c) => ownTokens(c).length > 0);
      continue;
    }
    const ability = /attach|Vehicle|Tap[^\n]*artifacts[^\n]*Draw/i.test(raw) ? capabilities({ ...card, oracleText: raw, cardFaces: undefined }) : undefined;
    if (ability?.attach) {
      cond("attach:equipment-aura", "Equipment and compatible Auras", 8, c => /Equipment/.test(c.typeLine) || /Aura/.test(c.typeLine) && /Enchant (?:creature|permanent)\b/i.test(textOf(c)));
      continue;
    }
    if (ability?.animateVehicle || ability?.crewReduction) {
      cond("animate:vehicle", "Vehicles to animate or crew", 8, c => /Vehicle/.test(c.typeLine));
      continue;
    }
    if (ability?.artifactTapDraw) {
      cond("tap:artifact", "artifacts to pay the draw activation cost", 8, c => /Artifact/.test(types(c)) || ownTokens(c).some(t => t.isArtifact || t.tokenTypes.length > 0));
      continue;
    }
    // Static effects scoped to a creature type: "Dragon creatures you control get +3/+3", "Elf spells you cast cost {1} less".
    const typed = line.match(/^(?:Other |Each )?([A-Z][a-z-]+(?: and [A-Z][a-z-]+)?)(?: creatures?)? (?:you control|spells you cast)\b/);
    if (typed && !NOT_TYPES.has(typed[1].split(" ")[0])) {
      const q = qualifier(typed[1].replace(" and ", " or "));
      cond(`type:${q.key}`, `${q.needs} creatures`, 8, (c) => (!isLand(c) && q.test(c)) || tokenMakes(c, (t) => q.test(tokenCard(t))));
      continue;
    }
    // "At the beginning of your upkeep, if you control an artifact, …": an intervening condition on the deck.
    const control = line.match(/^At the beginning of [^,]*, if you control (?:an?|one or more|(\w+) or more|at least (\w+)) ([^,]+?),/i);
    if (control) {
      const q = qualifier(control[3]);
      cond(`control:${q.key}`, `${q.needs || "permanents"}s to control`, 8, (c) => (!isLand(c) || q.key === "land") && q.test(c), false, q.understood);
      continue;
    }
    if (!/^(?:When|Whenever)\b/.test(line)) continue;
    // The trigger clause ends at the first comma that isn't inside a list such as "power 4, 5, or 6".
    // "This creature or another Dragon you control enters" is a condition on the other Dragons.
    const trigger = line
      .split(/,(?! (?:\d+|or \d+)[ ,])/)[0]
      .replace(/^(?:When|Whenever)\s+/, "")
      .replace(/^(?:this (?:creature|enchantment|artifact|permanent)|~)(?: or (another|an?|one or more other)) /i, "$1 ")
      .replace(/\bcast or copy\b/i, "cast")
      .replace(/ of the chosen type\b/i, "")
      .replace(/\bis put into your graveyard from the battlefield\b/i, "you control dies");
    const self = /^(?:you cast this spell|this\b|~|equipped\b|enchanted\b|fortified\b|your commanders?\b)/i.test(trigger);
    // Supplied by every table or every deck: opponents' actions, any creature dying, your attacks and draws.
    const table = /^(?:an?|each) (?:opponent|player)\b|^a player\b|\bopponents? controls?\b|\bunder an opponent's control\b|\bdeals? damage to you\b|^you(?:'re| are) dealt damage\b|^you (?:attack|draw a card|draw one or more cards|cast your first spell|lose life|tap a land|tap an untapped land)\b|^day becomes night|^night becomes day/i.test(trigger);
    if (self || table) continue;
    let m: RegExpMatchArray | null;
    if ((m = trigger.match(/^you (?:next )?cast (.+)$/i))) {
      const phrase = m[1].replace(/\b(?:each turn|this turn|during (?:your|an opponent's|each) turn|from (?:exile|your graveyard|anywhere other than your hand))\b/gi, " ").replace(/\b(?:your (?:second|third|next)|(?:second|third) )\s*/gi, "").replace(/\bspells?\b/i, " ");
      const q = qualifier(phrase);
      if (q.key === "any") continue; // every nonland card is a spell: any deck supplies it
      cond(`cast:${q.key}`, q.needs.replace(/^(.*?)( with .*)?$/, (_, a: string, b = "") => `${a} spells${b}`), 8, (c) => !isLand(c) && q.test(c), false, q.understood);
    } else if ((m = trigger.match(/^(?:~ or )?(?:another |a |an |one or more )?(.+?) (?:you control )?enters?(?: the battlefield)?(?: under your control)?(?: or .*)?$/i))) {
      const subject = m[1].replace(/\b(?:you control|under your control)\b/g, "").trim();
      if (/^(?:~|this)\b/i.test(subject)) continue;
      const q = qualifier(subject);
      const tokenOnly = /\btoken\b/i.test(subject);
      const nontoken = /\bnontoken\b/i.test(subject);
      if (/\bland\b/i.test(subject)) cond("enters:land", "lands entering", 30, (c) => isLand(c) || /\bsearch your library for [^.]*\blands?\b[^.]*onto the battlefield|you may play (?:an?|one|two) additional lands?/i.test(textOf(c)));
      else
        cond(`enters:${q.key}`, `${q.needs ? `${q.needs}s` : "permanents"} entering`, 8, (c) =>
          (!tokenOnly && !isLand(c) && q.test(c)) ||
          (!nontoken && tokenMakes(c, (t) => tokenOnly || q.key === "any" || q.test(tokenCard(t)))),
        false, q.understood);
    } else if ((m = trigger.match(/^(?:another |a |an |one or more )?(nontoken )?(.+?) you control (?:dies|die|is put into a graveyard)/i))) {
      const q = qualifier(`${m[1] || ""}${m[2]}`);
      cond(`dies:${q.key}`, `${q.needs || "creature"}s that can die`, 8, (c) => (!isLand(c) && q.test(c)) || (!m![1] && tokenMakes(c, (t) => q.test(tokenCard(t)))), false, q.understood);
    } else if (/counters? (?:are|is) put on|you put one or more [^,]*counters?/i.test(trigger)) {
      const recipient=counterRecipient(card,trigger), selfTarget=countersTargetSelf(card,trigger);
      cond(`counters:+1/+1:${types(recipient).trim()}:${selfTarget ? "self" : "board"}`, "cards that put +1/+1 counters", 5, (source)=>suppliesCounterEvent(source,recipient,selfTarget), true);
      out[out.length-1].selfProvides=(source)=>placesCountersOn(source,recipient,true);
    } else if (/^you sacrifice /i.test(trigger)) {
      cond("sacrifice", "sacrifice outlets and effects", 5, (c) => /\bsacrifice (?:a|an|another|one or more|any number of|x|two)\b[^.\n]*(?:creature|artifact|permanent|token|food|clue|treasure)|:\s*[^.\n]*\bsacrifice\b/i.test(textOf(c)) || /\bTreasure\b|\bFood\b|\bClue\b/.test(textOf(c)), true);
    } else if (/^you gain life\b|^you gain \w+ or more life/i.test(trigger)) {
      cond("lifegain", "life-gain sources", 5, (c) => /\byou gain (?:\d+|x|that much|that many|one|two|three|four|life)\b|\bgain \d+ life\b/i.test(textOf(c)) || cardKeywords(c).some((k) => /^lifelink$/i.test(k)), true);
    } else if (/^you discard /i.test(trigger)) {
      cond("discard", "ways to discard cards", 5, (c) => extractCardFacts(c).faces.some((f) => f.discards.some((d) => d.who === "you" || d.who === "each_player")), true);
    } else if (/^you create (?:one or more |a |an )?.*tokens?|^(?:a|one or more) tokens? (?:you control )?enters?/i.test(trigger)) {
      cond("token", "token makers", 5, (c) => ownTokens(c).length > 0, true);
    } else if (/^you (?:scry|surveil)\b/i.test(trigger)) {
      cond("scry", "scry or surveil effects", 5, (c) => /\b(?:scry|surveil) (?:\d+|x)\b/i.test(textOf(c)), true);
    } else if (/^you cycle (?:or discard )?/i.test(trigger)) {
      cond("cycle", "cards with cycling", 6, (c) => cardKeywords(c).some((k) => /cycling$/i.test(k)), true);
    } else if (/^you draw your second card/i.test(trigger)) {
      cond("draw2", "extra card draw", 6, (c) => extractCardFacts(c).faces.some((f) => f.cardDrawEffects.some((d) => benefitsYou(d.controller))), true);
    } else if ((m = trigger.match(/^(?:another |a |an |one or more )?(.+?) you control (?:attacks?|deals? combat damage)\b/i))) {
      const q = qualifier(m[1]);
      if (q.key === "any" || q.key === "creature") continue; // any attacking creature: supplied by any creature deck
      cond(`attacks:${q.key}`, `${q.needs}s that attack`, 8, (c) => (!isLand(c) && q.test(c)) || tokenMakes(c, (t) => t.isCreature && q.test(tokenCard(t))), false, q.understood);
    } else if (/\bcards? leaves? your graveyard|cards? leave your graveyard/i.test(trigger)) {
      cond("graveyard-leave", "ways to use cards from your graveyard", 5, (c) => /\bfrom your graveyard\b/i.test(textOf(c)) || cardKeywords(c).some((k) => /^(?:flashback|escape|unearth|delve|embalm|eternalize|disturb|retrace|jump-start|encore|scavenge)$/i.test(k)), true);
    } else if (/cards? (?:are|is) put into your graveyard from (?:your library|anywhere)/i.test(trigger)) {
      cond("self-mill", "ways to put cards into your graveyard", 5, (c) => /\bmill\b|\bsurveil\b|cards? of your library into your graveyard|\bdiscard\b/i.test(textOf(c)), true);
    } else if (/^a source you control deals noncombat damage/i.test(trigger)) {
      cond("noncombat-damage", "noncombat damage sources", 6, (c) => /\bdeals? (?:\d+|x|that much|damage equal)[^.\n]*damage to (?:any target|each opponent|target (?:player|opponent)|each player)/i.test(textOf(c)), true);
    } else if (/^(?:a|another) (?:nontoken )?(?:creature|permanent|artifact)\b|^~ (?:and at least|and \w+ other)/i.test(trigger)) {
      continue; // supplied by the card itself or by any creature deck
    } else {
      cond(`other:${trigger.toLowerCase()}`, trigger.replace(/^you /i, "you "), 6, () => false, false, false);
    }
  }
  return out;
}
/** Every deck card, the Commander included, that supplies a condition. The Commander counts twice: it is always available. */
export class SupplyIndex {
  private cache = new Map<string, { supply: number; suppliers: string[] }>();
  constructor(readonly cards: DeckSupplier[]) {}
  supply(condition: EffectCondition, self?: CardMetadata) {
    let known = this.cache.get(condition.key);
    if (!known) {
      let supply = 0;
      const suppliers: string[] = [];
      let chosenType: string | undefined;
      if (condition.chooseCreatureType) {
        const candidates = [...new Set(this.cards.filter(c => isCreature(c.card)).flatMap(c => subtypes(c.card)))];
        chosenType = candidates.sort((a, b) => {
          const count = (type: string) => this.cards.reduce((n, c) => n + (isCreature(c.card) && hasType(c.card, type) ? c.commander ? 2 : c.quantity : 0), 0);
          return count(b) - count(a) || a.localeCompare(b);
        })[0];
      }
      for (const c of this.cards) {
        if (!condition.understood || !condition.supplies(c.card) || condition.chooseCreatureType && (!chosenType || !hasType(c.card, chosenType))) continue;
        supply += c.commander ? 2 : c.quantity;
        if (!suppliers.includes(c.card.name)) suppliers.push(c.card.name);
      }
      this.cache.set(condition.key, (known = { supply, suppliers }));
    }
    if (self && condition.selfSupplies && (condition.selfProvides || condition.supplies)(self) && !known.suppliers.includes(self.name)) return { supply: known.supply + 1, suppliers: [...known.suppliers, self.name] };
    return known;
  }
}
/** Credit share for one condition: nothing below two suppliers, full credit once the deck supplies it reliably. */
export function conditionFactor(condition: EffectCondition, supply: number) {
  if (!condition.understood) return 0.5;
  if (supply < (condition.minimumSupply || 2)) return 0;
  return Math.min(1, supply / condition.reliableAt);
}
/** Vehicles attack only when crewed: their body and attack abilities need creatures in the deck. */
export function crewCondition(card: CardMetadata): EffectCondition | null {
  const crew = textOf(card).match(/^Crew (\d+)/m);
  if (!crew || !/\bVehicle\b/.test(card.cardFaces?.[0]?.typeLine || card.typeLine)) return null;
  return { key: "crew", line: crew[0], needs: "creatures to crew it", reliableAt: 12, understood: true, selfSupplies: false, supplies: (c) => (isCreature(c) && !isLand(c)) || ownTokens(c).some((t) => t.isCreature) };
}
export function withoutLines(card: CardMetadata, lines: string[]): CardMetadata {
  if (!lines.length) return card;
  const drop = (text?: string) => (text === undefined ? text : text.split("\n").filter((l) => !lines.includes(stripReminderText(l).replace(/[’‘]/g, "'").trim())).join("\n"));
  return { ...card, oracleText: drop(card.oracleText), cardFaces: card.cardFaces?.map((f) => ({ ...f, oracleText: drop(f.oracleText) })) };
}

const conditionCache = new WeakMap<CardMetadata, EffectCondition[]>();
export function effectConditions(card: CardMetadata): EffectCondition[] {
  let known = conditionCache.get(card);
  if (!known) conditionCache.set(card, known = computeConditions(card));
  return known;
}
