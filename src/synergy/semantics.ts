// Ability-level semantics (v0.6.23). A card is split into its abilities: keyword lines, static / triggered /
// activated abilities, loyalty abilities, Saga chapters, Class levels, dice-result branches and abilities granted
// in quotes. Each ability gets typed capabilities and an access level, so understood parts of a card count even
// when another clause is unsupported, and potential value (ultimates, later levels/chapters) is not treated as
// immediately available. Oracle-derived only: no card names, scores or archetype tables.
import type { CardMetadata } from "../models/collection";
import { stripAbilityWord, stripReminderText } from "../utils/rulesText";
import { cardKeywords } from "../utils/cardKeywords";

export type AbilityKind = "keyword" | "static" | "triggered" | "activated" | "loyalty" | "chapter" | "level" | "branch" | "spell" | "procedural";
export type Access = "immediate" | "gated" | "inaccessible";
export interface Ability {
  /** The ability exactly as printed (reminder text removed). */
  line: string;
  /** Text used for parsing: ability words, chapter numerals, branch ranges and loyalty costs stripped. */
  effect: string;
  kind: AbilityKind;
  access: Access;
  /** Share of the ability's value available in practice: 1 immediate, < 1 gated (later level/chapter, opponent state), 0 inaccessible. */
  weight: number;
  /** For dice-result branches: the probability of this result. */
  probability?: number;
  capabilities: string[];
}
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
// Rules procedure, not a strategic ability: casting restrictions, entering tapped, choices made on entry, mode headers.
const PROCEDURAL = /^(?:Cast this spell only\b|If this card is in your opening hand\b|As an additional cost to cast this spell\b|\(Gain the next level|Gain the next level\b|This (?:land|artifact|permanent|creature|enchantment) enters tapped\b|(?:~|This land) enters tapped\b|As (?:this|~)\b[^,]*\benters, (?:choose|you may reveal|you may exchange)\b|Choose (?:one|two|three|one or both|one or more|any number)\b[^—]*—$|You can't cast (?:this spell|~) unless\b|Activate only\b|~ can't be countered\.?$|This spell can't be countered\.?$)/i;
// Understood rules structure that needs no strategic credit: mana abilities, evasion and P/T definitions, hand size,
// transform, devotion, forced attacks, uncounterability and similar.
const STRUCTURE: [string, RegExp][] = [
  ["MANA_ABILITY", /(?:^|: )Add (?:\{|one mana|two mana|three mana|X mana|an amount)|\{T\}(?:, [^:]*)?: Add\b/i],
  ["NO_MAX_HAND_SIZE", /\bno maximum hand size\b|\bmaximum hand size is\b/i],
  ["CDA_PT", /\bpower and toughness are each equal to\b|\bpower is equal to\b|\btoughness is equal to\b/i],
  ["EVASION", /\bcan't be blocked\b/i],
  ["UNTAP_SELF", /^Untap (?:this creature|~)\.?$/i],
  ["ALT_COST", /\brather than pay (?:this spell's|its) mana cost\b/i],
  ["TRANSFORM", /\b(?:transform|convert) (?:~|this\b|it\b)/i],
  ["DEVOTION", /\bdevotion to\b/i],
  ["FORCED_ATTACK", /\battacks? (?:this turn|each combat) if able\b/i],
  ["TOPDECK_LOOK", /\blook at the top card of your library any time\b/i],
  ["CONDITIONAL_KEYWORD", /^During your turn, (?:~|this creature) has \w+/i],
  ["TARGET_TAX", /\bthat targets? (?:this creature|it|~)\b[^.]*\bcosts? \{\d+\} more\b/i],
  ["LIFEGAIN_HATE", /\b(?:players|your opponents|opponents|each opponent) can't gain life\b/i],
  ["MANA_RETENTION", /\bdon't lose unspent\b/i],
  ["UNCOUNTERABLE", /\bcan't be countered\b/i],
  ["SELF_COUNTER_TRIGGER", /\bput an? [\w+/-]+ counter on (?:this|~)\b/i],
  ["ANIMATE_SELF", /^Tap (?:\w+|any number of) untapped [^:]*: (?:This Vehicle|~) becomes an artifact creature\b/i],
];
export const STRUCTURE_CAPABILITIES = new Set(STRUCTURE.map(([id]) => id));

const SUPPLIES_ROLL = /\broll (?:a|an|one|two|three|\w+ )?(?:d\d+|(?:four|six|eight|ten|twelve|twenty)-sided di(?:e|ce)|di(?:e|ce))\b|\broll (?:a|one or more|two|three) dice\b|\broll a d\d+/i;
/** Typed capabilities of one ability's effect text. */
export function effectCapabilities(effect: string): string[] {
  const caps = new Set<string>();
  const t = effect;
  for (const [id, pattern] of STRUCTURE) if (pattern.test(t)) caps.add(id);
  const add = (id: string, test: boolean | RegExpMatchArray | null) => test && caps.add(id);
  // Dynamic power / toughness transformations.
  add("POWER_FROM_POWER", /\bgets? \+X\/\+0[^.]*\bwhere X is its power\b/i.test(t));
  add("POWER_FROM_TOUGHNESS", /\bgets? \+X\/\+0[^.]*\bwhere X is its toughness\b/i.test(t));
  add("POWER_FROM_COUNTERS", /\bgets? \+X\/\+0[^.]*\bwhere X is the number of [^.]*counters\b/i.test(t));
  add("PT_SWITCH", /\bswitch (?:the |its )?power and toughness\b/i.test(t));
  add("PT_DOUBLE", /\bdouble (?:the |its )?power(?: and toughness)?\b/i.test(t));
  add("TEAM", /\b(?:double|gets?|have|gains?)\b[^.]*\b(?:each creature|creatures) you control\b|\b(?:each creature|creatures) you control\b[^.]*\b(?:gets?|have|gains?)\b/i.test(t) && !/"/.test(t));
  add("TEMP_BUFF", /\bgets? \+(?:\d+|X)\/\+(?:\d+|X)\b[^.]*until end of turn|until end of turn, [^.]*\bgets? \+(?:\d+|X)\/\+(?:\d+|X)|\buntil end of turn\b[^.]*\bdouble (?:the )?power|\bgets? \+(?:\d+|X)\/\+(?:\d+|X)\b/i.test(t) && /\buntil end of turn\b/i.test(t));
  add("TRAMPLE_GRANT", /\b(?:gains?|have) [^.]*\btrample\b/i.test(t));
  add("DELAYED_DESTRUCTION", /\bat the beginning of the next end step, (?:destroy|sacrifice) (?:that creature|it|them)\b/i.test(t));
  // Team-wide keywords granted as a static ability ("Creatures you control have haste").
  // Static grants only ("have"): a one-shot "gain … until end of turn" is a spell effect read elsewhere.
  const team = t.match(/^(?:Other )?creatures you control have ([a-z, ]+?)(?:\.|$)/i);
  if (team && !/"/.test(t)) for (const k of team[1].split(/,\s*|\s+and\s+/)) if (k.replace(/^and\s+/i, "").trim()) caps.add(`TEAM_KEYWORD:${k.replace(/^and\s+/i, "").trim().toLowerCase()}`);
  add("TEMP_KEYWORD", /\bgains? (?:flying|trample|haste|deathtouch|lifelink|first strike|double strike|menace|vigilance|hexproof|indestructible)(?:[^.]*)? until end of turn\b/i.test(t));
  add("SELF_SACRIFICE_EFFECT", /^Sacrifice (?:this|~)\b[^:]*:/i.test(t));
  add("DEATH_TRIGGER", /^When(?:ever)? (?:this creature|~) dies\b/i.test(t));
  add("LIFE_GAIN", /\byou gain (?:\d+|x|that much|life equal to)\b|\bgain (?:\d+) life\b/i.test(t));
  add("SCALES_WITH_TOUGHNESS", /\bequal to (?:that creature's|its|the creature's) toughness\b/i.test(t));
  add("FIGHT", /\bfights? (?:up to one )?(?:another )?target creature\b/i.test(t));
  // Copying.
  add("TARGETED_SPELL_COPY", /\bwhenever you cast an instant or sorcery spell that targets\b[^,]*, copy that spell\b/i.test(t));
  add("COPY_TRIGGERED_ABILITY", /\bcopy target triggered ability\b/i.test(t));
  add("TOKEN_COPY", /\bcreate[^.]*\btokens? that's a copy of\b|\bcreate[^.]*\bcopy of\b[^.]*\btoken/i.test(t));
  add("TEMPORARY_COPY", /\bat end of combat, exile (?:this|that) token\b|\bexile (?:this|that) token at end of combat\b/i.test(t));
  add("ENTERED_ATTACKING", /\btapped and attacking\b/i.test(t));
  add("LINKED_IMPRINT", /^When[^,]*, you may exile an? \w+ card from your hand\b/i.test(t) || /\bcopy of the exiled card\b/i.test(t));
  // Counters.
  add("COUNTER_STORAGE", /\bif it had counters on it, put those counters on\b/i.test(t));
  add("COUNTER_TRANSFER", /\bmove all counters from\b/i.test(t));
  // Bounce and blink.
  add("FRIENDLY_BOUNCE", /\breturn (?:up to one )?(?:other |another )?target (?:creature|permanent|artifact|enchantment|nonland permanent) you control to its owner's hand\b/i.test(t));
  add("MASS_BLINK", /\bexile any number of (?:target )?(?:creatures|permanents|nonland permanents)[^.]* you control, then return them\b/i.test(t));
  add("REPEATED_BLINK", /\brepeat this process (?:X|\w+) (?:more )?times?\b/i.test(t));
  add("BLINK", /\bexile (?:up to (?:one|two) )?(?:another )?target (?:tapped |untapped |nontoken )?(?:artifact or creature|creature|permanent)[^.]*you control, then return (?:it|that card|them)\b/i.test(t));
  add("DELAYED_BLINK", /\bexile (?:another |up to one )?target (?:creature|permanent|nonland permanent|artifact|artifact or creature)\b[^.]*\.\s*Return (?:that card|it|the exiled card) to the battlefield[^.]*\bat the beginning of the next end step\b/i.test(t));
  add("GRANTED_ABILITY", /\b(?:have|has|gains?) "/.test(t));
  // Vehicles, wipes, creature resources.
  add("TOUGHNESS_CREW", /\bcrews? Vehicles using its toughness\b/i.test(t));
  add("SACRIFICE_WIPE", /\beach player\b[^.]*\bsacrifices all (?:other )?creatures\b/i.test(t));
  add("PRESERVATION_CONDITION", /\bchooses any number of creatures they control with total (?:power|toughness|mana value) \d+ or less\b/i.test(t));
  add("CREATURE_TAP_COST", /\btap any number of untapped creatures you control\b|^Tap (?:X|\w+|any number of) untapped creatures you control:/i.test(t));
  add("SCALES_WITH_CREATURES", /\bnumber of creatures tapped this way\b|\bfor each creature tapped\b|\bnumber of creatures you control\b/i.test(t));
  // Dice.
  add("ROLL_EVENT", /^Whenever you roll\b/i.test(t));
  add("ROLL_THRESHOLD", /\broll (?:a )?(?:natural )?\d+ or higher\b/i.test(t));
  add("ROLL_SUPPLIER", SUPPLIES_ROLL.test(t) && !/^Whenever you roll\b|^If you would roll\b/i.test(t));
  add("ROLL_AMPLIFIER", /\bif you would roll (?:one or more )?dice, instead roll\b|\bignore the lowest roll\b|\breroll\b|\bplus an additional [\w-]+ die\b/i.test(t));
  // Rolling again is more roll supply, not a guaranteed loop.
  add("ROLL_AGAIN", /\byou may roll again\b|\broll (?:the die|it) again\b/i.test(t));
  // Library selection and cheats.
  add("TOP_X_CHEAT", /\b(?:reveal|look at) the top X cards\b[^.]*\.[^.]*\bput any number of permanent cards\b[^.]*\bonto the battlefield\b/i.test(t));
  add("MULTI_TYPE_SELECTION", /\bput an? \w+ card and\/or an? \w+ card from among them into your hand\b/i.test(t));
  add("TYPE_SELECTION", /\blook at the top card of your library\. If it's an? \w+ card, you may reveal it and put it into your hand\b/i.test(t));
  add("REST_TO_GRAVEYARD", /\bput the rest into your graveyard\b|\binto your graveyard\b[^.]*\bweren't put\b/i.test(t));
  add("ATTACK_TRIGGER", /^Whenever (?:this creature|~) attacks\b/i.test(t));
  add("OPPONENT_STATE_CONDITION", /\battacks a player who controls (?:\w+) or more\b/i.test(t));
  add("CREATURE_CHEAT", /\bput a creature card from among them onto the battlefield\b/i.test(t));
  add("CROSS_TURN_UNTAP", /\buntap all permanents you control during each other player's untap step\b/i.test(t));
  return [...caps];
}
const lineKind = (effect: string): AbilityKind =>
  /^(?:When|Whenever|At the beginning)\b/i.test(effect) ? "triggered" : /^[^"]*:/.test(effect) && !/^[A-Z][a-z]+ — /.test(effect) ? "activated" : "static";
const textOf = (text?: string) => stripReminderText((text || "").replace(/[’‘]/g, "'"));
const cache = new WeakMap<CardMetadata, Ability[]>();
/** Every ability of the card, with typed capabilities and how available it really is. */
export function cardAbilities(card: CardMetadata): Ability[] {
  const known = cache.get(card);
  if (known) return known;
  const faces = card.cardFaces?.length ? card.cardFaces.map((f) => ({ text: f.oracleText, type: f.typeLine || card.typeLine, loyalty: f.loyalty ?? card.loyalty, name: f.name })) : [{ text: card.oracleText, type: card.typeLine, loyalty: card.loyalty, name: card.name }];
  const keywords = cardKeywords(card).map((k) => k.toLowerCase());
  const out: Ability[] = [];
  const spell = /\b(?:Instant|Sorcery)\b/.test(card.typeLine.split("—")[0]);
  for (const face of faces) {
    const names = [face.name, face.name.split(",")[0], card.name.split(" // ")[0]].filter((n) => n && n.length >= 3).sort((a, b) => b.length - a.length);
    const start = Number(face.loyalty);
    let level = 1;
    let die = 20;
    let token = "";
    for (const raw of textOf(face.text).split("\n").map((l) => l.trim()).filter(Boolean)) {
      if (raw === face.name || raw === card.name) continue;
      let effect = raw;
      for (const n of names) effect = effect.split(n).join("~");
      const push = (a: Omit<Ability, "capabilities" | "line"> & { capabilities?: string[] }) => {
        const quoted = a.effect.match(/"([^"]+)"/);
        const caps = new Set([...(a.capabilities || effectCapabilities(a.effect)), ...(quoted ? effectCapabilities(quoted[1]).map((c) => `GRANTED:${c}`) : [])]);
        out.push({ line: raw, ...a, capabilities: [...caps] });
      };
      // Class levels: "{1}{R}: Level 2" gates the abilities printed after it.
      const levelMark = effect.match(/^(?:\{[^}]+\})+: Level (\d+)$/);
      if (levelMark) {
        level = Number(levelMark[1]);
        push({ effect, kind: "procedural", access: "immediate", weight: 1, capabilities: [] });
        continue;
      }
      if (PROCEDURAL.test(effect)) {
        // Costs and casting restrictions aren't abilities, but a cost can still be a capability ("tap creatures").
        push({ effect, kind: "procedural", access: "immediate", weight: 1 });
        continue;
      }
      // Saga chapters.
      const chapter = effect.match(/^((?:[IV]+)(?:, [IV]+)*) — (.*)$/);
      if (chapter) {
        const first = Math.min(...chapter[1].split(", ").map((r) => ROMAN[r] || 1));
        push({ effect: chapter[2], kind: "chapter", access: first === 1 ? "immediate" : "gated", weight: first === 1 ? 1 : Math.max(0.5, 1 - 0.1 * (first - 1)) });
        continue;
      }
      // Dice-result branches belong to the roll before them; each is gated by its result.
      const branch = effect.match(/^(\d+)(?:[—–-](\d+))? \| (.*)$/);
      if (branch) {
        const lo = Number(branch[1]), hi = Number(branch[2] ?? branch[1]);
        // "Create two of those tokens" refers to the token an earlier branch described.
        let result = branch[3];
        const described = result.match(/^Create an? (.+? creature tokens?)(?: with [^.]*)?\.?$/i);
        if (described) token = described[1];
        const those = result.match(/^Create (\w+) of those tokens\.?(.*)$/i);
        if (those && token) result = `Create ${those[1]} ${token.replace(/ tokens?$/, " tokens")}.${those[2]}`;
        push({ effect: result, kind: "branch", access: "gated", weight: (hi - lo + 1) / die, probability: (hi - lo + 1) / die });
        continue;
      }
      const sided = effect.match(/\broll a d(\d+)\b/i) || effect.match(/\broll a (four|six|eight|ten|twelve|twenty)-sided die\b/i);
      if (sided) die = Number(sided[1]) || ({ four: 4, six: 6, eight: 8, ten: 10, twelve: 12, twenty: 20 } as Record<string, number>)[sided[1].toLowerCase()] || 20;
      // Planeswalker loyalty abilities: an ultimate beyond starting loyalty is not immediately available.
      const loyalty = effect.match(/^([+−-]?)(\d+|X): (.*)$/);
      if (loyalty && Number.isFinite(start)) {
        const minus = loyalty[1] === "−" || loyalty[1] === "-";
        const inaccessible = minus && Number(loyalty[2]) > start;
        push({ effect: loyalty[3], kind: "loyalty", access: inaccessible ? "inaccessible" : "immediate", weight: inaccessible ? 0 : 1 });
        continue;
      }
      // Ability words ("Jump —", "Sneak Attack —") carry no rules of their own.
      const stripped = stripAbilityWord(effect.replace(/^Imprint — /, "").replace(/^[•●]\s*/, "")).replace(/^[A-Z][A-Za-z' -]{1,30} — (?=[A-Z])/, "");
      // Keyword lines, including keywords with costs or qualifiers ("Cycling {3}{B}{B}", "Affinity for artifacts").
      const keywordOnly = !/[.:]$|\. /.test(stripped) && stripped.split(/,\s*/).every((part) => keywords.some((k) => part.toLowerCase().startsWith(k)) && /^[A-Za-z' -]+(?:\s?\d+—)?(?:\s?\{[^}]+\})*(?:\s\d+)?(?: (?:for|from|with) [a-z ]+)?$/.test(part));
      if (keywordOnly) {
        push({ effect: stripped, kind: "keyword", access: "immediate", weight: 1, capabilities: stripped.split(/,\s*/).map((k) => `KEYWORD:${k.toLowerCase().split(" ")[0]}`) });
        continue;
      }
      const gated = level > 1;
      const conditional = /\battacks a player who controls (?:\w+) or more\b/i.test(stripped);
      push({
        effect: stripped,
        kind: gated ? "level" : spell && lineKind(stripped) === "static" ? "spell" : lineKind(stripped),
        access: gated || conditional ? "gated" : "immediate",
        weight: gated ? Math.pow(0.6, level - 1) : conditional ? 0.5 : 1,
      });
    }
  }
  cache.set(card, out);
  return out;
}
export const hasCapability = (card: CardMetadata, id: string, includeGranted = true) =>
  cardAbilities(card).some((a) => a.weight > 0 && a.capabilities.some((c) => c === id || (includeGranted && c === `GRANTED:${id}`)));
/** Lines whose value is only partly available (later Class levels / Saga chapters, opponent-state conditions)
 * and dice-result branches, for weighting in the card function. */
export function weightedLines(card: CardMetadata) {
  return cardAbilities(card).filter((a) => a.access !== "immediate" && a.kind !== "loyalty");
}
export const SUPPLIES_DICE = SUPPLIES_ROLL;
/** Capabilities that only qualify another effect (team scope, trample, entering attacking, a roll threshold…) or
 * that are typed but not yet modeled (rolling again). On their own they don't make an ability understood. */
export const QUALIFIERS = new Set(["TEAM", "TRAMPLE_GRANT", "ENTERED_ATTACKING", "OPPONENT_STATE_CONDITION", "ROLL_THRESHOLD", "PRESERVATION_CONDITION", "SCALES_WITH_TOUGHNESS", "ATTACK_TRIGGER", "REST_TO_GRAVEYARD", "ROLL_AGAIN", "GRANTED_ABILITY"]);
export const understoodCapability = (c: string) => !QUALIFIERS.has(c.replace(/^GRANTED:/, "")) && !c.startsWith("GRANTED:ROLL_AGAIN");
