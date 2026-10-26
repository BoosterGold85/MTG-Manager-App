import { stripAbilityWord, stripReminderText } from "../utils/rulesText";
import type { RecommendationData } from "../synergy/recommendation";
import type { CardMetadata } from "../models/collection";
import type { DnaInput, DnaInputCard } from "./engine";
import type { Evidence } from "../intelligence/types";
import { tagDefinition } from "../intelligence/taxonomy";
import { creatureTypePatterns } from "../intelligence/subtypes";
import { cardKeywords, oracleText } from "../utils/cardKeywords";

export const SYNERGY_VERSION = "0.6.5";
export type Role =
  | "ramp"
  | "cardAdvantage"
  | "removal"
  | "boardWipes"
  | "protection"
  | "graveyardHate"
  | "tutors"
  | "recursion"
  | "finishers"
  | "lands"
  | "manaFixing"
  | "tokenGeneration"
  | "sacrificeOutlet"
  | "payoff"
  | "enabler";
export interface WeightedTag {
  tag: string;
  label: string;
  weight: number;
  evidence: Evidence[];
}
export interface RoleNeed {
  count: number;
  target: number;
  deficit: number;
  need: "HIGH" | "MEDIUM" | "LOW" | "NONE";
}
export type DeckRoleNeeds = Record<Role, RoleNeed>;
export interface ManaCurveProfile {
  buckets: Record<number, number>;
  nonlands: number;
  average: number;
  commanderCost: number;
  rampCount: number;
  coloredPips: Record<string, number>;
}
export interface CommanderSynergyTag {
  controller?: "you" | "opponent";
  commander: string;
  event: string;
  objects: string[];
  creatureTypes: string[];
  nontoken: boolean;
  noncreature: boolean;
  requiredKeywords: string[];
  selfOnly: boolean;
  damageAmount?: number;
  evidence: Evidence;
}
export interface SynergyPackage extends WeightedTag {
  members: string[];
}
interface Characteristics {
  card: DnaInputCard;
  features: Map<string, number>;
  roles: Set<Role>;
  types: string[];
  text: string;
  receivers: CommanderSynergyTag[];
  emits: Set<string>;
  quality: number;
  repeatable: boolean;
  effects: number;
}
export interface DeckStrategyProfile {
  version: string;
  revision: string;
  commanders: CardMetadata[];
  colorIdentity: string[];
  primaryArchetypes: WeightedTag[];
  secondaryArchetypes: WeightedTag[];
  commanderMechanics: WeightedTag[];
  commanderSynergyTags: CommanderSynergyTag[];
  creatureTypes: WeightedTag[];
  mechanicalThemes: WeightedTag[];
  roleNeeds: DeckRoleNeeds;
  manaCurve: ManaCurveProfile;
  cardTypeDistribution: Record<string, number>;
  synergyPackages: SynergyPackage[];
  powerBaseline: number;
  tribalDensity: number;
  primaryCreatureType?: string;
  // Internal immutable inputs, not persisted or exported with collection data.
  cards: Characteristics[];
}
export interface SynergyScoreDebug {
  cardId: string;
  version: string;
  profileRevision: string;
  commanderSynergy: number;
  archetypeFit: number;
  roleNeed: number;
  packageMatch: number;
  cardQuality: number;
  genericOverlap: number;
  curveFit: number;
  penalties: { name: string; value: number; reason: string }[];
  matchedTags: string[];
  commanderInteractions: string[];
  packageInteractions: string[];
  componentReasons: { label: string; reason: string }[];
  rawScore: number;
  finalScore: number;
}
export interface StrategyScore {
  recommendation?: RecommendationData;
  score: number;
  band: string;
  tier: "Recommended" | "Worth Considering" | "Other Legal Cards";
  components: { label: string; points: number }[];
  debug: SynergyScoreDebug;
  roles: string[];
  reasons: string[];
  conflicts: string[];
  explanation: string;
}
const roleTags: Record<Role, string[]> = {
  ramp: [
    "ramp",
    "mana-dork",
    "mana-rock",
    "cost-reduction",
    "extra-land-drops",
  ],
  cardAdvantage: ["card-draw", "impulse-draw", "looting"],
  removal: [
    "removal",
    "creature-removal",
    "permanent-removal",
    "artifact-enchantment-removal",
    "counterspell",
  ],
  boardWipes: ["board-wipe"],
  protection: ["protection", "hexproof-ward"],
  graveyardHate: ["graveyard-hate"],
  tutors: ["tutor"],
  recursion: ["recursion", "reanimator", "land-recursion"],
  finishers: ["extra-combat", "go-tall"],
  lands: [],
  manaFixing: ["mana-fixing"],
  tokenGeneration: ["tokens"],
  sacrificeOutlet: ["sacrifice-outlet"],
  payoff: [],
  enabler: [],
};
const labels: Record<string, string> = {
  spells: "Spellslinger",
  clones: "Clones / Copies",
  discard: "Discard / Mayhem",
  tokens: "Tokens",
  sacrifice: "Aristocrats / Sacrifice",
  graveyard: "Graveyard / Reanimator",
  lands: "Landfall / Lands",
  counters: "+1/+1 Counters",
  voltron: "Equipment / Auras",
  artifacts: "Artifacts",
  enchantments: "Enchantress",
  blink: "Creature ETB / Blink",
  lifegain: "Lifegain",
  treasure: "Treasure",
  combat: "Attack / Combat Engines",
  drawEngine: "Draw Engines",
  damage: "Damage Engines",
  goodstuff: "Efficient Flexible Utility",
};
const featureTags: Record<string, string[]> = {
  spells: ["spellslinger", "instants-sorceries", "copy-spells"],
  clones: ["clones", "copy-creature-spells"],
  discard: ["mayhem", "madness", "discard-payoff"],
  tokens: ["tokens", "token-payoff", "populate", "go-wide"],
  sacrifice: [
    "aristocrats",
    "sacrifice-payoff",
    "sacrifice-outlet",
    "sacrifice-fodder",
    "death-triggers",
  ],
  graveyard: [
    "reanimator",
    "recursion",
    "self-mill",
    "graveyard-payoff",
    "land-recursion",
  ],
  lands: ["landfall", "lands-matter", "extra-land-drops", "land-recursion"],
  counters: ["plus-counters", "counter-payoff", "proliferate"],
  voltron: ["voltron", "equipment", "auras", "go-tall"],
  artifacts: ["artifacts"],
  enchantments: ["enchantments"],
  blink: ["blink"],
  lifegain: ["lifegain", "lifegain-payoff"],
  treasure: ["treasure"],
  combat: ["extra-combat", "attack-triggers", "combat-damage-triggers"],
  drawEngine: [],
  damage: [],
};
const objects = [
  "Creature",
  "Artifact",
  "Enchantment",
  "Equipment",
  "Aura",
  "Instant",
  "Sorcery",
  "Land",
  "Token",
  "Counter",
];
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};
const evidence = (snippet: string, reason: string): Evidence => ({
  field: "oracleText",
  snippet,
  reason,
});
const label = (id: string) =>
  id.startsWith("typal:") ? `${id.slice(6)} Typal` : labels[id] || id;
function receivers(c: DnaInputCard): CommanderSynergyTag[] {
  const result: CommanderSynergyTag[] = [];
  for (const clause of stripReminderText(oracleText(c.card))
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (!/\b(?:whenever|when|at the beginning)\b/i.test(clause)) continue;
    const trigger = stripAbilityWord(clause).split(",")[0];
    // Keep the Commander's own abilities, but never let another card masquerade as their subject.
    const selfOnly =
      (/^(?:when|whenever) this (?:creature|permanent|artifact|enchantment)/i.test(
        trigger,
      ) ||
        ["when ", "whenever "].some((prefix) =>
          trigger.toLowerCase().startsWith(prefix + c.card.name.toLowerCase()),
        )) &&
      !/\bor another\b/i.test(trigger);
    const event = /\bcasts?\b/i.test(trigger)
      ? "cast"
      : /\benter(?:s|ed)?\b/i.test(trigger)
        ? "enters"
        : /\bdie(?:s)?\b/i.test(trigger)
          ? "dies"
          : /combat damage/i.test(trigger)
            ? "combat-damage"
            : /\battack(?:s)?\b/i.test(trigger)
              ? "attacks"
              : /\bsacrific/i.test(trigger)
                ? "sacrifice"
                : /\bgain.*life/i.test(trigger)
                  ? "lifegain"
                  : /\bdraws?\b/i.test(trigger)
                    ? "draw"
                    : /\bcounters?\b/i.test(trigger) &&
                        /put|place|remove|proliferat/i.test(trigger)
                      ? "counters"
                      : /counter(?:s|ed)? (?:a |an? |target )?(?:spell|ability)/i.test(
                            trigger,
                          )
                        ? "counterspell"
                        : /deals?[^,]{0,50}damage/i.test(trigger)
                          ? "damage"
                          : /graveyard/i.test(trigger)
                            ? "graveyard"
                            : "turn";
    const types = c.analysis.creatureTypes.synergy.filter((type) =>
      creatureTypePatterns
        .find((p) => p.type === type)
        ?.reference.test(trigger),
    );
    result.push({
      commander: c.card.name,
      controller:
        /\b(?:an?|each|your) opponents? (?:casts?|sacrifices?|draws?|gains?|creates?|controls?)\b|under (?:an? |your )?opponent(?:['’]s|s['’]?)? control/i.test(
          trigger,
        )
          ? "opponent"
          : "you",
      event,
      objects: objects.filter((o) =>
        new RegExp(`\\b${o}(?:s)?\\b`, "i").test(trigger),
      ),
      creatureTypes: types,
      selfOnly,
      damageAmount: /deals? (?:exactly )?(\d+) damage/i.exec(trigger)
        ? Number(/deals? (?:exactly )?(\d+) damage/i.exec(trigger)![1])
        : undefined,
      nontoken: /nontoken/i.test(trigger),
      noncreature: /noncreature/i.test(trigger),
      requiredKeywords: ["flying", "haste", "trample", "defender"].filter(
        (keyword) => new RegExp(`with ${keyword}`, "i").test(trigger),
      ),
      evidence: evidence(
        clause,
        "Explicit triggered ability and its referenced objects.",
      ),
    });
  }
  return result;
}
function characteristics(c: DnaInputCard): Characteristics {
  const fields = [
    "name",
    "scryfallId",
    "oracleId",
    "manaValue",
    "manaCost",
    "typeLine",
    "oracleText",
    "colorIdentity",
    "colors",
    "keywords",
    "cardFaces",
    "power",
    "toughness",
    "loyalty",
    "layout",
    "producedMana",
    "imageUrl",
    "thumbnailUrl",
    "setCode",
    "setName",
    "collectorNumber",
    "rarity",
    "artist",
    "aliases",
    "printedLanguage",
  ] as const;
  c = {
    ...c,
    card: Object.fromEntries(
      fields.filter((k) => c.card[k] !== undefined).map((k) => [k, c.card[k]]),
    ) as CardMetadata,
  };

  const tags = new Set(c.assignments.map((a) => a.tagId)),
    text = stripReminderText(oracleText(c.card)),
    types = cardKeywords(c.card).some((k) => k.toLowerCase() === "changeling")
      ? creatureTypePatterns.map((p) => p.type)
      : c.analysis.creatureTypes.own;
  const features = new Map<string, number>();
  for (const [id, ids] of Object.entries(featureTags))
    if (ids.some((t) => tags.has(t))) features.set(id, 1);
  for (const type of types) features.set(`typal:${type}`, 0.85);
  for (const a of c.assignments)
    if (a.tagId.startsWith("typal:")) features.set(a.tagId, 1);
  const own = c.card.typeLine.split("—")[0];
  if (/\b(?:Instant|Sorcery)\b/.test(own))
    features.set("spells", Math.max(0.85, features.get("spells") || 0));
  if (/\bArtifact\b/.test(own))
    features.set("artifacts", Math.max(0.85, features.get("artifacts") || 0));
  if (/\bEnchantment\b/.test(own))
    features.set(
      "enchantments",
      Math.max(0.85, features.get("enchantments") || 0),
    );
  if (/\b(?:Equipment|Aura)\b/.test(c.card.typeLine))
    features.set("voltron", 1);
  if (/\bLand\b/.test(own)) features.set("lands", 0.85);
  if (tags.has("etb") && /\bCreature\b/.test(own)) features.set("blink", 0.9);
  if (tags.has("card-draw") || tags.has("impulse-draw"))
    features.set("drawEngine", 0.85);
  const rs = receivers(c);
  for (const r of rs) if (r.event === "draw") features.set("drawEngine", 1);
  const roles = new Set<Role>();
  if (rs.some((r) => !r.selfOnly && r.event !== "turn")) roles.add("payoff");
  if (
    /trigger[^.\n]{0,110}(?:additional time|twice)|copy target triggered ability/i.test(
      text,
    )
  )
    roles.add("enabler");
  for (const [role, ids] of Object.entries(roleTags))
    if (ids.some((t) => tags.has(t))) roles.add(role as Role);
  if (/\bLand\b/.test(own)) roles.add("lands");
  if (c.assignments.some((a) => tagDefinition(a.tagId)?.category === "payoff"))
    roles.add("payoff");
  if (c.assignments.some((a) => tagDefinition(a.tagId)?.category === "enabler"))
    roles.add("enabler");
  if (
    /\bCreature\b/.test(own) &&
    c.card.manaValue >= 5 &&
    (/flying|trample|double strike/i.test(cardKeywords(c.card).join(" ")) ||
      features.size > 1)
  )
    roles.add("finishers");
  const emits = new Set(
    objects
      .filter((o) => new RegExp(`\\b${o}\\b`, "i").test(own))
      .map((o) => o.toLowerCase()),
  );
  for (const type of types) emits.add(`typal:${type}`);
  if (/\bEquipment\b/.test(c.card.typeLine)) emits.add("equipment");
  if (/\bAura\b/.test(c.card.typeLine)) emits.add("aura");
  if (
    tags.has("extra-land-drops") ||
    /search[^.\n]{0,120}land[^.\n]{0,150}(?:put|onto)[^.\n]{0,35}battlefield/i.test(
      text,
    )
  )
    emits.add("land");
  if (tags.has("tokens")) {
    emits.add("token");
    emits.add("creature");
    for (const type of c.analysis.creatureTypes.referenced)
      if (
        new RegExp(
          `create[^.\\n]{0,130}\\b${type}\\b[^.\\n]{0,35}token`,
          "i",
        ).test(text)
      ) {
        emits.add(`typal:${type}`);
        features.set(
          `typal:${type}`,
          Math.max(0.8, features.get(`typal:${type}`) || 0),
        );
      }
  }
  if (tags.has("treasure")) {
    emits.add("token");
    emits.add("artifact");
  }
  const effectText = text
    .split(/[.\n]/)
    .map((clause) =>
      /^(?:when|whenever|at the beginning)/i.test(clause.trim())
        ? clause.slice(clause.indexOf(",") + 1)
        : clause,
    )
    .join(".");
  if (/deals?[^.\n]{0,80}damage/i.test(effectText)) {
    emits.add("damage");
    features.set("damage", Math.max(0.85, features.get("damage") || 0));
  }
  if (tags.has("counterspell")) emits.add("counterspell");
  if (roles.has("cardAdvantage")) emits.add("draw");
  if (tags.has("lifegain")) emits.add("lifegain");
  if (tags.has("plus-counters") || tags.has("proliferate"))
    emits.add("counters");
  if (roles.has("sacrificeOutlet") || tags.has("sacrifice-fodder")) {
    emits.add("sacrifice");
    emits.add("dies");
  }
  if (tags.has("self-mill") || roles.has("recursion")) emits.add("graveyard");
  const effects = c.assignments.filter(
    (a) =>
      !["strategy", "mechanic"].includes(
        tagDefinition(a.tagId)?.category || "",
      ),
  ).length;
  const repeatable =
    /\bwhenever\b|at the beginning|would[^.\n]{0,100}instead/i.test(text) ||
    (/Creature|Artifact|Enchantment|Planeswalker/.test(own) &&
      /^[^.\n]{1,100}:/m.test(text) &&
      !/discard this card|sacrifice this (?:creature|artifact|permanent)/i.test(
        text,
      ));
  const mana = c.card.manaValue;
  // Transparent local efficiency proxy, never price, rarity, popularity or a universal power rating.
  let quality = text ? 3 : 0;
  if (text && mana <= 2) quality += 2;
  else if (text && mana <= 4) quality++;
  if (repeatable) quality += 2;
  if (effects >= 2) quality++;
  if (
    /trigger[^.\n]{0,110}(?:additional time|twice)|copy target triggered ability/i.test(
      text,
    )
  )
    quality += 3;

  if (
    cardKeywords(c.card).some((k) =>
      /^(?:indestructible|hexproof|ward)$/i.test(k),
    )
  )
    quality++;
  if (/\bInstant\b/.test(own) || /choose (?:one|two)|choose up to/i.test(text))
    quality++;
  if (/draw (?:two|three|four|[2-9]) cards|add (?:\{[^}]+\}){2,}/i.test(text))
    quality++;
  const power = Number(c.card.power);
  if (
    Number.isFinite(power) &&
    power > 0 &&
    power >= Math.max(3, mana) &&
    /flying|trample|haste|double strike/i.test(cardKeywords(c.card).join(" "))
  )
    quality++;
  return {
    card: c,
    features,
    roles,
    types,
    text,
    receivers: rs,
    emits,
    quality: Math.min(10, quality),
    repeatable,
    effects,
  };
}
function interaction(
  receiver: CommanderSynergyTag,
  source: Characteristics,
): number {
  if (receiver.event === "turn" || receiver.selfOnly) return 0;
  if (
    receiver.event === "damage" &&
    receiver.damageAmount !== undefined &&
    !new RegExp(`deals? ${receiver.damageAmount} damage`, "i").test(source.text)
  )
    return 0;
  if (receiver.event === "combat-damage")
    return source.emits.has("creature") &&
      (!receiver.creatureTypes.length ||
        receiver.creatureTypes.some((t) => source.types.includes(t)))
      ? 0.8
      : 0;
  const own = source.card.card.typeLine.split("—")[0];
  if (/\bToken\b/.test(own) && (receiver.nontoken || receiver.event === "cast"))
    return 0;
  if (
    receiver.requiredKeywords.some(
      (keyword) =>
        !cardKeywords(source.card.card).some(
          (k) => k.toLowerCase() === keyword,
        ) &&
        !(
          source.emits.has("token") &&
          new RegExp(`token[^.\n]{0,50}${keyword}`, "i").test(source.text)
        ),
    )
  )
    return 0;
  const matchesType = receiver.creatureTypes.some((type) =>
    source.types.includes(type),
  );
  if (receiver.noncreature && /\bCreature\b/.test(own) && !matchesType)
    return 0;
  if (
    receiver.noncreature &&
    !/\bCreature\b/.test(own) &&
    receiver.event === "cast"
  )
    return 1;
  if (receiver.event === "cast") {
    if (receiver.creatureTypes.length)
      return receiver.creatureTypes.some((t) => source.types.includes(t))
        ? 1
        : 0;
    if (receiver.objects.length)
      return receiver.objects.some((o) =>
        new RegExp(`\\b${o}\\b`, "i").test(own),
      )
        ? 1
        : 0;
    return 0.25; // Unqualified spell overlap is intentionally weak.
  }
  if (["enters", "attacks"].includes(receiver.event)) {
    if (receiver.creatureTypes.length) {
      if (source.types.some((t) => receiver.creatureTypes.includes(t)))
        return 1;
      return !receiver.nontoken &&
        receiver.event === "enters" &&
        receiver.creatureTypes.some((t) => source.emits.has(`typal:${t}`))
        ? 0.9
        : 0;
    }
    if (receiver.objects.length) {
      const hits = receiver.objects.filter(
        (o) => o !== "Token" && o !== "Counter",
      );
      if (receiver.objects.includes("Token") && !source.emits.has("token"))
        return 0;
      if (
        receiver.nontoken &&
        source.emits.has("token") &&
        !/Creature|Artifact|Enchantment/.test(own)
      )
        return 0;
      return hits.some((o) => source.emits.has(o.toLowerCase())) ||
        (receiver.objects.includes("Token") &&
          source.emits.has("token") &&
          !hits.length)
        ? 0.9
        : 0;
    }
  }
  if (["dies", "sacrifice"].includes(receiver.event)) {
    const anyCreatureOutlet =
      source.roles.has("sacrificeOutlet") &&
      /sacrifice (?:another |a |an? |any number of )?creature/i.test(
        source.text,
      );
    if (
      receiver.creatureTypes.length &&
      !receiver.creatureTypes.some(
        (t) => source.types.includes(t) || source.emits.has(`typal:${t}`),
      ) &&
      !anyCreatureOutlet
    )
      return 0;
    return source.emits.has("sacrifice") || source.emits.has("dies")
      ? 1
      : source.emits.has("token")
        ? 0.8
        : source.emits.has("creature")
          ? 0.25
          : 0;
  }
  return source.emits.has(receiver.event) ? 1 : 0;
}
export function buildDeckStrategyProfile(input: DnaInput): DeckStrategyProfile {
  const start = performance.now(),
    cards = input.cards.map(characteristics),
    main = cards.filter((c) => !c.card.commander),
    commanders = cards.filter((c) => c.card.commander);
  const total = main.reduce((n, c) => n + c.card.quantity, 0),
    creatures = main.filter((c) => /\bCreature\b/.test(c.card.card.typeLine));
  const creatureTotal = creatures.reduce((n, c) => n + c.card.quantity, 0);
  const typeCounts = new Map<string, number>();
  for (const c of creatures)
    for (const type of c.types)
      typeCounts.set(type, (typeCounts.get(type) || 0) + c.card.quantity);
  const typeWeights = [...typeCounts]
    .map(([type, n]) => ({
      tag: `typal:${type}`,
      label: `${type} Typal`,
      weight: creatureTotal ? n / creatureTotal : 0,
      evidence: [] as Evidence[],
    }))
    .sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag));
  const keys = new Set(cards.flatMap((c) => [...c.features.keys()]));
  const weighted: WeightedTag[] = [];
  for (const key of keys) {
    const contributors = main.filter((c) => (c.features.get(key) || 0) > 0),
      command = commanders.filter((c) => (c.features.get(key) || 0) > 0);
    const direct = command.some(
      (c) =>
        c.card.assignments.some(
          (a) => a.tagId === key || featureTags[key]?.includes(a.tagId),
        ) ||
        c.receivers.some(
          (r) =>
            r.creatureTypes.some((t) => key === `typal:${t}`) ||
            (key === "blink" &&
              r.event === "enters" &&
              r.objects.includes("Creature")) ||
            (key === "drawEngine" && r.event === "draw") ||
            (key === "damage" && r.event === "damage") ||
            (key === "spells" && r.event === "counterspell"),
        ),
    );
    if (
      key.startsWith("typal:") &&
      !cards.some((c) => c.card.assignments.some((a) => a.tagId === key))
    )
      continue;
    const count = contributors.reduce(
      (n, c) => n + c.card.quantity * (c.features.get(key) || 0),
      0,
    );
    const density = key.startsWith("typal:")
      ? typeWeights.find((t) => t.tag === key)?.weight || 0
      : count / Math.max(1, total);
    const explicitMain = contributors.filter((c) =>
      c.card.assignments.some(
        (a) => a.tagId === key || featureTags[key]?.includes(a.tagId),
      ),
    );
    // An isolated self ETB is not a blink strategy; incidental attack tags do not dominate typal identity.
    if (
      key === "blink" &&
      !cards.some(
        (c) =>
          c.card.assignments.some((a) => a.tagId === "blink") ||
          c.receivers.some(
            (r) =>
              r.event === "enters" &&
              r.objects.includes("Creature") &&
              !r.selfOnly,
          ),
      )
    )
      continue;
    if (
      key === "drawEngine" &&
      !cards.some((c) => c.receivers.some((r) => r.event === "draw"))
    )
      continue;
    if (contributors.length < 2 && !direct) continue;
    const commanderWeight = direct ? 1 : command.length ? 0.55 : 0;
    const deckWeight =
      Math.min(1, density * 2.5) * (explicitMain.length ? 1 : 0.8);
    const weight = Math.min(
      1,
      commanderWeight * 0.6 +
        deckWeight * 0.4 +
        (contributors.length >= 3 ? 0.15 : 0),
    );
    if (weight < 0.18) continue;
    weighted.push({
      tag: key,
      label: label(key),
      weight,
      evidence: [...command, ...explicitMain]
        .slice(0, 6)
        .map((c) =>
          evidence(
            c.text || c.card.card.typeLine,
            `${c.card.card.name} supports this strategy${c.card.commander ? " as Commander" : ""}.`,
          ),
        ),
    });
  }
  weighted.sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag));
  const primary = weighted
    .filter((w) => w.weight >= Math.max(0.4, (weighted[0]?.weight || 0) * 0.65))
    .slice(0, 4);
  if (!primary.length && total >= 3)
    primary.push({
      tag: "goodstuff",
      label: labels.goodstuff,
      weight: 0.5,
      evidence: [],
    });
  const secondary = weighted.filter((w) => !primary.includes(w)).slice(0, 8);
  const dominantTribe = typeWeights.find(
    (type) => type.weight > 0.6 && primary.some((p) => p.tag === type.tag),
  );
  const buckets: Record<number, number> = {},
    pips: Record<string, number> = {},
    distribution: Record<string, number> = {};
  let nonlands = 0,
    manaSum = 0;
  for (const c of main) {
    const card = c.card.card,
      q = c.card.quantity;
    for (const type of [
      "Creature",
      "Artifact",
      "Enchantment",
      "Land",
      "Instant",
      "Sorcery",
      "Planeswalker",
      "Battle",
    ])
      if (new RegExp(`\\b${type}\\b`).test(card.typeLine.split("—")[0]))
        distribution[type] = (distribution[type] || 0) + q;
    if (!c.roles.has("lands")) {
      const bucket = Math.min(7, Math.floor(card.manaValue));
      buckets[bucket] = (buckets[bucket] || 0) + q;
      nonlands += q;
      manaSum += card.manaValue * q;
    }
    for (const color of (card.manaCost || "").match(/[WUBRG]/g) || [])
      pips[color] = (pips[color] || 0) + q;
  }
  const targets: Record<Role, number> = {
    ramp:
      manaSum / Math.max(1, nonlands) >= 3.5 ||
      commanders.some((c) => c.card.card.manaValue >= 6)
        ? 12
        : 10,
    cardAdvantage: 10,
    removal: 8,
    boardWipes: 3,
    protection: 4,
    graveyardHate: 2,
    tutors: 2,
    recursion: primary.some((p) => p.tag === "graveyard") ? 10 : 3,
    finishers: 5,
    lands: 36,
    manaFixing:
      new Set(commanders.flatMap((c) => c.card.card.colorIdentity)).size <= 1
        ? 0
        : new Set(commanders.flatMap((c) => c.card.card.colorIdentity)).size ===
            2
          ? 6
          : 8,
    tokenGeneration: primary.some((p) =>
      ["tokens", "sacrifice"].includes(p.tag),
    )
      ? 12
      : 0,
    sacrificeOutlet: primary.some((p) => p.tag === "sacrifice") ? 6 : 0,
    payoff: 10,
    enabler: 10,
  };
  const roleNeeds = {} as DeckRoleNeeds;
  for (const role of Object.keys(targets) as Role[]) {
    const count = main
        .filter((c) => c.roles.has(role))
        .reduce((n, c) => n + c.card.quantity, 0),
      target = total
        ? Math.max(
            targets[role] ? 1 : 0,
            Math.round((targets[role] * total) / 99),
          )
        : 0,
      deficit = target ? Math.max(0, (target - count) / target) : 0;
    roleNeeds[role] = {
      count,
      target,
      deficit,
      need:
        deficit >= 0.5
          ? "HIGH"
          : deficit > 0
            ? "MEDIUM"
            : target && count <= target
              ? "LOW"
              : "NONE",
    };
  }
  const synergyPackages = weighted
    .filter(
      (w) =>
        main.filter((c) => (c.features.get(w.tag) || 0) >= 0.8).length >= 2,
    )
    .map((w) => ({
      ...w,
      members: main
        .filter((c) => (c.features.get(w.tag) || 0) >= 0.8)
        .map((c) => c.card.card.name),
    }));
  const profile: DeckStrategyProfile = {
    version: SYNERGY_VERSION,
    revision: input.revision,
    commanders: commanders.map((c) => c.card.card),
    colorIdentity: [
      ...new Set(commanders.flatMap((c) => c.card.card.colorIdentity)),
    ],
    primaryArchetypes: primary,
    secondaryArchetypes: secondary,
    commanderMechanics: commanders.flatMap((c) => [
      ...c.card.assignments.map((a) => ({
        tag: a.tagId,
        label: tagDefinition(a.tagId)?.label || a.tagId,
        weight: ["strategy", "payoff", "enabler"].includes(
          tagDefinition(a.tagId)?.category || "",
        )
          ? 1
          : 0.5,
        evidence: a.evidence,
      })),
      ...c.receivers.map((r) => ({
        tag: `trigger:${r.event}`,
        label: `${r.event} trigger`,
        weight: 1,
        evidence: [r.evidence],
      })),
      ...cardKeywords(c.card.card).map((keyword) => ({
        tag: `keyword:${keyword}`,
        label: keyword,
        weight: 0.4,
        evidence: [
          {
            field: "keywords",
            snippet: keyword,
            reason: "Canonical Commander keyword.",
          },
        ],
      })),
      ...(/:/i.test(c.text)
        ? [
            {
              tag: "activated-ability",
              label: "Activated ability",
              weight: 0.8,
              evidence: [
                evidence(
                  c.text,
                  "Commander activated ability; costs and referenced objects remain in evidence.",
                ),
              ],
            },
          ]
        : []),
    ]),
    commanderSynergyTags: commanders.flatMap((c) => c.receivers),
    creatureTypes: typeWeights,
    mechanicalThemes: weighted.filter((w) => !w.tag.startsWith("typal:")),
    roleNeeds,
    manaCurve: {
      buckets,
      nonlands,
      average: manaSum / Math.max(1, nonlands),
      commanderCost: Math.max(
        0,
        ...commanders.map((c) => c.card.card.manaValue),
      ),
      rampCount: roleNeeds.ramp.count,
      coloredPips: pips,
    },
    cardTypeDistribution: distribution,
    synergyPackages,
    powerBaseline: median(
      main.filter((c) => !c.roles.has("lands")).map((c) => c.quality),
    ),
    tribalDensity: dominantTribe?.weight || typeWeights[0]?.weight || 0,
    primaryCreatureType: dominantTribe?.tag.slice(6),
    cards,
  };
  performance.measure("mtg:strategy-profile", {
    start,
    end: performance.now(),
  });
  return profile;
}
function staticTypeSupport(
  owner: Characteristics,
  type: string,
  recipient: Characteristics,
): string | undefined {
  const pattern = creatureTypePatterns.find((p) => p.type === type);
  return owner.text
    .split(/[.\n]/)
    .map((clause) => stripAbilityWord(clause.trim()))
    .find((clause) => {
      if (
        /^(?:when|whenever|at the beginning)/i.test(clause) ||
        !pattern?.reference.test(clause)
      )
        return false;
      if (
        /\bToken\b/.test(recipient.card.card.typeLine) &&
        /spells?[^.\n]{0,35}(?:cast|cost)/i.test(clause)
      )
        return false;
      return /\bcost|\bgets?|\bhave|\bgain|\bsearch|\bput/i.test(clause);
    });
}
function amplifiesCommander(
  c: Characteristics,
  cmdr: Characteristics,
): boolean {
  if (
    !/trigger[^.\n]{0,110}(?:additional time|twice)|copy target triggered ability/i.test(
      c.text,
    )
  )
    return false;
  const constrained = c.card.analysis.creatureTypes.synergy;
  if (
    constrained.length &&
    !constrained.some((type) => cmdr.types.includes(type))
  )
    return false;
  const event = /enter(?:s|ing|ed)?/i.test(c.text)
    ? "enters"
    : /cast/i.test(c.text)
      ? "cast"
      : null;
  const object =
    /if an? (artifact|creature|land|enchantment)[^.\n]{0,20}entering/i
      .exec(c.text)?.[1]
      ?.toLowerCase();
  return cmdr.receivers.some(
    (r) =>
      r.event !== "turn" &&
      (!event || r.event === event) &&
      (!object ||
        r.objects.some((o) => o.toLowerCase() === object) ||
        (object === "creature" && r.creatureTypes.length > 0)),
  );
}
export function scoreBand(score: number) {
  return score >= 90
    ? "Exceptional Fit"
    : score >= 80
      ? "Excellent Fit"
      : score >= 70
        ? "Strong Fit"
        : score >= 60
          ? "Reasonable Fit"
          : score >= 50
            ? "Situational"
            : score >= 35
              ? "Weak Fit"
              : "Poor Fit";
}
/** Rules relationships reused by vNext; deliberately excludes family/tag fallback bonuses. */
export function mechanicalRelationships(
  profile: DeckStrategyProfile,
  input: DnaInputCard,
  validate: (receiver: CommanderSynergyTag, source: DnaInputCard) => boolean,
  canonicalize?: (source: DnaInputCard) => {
    events: string[];
    creatureTypes: string[];
    changeling: boolean;
    sacrificeOutlet: boolean;
  },
) {
  const canonical = (card: Characteristics): Characteristics => {
    if (!canonicalize) return card;
    const facts = canonicalize(card.card);
    return {
      ...card,
      emits: new Set(facts.events),
      types: facts.changeling
        ? creatureTypePatterns.map((p) => p.type)
        : facts.creatureTypes,
      roles: new Set<Role>([
        ...[...card.roles].filter((r) => r !== "sacrificeOutlet"),
        ...(facts.sacrificeOutlet ? ["sacrificeOutlet" as Role] : []),
      ]),
    };
  };
  const candidate = canonical(characteristics(input));
  const relationships: {
    identity: string;
    name: string;
    commander: boolean;
    strength: number;
    evidence: string[];
  }[] = [];
  for (const original of profile.cards) {
    const other = canonical(original);
    if (other.card.identity === input.identity) continue;
    let strength = 0;
    const evidence: string[] = [];
    for (const [receiverCard, source] of [
      [other, candidate],
      [candidate, other],
    ] as const) {
      for (const receiver of receiverCard.receivers) {
        if (!validate(receiver, source.card)) continue;
        const value = interaction(receiver, source);
        if (value > 0) {
          strength = Math.max(strength, value);
          evidence.push(
            `${source.card.card.name} → ${receiverCard.card.card.name}: ${receiver.evidence.snippet}`,
          );
        }
      }
    }
    if (other.card.commander) {
      if (amplifiesCommander(candidate, other)) {
        strength = 1;
        evidence.push(
          `Additional triggered abilities for ${other.card.card.name}: ${candidate.text}`,
        );
      }
      if (
        /copy of[^.\n]{0,100}(?:creature|permanent)/i.test(candidate.text) &&
        /(?:isn.t|not) legendary/i.test(candidate.text)
      ) {
        strength = Math.max(strength, 0.8);
        evidence.push(
          `Nonlegendary copy support for ${other.card.card.name}: ${candidate.text}`,
        );
      }
      if (
        /untap (?:target|another|each|all)[^.\n]*(?:creature|permanent)/i.test(
          candidate.text,
        ) &&
        /\{T\}[^.\n]*:/i.test(other.text)
      ) {
        strength = Math.max(strength, 0.8);
        evidence.push(
          `Untap support for ${other.card.card.name}: ${candidate.text}`,
        );
      }
      const blink =
        /exile[^.\n]*(?:creature|permanent)[^.\n]*(?:return|then)[^.\n]*battlefield/i.test(
          candidate.text,
        );
      if (
        blink &&
        other.receivers.some((r) => r.selfOnly && r.event === "enters")
      ) {
        strength = Math.max(strength, 0.9);
        evidence.push(
          `Reuses the Commander’s own ETB ability: ${other.card.card.name}; ${candidate.text}`,
        );
      }
      const combat = other.receivers.some(
        (r) => r.selfOnly && ["attacks", "combat-damage"].includes(r.event),
      );
      if (
        combat &&
        (/Equipment/.test(input.card.typeLine) ||
          /target creature[^.\n]*gains?[^.\n]*(?:haste|double strike|hexproof|indestructible)/i.test(
            candidate.text,
          ))
      ) {
        strength = Math.max(strength, 0.8);
        evidence.push(
          `Supports the Commander’s combat ability: ${other.card.card.name}; ${candidate.text}`,
        );
      }
      for (const [giver, recipient] of [
        [other, candidate],
        [candidate, other],
      ] as const) {
        for (const type of recipient.types) {
          const clause = staticTypeSupport(giver, type, recipient);
          if (!clause) continue;
          const keyword =
            /with (flying|haste|trample|lifelink|vigilance)/i.exec(clause)?.[1];
          if (
            keyword &&
            !cardKeywords(recipient.card.card).some(
              (k) => k.toLowerCase() === keyword.toLowerCase(),
            )
          )
            continue;
          strength = Math.max(strength, 0.8);
          evidence.push(
            `Explicit ${type} support: ${giver.card.card.name} → ${recipient.card.card.name}: ${clause}`,
          );
        }
      }
    }
    if (strength > 0 && evidence.length)
      relationships.push({
        identity: other.card.identity,
        name: other.card.card.name,
        commander: other.card.commander,
        strength,
        evidence,
      });
  }
  return relationships;
}
