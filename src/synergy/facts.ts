import { stripAbilityWord, stripReminderText } from "../utils/rulesText";
import type { CardMetadata } from "../models/collection";
import type { Color } from "../models/card";
import {
  creatureTypePatterns,
  canonicalCreatureType,
} from "../intelligence/subtypes";

export const CARD_FACTS_VERSION = "1.2.0";
export type TutorRole =
  | "unrestricted_tutor"
  | "creature_tutor"
  | "dragon_tutor"
  | "tribal_tutor"
  | "artifact_tutor"
  | "enchantment_tutor"
  | "land_tutor_to_hand"
  | "land_tutor_to_battlefield"
  | "basic_land_to_hand"
  | "basic_land_to_battlefield"
  | "graveyard_tutor"
  | "topdeck_tutor";
export type TokenRole =
  | "dragon_token"
  | "generic_creature_token"
  | "soldier_token"
  | "treasure_token"
  | "clue_token"
  | "food_token"
  | "copy_token"
  | "token_doubler"
  | "token_payoff"
  | "token_sacrifice_payoff";
export type RampRole =
  | "land_ramp"
  | "mana_rock"
  | "mana_dork"
  | "ritual"
  | "treasure_generation"
  | "cost_reduction"
  | "tribal_cost_reduction"
  | "temporary_combat_mana"
  | "land_smoothing";
export type TribalRole =
  | "dragon"
  | "changeling"
  | "tribal_cost_reduction"
  | "tribal_etb_payoff"
  | "tribal_cast_payoff"
  | "tribal_attack_payoff"
  | "tribal_death_payoff"
  | "tribal_token_payoff"
  | "tribal_lord"
  | "tribal_card_draw"
  | "tribal_recursion";
export type DiscardRole =
  // Casts itself from the graveyard only in a turn it was discarded (Mayhem). Not reusable recursion.
  | "mayhem_card"
  // Cast for an alternative cost as it is discarded (Madness).
  | "madness_card"
  // You choose to discard: a cost, an optional choice, looting or rummaging. Enables Mayhem/Madness.
  | "controlled_discard"
  | "looting"
  | "rummaging"
  // Opponents discard: disruption, never a Mayhem/Madness enabler for you.
  | "opponent_discard"
  | "discard_payoff";
export type CombatRole =
  | "additional_combat"
  | "attack_trigger"
  | "combat_damage_trigger"
  | "on_attack_token_generation"
  | "combat_multiplier";
export type DamageRole =
  | "damage_source"
  | "noncombat_damage"
  | "triggered_damage"
  | "creature_damage"
  | "damage_multiplier"
  | "combat_damage_multiplier"
  | "noncombat_damage_multiplier";
export type TypedRole =
  | TutorRole
  | TokenRole
  | RampRole
  | TribalRole
  | DiscardRole
  | CombatRole
  | DamageRole
  | "scoped_token_multiplier";
/** Who performs, creates, receives or benefits from an effect. "each_player" includes you; never assume "you" otherwise. */
export type Scope =
  | "you"
  | "opponent"
  | "each_opponent"
  | "target_player"
  | "each_player"
  | "other_players"
  | "unknown";
export const benefitsYou = (scope: Scope) => scope === "you" || scope === "each_player";
export const reachesOpponents = (scope: Scope) =>
  scope === "opponent" || scope === "each_opponent" || scope === "each_player" || scope === "other_players";
export interface FactEvidence {
  face: string;
  text: string;
  conditional: boolean;
  controller: Scope;
}
export interface TokenMultiplierFact extends FactEvidence {
  // "any" = every token you create; otherwise exact token scopes such as "Treasure" or "Dragon".
  scopes: string[];
}
export interface DamageFact extends FactEvidence {
  role: "source" | "multiplier";
  combat: "combat" | "noncombat" | "any";
  amount?: number;
  targetsCreatures: boolean;
  reachesOpponents: boolean;
  triggered: boolean;
}
export type AnswerTarget =
  | "creature"
  | "artifact"
  | "enchantment"
  | "planeswalker"
  | "land"
  | "battle"
  | "permanent"
  | "nonland_permanent"
  | "graveyard"
  | "spell";
export interface AnswerFact extends FactEvidence {
  targets: AnswerTarget[];
  mode: "destroy" | "exile" | "damage" | "bounce" | "shuffle" | "sacrifice" | "counter";
  mass: boolean;
  instantSpeed: boolean;
  opponentsOnly: boolean;
}
export interface TokenFact extends FactEvidence {
  count?: number;
  tokenTypes: string[];
  creatureTypes: string[];
  isCreature: boolean;
  isCopy: boolean;
  grantedAbilities: string[];
}
export interface SearchFact extends FactEvidence {
  targetTypes: string[];
  creatureTypes: string[];
  basicOnly: boolean;
  unrestricted: boolean;
  destination: "hand" | "battlefield" | "graveyard" | "top" | "other";
  restrictions: string[];
  roles: TutorRole[];
}
export interface ManaFact extends FactEvidence {
  amount?: number;
  colors: string[];
  restrictions: string[];
  scope: "card" | "created-token";
  timing: "activated" | "triggered" | "spell" | "unknown";
}
export interface TribalFact extends FactEvidence {
  role: TribalRole;
  creatureTypes: string[];
}
export type DiscardWho =
  | "you"
  | "opponent"
  | "each_player"
  | "target_player"
  | "unknown";
export interface DiscardFact extends FactEvidence {
  who: DiscardWho;
  mode: "cost" | "choice" | "loot" | "rummage" | "hand" | "effect";
}
export interface GraveyardCastFact extends FactEvidence {
  mechanic: "mayhem" | "madness";
  cost?: string;
  // Mayhem/Madness need the card itself to be discarded; they are not repeatable recursion.
  condition: "discarded-this-turn" | "as-discarded";
}
export interface CardFaceFacts {
  name: string;
  cardTypes: string[];
  creatureTypes: string[];
  keywords: string[];
  hasChangeling: boolean;
  createsTokens: TokenFact[];
  searchesLibrary: SearchFact[];
  addsMana: ManaFact[];
  drawsCards: boolean;
  cardDrawEffects: FactEvidence[];
  removal: (FactEvidence & {
    permanentTypes: string[];
    targetRestrictions: string[];
  })[];
  costReductions: (FactEvidence & {
    creatureTypes: string[];
    restrictions: string[];
  })[];
  tribalEffects: TribalFact[];
  discards: DiscardFact[];
  castFromDiscard: GraveyardCastFact[];
  tokenMultipliers: TokenMultiplierFact[];
  damage: DamageFact[];
  answers: AnswerFact[];
  attackTriggers: FactEvidence[];
  triggers: string[];
  staticEffects: string[];
  typedRoles: TypedRole[];
  uncertainties: string[];
}
export interface CardFacts {
  version: string;
  name: string;
  manaValue: number;
  // Current legacy metadata may lack visual colors: never substitute color identity.
  colors?: Color[];
  colorIdentity: Color[];
  faces: CardFaceFacts[];
  typedRoles: TypedRole[];
  uncertainties: string[];
}
const cardTypes = [
  "Artifact",
  "Battle",
  "Creature",
  "Enchantment",
  "Instant",
  "Land",
  "Planeswalker",
  "Sorcery",
  "Kindred",
  "Tribal",
];
const resourceTokens = [
  "Treasure",
  "Clue",
  "Food",
  "Gold",
  "Blood",
  "Map",
  "Powerstone",
  "Junk",
  "Incubator",
  "Role",
];
const unique = <T>(items: T[]) => [...new Set(items)];
const words: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const count = (text: string) =>
  words[text.toLowerCase()] ?? (/^\d+$/.test(text) ? Number(text) : undefined);
const typesIn = (text: string) =>
  creatureTypePatterns.filter((p) => p.reference.test(text)).map((p) => p.type);
const cardTypesIn = (text: string) =>
  cardTypes.filter((type) => new RegExp(`\\b${type}s?\\b`, "i").test(text));
export function scopeOf(effect: string): Scope {
  if (/\beach player other than\b|\beach other player\b|\bplayers? other than\b/i.test(effect)) return "other_players";
  if (/\beach opponent (?:creates?|searches?|draws?|adds?|discards?|sacrifices?|gains?|mills?|puts?)\b/i.test(effect)) return "each_opponent";
  if (/\bspells? (?:your )?opponents? cast\b|\b(?:target|an?) opponent (?:creates?|searches?|draws?|adds?|discards?|sacrifices?|gains?|mills?|puts?)\b/i.test(effect)) return "opponent";
  if (/\btarget player (?:creates?|searches?|draws?|adds?|discards?|sacrifices?|gains?|mills?|puts?)\b/i.test(effect)) return "target_player";
  if (/\beach player (?:creates?|searches?|draws?|adds?|discards?|sacrifices?|gains?|mills?|puts?)\b/i.test(effect)) return "each_player";
  if (/\byou\b|^(?:create|search|add|draw|\{[^}]+\}[^:]*:)/i.test(effect.trim())) return "you";
  // An imperative with no named player is performed by the spell or ability's controller.
  if (/^(?:destroy|exile|return|counter|tap|untap|put|gain control|sacrifice|look|reveal|scry|surveil|mill|choose|copy|investigate|proliferate|populate|target|the owner of target)\b/i.test(effect.trim())) return "you";
  return "unknown";
}
function evidence(face: string, text: string): FactEvidence {
  const effect = text.replace(/^\s*(?:When(?:ever)?|If)\b[^,]*,\s*/i, "");
  return {
    face,
    text: text.trim(),
    conditional:
      /\b(?:if|may|unless|only|whenever|when|at the beginning|as long as)\b/i.test(
        text,
      ),
    controller: scopeOf(effect),
  };
}
// "If you would create one or more Treasure tokens…" multiplies Treasure only; "tokens under your control" multiplies all.
export function tokenMultiplierOf(face: string, line: string): TokenMultiplierFact | null {
  const m =
    line.match(/\bwould create (?:one or more |a |an |any number of )?([^.,]*?)\btokens?\b[^.]*?\b(?:twice|double|three times|instead|additional)/i) ||
    line.match(/\b(?:one or more |a )?([^.,]*?)\btokens? would be created\b[^.]*\b(?:twice|instead)/i);
  if (!m) return null;
  const words = m[1].trim();
  const scopes = [
    ...resourceTokens.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(words)),
    ...typesIn(words),
    ...(/\bcreature\b/i.test(words) ? ["creature"] : []),
  ];
  return { ...evidence(face, line), controller: /under your control|\byou would\b|you control/i.test(line) ? "you" : scopeOf(line), scopes: scopes.length ? unique(scopes) : ["any"] };
}
const numberWord = (text?: string) => (text === undefined ? undefined : count(text) ?? (/^x$/i.test(text) ? undefined : undefined));
export function damageOf(face: string, line: string, ability: string): DamageFact[] {
  const out: DamageFact[] = [];
  const base = evidence(face, line);
  const multiplier = line.match(/\bwould deal (combat |noncombat )?damage\b[^.]*\b(?:double|twice|triple|three times|instead|plus \d+)/i);
  if (multiplier) {
    const yours = /\b(?:source|creature|permanent|spell)s? you control\b|\byour\b|\bsource you control\b/i.test(line);
    out.push({
      ...base,
      controller: yours ? "you" : base.controller,
      role: "multiplier",
      combat: multiplier[1]?.trim().toLowerCase() === "combat" ? "combat" : multiplier[1]?.trim().toLowerCase() === "noncombat" ? "noncombat" : "any",
      targetsCreatures: /\b(?:creature|permanent)\b/i.test(line),
      reachesOpponents: /\b(?:opponent|player)\b/i.test(line),
      triggered: false,
    });
    return out;
  }
  const effect = line.replace(/^\s*(?:When(?:ever)?|At the beginning)\b[^,]*,\s*/i, "");
  for (const m of effect.matchAll(/\bdeals? (?:(\w+|that much|twice that much|x) damage|damage equal to [^.]*?) to ([^.;]+)/gi)) {
    if (/\bcombat damage\b/i.test(m[0])) continue;
    const targets = m[2];
    out.push({
      ...base,
      controller: /\b(?:target|an?) opponent\b[^.]*\bdeals\b/i.test(effect) ? "opponent" : "you",
      role: "source",
      combat: "noncombat",
      amount: numberWord(m[1]),
      targetsCreatures: /\b(?:any target|creature|planeswalker|permanent)\b/i.test(targets),
      reachesOpponents: /\b(?:any target|opponent|player|each player)\b/i.test(targets),
      triggered: /^(?:when|whenever|at the beginning)\b/i.test(ability),
    });
  }
  return out;
}
const answerWords: [RegExp, AnswerTarget][] = [
  [/\bnonland permanents?\b/i, "nonland_permanent"],
  [/\bcreatures?\b/i, "creature"],
  [/\bartifacts?\b/i, "artifact"],
  [/\benchantments?\b/i, "enchantment"],
  [/\bplaneswalkers?\b/i, "planeswalker"],
  [/\bbattles?\b/i, "battle"],
  [/\blands?\b/i, "land"],
];
// Specific answer coverage, not one broad "removal" count.
export function answerOf(face: string, line: string, types: string[], keywords: string[]): AnswerFact | null {
  const effect = stripAbilityWord(line).replace(/^\s*(?:When(?:ever)?|At the beginning)\b[^,]*,\s*/i, "");
  const patterns: [AnswerFact["mode"], RegExp][] = [
    ["counter", /\bcounter (?:target|all|each|up to \w+ target) ([^.]*?)\b(?:spells?|abilit(?:y|ies))\b/i],
    ["shuffle", /\b(?:owner of target ([^.]*?)|target ([^.]*?)'s owner) shuffles?\b/i],
    ["destroy", /\bdestroy (?:target|all|each|up to \w+ target|any number of target) ([^.]*)/i],
    ["exile", /\bexile (?:target|all|each|up to \w+ target|any number of target) ([^.]*)/i],
    ["bounce", /\breturn (?:target|all|each|up to \w+ target) ([^.]*?) to (?:its|their) owners?'? hands?/i],
    ["sacrifice", /\b(?:target|each) (?:opponent|player) sacrifices? (?:a|an|one|two|\w+) ([^.]*)/i],
    ["damage", /\bdeals? [^.]*?damage(?: equal to [^.]*?)? to ((?:any target|target [^.]*?|each [^.]*?))(?:[.,]|$)/i],
  ];
  for (const [mode, pattern] of patterns) {
    const m = effect.match(pattern);
    if (!m) continue;
    const phrase = (m[1] || m[2] || "").trim();
    if (mode === "exile" && /\bcards? (?:from|in) (?:your|a|target player's|all|an opponent's|each)?\s*graveyards?|\bgraveyards?\b/i.test(phrase)) {
      return { ...evidence(face, line), targets: ["graveyard"], mode, mass: /\ball|each\b/i.test(effect), instantSpeed: true, opponentsOnly: !/your graveyard/i.test(phrase) };
    }
    if (/\byou control\b/i.test(phrase) && !/\bdon't control|opponents? control/i.test(phrase)) continue;
    const targets: AnswerTarget[] =
      mode === "counter"
        ? ["spell"]
        : /\bany target\b/i.test(phrase)
          ? ["creature", "planeswalker"]
          : answerWords.filter(([r]) => r.test(phrase)).map(([, t]) => t);
    if (!targets.length && /\bpermanents?\b/i.test(phrase)) targets.push("permanent");
    if (!targets.length) continue;
    const base = evidence(face, line);
    return {
      ...base,
      controller: base.controller === "unknown" ? "you" : base.controller,
      targets: unique(targets),
      mode,
      // Judge the removal clause itself, not the start of the line: modal bullets ("• Destroy all creatures") and
      // earlier clauses ("Return a creature you control …, then destroy all other creatures") still make a wipe.
      mass:
        /^(?:destroy|exile|return) (?:all|each)\b/i.test(m[0]) ||
        /\beach (?:other )?(?:creature|opponent|player)\b/i.test(effect) ||
        keywords.some((k) => /^overload$/i.test(k)),
      instantSpeed: types.includes("Instant") || keywords.some((k) => /^flash$/i.test(k)) || /^[^:]*:/.test(line),
      // "each other creature and each opponent" still hits your own creatures: only restricted creature wording is one-sided.
      opponentsOnly:
        /\byou don't control|\ban opponent controls|\bopponents? control/i.test(effect) ||
        (/\beach opponent\b|\btarget opponent\b/i.test(effect) && !/\b(?:each|all) (?:other )?(?:creatures?|permanents?)\b/i.test(effect)),
    };
  }
  return null;
}
// Who discards, and how. Only "you" (or a symmetric "each player") can enable Mayhem/Madness.
export function discardOf(face: string, line: string): DiscardFact | null {
  const text = stripAbilityWord(line);
  if (!/\bdiscards?\b/i.test(text) || /\b(?:can't|cannot|don't|doesn't) discard/i.test(text))
    return null;
  const effect = text.replace(/^\s*(?:When(?:ever)?|At the beginning)\b[^,]*,\s*/i, "");
  // A trigger condition alone ("Whenever you discard…") is a payoff, not a discard effect.
  if (!/\bdiscards?\b/i.test(effect)) return null;
  const who: DiscardWho =
    /\b(?:target|each|an?) opponents?\b[^.;]*\bdiscards?\b|\bdefending player discards?\b|\bthat player discards?\b/i.test(effect)
      ? "opponent"
      : /\beach player discards?\b/i.test(effect)
        ? "each_player"
        : /\btarget player discards?\b/i.test(effect)
          ? "target_player"
          : /\byou (?:may )?discard\b|^discard\b|(?:^|[.,:]\s*|then |and )discard\b|as an additional cost[^.]*discard/i.test(effect)
            ? "you"
            : "unknown";
  const cost = /discard[^.:]*:/i.test(text) || /as an additional cost[^.]*discard/i.test(text);
  const mode: DiscardFact["mode"] = cost
    ? "cost"
    : /\bdiscards? (?:your|their|his or her) hands?\b/i.test(effect)
      ? "hand"
      : /\bdraw[^.]*,? then discard|\bdraw[^.]*\band discard/i.test(effect)
        ? "loot"
        : /\bdiscard[^.]*,? then draw|\bdiscard[^.]*\. (?:if you do, )?draw/i.test(effect)
          ? "rummage"
          : /\byou may discard\b/i.test(effect)
            ? "choice"
            : "effect";
  return {
    ...evidence(face, line),
    controller: who,
    who,
    mode,
  };
}
function faceFacts(face: {
  name: string;
  typeLine?: string;
  oracleText?: string;
  keywords?: string[];
}): CardFaceFacts {
  const original = (face.oracleText || "").replace(/[’‘]/g, "'");
  const text = stripReminderText(original);
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const printedTypes = cardTypesIn((face.typeLine || "").split("—")[0]);
  const ownTypes =
    printedTypes.includes("Creature") ||
    printedTypes.includes("Kindred") ||
    printedTypes.includes("Tribal")
      ? (face.typeLine?.split("—")[1] || "")
          .split(/\s+/)
          .map(canonicalCreatureType)
          .filter((type): type is string => !!type)
      : [];
  const hasChangeling =
    face.keywords?.some((k) => /^changeling$/i.test(k)) === true ||
    /^Changeling\b/im.test(text);
  const result: CardFaceFacts = {
    name: face.name,
    cardTypes: printedTypes,
    creatureTypes: ownTypes,
    keywords: [...(face.keywords || [])],
    hasChangeling,
    createsTokens: [],
    searchesLibrary: [],
    addsMana: [],
    drawsCards: false,
    cardDrawEffects: [],
    removal: [],
    costReductions: [],
    tribalEffects: [],
    discards: [],
    castFromDiscard: [],
    tokenMultipliers: [],
    damage: [],
    answers: [],
    attackTriggers: [],
    triggers: [],
    staticEffects: [],
    typedRoles: [],
    uncertainties: [],
  };
  const roles = new Set<TypedRole>();
  if (hasChangeling) roles.add("changeling");
  // Mayhem/Madness keyword lines keep their cost after reminder text is removed.
  for (const [mechanic, condition] of [
    ["mayhem", "discarded-this-turn"],
    ["madness", "as-discarded"],
  ] as const) {
    const keywordLine = lines.find((line) =>
      new RegExp(`^${mechanic}\\b`, "i").test(line),
    );
    if (
      keywordLine ||
      face.keywords?.some((k) => k.toLowerCase() === mechanic)
    ) {
      result.castFromDiscard.push({
        ...evidence(face.name, keywordLine || mechanic),
        controller: "you",
        mechanic,
        cost: keywordLine?.match(/((?:\{[^}]+\})+)/)?.[1],
        condition,
      });
      roles.add(mechanic === "mayhem" ? "mayhem_card" : "madness_card");
    }
  }
  if (ownTypes.includes("Dragon")) roles.add("dragon");
  for (const line of lines) {
    const fact = evidence(face.name, line);
    const ability = stripAbilityWord(line);
    // Replace self references before interpreting tribal relationships.
    const semantic = line.split(face.name.replace(/[’‘]/g, "'")).join("~");
    if (/^(?:when|whenever|at the beginning)\b/i.test(ability))
      result.triggers.push(ability);
    else if (
      !line.includes(":") &&
      !/^(?:create|search|draw|destroy|exile|return|add)\b/i.test(line)
    )
      result.staticEffects.push(line);
    for (const match of line.matchAll(
      /\bcreates?\s+([^.;\n]*?\btokens?\b[^.;\n]*)/gi,
    )) {
      if (/\bwould create\b|\btokens? would be created\b/i.test(line)) continue;
      const descriptions = match[1].split(
        /\s+and\s+(?=(?:a|an|one|two|three|four|five|six|\d+)\b[^.;]*\btoken)/i,
      );
      for (const description of descriptions) {
        const tokenTypes = resourceTokens.filter((type) =>
          new RegExp(`\\b${type}\\b`, "i").test(description),
        );
        const creatureTypes = typesIn(
          description.split(/\b(?:with|that's|that is)\b/i)[0],
        );
        const isCopy = /\bcopy\b/i.test(description);
        const isCreature =
          /\bcreature\b/i.test(description) || creatureTypes.length > 0;
        const amount = count(description.trim().split(/\s+/)[0]);
        const granted = description.match(/\bwith\s+(.+)/i)?.[1];
        result.createsTokens.push({
          ...fact,
          count: amount,
          tokenTypes,
          creatureTypes,
          isCreature,
          isCopy,
          grantedAbilities: granted ? [granted] : [],
        });
        if (amount === undefined)
          result.uncertainties.push(
            `Variable or unparsed token quantity: ${description}`,
          );
        if (!tokenTypes.length && !creatureTypes.length && !isCopy)
          result.uncertainties.push(`Unresolved token type: ${description}`);
        if (isCopy) roles.add("copy_token");
        if (isCreature) roles.add("generic_creature_token");
        if (creatureTypes.includes("Dragon")) roles.add("dragon_token");
        if (creatureTypes.includes("Soldier")) roles.add("soldier_token");
        for (const type of ["Treasure", "Clue", "Food"] as const)
          if (tokenTypes.includes(type))
            roles.add(`${type.toLowerCase()}_token` as TokenRole);
        if (tokenTypes.includes("Treasure")) roles.add("treasure_generation");
        // Firebending is a keyword ability of the created token, not immediate spell mana.
        const firebending = granted?.match(/\bfirebending (\d+)\b/i);
        if (firebending) {
          result.addsMana.push({
            ...fact,
            amount: Number(firebending[1]),
            colors: ["R"],
            restrictions: [
              "Created token must attack; mana lasts until end of combat.",
            ],
            scope: "created-token",
            timing: "triggered",
          });
          roles.add("temporary_combat_mana");
        }
      }
    }
    // Do not interpret reminder text inside a token ability as mana added by its creator.
    const directEffect = line.replace(
      /^\s*(?:When(?:ever)?|If)\b[^,]*,\s*/i,
      "",
    );
    for (const match of directEffect.matchAll(
      /\badd\s+((?:\{[^}]+\})+|(?:one|two|three|four|five|six|\d+|x|that much) mana)([^.;]*)/gi,
    )) {
      const manaText = match[1],
        symbols = [...manaText.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      const amount = symbols.length
        ? symbols.some((s) => s === "X")
          ? undefined
          : symbols.length
        : count(manaText.split(" ")[0]);
      const colors = unique(symbols.filter((s) => /^[WUBRG]$/.test(s)));
      const restrictions = [
        line.includes(":") ? line.slice(0, line.indexOf(":")) : "",
        match[2].trim(),
        ...(line.match(
          /Spend (?:this|that) mana[^.]*|(?:This|That) mana lasts[^.]*/gi,
        ) || []),
      ].filter(Boolean);
      const timing = line.includes(":")
        ? "activated"
        : /^(?:When|Whenever|At the beginning)\b/i.test(line)
          ? "triggered"
          : printedTypes.some(
                (type) => type === "Instant" || type === "Sorcery",
              )
            ? "spell"
            : "unknown";
      result.addsMana.push({
        ...fact,
        amount,
        colors,
        restrictions,
        scope: "card",
        timing,
      });
      if (/\bcombat\b/i.test(line)) roles.add("temporary_combat_mana");
      else if (timing === "spell") roles.add("ritual");
      else if (timing === "activated" && printedTypes.includes("Creature"))
        roles.add("mana_dork");
      else if (timing === "activated" && printedTypes.includes("Artifact"))
        roles.add("mana_rock");
    }
    for (const match of line.matchAll(
      /\bsearch(?:es)?\s+(?:your|their|his or her|a|target player's) library\s+for\s+([^,.;]+)([\s\S]*)/gi,
    )) {
      const target = match[1],
        tail = match[2];
      const targetTypes = cardTypesIn(target),
        creatureTypes = typesIn(target);
      const basicOnly =
        /\bbasic\b/i.test(target) && targetTypes.includes("Land");
      const unrestricted = /^(?:a|one|any) card$/i.test(target.trim());
      const destinations: SearchFact["destination"][] = [];
      if (
        /\b(?:put|puts)[^.]*?\b(?:into|in) (?:your|their|its owner's) hand\b/i.test(
          tail,
        )
      )
        destinations.push("hand");
      if (/\b(?:put|puts)[^.]*?\b(?:onto|on) the battlefield\b/i.test(tail))
        destinations.push("battlefield");
      if (
        /\b(?:put|puts)[^.]*?\binto (?:your|their|a|that player's) graveyard\b/i.test(
          tail,
        )
      )
        destinations.push("graveyard");
      if (
        /\b(?:put|puts)[^.]*?\bon top of (?:your|their|that) library\b/i.test(
          tail,
        )
      )
        destinations.push("top");
      if (!destinations.length) {
        destinations.push("other");
        result.uncertainties.push(
          `Unresolved library-search destination: ${line}`,
        );
      }
      const restrictions = [
        target,
        ...tail.matchAll(
          /\b(?:tapped|with mana value[^,.]*|with (?:a )?different names?[^,.]*)/gi,
        ),
      ].map((value) => (typeof value === "string" ? value : value[0]));
      for (const destination of destinations) {
        const searchRoles: TutorRole[] = [];
        if (unrestricted) searchRoles.push("unrestricted_tutor");
        if (
          targetTypes.includes("Land") &&
          (destination === "hand" || destination === "battlefield")
        )
          searchRoles.push(
            `${basicOnly ? "basic_land" : "land_tutor"}_to_${destination}`,
          );
        if (creatureTypes.length)
          searchRoles.push(
            creatureTypes.includes("Dragon") ? "dragon_tutor" : "tribal_tutor",
          );
        else if (targetTypes.includes("Creature"))
          searchRoles.push("creature_tutor");
        if (targetTypes.includes("Artifact"))
          searchRoles.push("artifact_tutor");
        if (targetTypes.includes("Enchantment"))
          searchRoles.push("enchantment_tutor");
        if (destination === "graveyard") searchRoles.push("graveyard_tutor");
        if (destination === "top") searchRoles.push("topdeck_tutor");
        searchRoles.forEach((role) => roles.add(role));
        result.searchesLibrary.push({
          ...fact,
          targetTypes,
          creatureTypes,
          basicOnly,
          unrestricted,
          destination,
          restrictions,
          roles: searchRoles,
        });
        if (targetTypes.includes("Land") && destination === "battlefield")
          roles.add("land_ramp");
        if (targetTypes.includes("Land") && destination === "hand")
          roles.add("land_smoothing");
      }
    }
    const multiplier = tokenMultiplierOf(face.name, line);
    if (multiplier) {
      result.tokenMultipliers.push(multiplier);
      // Only an unscoped multiplier doubles every token; Xorn-style effects multiply their exact scope.
      roles.add(multiplier.scopes.includes("any") ? "token_doubler" : "scoped_token_multiplier");
    }
    for (const damage of damageOf(face.name, line, ability)) {
      result.damage.push(damage);
      if (damage.role === "multiplier") {
        roles.add("damage_multiplier");
        if (damage.combat !== "noncombat") roles.add("combat_damage_multiplier");
        if (damage.combat !== "combat") roles.add("noncombat_damage_multiplier");
      } else {
        roles.add("damage_source");
        if (damage.combat !== "combat") roles.add("noncombat_damage");
        if (damage.triggered) roles.add("triggered_damage");
        if (damage.targetsCreatures) roles.add("creature_damage");
      }
    }
    const answer = answerOf(face.name, line, printedTypes, face.keywords || []);
    if (answer) result.answers.push(answer);
    const condition0 = stripAbilityWord(semantic).match(/^(?:When|Whenever)\b([^,]+),/i)?.[1] || "";
    if (/\battacks?\b/i.test(condition0) && !/\bopponents? attacks?\b|\battacks? you\b/i.test(condition0)) {
      roles.add("attack_trigger");
      result.attackTriggers.push(fact);
      if (/\bcreates?\b[^.]*\btokens?\b/i.test(line)) roles.add("on_attack_token_generation");
    }
    if (/\bdeals? combat damage\b/i.test(condition0)) roles.add("combat_damage_trigger");
    if (/\badditional combat phase\b|\bextra combat\b/i.test(line)) roles.add("additional_combat");
    if (/creatures you control (?:gain|have) double strike|double (?:the )?(?:combat )?damage/i.test(line)) roles.add("combat_multiplier");
    const discardFact = discardOf(face.name, line);
    if (discardFact) {
      result.discards.push(discardFact);
      if (discardFact.who === "opponent") roles.add("opponent_discard");
      else if (discardFact.who === "you" || discardFact.who === "each_player") {
        roles.add("controlled_discard");
        if (discardFact.mode === "loot") roles.add("looting");
        if (discardFact.mode === "rummage") roles.add("rummaging");
      } else
        result.uncertainties.push(
          `Discard by ${discardFact.who.replace("_", " ")} may not be you: ${line}`,
        );
    }
    if (
      /^(?:when|whenever)\b[^,]*\b(?:you|a player) discards?\b|\bif you(?:'ve)? discarded\b|\bcards? (?:you )?discarded this turn\b/i.test(
        stripAbilityWord(line),
      )
    )
      roles.add("discard_payoff");
    if (/\b(?:can't|cannot|don't|doesn't)\b/i.test(directEffect)) continue;
    if (
      /\bdraw(?:s)? (?:a|an|one|two|three|four|five|six|x|\d+|that many) cards?\b/i.test(
        directEffect,
      )
    ) {
      result.drawsCards = true;
      result.cardDrawEffects.push(fact);
    }
    if (
      /\b(?:destroy|exile) (?:target|all|each)\b|\bdeals?[^.]*damage to (?:any target|target (?:creature|permanent))|(?:owner of target permanent|target permanent.s owner)[^.]*shuffles?[^.]*library/i.test(
        directEffect,
      )
    )
      result.removal.push({
        ...fact,
        // Removal is performed by its controller unless an opponent is named as the actor.
        controller: fact.controller === "unknown" ? "you" : fact.controller,
        permanentTypes: cardTypesIn(directEffect),
        targetRestrictions: [directEffect],
      });
    const reduction = semantic.match(
      /\b([^.;]*?spells?[^.;]*?)\bcost[^.;]*\bless\b/i,
    );
    if (reduction) {
      const creatureTypes = typesIn(reduction[1]);
      result.costReductions.push({
        ...fact,
        creatureTypes,
        restrictions: [reduction[1].trim()],
      });
      roles.add(
        creatureTypes.length ? "tribal_cost_reduction" : "cost_reduction",
      );
      if (creatureTypes.length)
        result.tribalEffects.push({
          ...fact,
          role: "tribal_cost_reduction",
          creatureTypes,
        });
    }
    if (
      /\byou may play (?:an additional|two additional|\d+ additional) lands?\b/i.test(
        line,
      )
    )
      roles.add("land_ramp");

    const condition =
      stripAbilityWord(semantic).match(/^(?:When|Whenever)\b([^,]+),/i)?.[1] ||
      "";
    if (/\btokens?\b/i.test(condition)) {
      roles.add("token_payoff");
      if (/\b(?:sacrifice|sacrificed)\b/i.test(condition))
        roles.add("token_sacrifice_payoff");
    }
    const tribalTypes = typesIn(condition);
    if (tribalTypes.length) {
      const triggeredRoles: TribalRole[] = [];
      if (/\benter(?:s|ed)?\b/i.test(condition))
        triggeredRoles.push("tribal_etb_payoff");
      if (/\bcast(?:s)?\b/i.test(condition))
        triggeredRoles.push("tribal_cast_payoff");
      if (/\battack(?:s|ed)?\b/i.test(condition))
        triggeredRoles.push("tribal_attack_payoff");
      if (/\b(?:dies?|died)\b/i.test(condition))
        triggeredRoles.push("tribal_death_payoff");
      if (/\btokens?\b/i.test(condition))
        triggeredRoles.push("tribal_token_payoff");
      if (/\bdraw\b/i.test(directEffect))
        triggeredRoles.push("tribal_card_draw");
      for (const role of triggeredRoles) {
        roles.add(role);
        result.tribalEffects.push({
          ...fact,
          role,
          creatureTypes: tribalTypes,
        });
      }
    }
    const lord = semantic.match(
      /([^.;]*?)\bcreatures? you control\b[^.;]*\b(?:get|have|gain)\b/i,
    );
    const lordTypes = lord ? typesIn(lord[1]) : [];
    if (lordTypes.length) {
      roles.add("tribal_lord");
      result.tribalEffects.push({
        ...fact,
        role: "tribal_lord",
        creatureTypes: lordTypes,
      });
    }
    const returning = semantic.match(
      /\breturn\b([^.;]+)\bfrom (?:your|a) graveyard\b/i,
    );
    const returnTypes = returning ? typesIn(returning[1]) : [];
    if (returnTypes.length) {
      roles.add("tribal_recursion");
      result.tribalEffects.push({
        ...fact,
        role: "tribal_recursion",
        creatureTypes: returnTypes,
      });
    }
  }
  if (face.oracleText === undefined)
    result.uncertainties.push(
      "Oracle text unavailable; effects are not inferred from tags or name.",
    );
  if (face.keywords?.some((k) => /choose a background|partner/i.test(k)))
    result.uncertainties.push(
      "Multiple-Commander ability requires separate Commander evaluation.",
    );
  result.typedRoles = [...roles].sort();
  return result;
}
export function extractCardFacts(
  card: CardMetadata & { colors?: Color[] },
): CardFacts {
  const faces = card.cardFaces?.length
    ? card.cardFaces.map((face) => faceFacts(face))
    : [faceFacts(card)];
  return {
    version: CARD_FACTS_VERSION,
    name: card.name,
    manaValue: card.manaValue,
    colors: card.colors ? [...card.colors] : undefined,
    colorIdentity: [...card.colorIdentity],
    faces,
    typedRoles: unique(faces.flatMap((face) => face.typedRoles)).sort(),
    uncertainties: unique(faces.flatMap((face) => face.uncertainties)),
  };
}
/** Creature-type membership is factual; this does not claim any Commander trigger. */
export function hasCreatureType(face: CardFaceFacts, type: string): boolean {
  return (
    !!canonicalCreatureType(type) &&
    (face.hasChangeling ||
      face.creatureTypes.some(
        (own) => own.toLowerCase() === type.toLowerCase(),
      ))
  );
}
// Opponent life loss ("pings"): does this card make opponents lose life or take damage, and can it do so on their turns?
// "You lose N life" is a cost, never a source. Damage to "any target" can reach a player but is weaker evidence.
const lifeLossVictim = String.raw`(?:each opponent|each player|each other player|target opponent|target player|that player|defending player|its controller|that creature's controller|the chosen player|that opponent|an opponent)`;
const directLifeLoss = new RegExp(
  String.raw`\b${lifeLossVictim} (?:loses?|lose) (?:\d+|x|that much|half|one|two|three|life)|\bdeals?\b[^.\n]{0,70}\bdamage\b[^.\n]{0,50}\bto ${lifeLossVictim}`,
  "i",
);
const theirTurnLifeLoss =
  /whenever (?:a player|an opponent|each opponent|a creature[^,]{0,40}(?:an opponent|a player))[^.]{0,140}(?:damage|loses? \w+ life)|at the beginning of (?:each opponent's|each player's) (?:upkeep|draw step|end step)[^.]{0,120}(?:damage|loses? \w+ life)|unless (?:that player|they) (?:sacrifices?|pays?|discards?)/i;
export function opponentLifeLoss(text: string): { direct: boolean; theirTurn: boolean; anyTarget: boolean } {
  const clean = stripReminderText(text);
  const direct = directLifeLoss.test(clean);
  const anyTarget = /\bdeals?\b[^.\n]{0,70}\bdamage\b[^.\n]{0,50}\bto any (?:other )?target/i.test(clean);
  // A punisher trigger fires on opponents' turns, so even "any target" damage there usually hits that opponent.
  return { direct, theirTurn: (direct || anyTarget) && theirTurnLifeLoss.test(clean), anyTarget };
}
