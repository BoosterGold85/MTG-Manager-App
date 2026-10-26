import { stripAbilityWord, stripReminderText } from "../utils/rulesText";
import type { CardMetadata } from "../models/collection";
import type { Color } from "../models/card";
import {
  creatureTypePatterns,
  canonicalCreatureType,
} from "../intelligence/subtypes";

export const CARD_FACTS_VERSION = "1.0.0";
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
export type TypedRole = TutorRole | TokenRole | RampRole | TribalRole;
export interface FactEvidence {
  face: string;
  text: string;
  conditional: boolean;
  controller: "you" | "opponent" | "any" | "unknown";
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
function evidence(face: string, text: string): FactEvidence {
  const effect = text.replace(/^\s*(?:When(?:ever)?|If)\b[^,]*,\s*/i, "");
  return {
    face,
    text: text.trim(),
    conditional:
      /\b(?:if|may|unless|only|whenever|when|at the beginning|as long as)\b/i.test(
        text,
      ),
    controller:
      /\bspells? (?:your )?opponents? cast\b|\b(?:target|each|an?) opponent (?:creates?|searches?|draws?|adds?)\b/i.test(
        effect,
      )
        ? "opponent"
        : /\b(?:target|each|a) player\b/i.test(effect)
          ? "any"
          : /\byou\b|^(?:create|search|add|draw|\{[^}]+\}[^:]*:)/i.test(
                effect.trim(),
              )
            ? "you"
            : "unknown",
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
    triggers: [],
    staticEffects: [],
    typedRoles: [],
    uncertainties: [],
  };
  const roles = new Set<TypedRole>();
  if (hasChangeling) roles.add("changeling");
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
    if (
      /\bwould (?:create|be created)\b[^.]*\btokens?\b[^.]*(?:twice|double|three times|instead)/i.test(
        line,
      ) ||
      /\btokens? would be created\b[^.]*\b(?:twice|instead)/i.test(line)
    )
      roles.add("token_doubler");
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
